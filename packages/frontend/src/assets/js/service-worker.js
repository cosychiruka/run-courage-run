// Install event - Caches assets during the initial install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('static-v1').then((cache) => {
      return cache.addAll([
        '/', // Cache the homepage
        '/index.html', // Cache index page
        '/assets/css/lending.css', // Cache CSS files
        '/assets/js/app.js', // Cache JS files
        '/assets/images/logo.png', // Cache images
        // You can add more assets to cache here as needed
      ]);
    })
  );
});

// Fetch event - Intercepts network requests and serves cached assets if available
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // Return cached response if available
      }
      return fetch(event.request); // Fetch from network if not in cache
    })
  );
});

// Activate event - Cleans up old caches during the update process
self.addEventListener('activate', (event) => {
  const cacheWhitelist = ['static-v1']; // Define which caches to keep
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName); // Delete old caches not in whitelist
          }
        })
      );
    })
  );
});
