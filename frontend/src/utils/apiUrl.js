const isLocalhost = typeof window !== 'undefined' && Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.endsWith('.local')
);

const rawBackendUrl = isLocalhost
  ? (import.meta.env.VITE_LOCAL_BACKEND_URL || 'http://localhost:5000')
  : (import.meta.env.VITE_BACKEND_URL || 'https://afterhours-zvic.onrender.com');

export const BACKEND_URL = (rawBackendUrl || '').trim().replace(/\/+$/, '');

export const getApiUrl = (endpoint = '') => {
  const cleanEndpoint = endpoint.replace(/^\/+/, '/');
  return `${BACKEND_URL}${cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`}`;
};
