import { BACKEND_URL, getApiUrl } from './apiUrl.js';

const BACKOFF_DELAYS = [2000, 4000, 6000]; // 2s, 4s, 6s backoff delays
const COLD_START_STATUS_CODES = new Set([502, 503, 504]);

// Internal state tracking
let isWakingUp = false;
let activeRetriesCount = 0;
let healthCheckPromise = null;

/**
 * Updates the wake-up badge visibility across the application.
 */
function updateWakeUpState(waking) {
  if (isWakingUp === waking) return;
  isWakingUp = waking;
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('loopra:server-wake-status', {
        detail: { isWakingUp: waking }
      }));
    } catch (_) {}
  }
}

/**
 * Ping /api/health to confirm whether the server is awake.
 */
export async function pingServerHealth() {
  if (healthCheckPromise) return healthCheckPromise;
  
  healthCheckPromise = (async () => {
    try {
      const res = await fetch(getApiUrl('/api/health'), {
        method: 'GET',
        cache: 'no-store'
      });
      if (res.ok) {
        updateWakeUpState(false);
        return true;
      }
    } catch (_) {}
    return false;
  })().finally(() => {
    healthCheckPromise = null;
  });

  return healthCheckPromise;
}

/**
 * Executes a fetch request with automatic retries for Render cold-starts
 * (network timeouts / errors, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout).
 * Retries up to 3 times with 2s, 4s, 6s backoff while dispatching wake-up status.
 *
 * @param {string|Request} input - URL or Request object
 * @param {RequestInit} [init] - Fetch options
 * @param {object} [options] - Retry options
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(input, init = {}, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const delays = options.delays || BACKOFF_DELAYS;
  let lastError = null;
  let lastResponse = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(input, init);

      if (COLD_START_STATUS_CODES.has(res.status)) {
        lastResponse = res;
        if (attempt < maxRetries) {
          activeRetriesCount++;
          updateWakeUpState(true);
          const delay = delays[attempt] || delays[delays.length - 1];
          await new Promise(resolve => setTimeout(resolve, delay));
          activeRetriesCount = Math.max(0, activeRetriesCount - 1);
          // Check if health endpoint is now awake
          pingServerHealth();
          continue;
        }
      }

      // If response is successful or non-cold-start error, server is awake
      if (res.ok || (res.status !== 0 && !COLD_START_STATUS_CODES.has(res.status))) {
        if (activeRetriesCount === 0) {
          updateWakeUpState(false);
        }
      }

      return res;
    } catch (err) {
      lastError = err;
      // Network failure, aborted, or connection refused (server still waking up)
      if (attempt < maxRetries && err?.name !== 'AbortError') {
        activeRetriesCount++;
        updateWakeUpState(true);
        const delay = delays[attempt] || delays[delays.length - 1];
        await new Promise(resolve => setTimeout(resolve, delay));
        activeRetriesCount = Math.max(0, activeRetriesCount - 1);
        pingServerHealth();
        continue;
      }
      throw err;
    }
  }

  if (activeRetriesCount === 0) {
    updateWakeUpState(false);
  }

  if (lastResponse) {
    return lastResponse;
  }
  throw lastError || new Error('Request failed after cold-start retries');
}

/**
 * Hook or subscriber for the server waking-up state.
 */
export function subscribeToWakeStatus(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => {
    callback(Boolean(e.detail?.isWakingUp));
  };
  window.addEventListener('loopra:server-wake-status', handler);
  // Send current state immediately
  callback(isWakingUp);
  return () => window.removeEventListener('loopra:server-wake-status', handler);
}
