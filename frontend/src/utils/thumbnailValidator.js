/**
 * Loopra Frontend Thumbnail Validation & Verification Utility
 * 
 * Enforces strict thumbnail guarantees across all Loopra frontend recommendation surfaces:
 * - Curated Just For You
 * - Made For You
 * - Because You Listened To
 * - Your Daily Mix
 * - Discover Your Next Favourite
 * - More Like Your Recent Plays
 * - Radio stations and radio recommendations
 * - Nostalgia Stations
 * - AI Assistant song recommendations
 * - Search results and Related songs
 * 
 * Strict Validation Rules:
 * 1. URL must exist and be a non-empty string.
 * 2. URL must use valid HTTP/HTTPS protocol.
 * 3. Never permit generic placeholders, ui-avatars.com, dummy images, or default fallback artwork.
 * 4. Image dimensions must be greater than zero (naturalWidth > 1, naturalHeight > 1).
 * 5. YouTube unavailable 120x90 placeholders are strictly rejected.
 * 6. Broken or erroring images are immediately rejected.
 */

// In-memory cache for live browser image verification: url -> boolean
const validationCache = new Map();
const MAX_CACHE_SIZE = 3000;

// Prohibited placeholder domains and patterns
const PROHIBITED_PATTERNS = [
  /ui-avatars\.com/i,
  /dummyimage\.com/i,
  /via\.placeholder\.com/i,
  /placekitten\.com/i,
  /placeholder\.(?:png|jpg|jpeg|webp|gif|svg)/i,
  /\/placeholder\//i,
  /default_profile/i,
  /noimage/i,
  /no_image/i,
  /missing[-_]image/i,
  /about:blank/i,
  /javascript:/i,
  /data:text\/html/i
];

// Set of YouTube video IDs known to be unavailable / 404 / 1097-byte grey placeholders
export const KNOWN_INVALID_VIDEO_IDS = new Set([
  '2mDC8bQ2r2E', 'q_46zF7ZJqM', 'b0Z1_mHjW_E', 'wJ8d4xIeR-c', '27y8t1WkYpk',
  'exv-pL9pC_0', 'wMPb6ZkWd1k', '9mQk7Evt6Dk', 'bL4j_Hq_o1k', 'OQ1cbe_g5eM',
  'hV_2jUj6WJg', 'II2EO3NwUrQ', 'k4yXQkGLeAk', 'dra3PCbxbDE', 'N_r8u4B_U9c',
  'bm34qK3Y3bU', 'YtDk_9pM-cM', 'nBkWuYg5kG4', '6MgtJpA_k98', 'U7mPqPfQdUo',
  'D9G1Vo_JnHQ', 'zWqO3uO_8sQ', 'Il71Kx94lH8', 'yIIGQP77ZdU', 'IeXg1b_4l7Q',
  '8ofcz7A_Fw0', 'mF3qY4QvE9U', 'wTsl_k1Q1hU', 'bUu3Gz_5Y88', 'Jk_4L1_vM8g',
  'r_8G_j1Y_4M', 'h1F2Y3_K8nU', 'v_7N_e1T8n8', 'd_5B_9gK_4U', '7c3-Ge3ZgGg',
  '3_5U_7mG1Yk', 'Y_8t7_u3lGk', 'xRb8hLw_q7k', 'B61fSzdCzzs', 'hgi2MYAF20M',
  'aOI7zhnwLio', 'wPxqcq6ByqI', '9x_m716i3f0', '0G2VxhV_g10', 'ENcgNz_0p8k',
  'JSCH_r7lEGs', 'mNuhKUOD_P0', 'vu5-aKf_Qq8', 'djACk4vSbnw', 'xWy67bSgR4U',
  '0yW7k5eH7uQ', 'f64vZeHPap4', 'W-te4f63c8Y', 'n2R2p_1Ubg0', 'x9bT9k_k9a0',
  'D8vn7D5N4-8', 'Cg6Z_0g4h3I', 'VAdGW7TVua8', '0pWsChUMV4A', 'f6vQ_7k9a7A',
  'YxW5Y88qf3c', 'hXh35C27n84', 'bo_efYhAK2A', '9jI-z9h658o', 'kJ_aXkG2_m4',
  'D-YDEpLFLc8'
]);

export function isVideoIdInvalid(id) {
  if (!id || typeof id !== 'string') return false;
  return KNOWN_INVALID_VIDEO_IDS.has(id.trim());
}

export function invalidateVideoIdClient(id) {
  if (id && typeof id === 'string') {
    KNOWN_INVALID_VIDEO_IDS.add(id.trim());
  }
}

/**
 * Validates whether a thumbnail URL matches strict format rules:
 * - Must be a valid string with length >= 12
 * - Must start with http:// or https://
 * - Must not be a known placeholder or fallback service
 * - If YouTube, must have a valid 11-char alphanumeric ID and not be in KNOWN_INVALID_VIDEO_IDS
 */
export function isThumbnailUrlFormatValid(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  if (clean.length < 12) return false;

  if (!/^https?:\/\//i.test(clean)) return false;

  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(clean)) return false;
  }

  if (clean.includes('ytimg.com') || clean.includes('youtube.com')) {
    const ytMatch = clean.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//) || clean.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (!ytMatch || !ytMatch[1] || ytMatch[1].length !== 11) {
      return false;
    }
    if (KNOWN_INVALID_VIDEO_IDS.has(ytMatch[1])) {
      return false;
    }
  }

  return true;
}

/**
 * Extracts and cleans a thumbnail URL for any track, item, or URL string.
 * NEVER returns ui-avatars.com or generic fallback placeholders.
 * Returns empty string if no valid thumbnail URL can be determined.
 */
