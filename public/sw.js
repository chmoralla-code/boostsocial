// Minimal Service Worker to enable PWA installability.
// It implements a Network-First strategy for pages to ensure the admin dashboard
// always has the absolute latest live data and reflects new features immediately.

const CACHE_NAME = 'cynetwork-pwa-cache-v2';
const STATIC_ASSETS = [
  '/icon.svg',
  '/next.svg',
  '/vercel.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Only intercept HTTP/HTTPS GET requests
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // For API requests, Supabase database queries, or admin data calls,
  // we MUST always go straight to the network (Network Only) to prevent stale data.
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/admin') ||
    request.method !== 'GET' ||
    url.host.includes('supabase.co')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Network First strategy for other pages and static files:
  // Fetch from the network first. If that succeeds, update cache and return response.
  // If the network fails (offline), fall back to the cache.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
