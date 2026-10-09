/* G-Smart isolated FCM push test worker.
   Scope is strictly /preview-push-v1/ and does not cache or intercept fetch.
   Firebase public web project config only, NEVER service-account/private keys. */
const TEST_URL = self.registration.scope;
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target=TEST_URL; // Open the safe preview tester, NOT the live dashboard.
  event.waitUntil((async () => {
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    const existing=windows.find(client=>client.url.startsWith(target));
    if (existing) return existing.focus();
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
importScripts(
  "https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js"
);
firebase.initializeApp({"apiKey":"AIzaSyBbF1MPzFK_EdUFV9CNh2ZZfuHxRgilm6o","authDomain":"g-smart-guyangan.firebaseapp.com","projectId":"g-smart-guyangan","storageBucket":"g-smart-guyangan.firebasestorage.app","messagingSenderId":"513673068228","appId":"1:513673068228:web:03f3f5797b706fee641391"});
const messaging=firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  // Firebase automatically displays notification payloads. Do not duplicate them.
  if (payload?.notification) return;
  const data=payload?.data || {};
  return self.registration.showNotification(data.title || "G-Smart · Notifikasi Uji", {
    body:data.body || "Pesan percobaan FCM diterima oleh PWA.",
    icon:new URL("../G-SMART%20Traffic%20Monitoring%20Emblem.png", TEST_URL).href,
    tag:data.id || "gsmart-preview-fcm-test",
    data:{url:TEST_URL}
  });
});
