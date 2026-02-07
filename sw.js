const CACHE_NAME = 'bear-gym-cache-v1';

// Pliki do cache'owania (opcjonalnie, dla działania offline)
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest-coach.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  // Strategia: Najpierw sieć, potem cache (aby dane Firebase były zawsze świeże)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});