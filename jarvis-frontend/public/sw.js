const CACHE_NAME = "pal-ai-v1";
const ASSETS = ["/", "/index.html", "/manifest.json", "/icon.svg"];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }),
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Fetch Event (Network first, cache fallback)
self.addEventListener("fetch", (event) => {
  // Only cache GET requests and non-socket traffic
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("socket.io")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      }),
  );
});
