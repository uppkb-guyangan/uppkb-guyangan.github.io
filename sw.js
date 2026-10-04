const CACHE_NAME = 'gsmart-shell-v38';
const APP_SHELL = [
  './',
  './index.html',
  './styles-v2.css?v=20261004-gita37',
  './dashboard-redesign.css?v=20261003-truck35',
  './detail-redesign.css?v=20261003-ux33',
  './splash.css?v=20261003-splash3',
  './branding-overrides.css?v=20261002-brand1',
  './splash.js?v=20261003-splash3',
  './app-v2.js?v=20261004-gita37',
  './fcm-push.js?v=20261005-fcm2',
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
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of APP_SHELL) {
        try {
          await cache.add(url);
        } catch (error) {
          console.warn('G-Smart SW cache skip:', url, error);
        }
      }
    })
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

// Tahap diagnostik FCM:
// Firebase Messaging sengaja tidak di-import di service worker ini.
// Tujuannya memastikan service worker dasar dapat install + activate
// dengan stabil di Chrome Android sebelum background messaging
// ditambahkan kembali.

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
