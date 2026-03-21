const CACHE_NAME = 'inventory-pos-v3';
const STATIC_CACHE = 'static-v3';
const API_CACHE = 'api-v3';
const IMAGE_CACHE = 'images-v3';

const staticUrlsToCache = [
  '/',
  '/Wheezard logo.png',
  '/bg wheezard.jpg',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event - cache static resources
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('✅ Opened static cache');
        return cache.addAll(staticUrlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE && cacheName !== IMAGE_CACHE) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Only cache successful GET requests
          if (response.ok && request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(API_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Try cache first for GET requests
          if (request.method === 'GET') {
            return caches.match(request).then(cached => {
              if (cached) {
                console.log('📱 Serving from cache:', request.url);
                return cached;
              }
            });
          }
          // Return offline fallback for other API requests
          return new Response(
            JSON.stringify({ 
              error: 'Offline - request queued for sync',
              queued: true,
              url: request.url 
            }),
            { 
              status: 503, 
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Image requests - cache first, network fallback
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          return cached;
        }
        return fetch(request).then(response => {
          const responseClone = response.clone();
          caches.open(IMAGE_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        });
      })
    );
    return;
  }

  // Static assets - stale-while-revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Serve from cache immediately, then update in background
        fetch(request).then(response => {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
        }).catch(() => {
          // Network failed, but we have cached version
          console.log('📱 Serving stale version:', request.url);
        });
        return cached;
      }
      
      // Not in cache, fetch from network
      return fetch(request).then(response => {
        const responseClone = response.clone();
        caches.open(STATIC_CACHE).then(cache => {
          cache.put(request, responseClone);
        });
        return response;
      });
    })
  );
});

// Listen for messages from the client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'FORCE_SYNC') {
    console.log('🔄 Force sync requested');
    // Notify all clients about sync status
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_STATUS',
          status: 'started'
        });
      });
    });
  }
});

// Background sync event (if supported)
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('🔄 Background sync triggered');
    event.waitUntil(
      // Perform background sync operations
      new Promise(resolve => {
        // Notify clients about sync completion
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_STATUS',
              status: 'completed'
            });
          });
        });
        resolve();
      })
    );
  }
});

console.log('🚀 Service Worker loaded successfully');