export function getCleanThumbnail(itemOrUrl, explicitId) {
  if (!itemOrUrl && !explicitId) return '';

  let url = typeof itemOrUrl === 'string'
    ? itemOrUrl
    : (itemOrUrl?.thumbnail || itemOrUrl?.coverArt || itemOrUrl?.image || itemOrUrl?.snippet?.thumbnails?.high?.url || itemOrUrl?.snippet?.thumbnails?.medium?.url || '');

  const rawId = explicitId || (typeof itemOrUrl === 'object' ? (itemOrUrl?.videoId || itemOrUrl?.id) : null);
  const id = typeof rawId === 'string' ? rawId.trim() : (rawId?.videoId ? String(rawId.videoId).trim() : null);

  if (id && KNOWN_INVALID_VIDEO_IDS.has(id)) {
    return '';
  }

  // If explicit YouTube video ID exists and is 11-chars
  if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
    if (!url || !isThumbnailUrlFormatValid(url)) {
      url = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
  }

  if (typeof url === 'string') {
    url = url.trim();

    for (const pattern of PROHIBITED_PATTERNS) {
      if (pattern.test(url)) return '';
    }

    if (url.includes('ytimg.com') || url.includes('ggpht.com')) {
      const normalized = url
        .replace(/\/[^/]*hq720[^/]*\.(?:jpg|webp)(?:\?.*)?$/i, '/hqdefault.jpg')
        .replace(/\/[^/]*custom[^/]*\.(?:jpg|webp)(?:\?.*)?$/i, '/hqdefault.jpg')
        .replace(/\/maxresdefault\.(?:jpg|webp)(?:\?.*)?$/i, '/hqdefault.jpg')
        .replace(/\?.*$/i, '');

      return isThumbnailUrlFormatValid(normalized) ? normalized : '';
    }

    return isThumbnailUrlFormatValid(url) ? url : '';
  }

  return '';
}

/**
 * Live async browser image verification using Image() object.
 * Checks:
 * - Successful image load (onload triggered)
 * - Natural dimensions > 1x1
 * - Rejects YouTube 120x90 unavailable placeholder images
 * - Handles timeouts and error events gracefully
 */
export function validateThumbnailImage(url, timeoutMs = 3000) {
  if (!isThumbnailUrlFormatValid(url)) {
    return Promise.resolve(false);
  }

  if (validationCache.has(url)) {
    return Promise.resolve(validationCache.get(url));
  }

  return new Promise((resolve) => {
    let settled = false;
    const img = new Image();

    const finish = (isValid) => {
      if (settled) return;
      settled = true;
      img.onload = null;
      img.onerror = null;

      if (validationCache.size >= MAX_CACHE_SIZE) {
        const firstKey = validationCache.keys().next().value;
        if (firstKey) validationCache.delete(firstKey);
      }
      validationCache.set(url, isValid);
      resolve(isValid);
    };

    const timer = setTimeout(() => {
      finish(false);
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      const width = img.naturalWidth;
      const height = img.naturalHeight;

      // Must have actual rendered dimensions
      if (width <= 1 || height <= 1) {
        return finish(false);
      }

      // YouTube CDN returns a 120x90 placeholder when video/thumbnail is unavailable
      if ((url.includes('ytimg.com') || url.includes('youtube.com')) && width === 120 && height === 90) {
        return finish(false);
      }

      finish(true);
    };

    img.onerror = () => {
      clearTimeout(timer);
      finish(false);
    };

    try {
      img.src = url;
      // If already complete from browser cache
      if (img.complete) {
        clearTimeout(timer);
        if (img.naturalWidth <= 1 || img.naturalHeight <= 1) {
          finish(false);
        } else if ((url.includes('ytimg.com') || url.includes('youtube.com')) && img.naturalWidth === 120 && img.naturalHeight === 90) {
          finish(false);
        } else {
          finish(true);
        }
      }
    } catch (e) {
      clearTimeout(timer);
      finish(false);
    }
  });
}

/**
 * Filter an array of candidate tracks, checking both URL format and live image availability.
 */
export async function filterTracksWithValidThumbnails(tracks = [], maxConcurrency = 6) {
  if (!Array.isArray(tracks) || tracks.length === 0) return [];

  // Step 1: Pre-filter by format
  const candidatesWithValidFormat = [];
  for (const t of tracks) {
    if (!t) continue;
    const cleanThumb = getCleanThumbnail(t);
    if (cleanThumb && isThumbnailUrlFormatValid(cleanThumb)) {
      candidatesWithValidFormat.push({
        ...t,
        thumbnail: cleanThumb
      });
    }
  }

  if (candidatesWithValidFormat.length === 0) return [];

  // Step 2: Live image verification
  const validTracks = [];
  const queue = [...candidatesWithValidFormat];

  const worker = async () => {
    while (queue.length > 0) {
      const track = queue.shift();
      if (!track) break;
      const isValid = await validateThumbnailImage(track.thumbnail);
      if (isValid) {
        validTracks.push(track);
      }
    }
  };

  const pool = [];
  for (let i = 0; i < Math.min(maxConcurrency, candidatesWithValidFormat.length); i++) {
    pool.push(worker());
  }

  await Promise.all(pool);
  return validTracks;
}

export default {
  KNOWN_INVALID_VIDEO_IDS,
  isVideoIdInvalid,
  invalidateVideoIdClient,
  isThumbnailUrlFormatValid,
  getCleanThumbnail,
  validateThumbnailImage,
  filterTracksWithValidThumbnails
};

