// Frontend client for Loopra Gemini AI-Powered Recommendations & Listening Events

// LocalStorage preference keys
const LOCAL_TASTE_KEY = 'afterhours_taste_profile_v2';
const LOCAL_RECS_CACHE_KEY = 'afterhours_personalized_recs_v2';

export const recommendationsClient = {
  /**
   * Helper to retrieve offline/local taste profile
   */
  getLocalTasteProfile() {
    try {
      const raw = localStorage.getItem(LOCAL_TASTE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  },

  /**
   * Updates offline/local taste profile from user interactions (likes, skips, search, plays)
   */
  updateLocalTasteProfile(eventData) {
    try {
      const current = this.getLocalTasteProfile() || {
        likes: [],
        skips: [],
        searchPicks: [],
        chipPicks: [],
        topArtists: {},
        recentTracks: [],
        updatedAt: Date.now()
      };

      const { trackId, title, artist, eventType, chip, query } = eventData || {};
      if (trackId && eventType === 'like') {
        if (!current.likes.includes(trackId)) current.likes.push(trackId);
        current.skips = current.skips.filter(id => id !== trackId);
      } else if (trackId && (eventType === 'skip' || eventType === 'dislike')) {
        if (!current.skips.includes(trackId)) current.skips.push(trackId);
        current.likes = current.likes.filter(id => id !== trackId);
      }

      if (artist && artist !== 'Unknown Artist') {
        const delta = eventType === 'like' ? 5 : eventType === 'skip' ? -3 : 2;
        current.topArtists[artist] = Math.max(0, (current.topArtists[artist] || 0) + delta);
      }

      if (chip && !current.chipPicks.includes(chip)) {
        current.chipPicks.push(chip);
      }

      if (query && !current.searchPicks.includes(query)) {
        current.searchPicks.push(query);
      }

      if (trackId && title) {
        current.recentTracks = [
          { trackId, title, artist, timestamp: Date.now() },
          ...current.recentTracks.filter(t => t.trackId !== trackId)
        ].slice(0, 20);
      }

      current.updatedAt = Date.now();
      localStorage.setItem(LOCAL_TASTE_KEY, JSON.stringify(current));
    } catch (_) {}
  },

  /**
   * Fetches personalized recommendations for the authenticated user.
   */
  async getPersonalized(backendUrl, token, forceRefresh = false) {
    if (!token) {
      return { success: false, unauthenticated: true };
    }

    const url = `${backendUrl.replace(/\/+$/, '')}/api/recommendations/personalized${forceRefresh ? '?refresh=true' : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch recommendations (${res.status})`);
    }

    return await res.json();
  },

  /**
   * Fetches Daily Mix tracks with optional pagination and exclusion support.
   */
  async getDailyMix(backendUrl, token, { limit = 10, offset = 0, excludeIds = [], excludeKeys = [] } = {}) {
    if (!token) return { success: false, items: [] };

    let url = `${backendUrl.replace(/\/+$/, '')}/api/recommendations/daily-mix?limit=${limit}&offset=${offset}`;
    if (excludeIds.length > 0) {
      url += `&excludeIds=${encodeURIComponent(excludeIds.join(','))}`;
    }
    if (excludeKeys.length > 0) {
      url += `&excludeKeys=${encodeURIComponent(excludeKeys.join(','))}`;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) return { success: false, items: [] };
    return await res.json();
  },

  /**
   * Fetches discovery tracks with optional pagination, token awareness, and exclusion support.
   */
  async getDiscover(backendUrl, token = null, { limit = 12, offset = 0, excludeIds = [], excludeKeys = [] } = {}) {
    let url = `${backendUrl.replace(/\/+$/, '')}/api/recommendations/discover?limit=${limit}&offset=${offset}`;
    if (excludeIds.length > 0) {
      url += `&excludeIds=${encodeURIComponent(excludeIds.join(','))}`;
    }
    if (excludeKeys.length > 0) {
      url += `&excludeKeys=${encodeURIComponent(excludeKeys.join(','))}`;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!res.ok) return { success: false, items: [] };
    return await res.json();
  },

  /**
   * Fetches personalized home feed (Trending Songs, Popular Albums, Popular Radio)
   * tailored to the user's or guest's listening history while minimizing YouTube quota.
   */
  async getHomeFeed(backendUrl, token = null, guestId = null, limit = 12) {
    const base = (backendUrl || '').replace(/\/+$/, '');
    let url = `${base}/api/recommendations/home-feed?limit=${limit}`;
    if (guestId) {
      url += `&guestId=${encodeURIComponent(guestId)}`;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (guestId) {
      headers['X-Guest-ID'] = guestId;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  },

  /**
   * Sends a listening event to the backend with timeout protection.
   * Supports both authenticated users and guest users with guestId.
   */
  async logListeningEvent(backendUrl, token, eventData) {
    if (!eventData?.trackId || !eventData?.title) return;

    const base = (backendUrl || '').replace(/\/+$/, '');
    const url = `${base}/api/listening-events`;
    try {
      let guestId = eventData?.guestId || null;
      if (!guestId && typeof window !== 'undefined') {
        guestId = localStorage.getItem('afterhours_session_id') || null;
      }

      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (guestId) {
        headers['X-Guest-ID'] = guestId;
      }

      const payload = {
        ...eventData,
        guestId: guestId || eventData?.guestId
      };

      // Also persist to local taste profile for instant offline/guest personalization
      this.updateLocalTasteProfile(payload);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
        keepalive: true
      });
      clearTimeout(timeoutId);
    } catch (err) {
      // Non-blocking background telemetry notice - player remains unaffected
    }
  },

  /**
   * Requests a manual fresh calculation of recommendations.
   */
  async refreshRecommendations(backendUrl, token) {
    if (!token) throw new Error('Authentication required');

    const url = `${backendUrl.replace(/\/+$/, '')}/api/recommendations/refresh`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to refresh recommendations');
    }
    return data;
  },

  /**
   * Updates recommendation privacy preferences (e.g. toggle personalization).
   */
  async updatePreferences(backendUrl, token, preferences) {
    if (!token) throw new Error('Authentication required');

    const url = `${backendUrl.replace(/\/+$/, '')}/api/recommendations/preferences`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(preferences)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to update preferences');
    }
    return await res.json();
  }
};

