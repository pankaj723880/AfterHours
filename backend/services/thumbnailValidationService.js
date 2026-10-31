/**
 * Loopra Mandatory Thumbnail Validation & Verification Service
 * 
 * Enforces strict thumbnail guarantees across all Loopra recommendation surfaces:
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
 * 4. Reject YouTube unavailable 120x90 placeholders (1097-byte responses).
 * 5. Reject HTML error pages, 404s, 403s, and broken assets.
 * 6. Cache live verification results with TTL to ensure sub-millisecond repeated checks.
 */

// In-memory cache for live URL verification: url -> { valid: boolean, reason?: string, expiresAt: number }
const thumbnailCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_CACHE_SIZE = 5000;

// Placeholder domains and path patterns that are strictly prohibited
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

// Fast in-memory set of YouTube video IDs known to return 404 or 1097-byte grey placeholders
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

/**
 * Register an invalid video ID so that all future calls across the backend reject it synchronously.
 */
export function invalidateVideoId(id) {
  if (id && typeof id === 'string') {
    KNOWN_INVALID_VIDEO_IDS.add(id.trim());
  }
}

/**
 * Checks whether an ID is known to be broken.
 */
export function isKnownInvalidId(id) {
  if (!id || typeof id !== 'string') return true;
  return KNOWN_INVALID_VIDEO_IDS.has(id.trim());
}

/**
 * Validates whether a thumbnail URL matches strict format rules:
 * - Must be a valid string
 * - Must use http:// or https://
 * - Must not be a known placeholder or fallback service
 * - If YouTube, must have a valid 11-char alphanumeric ID and not be in KNOWN_INVALID_VIDEO_IDS
 */
