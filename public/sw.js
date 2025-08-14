// Only run service worker in production (HTTPS) or localhost
if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  console.warn('Service Worker requires HTTPS or localhost');
  return;
}

console.log('Tadudi Service Worker v1.0.1 loaded');

const STATIC_CACHE = 'tududi-static-v1.0.1';
const DYNAMIC_CACHE = 'tududi-dynamic-v1.0.1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  console.log('Static assets to cache:', STATIC_ASSETS);
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Cache opened:', STATIC_CACHE);
        // Cache assets one by one to handle failures gracefully
        const cachePromises = STATIC_ASSETS.map(url => {
          console.log('Attempting to cache:', url);
          return cache.add(url).catch(err => {
            console.warn('Failed to cache:', url, err);
            return null; // Continue with other assets
          });
        });
        return Promise.all(cachePromises);
      })
      .then((results) => {
        console.log('Caching completed:', results);
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('Service Worker install failed:', err);
        // Still skip waiting even if caching fails
        self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // Handle API requests differently
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Return offline response for API calls
          return new Response(
            JSON.stringify({ error: 'Offline - Please check your connection' }),
            { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // For static assets, try cache first
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(request)
          .then((response) => {
            // Cache successful responses
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => cache.put(request, responseClone))
                .catch(err => {
                  console.warn('Failed to cache response:', err);
                });
            }
            return response;
          })
          .catch((err) => {
            console.warn('Fetch failed for:', request.url, err);
            // Return offline page for navigation requests
            if (request.destination === 'document') {
              return caches.match('/offline.html');
            }
            // Return a basic offline response for other requests
            return new Response('Offline - Please check your connection', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Implement background sync logic for offline actions
  console.log('Background sync triggered');
}
