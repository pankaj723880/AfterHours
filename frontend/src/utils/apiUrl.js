const PROD_RENDER_BACKEND = 'https://afterhours-zvic.onrender.com';

const isLocalhost = typeof window !== 'undefined' && Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.endsWith('.local')
);

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});

let candidateBackend = '';
if (isLocalhost) {
  candidateBackend = env.VITE_LOCAL_BACKEND_URL || 'http://localhost:5000';
} else {
  // If running in browser and VITE_BACKEND_URL is explicitly set to an active backend URL, respect it
  const envVal = (env.VITE_BACKEND_URL || '').trim();
  if (envVal && envVal.startsWith('http')) {
    candidateBackend = envVal;
  } else if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')) {
    // Relative origin fallback through Vercel rewrites (/socket.io and /api) to prevent CORS or dormant endpoint locks
    candidateBackend = window.location.origin;
  } else {
    candidateBackend = PROD_RENDER_BACKEND;
  }
}

export const BACKEND_URL = candidateBackend.replace(/\/+$/, '');

export const getApiUrl = (endpoint = '') => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${BACKEND_URL}${cleanEndpoint}`;
};
