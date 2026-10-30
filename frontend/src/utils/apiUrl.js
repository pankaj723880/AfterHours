const PROD_RENDER_BACKEND = 'https://afterhours-zvic.onrender.com';

const isLocalhost = typeof window !== 'undefined' && Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.endsWith('.local')
);

let candidateBackend = '';
if (isLocalhost) {
  candidateBackend = import.meta.env.VITE_LOCAL_BACKEND_URL || 'http://localhost:5000';
} else {
  const envVal = (import.meta.env.VITE_BACKEND_URL || '').trim();
  if (envVal && envVal.startsWith('http')) {
    candidateBackend = envVal;
  } else {
    candidateBackend = PROD_RENDER_BACKEND;
  }
}

export const BACKEND_URL = candidateBackend.replace(/\/+$/, '');

export const getApiUrl = (endpoint = '') => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${BACKEND_URL}${cleanEndpoint}`;
};
