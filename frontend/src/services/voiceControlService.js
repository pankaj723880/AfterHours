import { BACKEND_URL } from '../utils/apiUrl.js';

const CACHE_STORAGE_KEY = 'loopra_voice_control_access_state';

// Default initial state: Secure Fail-Closed (all false until explicit verification)
const DEFAULT_ACCESS_STATE = {
  allowed: false,
  enabled: false,
  voiceControlEnabled: false,
  globalRollout: false,
  enableVoiceControlForAllUsers: false,
  adminAccess: false,
  lastChecked: 0
};

// Initialize from last known valid localStorage cache if available, otherwise fail-closed
const loadCachedAccessState = () => {
  if (typeof window === 'undefined') return { ...DEFAULT_ACCESS_STATE };
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          allowed: Boolean(parsed.allowed),
          enabled: Boolean(parsed.enabled ?? parsed.voiceControlEnabled),
          voiceControlEnabled: Boolean(parsed.voiceControlEnabled ?? parsed.enabled),
          globalRollout: Boolean(parsed.globalRollout ?? parsed.enableVoiceControlForAllUsers),
          enableVoiceControlForAllUsers: Boolean(parsed.enableVoiceControlForAllUsers ?? parsed.globalRollout),
          adminAccess: Boolean(parsed.adminAccess),
          lastChecked: Number(parsed.lastChecked) || 0
        };
      }
    }
  } catch (_) {}
  return { ...DEFAULT_ACCESS_STATE };
};

let currentAccessState = loadCachedAccessState();

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

    const adminAccess = typeof config.adminAccess === 'boolean' ? config.adminAccess : true;

    if (isAdmin) {
      return Boolean(adminAccess);
    }

    return Boolean(publicRollout);
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
        const enabled = Boolean(data.enabled ?? data.voiceControlEnabled ?? false);
        const globalRollout = Boolean(data.globalRollout ?? data.enableVoiceControlForAllUsers ?? false);
        const adminAccess = Boolean(data.adminAccess ?? false);
        const isAdmin = Boolean(user && (user.isAdmin === true || user.role === 'admin'));
        const allowed = enabled && (isAdmin ? adminAccess : globalRollout);

        currentAccessState = {
          allowed,
          enabled,
          voiceControlEnabled: enabled,
          globalRollout,
          enableVoiceControlForAllUsers: globalRollout,
          adminAccess,
          lastChecked: Date.now()
        };
        try {
          localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(currentAccessState));
        } catch (_) {}
        this.notify();
        return currentAccessState;
      }
    } catch (err) {
      console.warn('[voiceControlService] Check access notice:', err.message);
    }

    // Fail-closed fallback: evaluate strictly against saved cache or default closed state
    if (user) {
      const allowed = this.evaluateLocalAccess(currentAccessState, user);
      currentAccessState.allowed = allowed;
      this.notify();
    } else {
      currentAccessState.allowed = false;
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

    try {
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(currentAccessState));
    } catch (_) {}

    this.notify();
  }
};

