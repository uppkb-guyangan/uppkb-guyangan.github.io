const CACHE_NAME = 'gsmart-shell-v39';

// Hanya precache shell kecil/kritis. Asset video/base64 besar dan FCM
// sengaja tidak diprecache agar instalasi/update PWA tidak membebani startup.
const APP_SHELL = [
  './styles-v2.css?v=20261004-gita37',
  './dashboard-redesign.css?v=20261003-truck35',
  './detail-redesign.css?v=20261003-ux33',
  './splash.css?v=20261003-splash3',
  './branding-overrides.css?v=20261002-brand1',
  './app-v2.js?v=20261004-gita37',
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

  // Navigasi/HTML tetap network-first supaya deployment baru cepat terlihat.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // JS/CSS/gambar/font lokal cache-first untuk mempercepat buka ulang PWA.
  if (STATIC_DESTINATIONS.has(event.request.destination)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Request lokal lainnya network-first agar data/config dinamis tidak basi.
  event.respondWith(networkFirst(event.request));
});

// Push notification sedang dipending. Listener push dipertahankan pasif agar
// instalasi PWA yang sudah ada tidak rusak; tidak ada registrasi FCM saat startup.
self.addEventListener('push', event => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (_) {
    payload = { data: { body: event.data.text() } };
  }

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || 'G-Smart UPPKB Guyangan';
  const options = {
    body: notification.body || data.body || 'Ada pembaruan data G-Smart.',
    icon: './G-SMART%20Traffic%20Monitoring%20Emblem.png',
    badge: './G-SMART%20Traffic%20Monitoring%20Emblem.png',
    tag: data.tag || 'gsmart-update',
    data: { url: data.url || './' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = new URL(event.notification?.data?.url || './', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
    })
  );
});
