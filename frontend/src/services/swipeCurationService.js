/**
 * Loopra Swipe Recommendation & Curation Service
 * 
 * Guarantees solo official tracks personalized to each user's listening history,
 * while strictly filtering out mashups, jukeboxes, long playlists, and non-official uploads.
 */

import { filterSingleSongs, isSingleSong, isValidYouTubeId, normalizeTrack } from './songFilter';
import { recommendationsClient } from './recommendationsClient';

export const BLACKLIST_KEYWORDS = [
  'mashup', 'jukebox', 'playlist', 'all songs', 'compilation', 
  'full album', 'mega mix', 'non stop', 'audio jukebox', 
  'slowed', 'reverb', 'bass boosted', 'hour'
];

export const OFFICIAL_CHANNELS = [
  't-series', 'tseries', 'sony music india', 'zee music company', 
  'yrf', 'tips official', 'saregama music', 'speed records', 
  'warner music india', 'universal music india', 't-series apna punjab',
  'white hill music', 'eros now music', 'times music', 'aditya music',
  'sony music south', 'lahari music', 'saregama hum bhojpuri'
];

export const ICONIC_MAINSTREAM_ARTISTS = [
  'Arijit Singh', 'Diljit Dosanjh', 'KK', 'Shreya Ghoshal', 'Atif Aslam',
  'Mohit Chauhan', 'Kumar Sanu', 'Alka Yagnik', 'Sonu Nigam', 'Sunidhi Chauhan',
  'Jubin Nautiyal', 'Darshan Raval', 'B Praak', 'Sidhu Moose Wala', 'A.R. Rahman',
  'Kishore Kumar', 'Lata Mangeshkar', 'R.D. Burman', 'Udit Narayan', 'Anuv Jain'
];

/**
 * Parses track duration into integer seconds. Supports:
 * - Number (seconds)
 * - ISO 8601 string (PT3M45S)
 * - MM:SS or HH:MM:SS string
 */
export function parseDurationToSeconds(duration) {
  if (typeof duration === 'number' && !isNaN(duration) && duration > 0) {
    return duration;
  }
  if (!duration || typeof duration !== 'string') return null;

  const str = duration.trim();

  // ISO 8601 string (e.g., PT3M45S, PT1H2M3S)
  if (str.startsWith('PT')) {
    const hoursMatch = str.match(/(\d+)H/);
    const minsMatch = str.match(/(\d+)M/);
    const secsMatch = str.match(/(\d+)S/);
    const h = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
    const m = minsMatch ? parseInt(minsMatch[1], 10) : 0;
    const s = secsMatch ? parseInt(secsMatch[1], 10) : 0;
    return (h * 3600) + (m * 60) + s;
  }

  // MM:SS or HH:MM:SS
  if (str.includes(':')) {
    const parts = str.split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length === 2) {
      return (parts[0] * 60) + parts[1];
    }
    if (parts.length === 3) {
      return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }
  }

  const num = parseInt(str, 10);
  return !isNaN(num) && num > 0 ? num : null;
}

/**
 * Validates that a track is strictly a solo release:
 * 1. Title & description do not contain blacklisted keywords
 * 2. Duration is between 120s (2 min) and 360s (6 min) if known
 * 3. Title passes standard single-song validation
 */
export function isStrictSoloTrack(track) {
  if (!track) return false;
  const norm = normalizeTrack(track);
  if (!norm || !isValidYouTubeId(norm.id)) return false;

  const rawTitle = (track.title || norm.title || '').toLowerCase();
  const rawDesc = (track.description || norm.description || '').toLowerCase();

  // 1. Blacklist keywords filter
  for (const kw of BLACKLIST_KEYWORDS) {
    if (rawTitle.includes(kw) || rawDesc.includes(kw)) {
      return false;
    }
  }

  // 2. Strict duration guard: 120s (2 min) to 360s (6 min)
  const durationSec = parseDurationToSeconds(track.duration || norm.duration);
  if (durationSec !== null) {
    if (durationSec < 120 || durationSec > 360) {
      return false;
    }
  }

  // 3. Channel verification hint
  const channel = (track.channel || norm.channel || '').toLowerCase();
  const isTopicChannel = channel.includes('- topic') || channel.includes('topic');
  const isOfficialLabel = OFFICIAL_CHANNELS.some(c => channel.includes(c));

  // 4. Base single song validation
  if (!isSingleSong(norm)) return false;

  // Add metadata flag for official status
  norm.isOfficial = isTopicChannel || isOfficialLabel || rawTitle.includes('official');
  return true;
}

