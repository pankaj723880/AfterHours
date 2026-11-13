import { useEffect } from 'react';
import { pingServerHealth } from '../utils/errorHandler';
import { getApiUrl } from '../utils/apiUrl';

const KEEP_ALIVE_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

/**
 * Custom React hook that pings ${VITE_API_URL}/api/health immediately on mount
 * and every 14 minutes silently in the background with cache: 'no-store'.
 * 
 * Prevents Render.com free-tier instances from going to sleep during active user sessions.
 */
export function useServerKeepAlive() {
  useEffect(() => {
    const rawApiUrl =
      (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env && (process.env.VITE_API_URL || process.env.VITE_BACKEND_URL)) ||
      '';

    const healthEndpoint = rawApiUrl
      ? `${rawApiUrl.replace(/\/+$/, '')}/api/health`
      : getApiUrl('/api/health');

    const ping = () => {
      fetch(healthEndpoint, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      })
        .then((res) => {
          if (res.ok) {
            // Also synchronize global wake-up state tracking
            pingServerHealth().catch(() => {});
          }
        })
        .catch(() => {});
    };

    // Immediate ping on app load
    ping();

    // Scheduled ping every 14 minutes
    const intervalId = setInterval(ping, KEEP_ALIVE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);
}

export default useServerKeepAlive;

