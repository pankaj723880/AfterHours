try {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.removeItem('afterhours_equalizer_settings');
  }
} catch (_) {}
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
    } catch (_) {}
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

export const formatTime = (secs) => {
  if (isNaN(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const getCleanThumbnail = (itemOrUrl, explicitId) => {
  if (!itemOrUrl && !explicitId) return "https://ui-avatars.com/api/?name=Music&background=1e1e1e&color=f59e0b&size=300";

  let url = typeof itemOrUrl === 'string' ? itemOrUrl : (itemOrUrl?.thumbnail || itemOrUrl?.image || itemOrUrl?.snippet?.thumbnails?.high?.url || itemOrUrl?.snippet?.thumbnails?.medium?.url || '');
  const rawId = explicitId || (typeof itemOrUrl === 'object' ? (itemOrUrl?.videoId || itemOrUrl?.id) : null);
  const id = typeof rawId === 'string' ? rawId : (rawId?.videoId || null);

  if (id && typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }

  if (url && typeof url === 'string') {
    const ytMatch = url.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//) || url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) {
      return `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }

    if (url.includes('ytimg.com') || url.includes('ggpht.com')) {
      return url
        .replace(/\/[^/]*hq720[^/]*\.(?:jpg|webp)(?:\?.*)?$/i, '/hqdefault.jpg')
        .replace(/\/[^/]*custom[^/]*\.(?:jpg|webp)(?:\?.*)?$/i, '/hqdefault.jpg')
        .replace(/\/maxresdefault\.(?:jpg|webp)(?:\?.*)?$/i, '/hqdefault.jpg')
        .replace(/\?.*$/i, '');
    }

    return url;
  }

  if (id && typeof id === 'string') {
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }

  const fallbackTitle = typeof itemOrUrl === 'object' ? (itemOrUrl?.title || itemOrUrl?.name || 'Music') : 'Music';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackTitle)}&background=1e1e1e&color=f59e0b&size=300`;
};
