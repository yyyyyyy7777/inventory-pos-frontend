const CACHE_NAME = 'inventory-pos-v3';
const STATIC_CACHE = 'static-v3';
const API_CACHE = 'api-v3';
const IMAGE_CACHE = 'images-v3';

const staticUrlsToCache = [
  '/',
  '/manifest.json',
  // Icons - prioritize for PWA functionality
  '/icon-192x192.png',
  '/icon-512x512.png',
  // Images
  '/Wheezard logo.png',
  '/bg wheezard.jpg',
  '/placeholder-logo.png',
  '/placeholder-user.jpg',
  '/placeholder.jpg'
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
      .then(() => {
        console.log('✅ Static resources cached successfully');
        self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Failed to cache static resources:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log(' Service Worker activating...');
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

  // API requests - Network First, Cache Fallback
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request).then(response => {
        // Only cache successful GET requests
        if (request.method === 'GET' && response.ok) {
          const responseClone = response.clone();
          caches.open(API_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Network failed (offline), try to serve from cache
        return caches.match(request).then(cached => {
          if (cached) {
            return cached;
          }
          // Return offline fallback for API requests (simulate offline state queue)
          return new Response(
            JSON.stringify({ 
              error: 'Offline - request queued or unavailable',
              queued: true,
              url: request.url 
            }),
            { 
              status: 503, 
              headers: { 'Content-Type': 'application/json' }
            }
          );
        });
      })
    );
    return;
  }

  // Icon requests - always serve from cache
  if (request.url.includes('icon-192x192.png') || request.url.includes('icon-512x512.png')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          console.log('📱 Serving icon from cache:', request.url);
          return cached;
        }
        // If not in cache, try to fetch and cache
        return fetch(request).then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(IMAGE_CACHE).then(cache => {
              cache.put(request, responseClone);
              console.log('📱 Cached icon:', request.url);
            });
            return response;
          }
          // If fetch fails, try to serve from static cache
          return caches.match(request);
        }).catch(() => {
          console.log('📱 Icon fetch failed, trying cache fallback:', request.url);
          return caches.match(request);
        });
      })
    );
    return;
  }

  // Other image requests - cache first, network fallback
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
