// Frontend client for Loopra Gemini AI-Powered Recommendations & Listening Events

export const recommendationsClient = {
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
   * Sends a listening event to the backend with timeout protection.
   */
  async logListeningEvent(backendUrl, token, eventData) {
    if (!token || !eventData?.trackId || !eventData?.title) return;

    const base = (backendUrl || '').replace(/\/+$/, '');
    const url = `${base}/api/listening-events`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(eventData),
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

