import { BACKEND_URL } from '../utils/apiUrl';

let currentAccessState = {
  allowed: true,
  enabled: true,
  voiceControlEnabled: true,
  globalRollout: true,
  enableVoiceControlForAllUsers: true,
  adminAccess: true,
  lastChecked: 0
};

const subscribers = new Set();

export const voiceControlService = {
  getAccessState() {
    return { ...currentAccessState };
  },

  subscribe(callback) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },

  notify() {
    const state = this.getAccessState();
    subscribers.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        console.warn('[voiceControlService] subscriber callback error:', err);
      }
    });
  },

  /**
   * Local evaluation helper for instant UI reactivity
   */
  evaluateLocalAccess(config, user) {
    if (!config) return false;
    const masterEnabled = typeof config.voiceControlEnabled === 'boolean'
      ? config.voiceControlEnabled
      : Boolean(config.enabled);
    if (!masterEnabled) return false;

    const isAdmin = Boolean(user && (user.isAdmin === true || user.role === 'admin'));
    const publicRollout = typeof config.enableVoiceControlForAllUsers === 'boolean'
      ? config.enableVoiceControlForAllUsers
      : (typeof config.globalRollout === 'boolean' ? config.globalRollout : true);

    return Boolean(publicRollout || isAdmin);
  },

  /**
   * Fetch current voice control status from backend
   */
  async checkAccess({ token = null, user = null, backendUrl = '' } = {}) {
    const cleanUrl = (backendUrl && backendUrl.trim().startsWith('http'))
      ? backendUrl.trim().replace(/\/+$/, '')
      : (BACKEND_URL || '').replace(/\/+$/, '');

    try {
      const headers = {};
      const activeToken = token || localStorage.getItem('loopra_auth_token') || localStorage.getItem('token');
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const res = await fetch(`${cleanUrl}/api/features/voice-control/status`, {
        headers,
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        const enabled = Boolean(data.enabled ?? data.voiceControlEnabled ?? true);
        const globalRollout = Boolean(data.globalRollout ?? data.enableVoiceControlForAllUsers ?? true);
        const adminAccess = Boolean(data.adminAccess ?? true);
        const isAdmin = Boolean(user && (user.isAdmin === true || user.role === 'admin'));
        const allowed = enabled && (globalRollout || isAdmin);

        currentAccessState = {
          allowed,
          enabled,
          voiceControlEnabled: enabled,
          globalRollout,
          enableVoiceControlForAllUsers: globalRollout,
          adminAccess,
          lastChecked: Date.now()
        };
        this.notify();
        return currentAccessState;
      }
    } catch (err) {
      console.warn('[voiceControlService] Check access notice:', err.message);
    }

    // Fallback: evaluate locally based on passed user & last known config
    if (user) {
      const allowed = this.evaluateLocalAccess(currentAccessState, user);
      currentAccessState.allowed = allowed;
      this.notify();
    }

    return currentAccessState;
  },

  /**
   * Real-time update handler when socket emits 'feature_flag_updated'
   */
  handleSocketFlagUpdate(payload, currentUser) {
    if (!payload || payload.featureKey !== 'voice_control') return;
    const config = payload.config || {};

    const rawEnabled = typeof config.voiceControlEnabled === 'boolean'
      ? config.voiceControlEnabled
      : (typeof config.enabled === 'boolean' ? config.enabled : currentAccessState.enabled);
    const enabled = Boolean(rawEnabled);

    const rawRollout = typeof config.enableVoiceControlForAllUsers === 'boolean'
      ? config.enableVoiceControlForAllUsers
      : (typeof config.globalRollout === 'boolean' ? config.globalRollout : currentAccessState.globalRollout);
    const globalRollout = Boolean(rawRollout);

    const adminAccess = typeof config.adminAccess === 'boolean' ? config.adminAccess : currentAccessState.adminAccess;

    const updatedConfig = {
      enabled,
      voiceControlEnabled: enabled,
      globalRollout,
      enableVoiceControlForAllUsers: globalRollout,
      adminAccess
    };
    const allowed = this.evaluateLocalAccess(updatedConfig, currentUser);

    currentAccessState = {
      allowed,
      enabled,
      voiceControlEnabled: enabled,
      globalRollout,
      enableVoiceControlForAllUsers: globalRollout,
      adminAccess,
      lastChecked: Date.now()
    };

    this.notify();
  }
};

