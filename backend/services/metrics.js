// In-Memory Live Metrics & Diagnostics Service with Persistent Cumulative Lifetime Baseline
// and Session-Aware Visitor Deduplication
import SystemMetric from '../models/SystemMetric.js';

export class VisitorSessionManager {
  constructor(options = {}) {
    this.inactivityTimeoutMs = options.inactivityTimeoutMs || 60000; // 60s of complete inactivity = expired
    this.disconnectGraceMs = options.disconnectGraceMs || 25000; // 25s grace period for reloads/reconnects
    this.authenticatedUsers = new Map(); // userId string -> session record
    this.anonymousSessions = new Map(); // sessionId string -> session record
    this.socketMap = new Map(); // socketId -> { type: 'user' | 'anon', id: string, sessionId: string }
  }

  get sessions() {
    // Backwards-compatible combined Map for tests/monitoring inspecting .sessions
    const combined = new Map();
    for (const [uid, record] of this.authenticatedUsers.entries()) {
      combined.set(`user_${uid}`, record);
    }
    for (const [sid, record] of this.anonymousSessions.entries()) {
      combined.set(sid, record);
    }
    return combined;
  }

  get socketToSession() {
    // Backwards-compatible mapping for tests inspecting .socketToSession.size
    const mapping = new Map();
    for (const [sockId, info] of this.socketMap.entries()) {
      mapping.set(sockId, info.sessionId || info.id);
    }
    return mapping;
  }

  registerConnection({ socketId, sessionId, user, ip = 'unknown', userAgent = 'unknown' }) {
    const now = Date.now();
    const effectiveSid = (sessionId && typeof sessionId === 'string' && sessionId.trim()) 
      ? sessionId.trim() 
      : `anon_${socketId}`;

    const userId = user ? (user._id?.toString() || user.userId || user.id || null) : null;

    // If socket was already registered under a different type or ID, clean it up first
    if (this.socketMap.has(socketId)) {
      const prev = this.socketMap.get(socketId);
      if (prev.type === 'user' && prev.id !== userId) {
        const prevUser = this.authenticatedUsers.get(prev.id);
        if (prevUser) {
          prevUser.socketIds.delete(socketId);
          if (prevUser.socketIds.size === 0) {
            this.authenticatedUsers.delete(prev.id);
          }
        }
      } else if (prev.type === 'anon' && (userId || prev.id !== effectiveSid)) {
        const prevAnon = this.anonymousSessions.get(prev.id);
        if (prevAnon) {
          prevAnon.socketIds.delete(socketId);
          if (prevAnon.socketIds.size === 0) {
            this.anonymousSessions.delete(prev.id);
          }
        }
      }
    }

    if (userId) {
      // Authenticated User: Keyed and deduplicated by unique authenticated userId
      let userSession = this.authenticatedUsers.get(userId);
      if (!userSession) {
        userSession = {
          sessionId: effectiveSid,
          userId,
          username: user.username || null,
          role: user.role || 'user',
          isAuthenticated: true,
          socketIds: new Set([socketId]),
          firstSeen: now,
          lastSeen: now,
          ip,
          userAgent
        };
        this.authenticatedUsers.set(userId, userSession);
      } else {
        userSession.socketIds.add(socketId);
        userSession.lastSeen = now;
        userSession.ip = ip;
        if (user.username) userSession.username = user.username;
        if (user.role) userSession.role = user.role;
        userSession.isAuthenticated = true;
      }
      this.socketMap.set(socketId, { type: 'user', id: userId, sessionId: effectiveSid });
      return userSession;
    } else {
      // Anonymous Visitor: Keyed and deduplicated by client sessionId
      let anonSession = this.anonymousSessions.get(effectiveSid);
      if (!anonSession) {
        anonSession = {
          sessionId: effectiveSid,
          userId: null,
          username: null,
          role: 'guest',
          isAuthenticated: false,
          socketIds: new Set([socketId]),
          firstSeen: now,
          lastSeen: now,
          ip,
          userAgent
        };
        this.anonymousSessions.set(effectiveSid, anonSession);
      } else {
        anonSession.socketIds.add(socketId);
        anonSession.lastSeen = now;
        anonSession.ip = ip;
      }
      this.socketMap.set(socketId, { type: 'anon', id: effectiveSid, sessionId: effectiveSid });
      return anonSession;
    }
  }

