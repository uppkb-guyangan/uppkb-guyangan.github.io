/* Isolated G-Smart Push Lab, intentionally has NO Firebase Auth dependency.
   Only registers a SW under /preview-push-v1/, and never touches root PWA. */
import { firebaseConfig } from "../config.js?v=20261002-3";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getMessaging, getToken, deleteToken, isSupported, onMessage } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging.js";

const $ = (id) => document.getElementById(id);
const base = new URL("./", location.href);
let registration = null;
let messaging = null;
let currentToken = "";
let listening = false;
const classByState = (value) => value ? "chip good" : "chip bad";

function log(message) {
  const now = new Date().toLocaleTimeString("id-ID", {timeZone:"Asia/Jakarta"});
  const box = $("log");
  const initial = box.textContent.startsWith("Halaman siap.") ? "" : box.textContent.trim();
  const rows = (initial ? initial.split("\n") : []).slice(-15);
  rows.push("[" + now + " WIB] " + message);
  box.textContent = rows.join("\n");
  box.scrollTop = box.scrollHeight;
}
function errorText(err) {
  const code = String(err?.code || "");
  const msg = String(err?.message || err || "Kesalahan tidak diketahui");
  // Prevent exposing a token if a vendor error were to include it.
  return (code ? code + " — " : "") + msg.replace(currentToken || "__NO_TOKEN__", "[token disembunyikan]").slice(0,250);
}
function updatePermission() {
  const el = $("permissionStatus");
  const state = typeof Notification !== "undefined" ? Notification.permission : "tidak tersedia";
  el.textContent = "Izin: " + (state === "granted" ? "diizinkan" : state === "denied" ? "ditolak" : state === "default" ? "belum diminta" : state);
  el.className = classByState(state === "granted");
}
async function checkSupport() {
  $("httpsStatus").textContent = "HTTPS: " + (window.isSecureContext ? "aktif" : "tidak aktif");
  $("httpsStatus").className = classByState(window.isSecureContext);
  const browserSupported = window.isSecureContext &&
    ("Notification" in window) &&
    ("serviceWorker" in navigator) &&
    ("PushManager" in window);
  let fcmSupported = false;
  try { fcmSupported = browserSupported && await isSupported(); }
  catch (_) {}
  $("pushStatus").textContent = "FCM Web: " + (fcmSupported ? "didukung" : "tidak didukung");
  $("pushStatus").className = classByState(fcmSupported);
  updatePermission();
  log("Pemeriksaan: " + (fcmSupported ? "perangkat mendukung FCM Web." : "FCM Web belum didukung di browser ini."));
  return {browserSupported, fcmSupported};
}
async function askPermission() {
  if (!window.isSecureContext || !("Notification" in window)) {
    throw new Error("Notifikasi memerlukan HTTPS dan browser yang mendukung.");
  }
  // Called directly from click handlers, before other awaits, so user activation is retained.
  const result = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;
  updatePermission();
  if (result !== "granted") throw new Error("Izin notifikasi belum diberikan. Periksa pengaturan browser/HP.");
}
async function getLabRegistration() {
  if (!("serviceWorker" in navigator)) throw new Error("Service worker tidak tersedia di browser ini.");
  if (registration && registration.active) return registration;
  const reg = await navigator.serviceWorker.register("./firebase-messaging-sw.js?v=1", {scope:"./",updateViaCache:"none"});
  if (reg.scope !== base.href) throw new Error("Ruang lingkup worker tidak cocok; pengujian dibatalkan.");
  // Avoid waiting for navigator.serviceWorker.ready (which can resolve root worker).
  if (!reg.active) {
    const worker = reg.installing || reg.waiting;
    if (worker) await new Promise((resolve,reject)=>{
      if(worker.state === "activated"){resolve();return;}
      const timeout=setTimeout(()=>reject(new Error("Service worker pengujian tidak aktif dalam 12 detik.")),12000);
      worker.addEventListener("statechange",()=>{
        if(worker.state==="activated"){clearTimeout(timeout);resolve()}
        if(worker.state==="redundant"){clearTimeout(timeout);reject(new Error("Service worker pengujian gagal aktif."))}
      });
    });
  }
  if (!reg.active) throw new Error("Service worker pengujian belum aktif. Muat ulang halaman dan coba lagi.");
  registration=reg;
  return reg;
}
async function testLocal() {
  const button=$("localBtn");
  button.disabled=true;
  try {
    await askPermission();
    const reg = await getLabRegistration();
    await reg.showNotification("G-Smart · Notifikasi Uji",{
      body:"Tes dari halaman uji berhasil. Belum dikirim melalui Firebase.",
      icon:new URL("../G-SMART%20Traffic%20Monitoring%20Emblem.png", base).href,
      tag:"gsmart-preview-local-test",
      data:{url:base.href}
    });
    log("Notifikasi lokal berhasil diminta tampil. Periksa panel notifikasi HP.");
  } catch(e) {log("GAGAL tes lokal: "+errorText(e))}
  finally {button.disabled=false}
}
async function registerFcm() {
  const button=$("tokenBtn");
  const vapid=$("vapidInput").value.trim();
  if (!/^[A-Za-z0-9_-]{60,150}$/.test(vapid)) {
    log("Kunci VAPID publik belum valid. Salin dari Firebase Console → Project settings → Cloud Messaging → Web Push certificates.");
    return;
  }
  button.disabled=true;
  try {
    await askPermission();
    const sup=await checkSupport();
    if (!sup.fcmSupported) throw new Error("Browser ini belum mendukung Firebase Cloud Messaging.");
    const reg=await getLabRegistration();
    if (!messaging) {
      const app=initializeApp(firebaseConfig, "gsmart-push-lab");
      messaging=getMessaging(app);
    }
    const token=await getToken(messaging,{vapidKey:vapid,serviceWorkerRegistration:reg});
    if(!token)throw new Error("Firebase belum mengembalikan token perangkat.");
    currentToken=token;
    $("tokenOutput").value=token;
    $("copyBtn").disabled=false;
    if(!listening){
      onMessage(messaging,payload=>{
        const title=payload.notification?.title || payload.data?.title || "Pesan FCM masuk";
        const body=payload.notification?.body || payload.data?.body || "(tanpa isi)";
        log("PESAN FCM SAAT TERBUKA: "+title+" — "+body);
      });
      listening=true;
    }
    log("FCM berhasil membuat token di halaman UJI. Token hanya ditampilkan di perangkat ini, tidak dikirim ke server G-Smart.");
  } catch(e) {log("GAGAL FCM: "+errorText(e))}
  finally {button.disabled=false}
}
async function copyToken() {
  if (!currentToken) return;
  try {
    await navigator.clipboard.writeText(currentToken);
    log("Token FCM disalin. Tempel HANYA di Firebase Console bagian 'Send test message'.");
  } catch(e) {
    $("tokenOutput").focus();$("tokenOutput").select();
    log("Salin otomatis gagal. Silakan salin teks token yang telah dipilih secara manual.");
  }
}
async function cleanup() {
  const button=$("cleanupBtn");button.disabled=true;
  try {
    if(messaging && currentToken) {
      try{await deleteToken(messaging);log("Token pengujian dilepas.")}catch(e){log("Token belum dapat dilepas: "+errorText(e))}
    }
    const candidate=await navigator.serviceWorker.getRegistration(base.href);
    // Never unregister the main G-Smart worker at "/".
    if(candidate && candidate.scope===base.href) {
      await candidate.unregister();
      log("Service worker folder uji dilepas. Service worker G-Smart utama tidak diubah.");
    } else {
      log("Tidak ada service worker khusus folder uji untuk dibersihkan.");
    }
    registration=null;
    currentToken="";
    $("tokenOutput").value="";
    $("copyBtn").disabled=true;
  } catch(e){log("Pembersihan gagal: "+errorText(e))}
  finally{button.disabled=false}
}
$("checkBtn").addEventListener("click",()=>{checkSupport().catch(e=>log(errorText(e)))});
$("localBtn").addEventListener("click",testLocal);
$("tokenBtn").addEventListener("click",registerFcm);
$("copyBtn").addEventListener("click",copyToken);
$("cleanupBtn").addEventListener("click",cleanup);
checkSupport().catch(e=>log(errorText(e)));
