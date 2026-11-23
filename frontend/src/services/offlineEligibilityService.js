/**
 * Loopra Offline Eligibility Service
 * Centralized service to check and cache track offline download eligibility.
 * 
 * Strict Principle:
 * Default ALL tracks to offlineEligible: false.
 * Only tracks with an explicitly verified, server-controlled authorization record
 * are marked as eligible.
 */

import { getTabAuthToken } from '../utils/storage.js';

class OfflineEligibilityService {
  constructor() {
    this.cache = new Map(); // trackId -> { eligible: boolean, license: object|null, reason: string, checkedAt: number }
    this.pendingIds = new Set();
    this.listeners = new Set();
    this.batchTimeout = null;
    this.backendUrl = '';
    this.downloadsEnabled = true;
  }

  setBackendUrl(url) {
    this.backendUrl = (url || '').trim().replace(/\/+$/, '');
  }

  setDownloadsEnabled(enabled) {
    this.downloadsEnabled = Boolean(enabled);
  }

  isEligible(trackId) {
    if (!this.downloadsEnabled) return false;
    if (!trackId) return false;
    const entry = this.cache.get(trackId);
    return Boolean(entry && entry.eligible === true);
  }

  getLicense(trackId) {
    if (!this.downloadsEnabled) return null;
    if (!trackId) return null;
    const entry = this.cache.get(trackId);
    return entry?.license || null;
  }

  getReason(trackId) {
    if (!this.downloadsEnabled) {
      return 'Offline downloads are currently disabled by administrator.';
    }
    if (!trackId) return 'No licensing verification performed.';
    const entry = this.cache.get(trackId);
    return entry?.reason || 'Licensing verification pending or unavailable.';
  }

  hasChecked(trackId) {
    return this.cache.has(trackId);
  }

  /**
   * Register verified track licenses returned directly from the authorized tracks endpoint
   */
  registerEligibleTrack(track) {
    if (!track || !track.id) return;
    this.cache.set(track.id, {
      eligible: Boolean(track.offlineEligible),
      license: track.license || null,
      reason: 'Verified by offline licensing catalog.',
      checkedAt: Date.now()
    });
  }

  registerEligibleTracks(tracks = []) {
    if (!Array.isArray(tracks)) return;
    tracks.forEach(t => this.registerEligibleTrack(t));
    this.notifyListeners();
  }

  /**
   * Queue track IDs for batch verification
   */
  queueEligibilityCheck(trackIds = []) {
    if (!Array.isArray(trackIds)) return;
    const unverified = trackIds.filter(id => id && !this.cache.has(id));
    if (unverified.length === 0) return;

    unverified.forEach(id => this.pendingIds.add(id));

    if (this.batchTimeout) clearTimeout(this.batchTimeout);
    this.batchTimeout = setTimeout(() => {
      this._flushPendingChecks();
    }, 150);
  }

  async _flushPendingChecks() {
    if (this.pendingIds.size === 0) return;

    const idsToFetch = Array.from(this.pendingIds).slice(0, 100);
    idsToFetch.forEach(id => this.pendingIds.delete(id));

    if (!this.downloadsEnabled) {
      idsToFetch.forEach(id => {
        this.cache.set(id, {
          eligible: false,
          license: null,
          reason: 'Offline downloads are disabled by administrator.',
          checkedAt: Date.now()
        });
      });
      this.notifyListeners();
      return;
    }

    try {
      const url = `${this.backendUrl}/api/offline/eligibility/batch`;
      const token = getTabAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ trackIds: idsToFetch })
      });

      if (!res.ok) {
        if (res.status === 403) {
          // Administrator has disabled offline downloads
          this.downloadsEnabled = false;
          idsToFetch.forEach(id => {
            this.cache.set(id, {
              eligible: false,
              license: null,
              reason: 'Offline downloads are disabled by administrator.',
              checkedAt: Date.now()
            });
          });
          return;
        }
        throw new Error(`Eligibility check failed with status ${res.status}`);
      }

      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        data.results.forEach(item => {
          this.cache.set(item.trackId, {
            eligible: Boolean(item.offlineEligible),
            license: item.license || null,
            reason: item.reason || '',
            checkedAt: Date.now()
          });
        });
      }
    } catch (err) {
      console.warn('[Offline Eligibility Service] Verification network error:', err.message);
      // Mark as ineligible on error to prevent any unauthorized download attempt
      idsToFetch.forEach(id => {
        if (!this.cache.has(id)) {
          this.cache.set(id, {
            eligible: false,
            license: null,
            reason: 'Licensing verification service could not be reached.',
            checkedAt: Date.now()
          });
        }
      });
    } finally {
      this.notifyListeners();
    }
  }

  /**
   * Directly verify a single track immediately
   */
  async checkTrack(trackId) {
    if (!trackId) return { eligible: false, license: null };
    if (!this.downloadsEnabled) {
      return {
        eligible: false,
        license: null,
        reason: 'Offline downloads are disabled by administrator.',
        checkedAt: Date.now()
      };
    }
    if (this.cache.has(trackId)) {
      return this.cache.get(trackId);
    }

    try {
      const url = `${this.backendUrl}/api/offline/eligibility/${encodeURIComponent(trackId)}`;
      const token = getTabAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        const entry = {
          eligible: Boolean(data.offlineEligible),
          license: data.license || null,
          reason: data.reason || '',
          checkedAt: Date.now()
        };
        this.cache.set(trackId, entry);
        this.notifyListeners();
        return entry;
      }
      if (res.status === 403) {
        this.downloadsEnabled = false;
        const entry = {
          eligible: false,
          license: null,
          reason: 'Offline downloads are disabled by administrator.',
          checkedAt: Date.now()
        };
        this.cache.set(trackId, entry);
        this.notifyListeners();
        return entry;
      }
    } catch (e) {
      console.warn('[Offline Eligibility Service]:', e.message);
    }

    const fallback = {
      eligible: false,
      license: null,
      reason: 'Offline download eligibility could not be verified.',
      checkedAt: Date.now()
    };
    this.cache.set(trackId, fallback);
    return fallback;
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

export const offlineEligibilityService = new OfflineEligibilityService();