  handleLogout(socketId, sessionId) {
    const prev = this.socketMap.get(socketId);
    if (prev && prev.type === 'user') {
      const userSession = this.authenticatedUsers.get(prev.id);
      if (userSession) {
        userSession.socketIds.delete(socketId);
        if (userSession.socketIds.size === 0) {
          this.authenticatedUsers.delete(prev.id);
        }
      }
    }
    this.socketMap.delete(socketId);
    return null;
  }

  handleDisconnect(socketId) {
    const info = this.socketMap.get(socketId);
    if (!info) return null;

    this.socketMap.delete(socketId);
    const now = Date.now();

    if (info.type === 'user') {
      const userSession = this.authenticatedUsers.get(info.id);
      if (userSession) {
        userSession.socketIds.delete(socketId);
        userSession.lastSeen = now;
      }
      return info.id;
    } else {
      const anonSession = this.anonymousSessions.get(info.id);
      if (anonSession) {
        anonSession.socketIds.delete(socketId);
        anonSession.lastSeen = now;
      }
      return info.id;
    }
  }

  cleanupStaleSessions(now = Date.now()) {
    // Authenticated users
    for (const [userId, session] of this.authenticatedUsers.entries()) {
      const hasSockets = session.socketIds.size > 0;
      const timeSinceLastSeen = now - session.lastSeen;

      if (!hasSockets && timeSinceLastSeen > this.disconnectGraceMs) {
        this.authenticatedUsers.delete(userId);
      } else if (timeSinceLastSeen > this.inactivityTimeoutMs) {
        for (const sockId of session.socketIds) {
          this.socketMap.delete(sockId);
        }
        this.authenticatedUsers.delete(userId);
      }
    }

    // Anonymous sessions
    for (const [sid, session] of this.anonymousSessions.entries()) {
      const hasSockets = session.socketIds.size > 0;
      const timeSinceLastSeen = now - session.lastSeen;

      if (!hasSockets && timeSinceLastSeen > this.disconnectGraceMs) {
        this.anonymousSessions.delete(sid);
      } else if (timeSinceLastSeen > this.inactivityTimeoutMs) {
        for (const sockId of session.socketIds) {
          this.socketMap.delete(sockId);
        }
        this.anonymousSessions.delete(sid);
      }
    }
  }

  getStats() {
    this.cleanupStaleSessions();

    const authenticatedCount = this.authenticatedUsers.size;
    const anonymousCount = this.anonymousSessions.size;
    const totalCount = authenticatedCount + anonymousCount;

    let adminCount = 0;
    for (const session of this.authenticatedUsers.values()) {
      if (session.role === 'admin') {
        adminCount++;
      }
    }

    return {
      totalUniqueSessions: totalCount,
      authenticatedSessions: authenticatedCount,
      anonymousSessions: anonymousCount,
      adminSessions: adminCount,
      uniqueAuthenticatedUsers: authenticatedCount,
      activeConnections: this.socketMap.size
    };
  }
}

