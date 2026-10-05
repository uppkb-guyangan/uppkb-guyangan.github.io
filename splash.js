(()=>{"use strict";
const ASSETS={
  landscape:"./assets/gsmart-splash-landscape-hq.b64?v=20261003-splash3",
  portrait:"./assets/gsmart-splash-portrait-360.b64?v=20261003-splash2"
};
const blobUrlPromises={};
let activePromise=null;
function usePortrait(){return window.matchMedia("(max-width:800px) and (orientation:portrait)").matches}
function decodeBase64Video(kind){
  const asset=ASSETS[kind];
  if(blobUrlPromises[kind])return blobUrlPromises[kind];
  blobUrlPromises[kind]=fetch(asset,{cache:"force-cache"}).then(r=>{
    if(!r.ok)throw new Error("Splash asset HTTP "+r.status);
    return r.text()
  }).then(text=>{
    const clean=text.trim();
    const bin=atob(clean);
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes],{type:"video/webm"}))
  });
  return blobUrlPromises[kind]
}
function overlay(){return document.getElementById("gsmartSplash")}
function video(){return document.getElementById("gsmartSplashVideo")}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
function hideImmediately(){
  const o=overlay();
  if(o)o.classList.add("hidden");
  document.documentElement.classList.remove("splash-lock");
  document.body.classList.remove("splash-lock")
}
async function playSplash(reason="opening"){
  // Setelah login jangan memutar splash lagi. Data dashboard langsung ditampilkan.
  if(reason==="post-login"){
    hideImmediately();
    return
  }
  if(activePromise)return activePromise;
  activePromise=(async()=>{
    const o=overlay(),v=video();
    if(!o||!v)return;
    const kind=usePortrait()?"portrait":"landscape";
    o.dataset.orientation=kind;
    document.documentElement.classList.add("splash-lock");
    document.body.classList.add("splash-lock");
    o.classList.remove("hidden","is-closing","show-fallback");
    o.setAttribute("data-reason",reason);
    try{
      v.src=await decodeBase64Video(kind);
      v.muted=true;
      v.playsInline=true;
      v.defaultPlaybackRate=2.5;
      v.playbackRate=2.5;
      v.currentTime=0;
      const finished=new Promise(resolve=>{
        const done=()=>resolve();
        v.addEventListener("ended",done,{once:true});
        v.addEventListener("error",done,{once:true})
      });
      const started=v.play();
      if(started&&typeof started.catch==="function")await started.catch(()=>{});
      await Promise.race([finished,wait(2600)])
    }catch(err){
      console.warn("G-Smart splash fallback:",err);
      o.classList.add("show-fallback");
      await wait(350)
    }
    o.classList.add("is-closing");
    await wait(180);
    o.classList.add("hidden");
    o.classList.remove("is-closing");
    document.documentElement.classList.remove("splash-lock");
    document.body.classList.remove("splash-lock")
  })().finally(()=>{activePromise=null});
  return activePromise
}
window.gsmartPlaySplash=playSplash;
if(document.readyState==="loading"){
  window.gsmartSplashIntro=new Promise(resolve=>{
    document.addEventListener("DOMContentLoaded",()=>playSplash("opening").finally(resolve),{once:true})
  })
}else{
  window.gsmartSplashIntro=playSplash("opening")
}
})();