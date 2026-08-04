// Service Worker for Hisaab Kitab Android PWA WebAPK
const CACHE_NAME = 'hisaab-kitab-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network first fallback strategy
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
