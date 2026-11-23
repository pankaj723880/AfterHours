try {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.removeItem('afterhours_equalizer_settings');
  }
} catch (_) { }
const STORAGE_KEYS = {
  LIKED_SONGS: 'afterhours_liked_songs',
  PLAYLISTS: 'afterhours_playlists',
  HISTORY: 'afterhours_history',
  SEARCH_CACHE: 'afterhours_search_cache',
  STATION_CACHE: 'afterhours_station_cache',
  PREFERENCES: 'afterhours_preferences',
  CROSSFADE_DURATION: 'afterhours_crossfade_duration',
  GAPLESS_ENABLED: 'afterhours_gapless_enabled',
};

const LEGACY_KEYS = {
  [STORAGE_KEYS.LIKED_SONGS]: 'liked_songs',
  [STORAGE_KEYS.PLAYLISTS]: 'playlists',
  [STORAGE_KEYS.HISTORY]: 'history',
};

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24-hour expiration
const MAX_HISTORY_ITEMS = 50;

/**
 * Safely parses localStorage data with fallback, legacy migration, and TTL validation.
 */
export const safeGet = (key, fallback = null) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return fallback;
  try {
    let raw = localStorage.getItem(key);

    // Backward compatibility: check legacy un-prefixed key
    if (!raw && LEGACY_KEYS[key]) {
      raw = localStorage.getItem(LEGACY_KEYS[key]);
      if (raw) {
        localStorage.setItem(key, raw);
        localStorage.removeItem(LEGACY_KEYS[key]);
      }
    }

    if (!raw) return fallback;
    const parsed = JSON.parse(raw);

    // Validate TTL for temporary caches
    if (parsed && typeof parsed === 'object' && parsed._expiresAt) {
      if (Date.now() > parsed._expiresAt) {
        localStorage.removeItem(key);
        return fallback;
      }
      return parsed.data;
    }

    return parsed;
  } catch (err) {
    console.warn(`[Storage] Corrupted data for key "${key}". Resetting to fallback.`, err);
    localStorage.removeItem(key);
    return fallback;
  }
};

/**
 * Clears non-critical temporary entries when storage quota limits are hit.
 */
export const clearTemporaryCaches = () => {
  [STORAGE_KEYS.SEARCH_CACHE, STORAGE_KEYS.STATION_CACHE].forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (_) { }
  });
};

/**
 * Safely writes data to localStorage with size caps and QuotaExceededError handling.
 */
export const safeSet = (key, value, options = {}) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    let payload = value;

    // Enforce sliding window capacity on history
    if (key === STORAGE_KEYS.HISTORY && Array.isArray(value)) {
      payload = value.slice(-MAX_HISTORY_ITEMS);
    }

    // Attach TTL timestamp wrapper for temporary data
    if (options.ttl) {
      payload = {
        _expiresAt: Date.now() + options.ttl,
        data: value,
      };
    }

    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    if (err.name === 'QuotaExceededError' || err.code === 22) {
      console.warn('[Storage] Quota exceeded. Purging temporary caches...');
      clearTemporaryCaches();
      try {
        localStorage.setItem(key, JSON.stringify(payload));
      } catch (retryErr) {
        console.error('[Storage] Critical error: Quota full after eviction.', retryErr);
      }
    } else {
      console.error(`[Storage] Failed writing key "${key}"`, err);
    }
  }
};

export { STORAGE_KEYS };
export { getCleanThumbnail, isThumbnailUrlFormatValid } from './thumbnailValidator.js';

export const formatTime = (secs) => {
  if (isNaN(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

/**
 * Tab-Isolated Auth Session Storage Helpers
 *
 * Prevents multi-tab session overwrites (e.g. logging into Account B in Tab 2
 * does NOT overwrite Tab 1's active Account A session upon page refresh).
 *
 * sessionStorage is isolated per browser tab. We use sessionStorage as the primary
 * source of truth for the tab's active session, falling back to localStorage if
 * opened in a fresh tab that has no sessionStorage initialized yet.
 */
const AUTH_TOKEN_KEY = 'afterhours_token';
const AUTH_USER_KEY = 'afterhours_user';
const SESSION_INITIALIZED_KEY = 'loopra_tab_initialized';

export const getTabAuthToken = () => {
  if (typeof window === 'undefined') return '';
  try {
    const isTabInitialized = sessionStorage.getItem(SESSION_INITIALIZED_KEY);
    if (isTabInitialized) {
      // Tab has already established its session state (logged in or logged out)
      return sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
    }

    // Fresh tab: copy from localStorage ONLY on first hydration
    sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');
    const localToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
    if (localToken) {
      sessionStorage.setItem(AUTH_TOKEN_KEY, localToken);
    }
    return localToken;
  } catch (_) {
    try { return localStorage.getItem(AUTH_TOKEN_KEY) || ''; } catch (_) { return ''; }
  }
};

export const getTabAuthUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const isTabInitialized = sessionStorage.getItem(SESSION_INITIALIZED_KEY);
    if (isTabInitialized) {
      const sessionUser = sessionStorage.getItem(AUTH_USER_KEY);
      return sessionUser ? JSON.parse(sessionUser) : null;
    }

    // Fresh tab: copy from localStorage ONLY on first hydration
    sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');
    const localUserRaw = localStorage.getItem(AUTH_USER_KEY);
    if (localUserRaw) {
      sessionStorage.setItem(AUTH_USER_KEY, localUserRaw);
      return JSON.parse(localUserRaw);
    }
    return null;
  } catch (_) {
    try {
      const fallback = localStorage.getItem(AUTH_USER_KEY);
      return fallback ? JSON.parse(fallback) : null;
    } catch (_) {
      return null;
    }
  }
};

export const setTabAuthSession = (token, userObj) => {
  if (typeof window === 'undefined') return;
  // Always update this tab's isolated sessionStorage first
  try {
    sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');
    if (token) {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
    if (userObj) {
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(userObj));
    } else {
      sessionStorage.removeItem(AUTH_USER_KEY);
    }
  } catch (_) {}

  // Also update localStorage for default persistence (new tabs, app restarts, native WebView),
  // but existing tabs won't be clobbered because they read their own sessionStorage first.
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    if (userObj) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userObj));
    }
  } catch (_) {}
};

export const clearTabAuthSession = () => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem('loopra_token');
    sessionStorage.removeItem('loopra_user');
  } catch (_) {}
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch (_) {}
};


