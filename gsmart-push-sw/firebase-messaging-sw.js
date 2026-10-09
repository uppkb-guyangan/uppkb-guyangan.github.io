/* G-Smart optional push SW: scoped to /gsmart-push-sw/ only.
 * Do not intercept fetch, cache, login or existing root sw.js.
 */
const HOME="https://uppkb-guyangan.github.io/";
// Custom click behavior is registered before the FCM SDK's default click logic.
self.addEventListener("notificationclick",event=>{
  event.stopImmediatePropagation();
  event.notification.close();
  // FCM may wrap the custom data inside FCM_MSG on automatic notifications.
  const info=event.notification?.data||{};
  const caseId=String(info.case_id||info.FCM_MSG?.data?.case_id||"").trim();
  const targetUrl=new URL(HOME);
  if(/^[A-Za-z0-9_-]{1,100}$/.test(caseId))targetUrl.searchParams.set("case",caseId);
  const target=targetUrl.href;
  event.waitUntil((async()=>{
    // On Chrome Android openWindow may launch the installed G-Smart standalone PWA.
    // Never prefer an arbitrary open Chrome tab over the installed PWA.
    try{
      if(self.clients.openWindow){
        const opened=await self.clients.openWindow(target);
        if(opened){
          await opened.focus();
          return;
        }
      }
    }catch(error){console.warn("PWA launch was unavailable; checking existing windows.",error)}
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    const existing=windows.find(c=>c.url.startsWith(HOME)&&!c.url.includes("/preview-"));
    if(existing){
      const navigated=await existing.navigate(target).catch(()=>null);
      await (navigated||existing).focus();
    }
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
    const destination=new URL(HOME);
    const caseId=String(data.case_id||"");
    if(/^[A-Za-z0-9_-]{1,100}$/.test(caseId))
      destination.searchParams.set("case",caseId);
    return self.registration.showNotification(data.title||"G-Smart · ETLE",{
      body:data.body||"Ada informasi ETLE terbaru.",
      tag:data.event_key||"gsmart-etle",
      data:{url:destination.href,case_id:caseId}
    });
  });
}catch(e){console.warn("G-Smart push SW unavailable. Root PWA unaffected.",e)}
