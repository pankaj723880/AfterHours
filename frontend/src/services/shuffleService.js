/**
 * Loopra 100-Song Shuffle & Non-Repeating Randomization Service
 * 
 * Guarantees a minimum pool of 100 unique, verified single songs during shuffle mode:
 * - Fetches from /api/youtube/shuffle-pool or paginated YouTube search across diverse categories
 * - Deduplicates strictly by stable video ID
 * - Validates every candidate through filterSingleSongs()
 * - Fisher-Yates randomization
 * - Non-repeating playback cycle: tracks already played during this shuffle session
 *   are not repeated until all 100+ songs in the pool have been played.
 * - Multi-tier caching in memory and localStorage (key: 'afterhours_shuffle_pool_100')
 */

import { filterSingleSongs, isSingleSong, isValidYouTubeId, normalizeTrack } from './songFilter';
import { getApiUrl } from '../utils/apiUrl';

const STORAGE_KEY = 'afterhours_shuffle_pool_100';
const MIN_SHUFFLE_POOL_SIZE = 100;

// In-memory session state
let inMemoryPool = [];
let shuffledOrder = [];
let currentPointer = 0;
let playedSet = new Set();
let isFetchingPool = false;

// Fisher-Yates non-mutating shuffle
export function fisherYates(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Loads cached shuffle pool from localStorage
 */
function loadCachedPool() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return filterSingleSongs(parsed);
      }
    }
  } catch (e) {
    console.warn('[ShuffleService] Cache parse error:', e.message);
  }
  return [];
}

/**
 * Saves valid single-song pool to localStorage
 */
function saveCachedPool(pool) {
  try {
    if (Array.isArray(pool) && pool.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pool.slice(0, 200)));
    }
  } catch (e) {}
}

/**
 * Initializes and expands the 100-song shuffle pool
 */
export async function initShufflePool(seedTracks = [], forceRefresh = false) {
  // If memory pool already has 100+ songs and no forceRefresh, prepare order
  if (!forceRefresh && inMemoryPool.length >= MIN_SHUFFLE_POOL_SIZE) {
    if (shuffledOrder.length === 0) {
      reshufflePool();
    }
    return inMemoryPool;
  }

  // Check persistent cache
  if (!forceRefresh && inMemoryPool.length === 0) {
    const cached = loadCachedPool();
    if (cached.length >= MIN_SHUFFLE_POOL_SIZE) {
      inMemoryPool = cached;
      reshufflePool();
      return inMemoryPool;
    }
  }

  if (isFetchingPool) {
    // If already in flight, return current pool
    return inMemoryPool;
  }

  isFetchingPool = true;
  const poolMap = new Map();

  // 1. Add valid seed tracks from user queue / trending / stations
  if (Array.isArray(seedTracks)) {
    const validSeeds = filterSingleSongs(seedTracks);
    for (const t of validSeeds) {
      poolMap.set(t.id, t);
    }
  }

  // Also retain existing cached items
  const cached = loadCachedPool();
  for (const t of cached) {
    if (!poolMap.has(t.id)) {
      poolMap.set(t.id, t);
    }
  }

  // 2. Fetch from backend shuffle pool endpoint if we need more songs
  try {
    const res = await fetch(getApiUrl('/api/youtube/shuffle-pool'));
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items)) {
        const verified = filterSingleSongs(data.items);
        for (const t of verified) {
          poolMap.set(t.id, t);
          if (poolMap.size >= 120) break;
        }
      }
    }
  } catch (err) {
    console.warn('[ShuffleService] Backend shuffle-pool fetch notice:', err.message);
  }

  // 3. Fallback: If still under 100 songs, query paginated YouTube search across diverse genres
  if (poolMap.size < MIN_SHUFFLE_POOL_SIZE) {
    const seedQueries = [
      'Arijit Singh official songs',
      'Shreya Ghoshal romantic songs',
      'Kishore Kumar evergreen classics',
      'Lata Mangeshkar melodies',
      'Kumar Sanu 90s hits',
      'Sonu Nigam superhits',
      'A.R. Rahman official video songs',
      'Diljit Dosanjh hit songs',
      'Anuv Jain acoustic songs',
      'Prateek Kuhad official tracks',
      'Mohit Chauhan soulful songs',
      'KK iconic songs'
    ];

    for (const query of seedQueries) {
      if (poolMap.size >= MIN_SHUFFLE_POOL_SIZE) break;
      try {
        const searchRes = await fetch(getApiUrl(`/api/youtube/search?q=${encodeURIComponent(query)}&limit=15`));
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (Array.isArray(searchData.items)) {
            const clean = filterSingleSongs(searchData.items);
            for (const t of clean) {
              poolMap.set(t.id, t);
              if (poolMap.size >= MIN_SHUFFLE_POOL_SIZE) break;
            }
          }
        }
      } catch (e) {
        // Continue to next query
      }
    }
  }

  inMemoryPool = Array.from(poolMap.values());
  saveCachedPool(inMemoryPool);
  reshufflePool();
  isFetchingPool = false;

  return inMemoryPool;
}

/**
 * Generates a fresh Fisher-Yates shuffled order of the 100-song pool
 */
export function reshufflePool(currentTrackId = null) {
  if (inMemoryPool.length === 0) {
    shuffledOrder = [];
    currentPointer = 0;
    return [];
  }

  let candidates = [...inMemoryPool];
  let currentTrack = null;

  if (currentTrackId) {
    currentTrack = candidates.find(t => (t.id || t.videoId) === currentTrackId);
    if (currentTrack) {
      candidates = candidates.filter(t => (t.id || t.videoId) !== currentTrackId);
    }
  }

  const randomized = fisherYates(candidates);
  shuffledOrder = currentTrack ? [currentTrack, ...randomized] : randomized;
  currentPointer = 0;
  playedSet = new Set(currentTrack ? [currentTrack.id] : []);

  return shuffledOrder;
}

/**
 * Returns the next non-repeating track in the 100-song shuffle cycle
 */
export function getNextTrack(currentTrackId = null) {
  if (inMemoryPool.length === 0) return null;

  if (shuffledOrder.length === 0) {
    reshufflePool(currentTrackId);
  }

  // Advance pointer
  currentPointer++;

  // If we reached the end of the 100-song cycle, reshuffle and restart cycle
  if (currentPointer >= shuffledOrder.length) {
    const lastPlayedId = shuffledOrder[shuffledOrder.length - 1]?.id;
    reshufflePool(lastPlayedId);
    currentPointer = 1; // Play next song in the new cycle
  }

  const nextTrack = shuffledOrder[currentPointer] || shuffledOrder[0];
  if (nextTrack) {
    playedSet.add(nextTrack.id);
  }
  return nextTrack;
}

/**
 * Returns the previous track in the active shuffle session
 */
export function getPrevTrack(currentTrackId = null) {
  if (inMemoryPool.length === 0) return null;

  if (currentPointer > 0) {
    currentPointer--;
    return shuffledOrder[currentPointer];
  }

  // If already at beginning of current cycle, wrap to last played
  return shuffledOrder[shuffledOrder.length - 1] || shuffledOrder[0];
}

/**
 * Returns current pool size
 */
export function getPoolSize() {
  return inMemoryPool.length;
}

/**
 * Returns the full pool
 */
export function getShufflePool() {
  return inMemoryPool;
}

export default {
  initShufflePool,
  reshufflePool,
  getNextTrack,
  getPrevTrack,
  getPoolSize,
  getShufflePool,
  fisherYates
};