export function isValidThumbnailUrlFormat(url) {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = url.trim();
  if (cleanUrl.length < 12) return false;

  // Must begin with valid HTTP or HTTPS protocol
  if (!/^https?:\/\//i.test(cleanUrl)) return false;

  // Check prohibited patterns
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(cleanUrl)) {
      return false;
    }
  }

  // If YouTube CDN URL, ensure valid 11-character video ID and not known broken
  if (cleanUrl.includes('ytimg.com') || cleanUrl.includes('youtube.com')) {
    const ytMatch = cleanUrl.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//) || cleanUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
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
 * Extracts or synthesizes a clean, valid thumbnail URL for a track.
 * Returns empty string if no valid thumbnail URL can be determined.
 */
export function getCleanTrackThumbnail(trackOrUrl, explicitId) {
  if (!trackOrUrl && !explicitId) return '';

  let url = typeof trackOrUrl === 'string'
    ? trackOrUrl
    : (trackOrUrl?.thumbnail || trackOrUrl?.coverArt || trackOrUrl?.image || trackOrUrl?.snippet?.thumbnails?.high?.url || trackOrUrl?.snippet?.thumbnails?.medium?.url || '');

  const rawId = explicitId || (typeof trackOrUrl === 'object' ? (trackOrUrl?.videoId || trackOrUrl?.id) : null);
  const id = typeof rawId === 'string' ? rawId.trim() : (rawId?.videoId ? String(rawId.videoId).trim() : null);

  if (id && KNOWN_INVALID_VIDEO_IDS.has(id)) {
    return '';
  }

  // If YouTube video ID is explicitly valid 11-chars, hqdefault is standard
  if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
    if (!url || !isValidThumbnailUrlFormat(url)) {
      url = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
  }

  if (typeof url === 'string') {
    url = url.trim();

    // Check prohibited patterns immediately
    for (const pattern of PROHIBITED_PATTERNS) {
      if (pattern.test(url)) return '';
    }

    if (url.includes('ytimg.com') || url.includes('ggpht.com')) {
      const normalized = url
        .replace(/\/[^/]*hq720[^/]*\.(?:jpg|webp)(?:\?.*)?$/i, '/hqdefault.jpg')
        .replace(/\/[^/]*custom[^/]*\.(?:jpg|webp)(?:\?.*)?$/i, '/hqdefault.jpg')
        .replace(/\/maxresdefault\.(?:jpg|webp)(?:\?.*)?$/i, '/hqdefault.jpg')
        .replace(/\?.*$/i, '');

      return isValidThumbnailUrlFormat(normalized) ? normalized : '';
    }

    return isValidThumbnailUrlFormat(url) ? url : '';
  }

  return '';
}

/**
 * Live verification of a thumbnail URL via network check.
 * Rejects:
 * - Network errors / non-200 responses
 * - Non-image Content-Type (e.g. HTML error pages)
 * - YouTube 1097-byte unavailable placeholders (Content-Length <= 1200)
 */
export async function verifyThumbnailLive(url, timeoutMs = 2500) {
  if (!isValidThumbnailUrlFormat(url)) {
    return { valid: false, reason: 'invalid_format' };
  }

  const now = Date.now();
  const cached = thumbnailCache.get(url);
  if (cached && cached.expiresAt > now) {
    return { valid: cached.valid, reason: cached.reason, cached: true };
  }

  try {
    let res;
    try {
      res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (headErr) {
      // Some CDNs reject HEAD requests; fallback to GET with Range
      res = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-2048' },
        signal: AbortSignal.timeout(timeoutMs)
      });
    }

    if (!res.ok) {
      const result = { valid: false, reason: `http_${res.status}` };
      const ytMatch = url.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//) || url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (ytMatch && ytMatch[1]) invalidateVideoId(ytMatch[1]);
      setCache(url, result);
      return result;
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    // Must be an image MIME type
    if (contentType && !contentType.startsWith('image/')) {
      const result = { valid: false, reason: `non_image_mime_${contentType}` };
      const ytMatch = url.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//) || url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (ytMatch && ytMatch[1]) invalidateVideoId(ytMatch[1]);
      setCache(url, result);
      return result;
    }

    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    // YouTube returns a 1097-byte grey placeholder when video/thumbnail is missing
    if ((url.includes('ytimg.com') || url.includes('youtube.com')) && contentLength > 0 && contentLength <= 1200) {
      const result = { valid: false, reason: 'youtube_unavailable_placeholder' };
      const ytMatch = url.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//) || url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (ytMatch && ytMatch[1]) invalidateVideoId(ytMatch[1]);
      setCache(url, result);
      return result;
    }

    const result = { valid: true };
    setCache(url, result);
    return result;
  } catch (err) {
    const result = { valid: false, reason: `network_error_${err.name || err.message}` };
    setCache(url, result);
    return result;
  }
}

function setCache(url, result) {
  if (thumbnailCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest 500 entries
    const iter = thumbnailCache.keys();
    for (let i = 0; i < 500; i++) {
      const key = iter.next().value;
      if (key) thumbnailCache.delete(key);
      else break;
    }
  }
  thumbnailCache.set(url, {
    valid: result.valid,
    reason: result.reason,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

/**
 * Synchronous pre-flight check for a track's thumbnail.
 * Returns true if thumbnail format is valid and clean.
 */
export function isCandidateTrackValidSync(track) {
  if (!track || typeof track !== 'object') return false;
  const thumb = getCleanTrackThumbnail(track);
  return isValidThumbnailUrlFormat(thumb);
}

/**
 * Live async verification for a single candidate track.
 */
export async function verifyCandidateTrackLive(track, timeoutMs = 2500) {
  if (!isCandidateTrackValidSync(track)) {
    return { valid: false, reason: 'invalid_format' };
  }
  const thumb = getCleanTrackThumbnail(track);
  return verifyThumbnailLive(thumb, timeoutMs);
}

/**
 * Synchronously filters an array of tracks ensuring all returned tracks have valid thumbnail formats.
 */
export function filterTracksWithValidThumbnailsSync(tracks = []) {
  if (!Array.isArray(tracks)) return [];
  return tracks.filter(t => {
    if (!t) return false;
    const cleanThumb = getCleanTrackThumbnail(t);
    if (!isValidThumbnailUrlFormat(cleanThumb)) return false;
    // Mutate/ensure track has the clean validated thumbnail
    t.thumbnail = cleanThumb;
    return true;
  });
}

/**
 * Concurrently verifies tracks against live network check and returns only those with genuine images.
 */
export async function filterTracksWithValidThumbnailsLive(tracks = [], maxConcurrency = 8, timeoutMs = 2500) {
  if (!Array.isArray(tracks) || tracks.length === 0) return [];

  // Pre-filter with sync format check first
  const prefiltered = filterTracksWithValidThumbnailsSync(tracks);
  if (prefiltered.length === 0) return [];

  const verifiedTracks = [];
  const queue = [...prefiltered];

  const worker = async () => {
    while (queue.length > 0) {
      const track = queue.shift();
      if (!track) break;
      const res = await verifyThumbnailLive(track.thumbnail, timeoutMs);
      if (res.valid) {
        verifiedTracks.push(track);
      }
    }
  };

  const pool = [];
  for (let i = 0; i < Math.min(maxConcurrency, prefiltered.length); i++) {
    pool.push(worker());
  }

  await Promise.all(pool);
  return verifiedTracks;
}

export default {
  isValidThumbnailUrlFormat,
  getCleanTrackThumbnail,
  verifyThumbnailLive,
  isCandidateTrackValidSync,
  verifyCandidateTrackLive,
  filterTracksWithValidThumbnailsSync,
  filterTracksWithValidThumbnailsLive
};

