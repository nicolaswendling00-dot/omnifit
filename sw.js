// OmniFit — Service worker (PWA offline)
const CACHE_NAME = 'omniffit-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './modules/home.js',
  './modules/nutrition.js',
  './modules/workout.js',
  './modules/activity.js',
  './modules/settings.js',
  './data/exercises.js',
  './utils/storage.js',
  './utils/math.js',
  './utils/ui.js',
  './assets/manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first pour les assets locaux, network-first pour le reste (CDN, fonts)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      }))
    );
  } else {
    e.respondWith(
      fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
  }
});
