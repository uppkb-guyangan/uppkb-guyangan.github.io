/* G-Smart optional push SW: scoped to /gsmart-push-sw/ only.
 * Do not intercept fetch, cache, login or existing root sw.js.
 */
const HOME="https://uppkb-guyangan.github.io/";
// Custom click behavior is registered before the FCM SDK's default click logic.
self.addEventListener("notificationclick",event=>{
  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil((async()=>{
    // On Chrome Android openWindow may launch the installed G-Smart standalone PWA.
    // Never prefer an arbitrary open Chrome tab over the installed PWA.
    try{
      if(self.clients.openWindow){
        const opened=await self.clients.openWindow(HOME);
        if(opened){
          await opened.focus();
          return;
        }
      }
    }catch(error){console.warn("PWA launch was unavailable; checking existing windows.",error)}
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    const existing=windows.find(c=>c.url.startsWith(HOME)&&!c.url.includes("/preview-"));
    if(existing)await existing.focus();
  })());
});
try{
  importScripts("https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js",
                "https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js");
  firebase.initializeApp({"apiKey":"AIzaSyBbF1MPzFK_EdUFV9CNh2ZZfuHxRgilm6o","authDomain":"g-smart-guyangan.firebaseapp.com","projectId":"g-smart-guyangan","storageBucket":"g-smart-guyangan.firebasestorage.app","messagingSenderId":"513673068228","appId":"1:513673068228:web:03f3f5797b706fee641391"});
  const messaging=firebase.messaging();
  messaging.onBackgroundMessage(payload=>{
    // Firebase itself shows notification payloads. Never show a duplicate.
    if(payload?.notification)return;
    const data=payload?.data||{};
    return self.registration.showNotification(data.title||"G-Smart · ETLE",{
      body:data.body||"Ada informasi ETLE terbaru.",
      icon:HOME+"G-SMART%20Traffic%20Monitoring%20Emblem.png",
      tag:data.event_key||"gsmart-etle",
      data:{url:HOME}
    });
  });
}catch(e){console.warn("G-Smart push SW unavailable. Root PWA unaffected.",e)}
