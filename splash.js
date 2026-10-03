(()=>{"use strict";
const ASSET="./assets/gsmart-splash-225q.b64?v=20261003-splash1";
let blobUrlPromise=null;
let activePromise=null;
function decodeBase64Video(){
  if(blobUrlPromise)return blobUrlPromise;
  blobUrlPromise=fetch(ASSET,{cache:"force-cache"}).then(r=>{
    if(!r.ok)throw new Error("Splash asset HTTP "+r.status);
    return r.text()
  }).then(text=>{
    const clean=text.trim();
    const bin=atob(clean);
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes],{type:"video/webm"}))
  });
  return blobUrlPromise
}
function overlay(){return document.getElementById("gsmartSplash")}
function video(){return document.getElementById("gsmartSplashVideo")}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
async function playSplash(reason="opening"){
  if(activePromise)return activePromise;
  activePromise=(async()=>{
    const o=overlay(),v=video();
    if(!o||!v)return;
    document.documentElement.classList.add("splash-lock");
    document.body.classList.add("splash-lock");
    o.classList.remove("hidden","is-closing","show-fallback");
    o.setAttribute("data-reason",reason);
    try{
      v.src=await decodeBase64Video();
      v.muted=true;
      v.playsInline=true;
      v.defaultPlaybackRate=2;
      v.playbackRate=2;
      v.currentTime=0;
      const finished=new Promise(resolve=>{
        const done=()=>resolve();
        v.addEventListener("ended",done,{once:true});
        v.addEventListener("error",done,{once:true})
      });
      const started=v.play();
      if(started&&typeof started.catch==="function")await started.catch(()=>{});
      await Promise.race([finished,wait(5600)])
    }catch(err){
      console.warn("G-Smart splash fallback:",err);
      o.classList.add("show-fallback");
      await wait(1100)
    }
    o.classList.add("is-closing");
    await wait(360);
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