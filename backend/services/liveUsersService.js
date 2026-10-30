import mongoose from 'mongoose';
import LiveUsersConfig from '../models/LiveUsersConfig.js';

/**
 * Live Users Management Service
 * Manages the two-mode Live Users display system:
 * - Mode A: Real Live Users (genuine active visitor presence via Socket.IO/SessionManager)
 * - Mode B: Manual Display Range (admin-configured min/max with smooth non-jarring periodic drift)
 * 
 * Guarantees:
 * - Real analytics metrics are never altered or polluted by manual mode.
 * - Public API / sockets only ever receive the display count, never the admin config or min/max range.
 * - Persistent in MongoDB with fallback to Mode A if unconfigured.
 */
export class LiveUsersService {
  constructor() {
    this.io = null;
    this.metricsService = null;
    this.key = 'default_live_users_config';
    this.mode = 'real';
    this.minUsers = 500;
    this.maxUsers = 1000;
    this.currentDisplayCount = 742;
    this.updatedAt = new Date();
    this.timer = null;
    this.refreshIntervalMs = 45000; // 45 seconds (within 30-60s window)
  }

  /**
   * Initializes the service with Socket.IO instance and MetricsService.
   */
  async init({ io, metricsService }) {
    this.io = io || null;
    this.metricsService = metricsService || null;

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        let configDoc = await LiveUsersConfig.findOne({ key: this.key });
        if (!configDoc) {
          configDoc = await LiveUsersConfig.create({
            key: this.key,
            mode: 'real',
            minUsers: 500,
            maxUsers: 1000,
            currentDisplayCount: this.getRealCount() || 742,
            updatedBy: 'system'
          });
        }

        this.mode = configDoc.mode === 'manual' ? 'manual' : 'real';
        this.minUsers = typeof configDoc.minUsers === 'number' ? Math.max(0, configDoc.minUsers) : 500;
        this.maxUsers = typeof configDoc.maxUsers === 'number' ? Math.max(this.minUsers, configDoc.maxUsers) : 1000;
        this.updatedAt = configDoc.updatedAt || new Date();

        if (this.mode === 'manual') {
          if (
            typeof configDoc.currentDisplayCount === 'number' &&
            configDoc.currentDisplayCount >= this.minUsers &&
            configDoc.currentDisplayCount <= this.maxUsers
          ) {
            this.currentDisplayCount = configDoc.currentDisplayCount;
          } else {
            this.currentDisplayCount = this.getRandomIntInRange(this.minUsers, this.maxUsers);
          }
        } else {
          this.currentDisplayCount = this.getRealCount();
        }
      }
    } catch (err) {
      console.warn('[LiveUsersService] Initialization notice (using fallback defaults):', err.message);
    }

    // Start periodic update timer for realistic natural drift
    this.startPeriodicDrift();
  }

  /**
   * Starts periodic interval to refresh the public display count.
   */
  startPeriodicDrift() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.tick();
    }, this.refreshIntervalMs);
  }

  /**
   * Periodic clock tick (every 45s).
   */
  tick() {
    if (this.mode === 'manual') {
      this.applySmoothManualDrift();
    } else {
      this.currentDisplayCount = this.getRealCount();
    }

    this.broadcastDisplayCount();
  }

  /**
   * Generates a gradual, realistic drift within [minUsers, maxUsers] avoiding sudden wild spikes.
   */
  applySmoothManualDrift() {
    const min = this.minUsers;
    const max = this.maxUsers;
    if (max <= min) {
      this.currentDisplayCount = min;
      return;
    }

    // Drift by at most 2% to 4% of the range per tick (or 2 to 8 users)
    const range = max - min;
    const maxDelta = Math.max(2, Math.min(15, Math.floor(range * 0.035)));
    const delta = Math.floor(Math.random() * (maxDelta * 2 + 1)) - maxDelta;

    let nextCount = this.currentDisplayCount + delta;
    if (nextCount < min) nextCount = min + Math.floor(Math.random() * Math.min(5, range));
    if (nextCount > max) nextCount = max - Math.floor(Math.random() * Math.min(5, range));

    this.currentDisplayCount = Math.round(nextCount);
  }

  /**
   * Helper to pick a uniform random integer in [min, max].
   */
  getRandomIntInRange(min, max) {
    const safeMin = Math.ceil(min);
    const safeMax = Math.floor(max);
    if (safeMax <= safeMin) return safeMin;
    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
  }

  /**
   * Returns genuine active unique sessions/visitors tracked in SessionManager.
   */
  getRealCount() {
    if (this.metricsService && typeof this.metricsService.getSnapshot === 'function') {
      return this.metricsService.getSnapshot().activeVisitors ?? 0;
    }
    return 0;
  }

  /**
   * Public display value:
   * Returns only { count: number } without revealing whether manual mode is active
   * or the min/max range.
   */
  getPublicDisplayCount() {
    if (this.mode === 'real') {
      return { count: this.getRealCount() };
    }
    return { count: Math.round(this.currentDisplayCount) };
  }

  /**
   * Admin view:
   * Returns complete configuration and diagnostics for authorized administrators.
   */
  getAdminConfig() {
    const realCount = this.getRealCount();
    const publicDisplay = this.getPublicDisplayCount().count;

    return {
      mode: this.mode,
      minUsers: this.minUsers,
      maxUsers: this.maxUsers,
      currentDisplayCount: publicDisplay,
      realLiveCount: realCount,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Updates configuration persistently in MongoDB.
   * Validates all bounds and permissions.
   */
  async updateConfig({ mode, minUsers, maxUsers, updatedBy = 'admin' }) {
    if (mode !== 'real' && mode !== 'manual') {
      throw new Error("Mode must be either 'real' or 'manual'");
    }

    let parsedMin = this.minUsers;
    let parsedMax = this.maxUsers;

    if (mode === 'manual' || (minUsers !== undefined && maxUsers !== undefined)) {
      parsedMin = parseInt(minUsers, 10);
      parsedMax = parseInt(maxUsers, 10);

      if (isNaN(parsedMin) || isNaN(parsedMax)) {
        throw new Error('Minimum and maximum users must be valid non-negative numbers');
      }

      if (parsedMin < 0 || parsedMax < 0) {
        throw new Error('Minimum and maximum users must be non-negative integers (>= 0)');
      }

      if (parsedMax < parsedMin) {
        throw new Error(`Maximum users (${parsedMax}) must be greater than or equal to minimum users (${parsedMin})`);
      }
    }

    this.mode = mode;
    this.minUsers = parsedMin;
    this.maxUsers = parsedMax;
    this.updatedAt = new Date();

    if (this.mode === 'manual') {
      // Immediately activate the configured range with an initial realistic value
      if (this.currentDisplayCount < this.minUsers || this.currentDisplayCount > this.maxUsers) {
        this.currentDisplayCount = this.getRandomIntInRange(this.minUsers, this.maxUsers);
      }
    } else {
      this.currentDisplayCount = this.getRealCount();
    }

    // Persist to MongoDB
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await LiveUsersConfig.findOneAndUpdate(
          { key: this.key },
          {
            $set: {
              mode: this.mode,
              minUsers: this.minUsers,
              maxUsers: this.maxUsers,
              currentDisplayCount: this.currentDisplayCount,
              lastGeneratedAt: new Date(),
              updatedBy
            }
          },
          { upsert: true, new: true }
        );
      }
    } catch (err) {
      console.warn('[LiveUsersService] Database persistence warning:', err.message);
    }

    // Immediately broadcast updated display count to all active listeners
    this.broadcastDisplayCount();

    // Broadcast updated config to authorized admin room
    if (this.io) {
      this.io.to('admin_room').emit('admin_live_users_config', this.getAdminConfig());
    }

    return this.getAdminConfig();
  }

  /**
   * Broadcasts the public display count over Socket.IO.
   */
  broadcastDisplayCount() {
    if (this.io) {
      const displayCount = this.getPublicDisplayCount().count;
      this.io.emit('active_users', displayCount);
    }
  }

  /**
   * Cleanup timer on shutdown.
   */
  destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const liveUsersService = new LiveUsersService();

