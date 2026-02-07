const CACHE_NAME = 'bear-gym-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Dla aplikacji treningowej najważniejsze są aktualne dane z Firebase, 
  // dlatego stosujemy strategię Network-First.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});