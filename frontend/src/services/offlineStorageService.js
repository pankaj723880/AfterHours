/**
 * Loopra Offline Storage Service
 * Manages local persistence of genuine audio Blobs and track metadata in IndexedDB.
 * Large audio files are stored in IndexedDB (never in localStorage).
 */

import { getApiUrl } from '../utils/apiUrl';

const DB_NAME = 'LoopraOfflineCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'cached_tracks';
const CACHE_API_NAME = 'loopra-offline-songs';
const METADATA_LOCAL_STORAGE_KEY = 'loopra_offline_tracks_meta';

// Safe Cache Hygiene & Storage Limits
const MAX_CACHED_TRACKS = 50; // Keep up to 50 recent offline tracks

class OfflineStorageService {
  constructor() {
    this.db = null;
    this.initPromise = null;
    this.listeners = new Set();
    this.downloadingTrackIds = new Set();
    this.isDownloadsEnabled = true;

    // Initialize from cached CMS config if present in localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem('afterhours_cms_public_config');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.featureControls && typeof parsed.featureControls.offlineDownloadsEnabled === 'boolean') {
            this.isDownloadsEnabled = parsed.featureControls.offlineDownloadsEnabled;
          }
        }
      } catch (_) {}
    }
  }

  setDownloadsEnabled(enabled) {
    const nextVal = enabled !== false;
    if (this.isDownloadsEnabled !== nextVal) {
      this.isDownloadsEnabled = nextVal;
      this.notifyListeners();
    }
  }

  isNativeAppWrapper() {
    return typeof window !== 'undefined' && Boolean(window.LoopraAndroid);
  }

  isDownloadsGloballyEnabled() {
    if (this.isNativeAppWrapper()) {
      return false;
    }
    return this.isDownloadsEnabled !== false;
  }

  async initDB() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
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
        this.db = e.target.result;
        resolve(this.db);
      };

      req.onerror = (e) => {
        console.error('[IndexedDB] Init error:', e.target.error);
        reject(e.target.error);
      };
    });

    return this.initPromise;
  }

  _extractVideoId(trackOrId) {
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

  async isTrackDownloaded(trackOrId) {
    const videoId = this._extractVideoId(trackOrId);
    if (!videoId) return false;

    // Check IndexedDB first
    const db = await this.initDB();
    if (db) {
      const fromDB = await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(videoId);
          req.onsuccess = () => resolve(Boolean(req.result && req.result.audioBlob && req.result.audioBlob.size > 50000));
          req.onerror = () => resolve(false);
        } catch (err) {
          resolve(false);
        }
      });
      if (fromDB) return true;
    }

    // Fallback: Check Cache API (loopra-offline-songs)
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CACHE_API_NAME);
        const match = await cache.match(`/api/audio-stream/${encodeURIComponent(videoId)}`);
        if (match) return true;
      } catch (_) {}
    }

    return false;
  }

  async getTrack(trackOrId) {
    const videoId = this._extractVideoId(trackOrId);
    if (!videoId) return null;

    // Try IndexedDB first
    const db = await this.initDB();
    if (db) {
      const fromDB = await new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(videoId);
          req.onsuccess = () => {
            const res = req.result;
            if (res && res.audioBlob && res.audioBlob.size > 50000) {
              resolve(res);
            } else {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        } catch (err) {
          resolve(null);
        }
      });
      if (fromDB) return fromDB;
    }

    // Try Cache API fallback
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CACHE_API_NAME);
        const match = await cache.match(`/api/audio-stream/${encodeURIComponent(videoId)}`);
        if (match) {
          const blob = await match.blob();
          if (blob && blob.size > 50000) {
            // Read metadata from localStorage
            let meta = {};
            try {
              const raw = localStorage.getItem(METADATA_LOCAL_STORAGE_KEY);
              const list = raw ? JSON.parse(raw) : [];
              meta = list.find(item => (item.videoId || item.id) === videoId) || {};
            } catch (_) {}

            return {
              id: videoId,
              videoId,
              title: meta.title || 'Downloaded Track',
              artist: meta.artist || 'Loopra Artist',
              thumbnail: meta.thumbnail || '',
              duration: meta.duration || '',
              audioBlob: blob,
              fileSize: blob.size,
              mimeType: blob.type || 'audio/mp4',
              isOffline: true,
              cachedAt: meta.cachedAt || Date.now()
            };
          }
        }
      } catch (_) {}
    }

    return null;
  }

  async getAllTracks() {
    const db = await this.initDB();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          // Filter out corrupt / non-real blobs and sort newest first
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

  _syncMetadataToLocalStorage(record, isDelete = false) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(METADATA_LOCAL_STORAGE_KEY);
      let list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];

      const vid = record?.videoId || record?.id;
      list = list.filter(item => (item.videoId || item.id) !== vid);

      if (!isDelete && record) {
        list.unshift({
          id: vid,
          videoId: vid,
          title: record.title || 'Untitled Track',
          artist: record.artist || record.channel || 'Loopra Artist',
          thumbnail: record.thumbnail || '',
          duration: record.duration || '',
          cachedAt: record.cachedAt || Date.now(),
          fileSize: record.fileSize || 0
        });
      }

      localStorage.setItem(METADATA_LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
    } catch (_) {}
  }

  async saveTrack(record) {
    const db = await this.initDB();
    if (!db) throw new Error('IndexedDB unavailable.');

    // Request persistent browser storage so audio survives across restarts & clears
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        await navigator.storage.persist();
      } catch (_) {}
    }

    // Mirror to Cache API (loopra-offline-songs) for service worker / Cache API compatibility
    if (typeof window !== 'undefined' && 'caches' in window && record.audioBlob) {
      try {
        const cache = await window.caches.open(CACHE_API_NAME);
        const cacheRequest = new Request(`/api/audio-stream/${encodeURIComponent(record.videoId || record.id)}`);
        const cacheResponse = new Response(record.audioBlob, {
          status: 200,
          headers: {
            'Content-Type': record.mimeType || 'audio/mp4',
            'Content-Length': String(record.fileSize || record.audioBlob.size),
            'X-Loopra-Offline': 'true'
          }
        });
        await cache.put(cacheRequest, cacheResponse);
      } catch (cacheErr) {
        console.warn('[OfflineStorage] Cache API put notice:', cacheErr?.message || cacheErr);
      }
    }

    // Mirror metadata to LocalStorage for quick listing and offline inspection
    this._syncMetadataToLocalStorage(record, false);

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);

        req.onsuccess = async () => {
          this.notifyListeners();
          // Safe LRU Eviction: Prune oldest tracks if cache exceeds limit
          try {
            await this.pruneExcessTracks(MAX_CACHED_TRACKS);
          } catch (_) {}
          resolve(record);
        };

        req.onerror = (e) => {
          if (e.target.error?.name === 'QuotaExceededError') {
            reject(new Error('Browser storage quota exceeded. Please remove some cached songs to free up space.'));
          } else {
            reject(e.target.error || new Error('Failed to save audio file to IndexedDB.'));
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Safely prunes older cached audio entries to respect MAX_CACHED_TRACKS.
   */
  async pruneExcessTracks(limit = MAX_CACHED_TRACKS) {
    try {
      const all = await this.getAllTracks();
      if (all.length > limit) {
        // Sort ascending by cachedAt (oldest first)
        all.sort((a, b) => (a.cachedAt || 0) - (b.cachedAt || 0));
        const excess = all.slice(0, all.length - limit);
        for (const item of excess) {
          await this.deleteTrack(item.videoId);
        }
      }
    } catch (_) {}
  }

  async deleteTrack(trackOrId) {
    const videoId = this._extractVideoId(trackOrId);
    if (!videoId) return;

    // Remove from Cache API
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CACHE_API_NAME);
        await cache.delete(`/api/audio-stream/${encodeURIComponent(videoId)}`);
      } catch (_) {}
    }

    // Remove from LocalStorage metadata
    this._syncMetadataToLocalStorage({ videoId }, true);

    const db = await this.initDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(videoId);
        req.onsuccess = () => {
          this.notifyListeners();
          resolve(true);
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async clearAllTracks() {
    // Clear Cache API
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        await window.caches.delete(CACHE_API_NAME);
      } catch (_) {}
    }

    // Clear LocalStorage metadata
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(METADATA_LOCAL_STORAGE_KEY);
      } catch (_) {}
    }

    const db = await this.initDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => {
          this.notifyListeners();
          resolve(true);
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Downloads actual audio stream from authorized endpoint, tracking progress percentage,
   * validates MIME type & size, and stores the binary Blob in IndexedDB.
   */
  async downloadAndStoreTrack(track, license, onProgress = () => { }) {
    if (!this.isDownloadsGloballyEnabled()) {
      throw new Error('Downloads are currently disabled by the site administrator.');
    }

    if (!track || !track.id) {
      throw new Error('Invalid track information for download.');
    }

    if (!license || !license.downloadEndpoint) {
      throw new Error('No verified download license found for this track.');
    }

    if (this.downloadingTrackIds.has(track.id)) {
      throw new Error('Download is already in progress for this track.');
    }

    const alreadyDownloaded = await this.isTrackDownloaded(track.id);
    if (alreadyDownloaded) {
      throw new Error('This track is already downloaded to your Offline Library.');
    }

    this.downloadingTrackIds.add(track.id);
    this.notifyListeners();

    try {
      onProgress({ percent: 1, downloadedBytes: 0, totalBytes: license.audioSizeBytes || null, status: 'connecting' });

      const endpoint = license.downloadEndpoint.startsWith('http') ? license.downloadEndpoint : getApiUrl(license.downloadEndpoint);
      const res = await fetch(endpoint);

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Offline download permission was denied by the licensing server.');
        }
        throw new Error(`Download failed with status ${res.status}: ${res.statusText}`);
      }

      const contentLengthHeader = res.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : (license.audioSizeBytes || 0);
      const mimeType = res.headers.get('content-type') || license.audioMimeType || 'audio/wav';

      let completeBlob;

      if (!res.body) {
        const blob = await res.blob();
        completeBlob = blob;
        onProgress({ percent: 99, downloadedBytes: blob.size, totalBytes: totalBytes || blob.size, status: 'finalizing' });
      } else {
        const reader = res.body.getReader();
        const chunks = [];
        let receivedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          receivedBytes += value.length;

          if (totalBytes > 0) {
            const calculatedPercent = Math.min(98, Math.max(1, Math.round((receivedBytes / totalBytes) * 100)));
            onProgress({
              percent: calculatedPercent,
              downloadedBytes: receivedBytes,
              totalBytes: totalBytes,
              status: 'downloading'
            });
          } else {
            onProgress({
              percent: null,
              downloadedBytes: receivedBytes,
              totalBytes: null,
              status: 'downloading'
            });
          }
        }

        onProgress({ percent: 99, downloadedBytes: receivedBytes, totalBytes: totalBytes || receivedBytes, status: 'finalizing' });
        completeBlob = new Blob(chunks, { type: mimeType });
      }

      const record = await this._persistTrackRecord(track, completeBlob, mimeType, license);
      onProgress({ percent: 100, downloadedBytes: completeBlob.size, totalBytes: completeBlob.size, status: 'completed' });
      return record;
    } finally {
      this.downloadingTrackIds.delete(track.id);
      this.notifyListeners();
    }
  }

  async _persistTrackRecord(track, blob, mimeType, license) {
    if (!blob || blob.size === 0) {
      throw new Error('Received empty audio file from provider.');
    }

    const record = {
      id: track.id,
      videoId: track.videoId || track.id,
      title: track.title,
      artist: track.artist || track.channel || 'Unknown Artist',
      channel: track.channel || track.artist || 'Loopra',
      thumbnail: track.thumbnail || track.image || '',
      duration: track.duration || '',
      mimeType: mimeType || blob.type || 'audio/wav',
      fileSize: blob.size,
      downloadedAt: new Date().toISOString(),
      audioBlob: blob,
      isOffline: true,
      license: {
        provider: license.provider || 'direct_license',
        permissionScope: license.permissionScope || 'offline_download_permitted',
        licenseType: license.licenseType || 'Verified License',
        licenseReference: license.licenseReference || '',
        verifiedBy: license.verifiedBy || 'system',
        verifiedAt: license.verifiedAt || new Date().toISOString()
      }
    };

    await this.saveTrack(record);
    return record;
  }

  isDownloading(trackId) {
    return this.downloadingTrackIds.has(trackId);
  }

  async getStorageUsage() {
    const tracks = await this.getAllTracks();
    const totalBytes = tracks.reduce((sum, t) => sum + (t.fileSize || 0), 0);

    let quota = null;
    let quotaUsage = null;
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        quota = estimate.quota || null;
        quotaUsage = estimate.usage || null;
      } catch (e) { }
    }

    return {
      trackCount: tracks.length,
      totalBytes,
      formattedTotal: this.formatBytes(totalBytes),
      quota,
      quotaUsage,
      formattedQuota: quota ? this.formatBytes(quota) : 'Unknown'
    };
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Universal audio caching method: fetches audio blob via /api/stream/cache/:videoId
   * or direct license endpoint and saves it into IndexedDB.
   */
  async cacheTrackAudio(track, onProgress = () => {}) {
    if (!this.isDownloadsGloballyEnabled()) {
      throw new Error('Downloads are currently disabled by the site administrator.');
    }
    if (!track) throw new Error('Invalid track data');
    const videoId = this._extractVideoId(track);
    if (!videoId) throw new Error('Track has no valid YouTube video ID');

    if (this.downloadingTrackIds.has(videoId)) {
      return; // Already in progress
    }

    const alreadyCached = await this.isTrackDownloaded(videoId);
    if (alreadyCached) {
      return await this.getTrack(videoId);
    }

    this.downloadingTrackIds.add(videoId);
    this.notifyListeners();

    try {
      // Step 1: Connecting to stream endpoint
      onProgress({ percent: 1, downloadedBytes: 0, totalBytes: null, status: 'connecting' });

      // Request persistent storage permission immediately
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        try { await navigator.storage.persist(); } catch (_) {}
      }

      // Check if track has an authorized download endpoint in its license metadata
      let streamUrl = track.license?.downloadEndpoint
        ? (track.license.downloadEndpoint.startsWith('http') ? track.license.downloadEndpoint : getApiUrl(track.license.downloadEndpoint))
        : getApiUrl(`/api/audio-stream/${encodeURIComponent(videoId)}`);

      // Set timeout for stream connection to prevent indefinite freeze
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      let res;
      try {
        res = await fetch(streamUrl, { signal: controller.signal });
      } catch (fetchErr) {
        console.error('[OfflineStorage] Stream fetch failed at connecting stage:', {
          videoId,
          streamUrl,
          name: fetchErr?.name,
          message: fetchErr?.message
        });
        if (fetchErr.name === 'AbortError') {
          throw new Error('Streaming connection timed out after 20s. Backend is waking up or provider is unreachable.');
        }
        throw new Error(`Network/CORS error while fetching audio stream: ${fetchErr?.message || 'Unknown error'}`);
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        let errorBody = '';
        try {
          errorBody = await res.text();
        } catch (_) {}
        console.error('[OfflineStorage] Stream HTTP error at 1% stage:', {
          videoId,
          streamUrl,
          status: res.status,
          statusText: res.statusText,
          contentType: res.headers.get('content-type'),
          contentLength: res.headers.get('content-length'),
          body: errorBody.slice(0, 300)
        });
        let parsedMsg = '';
        try {
          const jsonErr = JSON.parse(errorBody);
          parsedMsg = jsonErr?.error || jsonErr?.message || '';
        } catch (_) {}
        throw new Error(
          parsedMsg ||
          (res.status === 403 || res.status === 404 || res.status === 502
            ? `Direct audio caching is unavailable for this YouTube track (HTTP ${res.status}).`
            : `Failed to fetch audio stream for caching (HTTP ${res.status})`)
        );
      }

      const contentLengthHeader = res.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : (track.license?.audioSizeBytes || null);
      const mimeType = res.headers.get('content-type') || 'audio/mp4';

      let completeBlob;

      if (!res.body) {
        const arrayBuffer = await res.arrayBuffer();
        completeBlob = new Blob([arrayBuffer], { type: mimeType });
        onProgress({ percent: 99, downloadedBytes: completeBlob.size, totalBytes: completeBlob.size, status: 'finalizing' });
      } else {
        const reader = res.body.getReader();
        const chunks = [];
        let receivedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          receivedBytes += value.length;

          if (totalBytes && totalBytes > 0) {
            const calculatedPercent = Math.min(98, Math.max(1, Math.round((receivedBytes / totalBytes) * 100)));
            onProgress({
              percent: calculatedPercent,
              downloadedBytes: receivedBytes,
              totalBytes: totalBytes,
              status: 'downloading'
            });
          } else {
            // Indeterminate total size: report actual downloaded bytes
            onProgress({
              percent: null,
              downloadedBytes: receivedBytes,
              totalBytes: null,
              status: 'downloading'
            });
          }
        }

        onProgress({ percent: 99, downloadedBytes: receivedBytes, totalBytes: totalBytes || receivedBytes, status: 'finalizing' });
        completeBlob = new Blob(chunks, { type: mimeType });
      }

      // Verify real audio file size > 50,000 bytes
      if (!completeBlob || completeBlob.size < 50000) {
        throw new Error('Downloaded audio stream was incomplete or empty (< 50 KB)');
      }

      const record = {
        videoId: videoId,
        id: videoId,
        title: track.title || 'Untitled Track',
        artist: track.artist || track.channel || 'Loopra Artist',
        channel: track.channel || track.artist || 'Loopra',
        thumbnail: track.thumbnail || track.image || '',
        duration: track.duration || '',
        mimeType: mimeType,
        fileSize: completeBlob.size,
        audioBlob: completeBlob,
        isOffline: true,
        cachedAt: Date.now()
      };

      await this.saveTrack(record);
      onProgress({ percent: 100, downloadedBytes: completeBlob.size, totalBytes: completeBlob.size, status: 'completed' });

      // Enforce auto-session cache limit (keep last 25 tracks)
      this.pruneCacheLimit(25).catch(() => {});

      return record;
    } finally {
      this.downloadingTrackIds.delete(videoId);
      this.notifyListeners();
    }
  }

  /**
   * Auto-Session Caching: Keep the cache cleanly bounded (e.g., last 25 tracks)
   */
  async pruneCacheLimit(maxTracks = 25) {
    try {
      const allTracks = await this.getAllTracks();
      if (allTracks.length > maxTracks) {
        // allTracks is sorted newest first, so tracks beyond index maxTracks are the oldest
        const toPrune = allTracks.slice(maxTracks);
        for (const item of toPrune) {
          await this.deleteTrack(item.id);
        }
      }
    } catch (err) {
      console.warn('[OfflineStorage] Cache pruning error:', err);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    this.listeners.forEach(fn => {
      try { fn(); } catch (e) { }
    });
  }
}

export const offlineStorageService = new OfflineStorageService();