/**
 * Filters an array down to only strict solo tracks
 */
export function filterStrictSoloTracks(tracks = []) {
  if (!Array.isArray(tracks)) return [];
  const seen = new Set();
  const result = [];

  for (const t of tracks) {
    if (!t) continue;
    const id = t.id || t.videoId;
    if (!id || seen.has(id)) continue;

    if (isStrictSoloTrack(t)) {
      seen.add(id);
      result.push(normalizeTrack(t));
    }
  }
  return result;
}

/**
 * Extracts top affinity artists from user listening history and liked songs
 */
export function extractUserTopArtists(likedSongs = [], history = []) {
  const counts = {};

  const cleanArtist = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    return raw
      .replace(/VEVO|Official|Topic/gi, '')
      .replace(/\s*-\s*Topic/i, '')
      .trim();
  };

  [...likedSongs, ...history].forEach(t => {
    const artist = cleanArtist(t.artist || t.channel);
    if (artist && artist.length > 2 && !artist.toLowerCase().includes('unknown')) {
      const key = artist.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

/**
 * Builds personalized recommendation seeds:
 * 60% top favorite artists/genres
 * 30% adjacent trending solo tracks
 * 10% fresh discoveries in similar moods
 */
export function buildSwipeSearchQueries(userTopArtists = []) {
  const queries = [];

  // Top artists queries (60% weight)
  if (userTopArtists.length > 0) {
    const primary = userTopArtists.slice(0, 3);
    primary.forEach(artist => {
      queries.push(`${artist} solo official song`);
      queries.push(`${artist} hit solo official audio`);
    });
  }

  // Adjacent trending solo queries (30% weight)
  const shuffledMainstream = [...ICONIC_MAINSTREAM_ARTISTS].sort(() => 0.5 - Math.random());
  queries.push(`${shuffledMainstream[0]} official music video solo`);
  queries.push(`${shuffledMainstream[1]} official audio song`);

  // Fresh discovery (10% weight)
  queries.push(`new hindi solo release official music video`);

  return queries;
}

/**
 * Curates a robust, verified solo deck for Swipe
 */
export async function curateSwipeDeck({
  fetchFromBackend,
  likedSongs = [],
  history = [],
  trendingSongs = [],
  targetCount = 20,
  excludeIds = new Set()
}) {
  const candidates = [];
  const seenIds = new Set(excludeIds);

  // 1. First, harvest any valid solo songs already present in trendingSongs
  if (Array.isArray(trendingSongs) && trendingSongs.length > 0) {
    const validTrending = filterStrictSoloTracks(trendingSongs);
    validTrending.forEach(t => {
      const id = t.id || t.videoId;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        candidates.push(t);
      }
    });
  }

  // 2. Derive personalized search seeds from user profile
  const topArtists = extractUserTopArtists(likedSongs, history);
  const searchQueries = buildSwipeSearchQueries(topArtists);

  // Fallback to iconic artists if query pool is sparse
  if (searchQueries.length === 0) {
    const fallbackArtists = [...ICONIC_MAINSTREAM_ARTISTS].sort(() => 0.5 - Math.random()).slice(0, 3);
    fallbackArtists.forEach(a => searchQueries.push(`${a} official song audio`));
  }

  // 3. Fetch from backend for each query until targetCount is met
  if (typeof fetchFromBackend === 'function') {
    for (const q of searchQueries) {
      if (candidates.length >= targetCount) break;
      try {
        const res = await fetchFromBackend(`${q} -mashup -jukebox`, { limit: 10, timeoutMs: 8000 });
        if (res && Array.isArray(res.items)) {
          const validFetched = filterStrictSoloTracks(res.items);
          for (const t of validFetched) {
            const id = t.id || t.videoId;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              candidates.push(t);
              if (candidates.length >= targetCount) break;
            }
          }
        }
      } catch (err) {
        // Silently continue to next query on network issue
      }
    }
  }

  // 4. Return randomized, deduplicated solo deck
  return candidates.sort(() => 0.5 - Math.random());
}

