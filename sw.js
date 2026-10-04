const CACHE_NAME = 'gsmart-shell-v37';
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

// ============================================================
// FIREBASE CLOUD MESSAGING - BACKGROUND PUSH
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBbF1MPzFK_EdUFV9CNh2ZZfuHxRgilm6o',
  authDomain: 'g-smart-guyangan.firebaseapp.com',
  projectId: 'g-smart-guyangan',
  storageBucket: 'g-smart-guyangan.firebasestorage.app',
  messagingSenderId: '513673068228',
  appId: '1:513673068228:web:03f3f5797b706fee641391'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  console.info('G-Smart FCM background:', payload);

  // Jika backend mengirim notification payload, browser/FCM dapat
  // menampilkannya otomatis. Kita hanya membuat notifikasi sendiri
  // untuk data-only payload agar tidak terjadi notifikasi ganda.
  if (payload.notification) return;

  const data = payload.data || {};
  const title = data.title || 'G-Smart UPPKB Guyangan';
  const options = {
    body: data.body || 'Ada pembaruan data G-Smart.',
    icon: './G-SMART%20Traffic%20Monitoring%20Emblem.png',
    badge: './G-SMART%20Traffic%20Monitoring%20Emblem.png',
    tag: data.tag || 'gsmart-update',
    data: {
      url: data.url || './'
    }
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification?.data?.url || './',
    self.location.origin
  ).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
