// OmniFit — Service worker (PWA offline)
const CACHE_NAME = 'omniffit-v6-7';
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
  './data/foods.js',
  './data/recipes.js',
  './utils/storage.js',
  './utils/math.js',
  './utils/nav.js',
  './utils/charts.js',
  './utils/ui.js',
  './utils/ranks.js',
  './utils/bodyMap.js',
  './utils/globalRank.js',
  './utils/barcode.js',
  './utils/openfoodfacts.js',
  './standards.json',
  './assets/manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-180.png',
];

// Installation : on télécharge chaque fichier en CONTOURNANT le cache HTTP
// (`cache: 'reload'`). GitHub Pages autorise le navigateur à garder ses
// fichiers 10 minutes : sans ça, une version publiée peu après la précédente
// se remplissait avec les ANCIENS fichiers.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Réseau d'abord, cache en secours : en ligne, l'app charge toujours la
// dernière version publiée ; hors ligne, elle retombe sur la copie en cache.
// (Avant : cache d'abord, ce qui affichait l'ancienne version jusqu'à un
// redémarrage complet de l'app.)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === location.origin;
  e.respondWith(
    fetch(e.request, sameOrigin ? { cache: 'no-cache' } : undefined).then((res) => {
      if (res && res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
