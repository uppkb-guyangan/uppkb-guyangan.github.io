const CACHE_NAME = 'gsmart-shell-v25';
const APP_SHELL = [
  './',
  './index.html',
  './styles-v2.css?v=20261003-online1',
  './dashboard-redesign.css?v=20261003-activity1',
  './detail-redesign.css?v=20261003-confirm2',
  './splash.css?v=20261003-splash3',
  './branding-overrides.css?v=20261002-brand1',
  './splash.js?v=20261003-splash3',
  './app-v2.js?v=20261003-activity1',
  './analytics-drilldown.js?v=20261002-1',
  './court-enhancement.js?v=20261002-4',
  './config.js?v=20261002-3',
  './assets/gsmart-splash-landscape-hq.b64?v=20261003-splash3',
  './assets/gsmart-splash-portrait-360.b64?v=20261003-splash2',
  './G-SMART%20Traffic%20Monitoring%20Emblem.png',
  './Gemini_Generated_Image_pckqrmpckqrmpckq.jpg',
  './manifest.webmanifest?v=20261003-maskable1'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => cached || caches.match('./index.html'))
      )
  );
});
