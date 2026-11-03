import FeatureFlag from '../models/FeatureFlag.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';

// Default initial config for voice_control (Active for all users)
const DEFAULT_VOICE_CONTROL_CONFIG = {
  featureKey: 'voice_control',
  enabled: false,
  globalRollout: false,
  adminAccess: false,
  updatedBy: 'system',
  updatedByUsername: 'System Default',
  updatedAt: new Date()
};

// Fast in-memory cache with immediate invalidation capability
const flagCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute safety fallback

export const featureFlagService = {
  /**
   * Invalidate cache for a specific feature key or all keys
   */
  invalidateCache(featureKey) {
    if (featureKey) {
      flagCache.delete(featureKey);
    } else {
      flagCache.clear();
    }
  },

  /**
   * Get feature flag config from DB or initialize default
   */
  async getFeatureConfig(featureKey = 'voice_control') {
    const cached = flagCache.get(featureKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    let doc = await FeatureFlag.findOne({ featureKey }).lean();
    if (!doc) {
      if (featureKey === 'voice_control') {
        try {
          doc = await FeatureFlag.findOneAndUpdate(
            { featureKey: 'voice_control' },
            { $setOnInsert: DEFAULT_VOICE_CONTROL_CONFIG },
            { upsert: true, new: true }
          ).lean();
        } catch (e) {
          // Fallback if concurrent insert
          doc = await FeatureFlag.findOne({ featureKey: 'voice_control' }).lean();
        }
      }
    }

    const result = doc || {
      ...DEFAULT_VOICE_CONTROL_CONFIG,
      featureKey
    };

    flagCache.set(featureKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  },

  /**
   * Exact Permission Logic specification:
   *
   * IF masterFeatureEnabled = false:
   *     No user can access Voice Control.
   * ELSE IF user is an authenticated administrator AND adminAccessEnabled = true:
   *     Allow Voice Control.
   * ELSE IF user is authenticated AND globalRolloutEnabled = true:
   *     Allow Voice Control.
   * ELSE:
   *     Deny Voice Control.
   */
  evaluateAccess(config, user) {
    if (!config || !config.enabled) {
      return false;
    }

    if (!user) {
      // Unauthenticated guests do not have voice control access
      return false;
    }

    const isAdmin = user.role === 'admin';

    if (isAdmin) {
      return Boolean(config.adminAccess);
    }

    // Authenticated regular user
    return Boolean(config.globalRollout);
  },

  /**
   * Retrieve live stats for admin dashboard
   */
  async getVoiceControlRolloutStats() {
    const config = await this.getFeatureConfig('voice_control');

    let totalEligibleUsers = 0;
    let usersWithAccess = 0;

    try {
      totalEligibleUsers = await User.countDocuments({ status: { $ne: 'suspended' } });

      if (!config.enabled) {
        usersWithAccess = 0;
      } else if (config.globalRollout && config.adminAccess) {
        usersWithAccess = totalEligibleUsers;
      } else if (config.globalRollout && !config.adminAccess) {
        usersWithAccess = await User.countDocuments({
          role: { $ne: 'admin' },
          status: { $ne: 'suspended' }
        });
      } else if (!config.globalRollout && config.adminAccess) {
        usersWithAccess = await User.countDocuments({
          role: 'admin',
          status: { $ne: 'suspended' }
        });
      } else {
        usersWithAccess = 0;
      }
    } catch (err) {
      console.warn('[FeatureFlagService] Error calculating user counts:', err.message);
    }

    return {
      featureStatus: config.enabled ? 'Enabled' : 'Disabled',
      rolloutStatus: config.globalRollout ? 'All Users' : 'Admin Only',
      adminAccessStatus: config.adminAccess ? 'Enabled' : 'Disabled',
      totalEligibleUsers,
      usersWithAccess,
      lastConfigurationUpdate: config.updatedAt,
      lastUpdatedBy: config.updatedByUsername || config.updatedBy || 'System'
    };
  },

  /**
   * Update feature configuration by an authorized administrator
   */
  async updateVoiceControlConfig({ enabled, globalRollout, adminAccess }, adminUser, ip = 'unknown') {
    if (
      (enabled !== undefined && typeof enabled !== 'boolean') ||
      (globalRollout !== undefined && typeof globalRollout !== 'boolean') ||
      (adminAccess !== undefined && typeof adminAccess !== 'boolean')
    ) {
      throw new Error('All feature toggles (enabled, globalRollout, adminAccess) must be boolean values');
    }

    const previousDoc = await this.getFeatureConfig('voice_control');

    const previousState = {
      enabled: previousDoc.enabled,
      globalRollout: previousDoc.globalRollout,
      adminAccess: previousDoc.adminAccess
    };

    const finalEnabled = typeof enabled === 'boolean' ? enabled : previousDoc.enabled;
    const finalGlobalRollout = typeof globalRollout === 'boolean' ? globalRollout : (typeof enabled === 'boolean' ? enabled : previousDoc.globalRollout);
    const finalAdminAccess = typeof adminAccess === 'boolean' ? adminAccess : (typeof enabled === 'boolean' ? enabled : previousDoc.adminAccess);

    const newState = {
      enabled: finalEnabled,
      globalRollout: finalGlobalRollout,
      adminAccess: finalAdminAccess
    };

    const updatePayload = {
      enabled: finalEnabled,
      globalRollout: finalGlobalRollout,
      adminAccess: finalAdminAccess,
      updatedBy: adminUser._id ? adminUser._id.toString() : (adminUser.userId || 'admin'),
      updatedByUsername: adminUser.username || 'Administrator',
      updatedAt: new Date()
    };

    const auditEntry = {
      adminId: updatePayload.updatedBy,
      adminUsername: updatePayload.updatedByUsername,
      previousState,
      newState,
      ip,
      timestamp: updatePayload.updatedAt
    };

    const updatedDoc = await FeatureFlag.findOneAndUpdate(
      { featureKey: 'voice_control' },
      {
        $set: updatePayload,
        $push: {
          auditHistory: {
            $each: [auditEntry],
            $slice: -100 // Keep last 100 audit entries
          }
        }
      },
      { upsert: true, new: true }
    ).lean();

    // Log to global AuditLog
    try {
      await AuditLog.create({
        adminId: updatePayload.updatedBy,
        adminUsername: updatePayload.updatedByUsername,
        action: 'UPDATE_FEATURE_FLAG',
        targetId: 'voice_control',
        targetUsername: 'Feature: Voice Control',
        details: {
          featureKey: 'voice_control',
          previousState,
          newState
        },
        ip,
        status: 'SUCCESS',
        timestamp: updatePayload.updatedAt
      });
    } catch (auditErr) {
      console.warn('[FeatureFlagService] Failed to create AuditLog entry:', auditErr.message);
    }

    // Invalidate in-memory cache immediately
    this.invalidateCache('voice_control');

    const stats = await this.getVoiceControlRolloutStats();

    return {
      config: updatedDoc,
      stats
    };
  }
};

