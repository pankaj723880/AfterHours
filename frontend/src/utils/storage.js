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
 * We identify each browser tab with a unique tab ID stored in window.name.
 * (window.name survives page refreshes in the same tab, but is completely isolated
 * between tabs and never inherited or duplicated across tabs).
 *
 * sessionStorage is also strictly tab-isolated in modern browsers.
 * We store the active authentication credentials per tab:
 * 1. Primary: sessionStorage (keys: loopra_tab_token, loopra_tab_user)
 * 2. Secondary fallback / persistence: tab-keyed localStorage using getTabId()
 *    (keys: loopra_token_${tabId}, loopra_user_${tabId})
 *
 * We NEVER write an active user's credentials to shared global keys (afterhours_token / afterhours_user)
 * from one tab in a way that clobbers other existing tabs.
 */
const TAB_TOKEN_KEY = 'loopra_tab_token';
const TAB_USER_KEY = 'loopra_tab_user';
const SESSION_INITIALIZED_KEY = 'loopra_tab_initialized';

// Legacy / fallback global keys used ONLY for default cold-start hydration of new blank tabs:
const GLOBAL_AUTH_TOKEN_KEY = 'afterhours_token';
const GLOBAL_AUTH_USER_KEY = 'afterhours_user';

export const getTabId = () => {
  if (typeof window === 'undefined') return 'ssr_tab';
  try {
    if (window.name && window.name.startsWith('loopra_tab_')) {
      return window.name;
    }
    const newTabId = 'loopra_tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    window.name = newTabId;
    return newTabId;
  } catch (_) {
    return 'default_tab';
  }
};

export const getTabAuthToken = () => {
  if (typeof window === 'undefined') return '';
  try {
    const isTabInitialized = sessionStorage.getItem(SESSION_INITIALIZED_KEY);
    if (isTabInitialized) {
      // Tab has already established its session state (logged in or logged out)
      return sessionStorage.getItem(TAB_TOKEN_KEY) || '';
    }

    // First hydration for this specific tab:
    sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');

    // Check if this tab already has a tab-scoped token stored in tab-keyed storage
    const tabId = getTabId();
    const tabScopedToken = localStorage.getItem(`loopra_token_${tabId}`);
    if (tabScopedToken) {
      sessionStorage.setItem(TAB_TOKEN_KEY, tabScopedToken);
      return tabScopedToken;
    }

    // Otherwise, check if there is an existing global session (e.g. initial login before multi-tab)
    const globalToken = localStorage.getItem(GLOBAL_AUTH_TOKEN_KEY) || '';
    if (globalToken) {
      sessionStorage.setItem(TAB_TOKEN_KEY, globalToken);
      localStorage.setItem(`loopra_token_${tabId}`, globalToken);
    }
    return globalToken;
  } catch (_) {
    try {
      const tabId = getTabId();
      return sessionStorage.getItem(TAB_TOKEN_KEY) || localStorage.getItem(`loopra_token_${tabId}`) || localStorage.getItem(GLOBAL_AUTH_TOKEN_KEY) || '';
    } catch (_) {
      return '';
    }
  }
};

export const getTabAuthUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const isTabInitialized = sessionStorage.getItem(SESSION_INITIALIZED_KEY);
    if (isTabInitialized) {
      const sessionUser = sessionStorage.getItem(TAB_USER_KEY);
      return sessionUser ? JSON.parse(sessionUser) : null;
    }

    // First hydration for this specific tab:
    sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');

    const tabId = getTabId();
    const tabScopedUserRaw = localStorage.getItem(`loopra_user_${tabId}`);
    if (tabScopedUserRaw) {
      sessionStorage.setItem(TAB_USER_KEY, tabScopedUserRaw);
      return JSON.parse(tabScopedUserRaw);
    }

    const globalUserRaw = localStorage.getItem(GLOBAL_AUTH_USER_KEY);
    if (globalUserRaw) {
      sessionStorage.setItem(TAB_USER_KEY, globalUserRaw);
      localStorage.setItem(`loopra_user_${tabId}`, globalUserRaw);
      return JSON.parse(globalUserRaw);
    }
    return null;
  } catch (_) {
    try {
      const tabId = getTabId();
      const raw = sessionStorage.getItem(TAB_USER_KEY) || localStorage.getItem(`loopra_user_${tabId}`) || localStorage.getItem(GLOBAL_AUTH_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }
};

export const setTabAuthSession = (token, userObj) => {
  if (typeof window === 'undefined') return;
  const tabId = getTabId();

  // 1. Strictly update this tab's isolated sessionStorage
  try {
    sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');
    if (token) {
      sessionStorage.setItem(TAB_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TAB_TOKEN_KEY);
    }
    if (userObj) {
      sessionStorage.setItem(TAB_USER_KEY, JSON.stringify(userObj));
    } else {
      sessionStorage.removeItem(TAB_USER_KEY);
    }
  } catch (_) {}

  // 2. Persist in tab-isolated localStorage using tabId so it survives crashes / reloads
  try {
    if (token) {
      localStorage.setItem(`loopra_token_${tabId}`, token);
    } else {
      localStorage.removeItem(`loopra_token_${tabId}`);
    }
    if (userObj) {
      localStorage.setItem(`loopra_user_${tabId}`, JSON.stringify(userObj));
    } else {
      localStorage.removeItem(`loopra_user_${tabId}`);
    }
  } catch (_) {}

  // 3. Update global fallback key ONLY if no global session is currently set or if explicitly set
  // This allows newly opened cold tabs to inherit a default login, but existing tabs will NEVER
  // read this because their sessionStorage.getItem(SESSION_INITIALIZED_KEY) is already true!
  try {
    if (token) {
      localStorage.setItem(GLOBAL_AUTH_TOKEN_KEY, token);
    }
    if (userObj) {
      localStorage.setItem(GLOBAL_AUTH_USER_KEY, JSON.stringify(userObj));
    }
  } catch (_) {}
};

export const clearTabAuthSession = () => {
  if (typeof window === 'undefined') return;
  const tabId = getTabId();
  try {
    sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');
    sessionStorage.removeItem(TAB_TOKEN_KEY);
    sessionStorage.removeItem(TAB_USER_KEY);
    sessionStorage.removeItem('afterhours_token');
    sessionStorage.removeItem('afterhours_user');
    sessionStorage.removeItem('loopra_token');
    sessionStorage.removeItem('loopra_user');
  } catch (_) {}
  try {
    localStorage.removeItem(`loopra_token_${tabId}`);
    localStorage.removeItem(`loopra_user_${tabId}`);
  } catch (_) {}
};