export class MetricsService {
  constructor() {
    this.startTime = Date.now();
    this.processStartTimeIso = new Date().toISOString();

    // Session-aware visitor tracking
    this.sessionManager = new VisitorSessionManager();

    // Request Counters
    this.processRequestsTotal = 0;
    this.lifetimeBaseline = 80214; // Default starting lifetime baseline preserving historical volume
    this.isPersistenceInitialized = false;

    // Granular Categorization
    this.userApiRequests = 0;
    this.adminApiRequests = 0;
    this.healthCheckRequests = 0;
    this.socketPollRequests = 0;

    this.requestsByStatus = {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0
    };

    // Latency & Timestamps
    this.endpointHits = new Map(); // path -> count
    this.latencyHistory = []; // numbers (ms, max 200 non-polling requests)
    this.requestTimestamps = []; // rolling 60s timestamps for RPM: { time, isUser }
    this.recentErrors = []; // max 50 sanitized errors
    this.slowRequests = []; // max 20 requests > 500ms (excluding socket.io polls)
    this.failedLogins = []; // max 50 privacy-conscious failed logins without sensitive credentials

    // YouTube API & Fallback Resolver Metrics
    this.youtubeStats = {
      totalSearches: 0,
      apiHits: 0,
      fallbackHits: 0, // Fallback query resolver hits (formerly mislabeled 'scraper')
      curatedFallbackHits: 0,
      quotaErrors: 0,
      invalidKeyErrors: 0
    };

    // Music & Playback Analytics
    this.musicStats = {
      totalPlays: 0,
      playAttempts: 0,
      playErrors: 0,
      searchQueries: new Map() // query -> count
    };

    // Database operation latency tracking
    this.dbLatencyHistory = [];

    // Periodic flush timer for MongoDB persistence
    this.persistInterval = null;
  }

  async initPersistence() {
    try {
      const record = await SystemMetric.findOne({ key: 'cumulative_traffic' });
      if (record && typeof record.value === 'number') {
        this.lifetimeBaseline = record.value;
      } else {
        await SystemMetric.findOneAndUpdate(
          { key: 'cumulative_traffic' },
          { $setOnInsert: { value: this.lifetimeBaseline, updatedAt: new Date() } },
          { upsert: true, new: true }
        );
      }
      this.isPersistenceInitialized = true;
    } catch (err) {
      console.warn('[MetricsService] MongoDB persistence notice (in-memory mode active):', err.message);
    }

    // Flush cumulative count to DB every 30s
    if (!this.persistInterval) {
      this.persistInterval = setInterval(() => this.flushPersistence(), 30000);
      if (this.persistInterval.unref) this.persistInterval.unref();
    }
  }

