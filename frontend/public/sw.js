const CACHE_NAME = 'loopra-v8-shell';
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

// Install event - precache core shell resiliently (never fail on missing optional icons)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        APP_SHELL.map(async (url) => {
          try {
            await cache.add(url);
          } catch (err) {
            console.warn('[SW] Precache skipped optional resource:', url, err?.message || err);
          }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up all outdated caches and claim clients immediately
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

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Bypass API, WebSocket, audio streams, and browser extension requests
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket.io') ||
    url.origin.includes('youtube.com') ||
    url.origin.includes('googlevideo.com') ||
    url.origin.includes('ytimg.com') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return;
  }

  // 2. Allow third-party requests (e.g. Google Fonts) to be handled natively by browser
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. HTML page navigations: Network First, falling back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached =
            (await caches.match('/index.html', { ignoreSearch: true })) ||
            (await caches.match('/', { ignoreSearch: true }));
          if (cached) return cached;
          return new Response('Offline - Loopra is temporarily unavailable', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // 4. Vite static assets (/assets/*): Cache First with Network Fallback
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) return cached;
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const contentType = networkResponse.headers.get('content-type') || '';
            // Anti-poisoning check: NEVER cache HTML responses for .js or .css requests (e.g. SPA 404 rewrite)
            const isInvalidType =
              (url.pathname.endsWith('.js') && !contentType.includes('javascript')) ||
              (url.pathname.endsWith('.css') && !contentType.includes('css'));
            if (!isInvalidType) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
          }
          return networkResponse;
        } catch (_) {
          return new Response('Asset not available offline', {
            status: 404,
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      })
    );
    return;
  }

  // 5. Public shell assets (manifest.json, icons, images)
  // Use ignoreSearch: true so manifest.json?v=3 and icons match cached versions
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(async (cached) => {
      if (cached) return cached;
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      } catch (_) {
        // Fallback for manifest or icons if requested with query string
        const fallback = await caches.match(url.pathname, { ignoreSearch: true });
        if (fallback) return fallback;
        return new Response('', { status: 404, statusText: 'Not Found' });
      }
    })
  );
});

// =========================================================================
// ADVANCED PWA CAPABILITIES: Background Sync, Periodic Sync, Push Notifications
// =========================================================================

// Background Sync: Replay pending offline interactions & sync playback state
self.addEventListener('sync', (event) => {
  if (event.tag === 'loopra-sync-likes' || event.tag === 'loopra-background-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'LOOPRA_BACKGROUND_SYNC_TRIGGER', tag: event.tag });
        });
      })
    );
  }
});

// Periodic Background Sync: Refresh station metadata & cached playlists in background
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'loopra-periodic-update' || event.tag === 'get-daily-mix') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const resp = await fetch('/manifest.json');
          if (resp && resp.status === 200) {
            await cache.put('/manifest.json', resp);
          }
        } catch (_) {}
      })
    );
  }
});

// Push Notifications: Display incoming broadcast / radio release notifications
self.addEventListener('push', (event) => {
  let data = {
    title: 'Loopra Music',
    body: 'New live radio station and curated tracks are ready.',
    icon: '/icon-192.png?v=3',
    badge: '/favicon.png?v=3',
    tag: 'loopra-notification',
    data: { url: '/' }
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (_) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: data.data,
      vibrate: [100, 50, 100]
    })
  );
});

// Notification Click: Focus existing client or open target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
