import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getApiUrl } from '../utils/apiUrl';
import { getDefaultVisibilityMap, UI_VISIBILITY_REGISTRY } from '../constants/uiVisibilityRegistry';

const UI_CONFIG_STORAGE_KEY = 'loopra_ui_visibility_cache';

const UiConfigContext = createContext({
  visibility: getDefaultVisibilityMap(),
  isVisible: () => true,
  isLoading: false,
  lastUpdated: null,
  updateVisibility: async () => {},
  resetToDefaults: async () => {}
});

export const UiConfigProvider = ({ children, socket }) => {
  // 1. Initial State: Read from localStorage cache, merging with default true values
  const [visibility, setVisibility] = useState(() => {
    const defaults = getDefaultVisibilityMap();
    if (typeof window === 'undefined') return defaults;
    try {
      const cached = localStorage.getItem(UI_CONFIG_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return { ...defaults, ...parsed };
      }
    } catch (_) {}
    return defaults;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // 2. Fetch remote UI Config from GET /api/ui-config on initial app mount
  const fetchUiConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(getApiUrl('/api/ui-config'));
      if (res.ok) {
        const data = await res.json();
        if (data && data.visibility) {
          const defaults = getDefaultVisibilityMap();
          const merged = { ...defaults, ...data.visibility };
          setVisibility(merged);
          setLastUpdated(data.lastUpdated || new Date().toISOString());
          try {
            localStorage.setItem(UI_CONFIG_STORAGE_KEY, JSON.stringify(merged));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[UiConfigProvider] Network fetch failed, using fallback cache:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUiConfig();
  }, [fetchUiConfig]);

  // 3. Socket.io Real-Time Listener: Listen for 'ui:config:updated' to show/hide live
  useEffect(() => {
    if (!socket) return;

    const handleSocketUiUpdate = (data) => {
      if (data && data.visibility) {
        const defaults = getDefaultVisibilityMap();
        const merged = { ...defaults, ...data.visibility };
        setVisibility(merged);
        setLastUpdated(data.lastUpdated || new Date().toISOString());
        try {
          localStorage.setItem(UI_CONFIG_STORAGE_KEY, JSON.stringify(merged));
        } catch (_) {}
      }
    };

    socket.on('ui:config:updated', handleSocketUiUpdate);

    return () => {
      socket.off('ui:config:updated', handleSocketUiUpdate);
    };
  }, [socket]);

  // 4. isVisible checker function with fail-safe true default
  const isVisible = useCallback((key) => {
    if (!key) return true;
    // Guaranteed to default to true if key is not found or not boolean
    const val = visibility[key];
    return typeof val === 'boolean' ? val : true;
  }, [visibility]);

  // 5. Admin API updater: PATCH /api/admin/ui-config
  const updateVisibility = useCallback(async (updates, token) => {
    if (!updates || typeof updates !== 'object') return false;

    // Optimistically update local state
    setVisibility(prev => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(UI_CONFIG_STORAGE_KEY, JSON.stringify(next));
      } catch (_) {}
      return next;
    });

    try {
      const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(getApiUrl('/api/admin/ui-config'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({ updates })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update UI visibility');
      }

      const resData = await res.json();
      if (resData.visibility) {
        const defaults = getDefaultVisibilityMap();
        const merged = { ...defaults, ...resData.visibility };
        setVisibility(merged);
        try {
          localStorage.setItem(UI_CONFIG_STORAGE_KEY, JSON.stringify(merged));
        } catch (_) {}
      }
      return true;
    } catch (err) {
      console.error('[UiConfigProvider] Update error:', err);
      // Re-fetch to roll back optimistic state if server rejected
      fetchUiConfig();
      throw err;
    }
  }, [fetchUiConfig]);

  // 6. Reset All to Visible
  const resetToDefaults = useCallback(async (token) => {
    const defaults = getDefaultVisibilityMap();
    setVisibility(defaults);
    try {
      localStorage.setItem(UI_CONFIG_STORAGE_KEY, JSON.stringify(defaults));
    } catch (_) {}

    try {
      const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(getApiUrl('/api/admin/ui-config'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({ resetAll: true })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to reset UI visibility');
      }
      return true;
    } catch (err) {
      console.error('[UiConfigProvider] Reset error:', err);
      fetchUiConfig();
      throw err;
    }
  }, [fetchUiConfig]);

  const value = useMemo(() => ({
    visibility,
    isVisible,
    isLoading,
    lastUpdated,
    updateVisibility,
    resetToDefaults,
    refetch: fetchUiConfig
  }), [visibility, isVisible, isLoading, lastUpdated, updateVisibility, resetToDefaults, fetchUiConfig]);

  return (
    <UiConfigContext.Provider value={value}>
      {children}
    </UiConfigContext.Provider>
  );
};

export const useUiConfig = () => {
  return useContext(UiConfigContext);
};

export default UiConfigContext;
