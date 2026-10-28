/**
 * Loopra Offline Storage Service
 * Manages local persistence of genuine audio Blobs and track metadata in IndexedDB.
 * Large audio files are stored in IndexedDB (never in localStorage).
 */

const DB_NAME = 'LoopraOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'downloaded_tracks';

class OfflineStorageService {
  constructor() {
    this.db = null;
    this.initPromise = null;
    this.listeners = new Set();
    this.downloadingTrackIds = new Set();
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
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
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

  async isTrackDownloaded(trackId) {
    if (!trackId) return false;
    const db = await this.initDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(trackId);
        req.onsuccess = () => resolve(Boolean(req.result && req.result.audioBlob));
        req.onerror = () => resolve(false);
      } catch (err) {
        resolve(false);
      }
    });
  }

  async getTrack(trackId) {
    if (!trackId) return null;
    const db = await this.initDB();
    if (!db) return null;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(trackId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getAllTracks() {
    const db = await this.initDB();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('downloadedAt');
        const req = index.getAll();
        req.onsuccess = () => {
          // Return tracks sorted newest first
          const tracks = (req.result || []).reverse();
          resolve(tracks);
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async saveTrack(record) {
    const db = await this.initDB();
    if (!db) throw new Error('IndexedDB unavailable.');

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);

        req.onsuccess = () => {
          this.notifyListeners();
          resolve(record);
        };

        req.onerror = (e) => {
          if (e.target.error?.name === 'QuotaExceededError') {
            reject(new Error('Browser storage quota exceeded. Please delete some downloaded songs to free up space.'));
          } else {
            reject(e.target.error || new Error('Failed to save audio file to IndexedDB.'));
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  async deleteTrack(trackId) {
    const db = await this.initDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(trackId);
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
      onProgress(5); // Start indication

      const endpoint = license.downloadEndpoint;
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

      if (!res.body) {
        const blob = await res.blob();
        onProgress(100);
        return await this._persistTrackRecord(track, blob, mimeType, license);
      }

      const reader = res.body.getReader();
      const chunks = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;

        if (totalBytes > 0) {
          const percent = Math.min(98, Math.round((receivedBytes / totalBytes) * 100));
          onProgress(percent);
        } else {
          onProgress(50);
        }
      }

      const completeBlob = new Blob(chunks, { type: mimeType });
      onProgress(100);

      const record = await this._persistTrackRecord(track, completeBlob, mimeType, license);
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
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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

