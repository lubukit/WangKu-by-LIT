/* WangKu Service Worker — Offline Support */
const CACHE_NAME = "wangku-v5";
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const withBase = path => `${BASE_PATH}${path}`;
const STATIC_ASSETS = [
  withBase("/"),
  withBase("/index.html"),
  withBase("/manifest.json"),
  withBase("/icons/icon-192.png"),
  withBase("/icons/icon-512.png")
];

// Install — cache static assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, fallback to cache
self.addEventListener("fetch", event => {
  // Skip non-GET and external API requests
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("firebaseio.com")) return;
  if (event.request.url.includes("googleapis.com")) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