  async flushPersistence() {
    try {
      const total = this.lifetimeBaseline + this.processRequestsTotal;
      await SystemMetric.updateOne(
        { key: 'cumulative_traffic' },
        { $set: { value: total, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch {
      // Non-fatal background flush
    }
  }

  recordRequest({ method, path, status, durationMs, ip = 'unknown' }) {
    const now = Date.now();
    const duration = typeof durationMs === 'number' ? Math.round(durationMs * 10) / 10 : 0;

    // Categorize Request Types
    const isHealthCheck = path === '/health' || path === '/' || path === '/api/health';
    const isSocketPoll = path.startsWith('/socket.io/');
    const isAdminApi = path.startsWith('/api/admin/');
    const isUserApi = !isHealthCheck && !isSocketPoll && !isAdminApi;

    this.processRequestsTotal++;

    if (isHealthCheck) this.healthCheckRequests++;
    else if (isSocketPoll) this.socketPollRequests++;
    else if (isAdminApi) this.adminApiRequests++;
    else this.userApiRequests++;

    // Track status codes for eligible requests (excluding health keepalive and socket.io transport polls)
    const isEligibleForDistribution = !isHealthCheck && !isSocketPoll;

    if (isEligibleForDistribution) {
      if (status >= 200 && status < 300) this.requestsByStatus['2xx']++;
      else if (status >= 300 && status < 400) this.requestsByStatus['3xx']++;
      else if (status >= 400 && status < 500) this.requestsByStatus['4xx']++;
      else if (status >= 500) this.requestsByStatus['5xx']++;

      // Endpoint frequency (sanitize query params and Mongo ObjectIDs)
      const sanitizedPath = path.split('?')[0].replace(/\/[0-9a-fA-F]{24}/g, '/:id');
      const count = this.endpointHits.get(sanitizedPath) || 0;
      this.endpointHits.set(sanitizedPath, count + 1);

      // Latency history for genuine application requests (filter out long-polling socket.io)
      this.latencyHistory.push(duration);
      if (this.latencyHistory.length > 200) this.latencyHistory.shift();

      // Slow requests tracking (> 500ms)
      if (duration > 500) {
        this.slowRequests.unshift({
          timestamp: new Date().toISOString(),
          method,
          path: sanitizedPath,
          status,
          duration: Math.round(duration)
        });
        if (this.slowRequests.length > 20) this.slowRequests.pop();
      }
    }

    // Rolling RPM tracking (recording timestamp and classification)
    this.requestTimestamps.push({ time: now, isUser: isUserApi });
    this.cleanupTimestamps(now);
  }

  cleanupTimestamps(now = Date.now()) {
    const oneMinuteAgo = now - 60000;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0].time < oneMinuteAgo) {
      this.requestTimestamps.shift();
    }
  }

  recordFailedLogin({ ip, username, userAgent, reason = 'invalid_credentials' }) {
    this.failedLogins.unshift({
      timestamp: new Date().toISOString(),
      ip: (ip || 'unknown').toString().replace(/:\d+$/, ''),
      username: (username || '').slice(0, 50),
      userAgent: (userAgent || 'unknown').slice(0, 100),
      reason
    });
    if (this.failedLogins.length > 50) this.failedLogins.pop();
  }

  getFailedLogins() {
    return this.failedLogins;
  }

  recordError({ method, path, status, message, ip }) {
    const sanitizedPath = path ? path.split('?')[0] : 'unknown';
    this.recentErrors.unshift({
      timestamp: new Date().toISOString(),
      method: method || 'GET',
      path: sanitizedPath,
      status: status || 500,
      message: (message || 'Unknown error').replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, '[REDACTED_URI]').slice(0, 200),
      ip: ip ? ip.replace(/:\d+$/, '') : 'unknown'
    });
    if (this.recentErrors.length > 50) this.recentErrors.pop();
  }

  recordYouTube(type) {
    this.youtubeStats.totalSearches++;
    if (type === 'api') this.youtubeStats.apiHits++;
    else if (type === 'scraper' || type === 'fallback') this.youtubeStats.fallbackHits++;
    else if (type === 'curated') this.youtubeStats.curatedFallbackHits++;
    else if (type === 'quota') this.youtubeStats.quotaErrors++;
    else if (type === 'invalid_key') this.youtubeStats.invalidKeyErrors++;
  }

  recordMusicEvent({ type, query }) {
    if (type === 'play_start') this.musicStats.totalPlays++;
    else if (type === 'play_attempt') this.musicStats.playAttempts++;
    else if (type === 'play_error') this.musicStats.playErrors++;
    else if (type === 'search' && query) {
      const cleanQ = query.trim().toLowerCase().slice(0, 50);
      const count = this.musicStats.searchQueries.get(cleanQ) || 0;
      this.musicStats.searchQueries.set(cleanQ, count + 1);
    }
  }

  registerVisitorConnection(params) {
    return this.sessionManager.registerConnection(params);
  }

  handleVisitorDisconnect(socketId) {
    return this.sessionManager.handleDisconnect(socketId);
  }

  handleVisitorLogout(socketId, sessionId) {
    return this.sessionManager.handleLogout(socketId, sessionId);
  }

  getSnapshot() {
    this.cleanupTimestamps();
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - this.startTime) / 1000);

    // Visitor Statistics from SessionManager
    const visitorStats = this.sessionManager.getStats();

    // Latency Calculation: Average, Median (p50), and 95th Percentile (p95)
    let avgLatency = 0;
    let p95Latency = 0;
    let p50Latency = 0;

    if (this.latencyHistory.length > 0) {
      const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
      avgLatency = Math.round(sum / this.latencyHistory.length);

      const sorted = [...this.latencyHistory].sort((a, b) => a - b);
      const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
      const p50Idx = Math.floor(sorted.length * 0.5);

      p95Latency = Math.round(sorted[p95Idx]);
      p50Latency = Math.round(sorted[p50Idx]);
    }

    // Rolling 60-second RPM
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestTimestamps.filter(t => t.time >= oneMinuteAgo);
    const rpmTotal = recentRequests.length;
    const rpmUser = recentRequests.filter(t => t.isUser).length;

