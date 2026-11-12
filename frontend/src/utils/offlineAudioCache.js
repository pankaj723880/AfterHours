/**
 * Loopra Offline Audio Cache Utility
 * Database: LoopraOfflineCacheDB
 * Object Store: cached_tracks
 * Key: videoId
 */

import { getApiUrl } from './apiUrl';

const DB_NAME = 'LoopraOfflineCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'cached_tracks';

let dbInstance = null;
let dbInitPromise = null;
const cacheListeners = new Set();
const cachingInProgress = new Set();

/**
 * Cleanly extracts an 11-character YouTube videoId or fallback string.
 */
export function extractCleanVideoId(trackOrId) {
  if (!trackOrId) return '';
  if (typeof trackOrId === 'string') {
    const trimmed = trackOrId.trim();
    const match = trimmed.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|^)([a-zA-Z0-9_-]{11})(?:[\&\?\/]|$)/);
    if (match) return match[1];
    return trimmed;
  }
  const candidate = trackOrId.videoId || trackOrId.id?.videoId || trackOrId.id || '';
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    const match = trimmed.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|^)([a-zA-Z0-9_-]{11})(?:[\&\?\/]|$)/);
    if (match) return match[1];
    return trimmed;
  }
  return '';
}

/**
 * Initializes and returns the IndexedDB instance.
 */
export async function initOfflineAudioCacheDB() {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'videoId' });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
        store.createIndex('artist', 'artist', { unique: false });
      }
    };

    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    req.onerror = (e) => {
      console.error('[LoopraOfflineCacheDB] Init error:', e.target.error);
      reject(e.target.error);
    };
  });

  return dbInitPromise;
}

/**
 * Checks if a track exists with a valid audioBlob in IndexedDB.
 */
export async function isTrackCachedInDB(trackOrId) {
  const videoId = extractCleanVideoId(trackOrId);
  if (!videoId) return false;
  const db = await initOfflineAudioCacheDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(videoId);
      req.onsuccess = () => {
        const item = req.result;
        resolve(Boolean(item && item.audioBlob && item.audioBlob.size > 50000));
      };
      req.onerror = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}

/**
 * Retrieves the cached audio record from IndexedDB.
 */
export async function getCachedAudioFromDB(trackOrId) {
  const videoId = extractCleanVideoId(trackOrId);
  if (!videoId) return null;
  const db = await initOfflineAudioCacheDB();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(videoId);
      req.onsuccess = () => {
        const item = req.result;
        if (item && item.audioBlob && item.audioBlob.size > 50000) {
          resolve(item);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieves all valid cached songs.
 */
export async function getAllCachedAudiosFromDB() {
  const db = await initOfflineAudioCacheDB();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const tracks = (req.result || [])
          .filter(t => t && t.audioBlob && t.audioBlob.size > 50000)
          .sort((a, b) => (b.cachedAt || 0) - (a.cachedAt || 0));
        resolve(tracks);
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Downloads the actual audio stream from /api/audio-stream/:videoId and commits to IndexedDB.
 */
export async function cacheSongToDB(track, onProgress = () => {}) {
  if (!track) throw new Error('Invalid track information');
  const videoId = extractCleanVideoId(track);
  if (!videoId) throw new Error('Cannot cache track: missing valid videoId');

  if (cachingInProgress.has(videoId)) {
    return; // Already actively caching
  }

  const already = await isTrackCachedInDB(videoId);
  if (already) {
    return await getCachedAudioFromDB(videoId);
  }

  cachingInProgress.add(videoId);
  notifyCacheListeners();

  try {
    onProgress(10);
    // Request persistent storage permission immediately
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try { await navigator.storage.persist(); } catch (_) {}
    }

    const streamUrl = getApiUrl(`/api/audio-stream/${encodeURIComponent(videoId)}`);
    const res = await fetch(streamUrl);
    if (!res.ok) {
      throw new Error(`Server returned ${res.status} when fetching audio stream`);
    }

    onProgress(30);

    const arrayBuffer = await res.arrayBuffer();
    onProgress(85);

    const audioBlob = new Blob([arrayBuffer], { type: 'audio/mp4' });

    // Enforce real audio bytes verification (> 50,000 bytes)
    if (!audioBlob || audioBlob.size < 50000) {
      throw new Error(`Incomplete audio payload received (${audioBlob?.size || 0} bytes). Must be > 50 KB.`);
    }

    const record = {
      videoId,
      id: videoId,
      title: track.title || 'Untitled Track',
      artist: track.artist || track.channel || 'Loopra Artist',
      channel: track.channel || track.artist || 'Loopra',
      thumbnail: track.thumbnail || track.image || '',
      duration: track.duration || '',
      mimeType: 'audio/mp4',
      fileSize: audioBlob.size,
      audioBlob,
      isOffline: true,
      cachedAt: Date.now()
    };

    const db = await initOfflineAudioCacheDB();
    if (!db) throw new Error('IndexedDB unavailable');

    await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => reject(req.error || new Error('Failed to put audio into IndexedDB'));
      } catch (err) {
        reject(err);
      }
    });

    onProgress(100);
    notifyCacheListeners();
    return record;
  } finally {
    cachingInProgress.delete(videoId);
    notifyCacheListeners();
  }
}

/**
 * Removes a single track from the cache.
 */
export async function removeCachedSongFromDB(trackOrId) {
  const videoId = extractCleanVideoId(trackOrId);
  if (!videoId) return false;
  const db = await initOfflineAudioCacheDB();
  if (!db) return false;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(videoId);
      req.onsuccess = () => {
        notifyCacheListeners();
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Clears all cached tracks.
 */
export async function clearAllCachedSongsFromDB() {
  const db = await initOfflineAudioCacheDB();
  if (!db) return false;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => {
        notifyCacheListeners();
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

export function isCachingActive(trackOrId) {
  const videoId = extractCleanVideoId(trackOrId);
  return cachingInProgress.has(videoId);
}

export function subscribeOfflineCache(fn) {
  cacheListeners.add(fn);
  return () => cacheListeners.delete(fn);
}

function notifyCacheListeners() {
  cacheListeners.forEach(fn => {
    try { fn(); } catch (_) {}
  });
}

