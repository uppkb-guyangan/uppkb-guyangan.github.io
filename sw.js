const CACHE_NAME = 'gsmart-shell-v49';

// Precache hanya shell kecil/kritis agar instalasi dan update PWA tetap ringan.
const APP_SHELL = [
  './styles-v2.css?v=20261007-loginaudit1',
  './dashboard-redesign.css?v=20261009-vivid1',
  './detail-redesign.css?v=20261003-ux33',
  './performance-overrides.css?v=20261008-mobile-nav-fit1',
  './health-check.css?v=20261008-health-check3',
  './settings-management.css?v=20261009-settings-v2',
  './gsmart-visual-themes.css?v=20261009-four-v1',
  './gsmart-theme-picker.css?v=20261009-four-v1',
  './gsmart-illustrative-city.svg',
  './splash.css?v=20261003-splash3',
  './branding-overrides.css?v=20261002-brand1',
  './app-v2.js?v=20261009-four-v1',
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


// Root service worker owns the installed standalone PWA AND its FCM registration.
// Keep normal caching/fetch, login, and ETLE functionality unchanged.
const GSMART_HOME = self.location.origin + '/';
const GSMART_CASE_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

function gsmartCaseId(notification) {
  const detail = notification?.data || {};
  const message = detail.FCM_MSG || {};
  const value = String(detail.case_id || message.data?.case_id || '').trim();
  return GSMART_CASE_PATTERN.test(value) ? value : '';
}
function gsmartCaseUrl(caseId) {
  const url = new URL(GSMART_HOME);
  if (caseId) url.searchParams.set('case', caseId);
  return url.href;
}
async function gsmartIsStandalone(client) {
  if (typeof MessageChannel === 'undefined') return false;
  return new Promise(resolve => {
    let done = false;
    const complete = value => {
      if (done) return;
      done = true;
      resolve(!!value);
    };
    const channel = new MessageChannel();
    const timeout = setTimeout(() => complete(false), 350);
    channel.port1.onmessage = event => {
      clearTimeout(timeout);
      complete(event.data?.standalone === true);
    };
    try {
      client.postMessage({type:'GSMART_IDENTIFY_WINDOW'}, [channel.port2]);
    } catch (_) {
      clearTimeout(timeout);
      complete(false);
    }
  });
}
self.addEventListener('notificationclick', event => {
  event.stopImmediatePropagation();
  const caseId = gsmartCaseId(event.notification);
  const target = gsmartCaseUrl(caseId);
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    const candidates = windows.filter(client => {
      try { const url = new URL(client.url); return url.origin === self.location.origin && url.pathname === '/'; }
      catch (_) { return false; }
    });
    let pwa = null;
    for (const candidate of candidates) {
      if (await gsmartIsStandalone(candidate)) { pwa = candidate; break; }
    }
    // Reuse ONLY a verified standalone PWA, not arbitrary Chrome tabs.
    // If the app is closed, openWindow from the ROOT worker is eligible
    // to route the URL into the installed standalone web app.
    if (pwa) {
      try {
        const client = await pwa.navigate(target) || pwa;
        await client.focus();
        client.postMessage({type:'GSMART_PUSH_OPEN_CASE', case_id:caseId});
        return;
      } catch (error) {
        console.warn('G-Smart PWA navigation was unavailable:', error);
      }
    }
    try {
      const opened = await self.clients.openWindow(target);
      if (opened) {
        await opened.focus();
        opened.postMessage({type:'GSMART_PUSH_OPEN_CASE', case_id:caseId});
        return;
      }
    } catch (error) {
      console.warn('G-Smart PWA launch failed:', error);
    }
    // Fallback on platforms without installed PWA handling.
    if (candidates[0]) {
      const client = await candidates[0].navigate(target).catch(() => null) || candidates[0];
      await client.focus();
      client.postMessage({type:'GSMART_PUSH_OPEN_CASE', case_id:caseId});
    }
  })());
});

// This background SDK must be registered in the same root SW as the installed PWA.
try {
  importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js',
                'https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey:'AIzaSyBbF1MPzFK_EdUFV9CNh2ZZfuHxRgilm6o',
    authDomain:'g-smart-guyangan.firebaseapp.com',
    projectId:'g-smart-guyangan',
    storageBucket:'g-smart-guyangan.firebasestorage.app',
    messagingSenderId:'513673068228',
    appId:'1:513673068228:web:03f3f5797b706fee641391'
  });
  const gsmartMessaging = firebase.messaging();
  gsmartMessaging.onBackgroundMessage(payload => {
    // Firebase automatically shows notification payloads; no duplicate display.
    if (payload?.notification) return;
    const data = payload?.data || {};
    const caseId = GSMART_CASE_PATTERN.test(String(data.case_id || '')) ? String(data.case_id) : '';
    return self.registration.showNotification(data.title || 'G-Smart · ETLE', {
      body:data.body || 'Ada informasi ETLE terbaru.',
      tag:data.event_key || 'gsmart-etle',
      data:{case_id:caseId, url:gsmartCaseUrl(caseId)}
    });
  });
} catch (error) {
  console.warn('G-Smart root push unavailable; app shell remains operational:', error);
}
