const CACHE_NAME = 'loopra-v6-shell';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/loopra-logo.png',
  '/apple-touch-icon.png'
];

// Install event - precache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('[SW] Precache skipped optional resource:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up all old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Clearing outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - cache-first for static shell assets, network-first for pages, pass-through for APIs/YouTube
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass API requests, non-GET requests, or third-party streaming
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket.io') ||
    url.origin.includes('youtube.com') ||
    url.origin.includes('googlevideo.com') ||
    url.origin.includes('ytimg.com')
  ) {
    return;
  }

  // HTML page navigations: Network first, fall back to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // Static assets: Cache first with network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.png') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.ico') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        // Return nothing if unreachable
      });
    })
  );
});
