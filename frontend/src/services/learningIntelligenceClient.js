/**
 * AI Learning Intelligence Engine Client
 * Provides passive, non-blocking telemetry ingestion and Admin Dashboard API queries.
 */

export const learningIntelligenceClient = {
  /**
   * Passively records a behavior event if user is authenticated.
   * Completely non-blocking and fails silent to never impact user experience.
   */
  async recordEvent(backendUrl, token, { category, eventType, metadata = {}, eventId = null }) {
    if (!token || !backendUrl) return;
    try {
      const base = backendUrl.replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      fetch(`${base}/api/learning-intelligence/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ category, eventType, metadata, eventId }),
        signal: controller.signal,
        keepalive: true
      })
        .then(() => clearTimeout(timeoutId))
        .catch(() => clearTimeout(timeoutId));
    } catch (e) {
      // Passive silent catch
    }
  },

  /**
   * Fetches overall intelligence stats for Admin Dashboard (Admin only).
   */
  async getOverview(backendUrl, token) {
    if (!token || !backendUrl) throw new Error('Authentication required');
    const base = backendUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}/api/learning-intelligence/admin/overview`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to fetch overview`);
    }
    return res.json();
  },

  /**
   * Fetches paginated/searchable list of users and their learning profiles (Admin only).
   */
  async getUsers(backendUrl, token, { search = '', page = 1, limit = 15 } = {}) {
    if (!token || !backendUrl) throw new Error('Authentication required');
    const base = backendUrl.replace(/\/+$/, '');
    const params = new URLSearchParams({ search, page, limit });
    const res = await fetch(`${base}/api/learning-intelligence/admin/users?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to fetch users`);
    }
    return res.json();
  },

  /**
   * Fetches individual user's complete learned profile (Admin only).
   */
  async getUserDetail(backendUrl, token, userId) {
    if (!token || !backendUrl || !userId) throw new Error('User ID and authentication required');
    const base = backendUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}/api/learning-intelligence/admin/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to fetch user profile`);
    }
    return res.json();
  },

  /**
   * Manually triggers an immediate learning batch processing cycle (Admin only).
   */
  async processBatchNow(backendUrl, token, limit = 100) {
    if (!token || !backendUrl) throw new Error('Authentication required');
    const base = backendUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}/api/learning-intelligence/admin/process-now`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ limit })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to process batch`);
    }
    return res.json();
  },

  /**
   * Deletes a user's learning profile and derived intelligence data (Admin only).
   */
  async deleteUserProfile(backendUrl, token, userId) {
    if (!token || !backendUrl || !userId) throw new Error('User ID and authentication required');
    const base = backendUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}/api/learning-intelligence/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Failed to delete user profile`);
    }
    return res.json();
  }
};

