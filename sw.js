const CACHE_NAME = 'gsmart-shell-v47';

// Precache hanya shell kecil/kritis agar instalasi dan update PWA tetap ringan.
const APP_SHELL = [
  './styles-v2.css?v=20261009-management1',
  './dashboard-redesign.css?v=20261009-vivid1',
  './detail-redesign.css?v=20261003-ux33',
  './performance-overrides.css?v=20261008-mobile-nav-fit1',
  './health-check.css?v=20261008-health-check3',
  './splash.css?v=20261003-splash3',
  './branding-overrides.css?v=20261002-brand1',
  './app-v2.js?v=20261009-management1',
  './analytics-drilldown.js?v=20261002-1',
  './court-enhancement.js?v=20261002-4',
  './config.js?v=20261002-3',
  './G-SMART%20Traffic%20Monitoring%20Emblem.png',
  './manifest.webmanifest?v=20261003-maskable1'
];

const STATIC_DESTINATIONS = new Set(['style', 'script', 'image', 'font']);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(APP_SHELL.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (STATIC_DESTINATIONS.has(event.request.destination)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});