    // Eligible Request Population for Consistent Error Rates
    const eligibleTotal = this.requestsByStatus['2xx'] +
      this.requestsByStatus['3xx'] +
      this.requestsByStatus['4xx'] +
      this.requestsByStatus['5xx'];

    const serverErrorsCount = this.requestsByStatus['5xx'];
    const clientErrorsCount = this.requestsByStatus['4xx'];
    const totalErrorsCount = serverErrorsCount + clientErrorsCount;

    const serverErrorRatePercent = eligibleTotal > 0
      ? parseFloat(((serverErrorsCount / eligibleTotal) * 100).toFixed(1))
      : 0.0;

    const clientErrorRatePercent = eligibleTotal > 0
      ? parseFloat(((clientErrorsCount / eligibleTotal) * 100).toFixed(1))
      : 0.0;

    const totalErrorRatePercent = eligibleTotal > 0
      ? parseFloat(((totalErrorsCount / eligibleTotal) * 100).toFixed(1))
      : 0.0;

    // Top endpoints sorted by count
    const topEndpoints = Array.from(this.endpointHits.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));

    // Top search terms
    const topSearches = Array.from(this.musicStats.searchQueries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    const lifetimeTotal = this.lifetimeBaseline + this.processRequestsTotal;

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      processStartTimeIso: this.processStartTimeIso,

      // Live Visitors (Session-aware, deduplicated)
      activeVisitors: visitorStats.totalUniqueSessions,
      activeAuthenticatedUsers: visitorStats.authenticatedSessions,
      visitorBreakdown: {
        totalUniqueSessions: visitorStats.totalUniqueSessions,
        authenticated: visitorStats.authenticatedSessions,
        anonymous: visitorStats.anonymousSessions,
        admins: visitorStats.adminSessions,
        uniqueUsers: visitorStats.uniqueAuthenticatedUsers,
        activeConnections: visitorStats.activeConnections
      },

      // Requests Totals (Process vs Cumulative Lifetime)
      requestsTotal: this.processRequestsTotal, // Clear process-lifetime counter
      requestsLifetimeTotal: lifetimeTotal, // Persistent cumulative total
      requestsBreakdown: {
        processLifetime: this.processRequestsTotal,
        cumulativeLifetime: lifetimeTotal,
        userApi: this.userApiRequests,
        adminApi: this.adminApiRequests,
        healthChecks: this.healthCheckRequests,
        socketTransportPolls: this.socketPollRequests
      },

      // Rolling RPM (60-second window)
      requestsPerMinute: rpmTotal,
      requestsPerMinuteUser: rpmUser,

      // Monotonic Latency Measurements
      avgLatencyMs: avgLatency,
      p95LatencyMs: p95Latency,
      p50LatencyMs: p50Latency,
      latencySampleSize: this.latencyHistory.length,

      // Consistent Error Rate Metrics
      eligibleRequestsTotal: eligibleTotal,
      errorCountTotal: totalErrorsCount,
      serverErrorsCount,
      clientErrorsCount,
      serverErrorRatePercent,
      clientErrorRatePercent,
      totalErrorRatePercent,
      errorRatePercent: totalErrorRatePercent,

      // HTTP Status Codes Distribution
      requestsByStatus: { ...this.requestsByStatus },

      // Endpoints & Diagnosed Slow Requests
      topEndpoints,
      slowRequests: this.slowRequests.slice(0, 10),
      recentErrors: this.recentErrors.slice(0, 15),
      failedLogins: this.failedLogins.slice(0, 15),
      failedLoginsCount: this.failedLogins.length,

      // YouTube & Music Subsystems
      youtubeStats: {
        ...this.youtubeStats,
        // Provide scraperHits as an alias to avoid breaking any legacy consumer
        scraperHits: this.youtubeStats.fallbackHits
      },
      musicStats: {
        totalPlays: this.musicStats.totalPlays,
        playAttempts: this.musicStats.playAttempts,
        playErrors: this.musicStats.playErrors,
        topSearches
      }
    };
  }
}

export const metricsService = new MetricsService();
