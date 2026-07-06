const CACHE = 'komorebi-shell-v32';
const CORE = ['./','./index.html','./japanese.html','./music.html','./study.html','./search.html','./practice-calendar.html','./practice-settings.html','./practice-goals.html','./add-word.html','./backup.html','./styles.css?v=17','./enhancements.css?v=18','./practice-calendar.css?v=19','./practice-totals.css?v=20','./activity-manager.css?v=21','./activity-totals-dynamic.css?v=21','./home-hierarchy.css?v=23','./practice-cloud.css?v=24','./practice-input.css?v=26','./practice-settings.css?v=27','./japanese-notebook.css?v=27','./home-page.js?v=16','./activity-catalog.js?v=22','./practice-cloud.js?v=24','./practice-tools.js?v=26','./practice-calendar.js?v=24','./practice-settings.js?v=27','./practice-goals.js?v=24','./japanese-page.js?v=12','./japanese-review.js?v=18','./japanese-card-motion.js?v=27','./music-page.js?v=16','./music-library.js?v=12','./search.js?v=18','./backup.js?v=16','./add-word.js?v=16','./cloud-vocab.js?v=16','./supabase-loader.js?v=16','./supabase-config.js','./pwa.js?v=17','./pwa.js?v=18','./manifest.webmanifest','./assets/icons/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
        return response;
      } catch (error) {
        return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const network = fetch(request).then(async response => {
      if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
      return response;
    }).catch(() => cached);
    return cached || network;
  })());
});
