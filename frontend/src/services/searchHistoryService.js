/**
 * searchHistoryService.js
 * Persistent management of recent search queries for Loopra.
 * Supports guest localStorage and per-user backend synchronization.
 */

const GUEST_STORAGE_KEY = 'afterhours_recent_searches';

export const getStorageKey = (userId) => {
  return userId ? `afterhours_recent_searches_${userId}` : GUEST_STORAGE_KEY;
};

/**
 * Retrieve recent search queries (max 10)
 */
export const getRecentSearches = (userId = null) => {
  if (typeof window === 'undefined') return [];
  try {
    const key = getStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item === 'string' && item.trim().length > 0)
      .slice(0, 10);
  } catch (err) {
    console.warn('[Search History] Failed to read recent searches:', err.message);
    return [];
  }
};

/**
 * Sync search history to backend if logged in
 */
export const syncSearchHistoryToBackend = async (searches, userId, token, backendUrl) => {
  if (!userId || !token || !backendUrl) return;
  try {
    const cleanUrl = backendUrl.replace(/\/+$/, '');
    await fetch(`${cleanUrl}/api/user/${userId}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ searchHistory: searches })
    });
  } catch (err) {
    console.warn('[Search History Sync Warning]:', err.message);
  }
};

/**
 * Save a submitted search query. Moves repeated search to the top, preserves original text.
 * Max 10 items.
 */
export const saveRecentSearch = (query, userId = null, { token = null, backendUrl = null } = {}) => {
  if (!query || typeof query !== 'string') return getRecentSearches(userId);
  const trimmed = query.trim();
  if (!trimmed) return getRecentSearches(userId);

  try {
    const key = getStorageKey(userId);
    const current = getRecentSearches(userId);
    // Remove if already exists (case-insensitive check, but keep the new original text)
    const filtered = current.filter(
      (item) => item.toLowerCase() !== trimmed.toLowerCase()
    );
    const updated = [trimmed, ...filtered].slice(0, 10);

    localStorage.setItem(key, JSON.stringify(updated));

    if (userId && token && backendUrl) {
      syncSearchHistoryToBackend(updated, userId, token, backendUrl);
    }

    return updated;
  } catch (err) {
    console.warn('[Search History] Failed to save search query:', err.message);
    return getRecentSearches(userId);
  }
};

/**
 * Remove an individual search query from recent history
 */
export const removeRecentSearch = (queryToRemove, userId = null, { token = null, backendUrl = null } = {}) => {
  if (!queryToRemove || typeof queryToRemove !== 'string') return getRecentSearches(userId);
  const trimmed = queryToRemove.trim().toLowerCase();

  try {
    const key = getStorageKey(userId);
    const current = getRecentSearches(userId);
    const updated = current.filter((item) => item.toLowerCase() !== trimmed);

    localStorage.setItem(key, JSON.stringify(updated));

    if (userId && token && backendUrl) {
      syncSearchHistoryToBackend(updated, userId, token, backendUrl);
    }

    return updated;
  } catch (err) {
    console.warn('[Search History] Failed to remove search query:', err.message);
    return getRecentSearches(userId);
  }
};

/**
 * Clear all recent searches
 */
export const clearAllRecentSearches = (userId = null, { token = null, backendUrl = null } = {}) => {
  try {
    const key = getStorageKey(userId);
    localStorage.removeItem(key);

    if (userId && token && backendUrl) {
      syncSearchHistoryToBackend([], userId, token, backendUrl);
    }

    return [];
  } catch (err) {
    console.warn('[Search History] Failed to clear search history:', err.message);
    return [];
  }
};
