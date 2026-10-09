/* Loaded ONLY when Notifications Settings opens; never part of Firebase login boot.
   Independent push SW at /gsmart-push-sw/, no root SW or Auth changes. */
import {getApp} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {getMessaging,getToken,deleteToken,isSupported,onMessage} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging.js";
import {supabaseConfig} from "./config.js?v=20261002-3";
const PUSH_SCOPE=new URL("./gsmart-push-sw/",location.href).href;
const prefKey=uid=>"gsmart_web_push_v1_"+uid;
let foregroundAttached=false;
function read(uid){try{return JSON.parse(localStorage.getItem(prefKey(uid))||"{}")||{}}catch(_){return {}}}
function save(uid,obj){try{localStorage.setItem(prefKey(uid),JSON.stringify(obj))}catch(_){throw Error("Tidak dapat menyimpan pengaturan perangkat.")}}
function choices(root){return Object.fromEntries(["blanko","disputes","shipping"].map(k=>[k,!!root.querySelector('[data-push-choice="'+k+'"]')?.checked]))}
function show(root,message,kind=""){const item=root?.querySelector("#gsmartPushStatus");if(item){item.textContent=message;item.dataset.kind=kind}}
function supportedBrowser(){return location.protocol==="https:"&&"serviceWorker" in navigator&&"Notification" in window&&"PushManager" in window}
async function waitForActive(reg){
  if(reg.active)return reg;
  const worker=reg.installing||reg.waiting;
  if(!worker)throw Error("Pendaftaran pemberitahuan belum aktif. Coba muat ulang.");
  await new Promise((resolve,reject)=>{
    const t=setTimeout(()=>reject(Error("Proses pemberitahuan terlalu lama. Coba lagi.")),15000);
    const cb=()=>{if(worker.state==="activated"){clearTimeout(t);resolve()}else if(worker.state==="redundant"){clearTimeout(t);reject(Error("Layanan pemberitahuan gagal aktif."))}};
    worker.addEventListener("statechange",cb);cb();
  });
  if(!reg.active)throw Error("Layanan pemberitahuan belum siap.");
  return reg;
}
async function registerWorker(){
  const reg=await navigator.serviceWorker.register("./gsmart-push-sw/firebase-messaging-sw.js?v=1",{
    scope:"./gsmart-push-sw/",updateViaCache:"none"
  });
  if(reg.scope!==PUSH_SCOPE)throw Error("Alamat layanan notifikasi tidak sesuai.");
  return waitForActive(reg);
}
async function callServer(user,action,token,preferences){
  const idToken=await user.getIdToken();
  const response=await fetch(supabaseConfig.url+"/functions/v1/gsmart-web-push-register",{
    method:"POST",headers:{"Authorization":"Bearer "+idToken,
      "apikey":supabaseConfig.publishableKey,"Content-Type":"application/json"},
    body:JSON.stringify({action,token,preferences,userAgent:navigator.userAgent.slice(0,500)})
  });
  const result=await response.json().catch(()=>({}));
  const errors={
    PROFILE_DENIED:"Akun Anda tidak diizinkan untuk mendaftar.",
    UNAUTHORIZED:"Sesi perlu diperbarui. Silakan masuk kembali.",
    DEVICE_LINKED_TO_OTHER_ACCOUNT:"Perangkat ini masih terdaftar di akun lain. Hubungi Admin.",
    TOKEN_INVALID:"Token pemberitahuan tidak valid."
  };
  if(!response.ok||!result.ok)throw Error(errors[result.error]||"Pendaftaran server gagal (HTTP "+response.status+").");
  return result;
}
function attachForeground(messaging,reg){
  if(foregroundAttached)return;
  foregroundAttached=true;
  onMessage(messaging,payload=>{
    const title=payload.notification?.title||payload.data?.title||"G-Smart · ETLE";
    const body=payload.notification?.body||payload.data?.body||"Informasi ETLE baru";
    reg.showNotification(title,{
      body,tag:payload.data?.event_key||"gsmart-foreground",
      icon:location.origin+"/G-SMART%20Traffic%20Monitoring%20Emblem.png"
    }).catch(()=>{});
  });
}
export function mountPushSettings({root,user,profile}){
  if(!root)return;
  const activate=root.querySelector("#gsmartEnablePush");
  const deactivate=root.querySelector("#gsmartDisablePush");
  const vapid=root.querySelector("#gsmartVapidKey");
  if(!user||!profile||!["ADMIN","WASATPEL","PETUGAS"].includes(String(profile.role||"").trim().toUpperCase())){
    show(root,"Masuk dengan akun petugas aktif untuk mengatur pemberitahuan.","error");
    activate.disabled=true;deactivate.disabled=true;return;
  }
  const saved=read(user.uid);
  vapid.value=saved.vapid||"";
  for(const key of ["blanko","disputes","shipping"]){
    root.querySelector('[data-push-choice="'+key+'"]').checked=saved.preferences?.[key]!==false;
  }
  if(!supportedBrowser()){
    show(root,"Browser ini belum mendukung Web Push. Fitur G-Smart lainnya tetap tersedia.","error");
    activate.disabled=true;deactivate.disabled=true;return;
  }
  show(root,saved.enabled?"Pemberitahuan telah diaktifkan pada akun dan perangkat ini.":"Pemberitahuan belum aktif pada perangkat ini.",saved.enabled?"success":"");
  const busy=x=>{activate.disabled=x;deactivate.disabled=x;vapid.disabled=x};
  const getMessagingChecked=async()=>{
    if(!await isSupported())throw Error("Firebase Cloud Messaging belum didukung browser ini.");
    return getMessaging(getApp());
  };
  activate.onclick=async()=>{
    busy(true);
    try{
      const key=vapid.value.trim();
      if(!/^[A-Za-z0-9_-]{60,150}$/.test(key))throw Error("Masukkan kunci publik Web Push dari Firebase Cloud Messaging.");
      if(Notification.permission==="denied")throw Error("Notifikasi diblokir. Periksa pengaturan browser/HP.");
      if(Notification.permission==="default"){
        const choice=await Notification.requestPermission();
        if(choice!=="granted")throw Error("Izin pemberitahuan belum diberikan.");
      }
      const messaging=await getMessagingChecked();
      const reg=await registerWorker();
      const token=await getToken(messaging,{vapidKey:key,serviceWorkerRegistration:reg});
      if(!token)throw Error("Token Firebase belum tersedia.");
      const prefs=choices(root);
      await callServer(user,"register",token,prefs);
      save(user.uid,{enabled:true,vapid:key,preferences:prefs});
      attachForeground(messaging,reg);
      show(root,"✅ Pemberitahuan aktif. Perangkat siap menerima informasi ETLE.","success");
    }catch(e){show(root,String(e.message||"Pemberitahuan gagal diaktifkan."),"error")}
    finally{busy(false)}
  };
  deactivate.onclick=async()=>{
    busy(true);
    try{
      const saved=read(user.uid);
      if(saved.vapid){
        const messaging=await getMessagingChecked();
        const reg=await registerWorker();
        const token=await getToken(messaging,{vapidKey:saved.vapid,serviceWorkerRegistration:reg});
        if(token)await callServer(user,"disable",token,choices(root));
        try{await deleteToken(messaging)}catch(_){}
      }
      save(user.uid,{enabled:false,vapid:saved.vapid||vapid.value.trim(),preferences:choices(root)});
      show(root,"Pemberitahuan telah dinonaktifkan pada perangkat ini.");
    }catch(e){show(root,"Gagal menonaktifkan: "+String(e.message||"Coba lagi."),"error")}
    finally{busy(false)}
  };
  for(const input of root.querySelectorAll("[data-push-choice]"))input.addEventListener("change",()=>{
    const cur=read(user.uid);
    save(user.uid,{...cur,preferences:choices(root)});
    if(cur.enabled)show(root,"Pilihan berubah. Tekan Aktifkan Pemberitahuan untuk menyimpan ke server.");
  });
}
