import { firebaseConfig, supabaseConfig } from "./config.js?v=20261004-fcm1";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";

const VAPID_KEY = "BC4m__KPNTgQJFOiIOEpD5VTlPDXtxz9yVbWCtVufTUrt-8BzKTmDu4d_sTAcMK61TOpifLJJkZ9UlhUosVgQ4o";
const REGISTER_URL = `${supabaseConfig.url}/functions/v1/register-push-token`;
const ALLOWED_ROLES = new Set(["ADMIN", "WASATPEL"]);
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const roleOf = v => String(v || "").trim().toUpperCase();

async function loadRole(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? roleOf(snap.data()?.role) : "";
}

async function saveToken(user, role, token) {
  const response = await fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": supabaseConfig.publishableKey },
    body: JSON.stringify({ token, firebase_uid: user.uid, role, platform: navigator.userAgentData?.platform || navigator.platform || "web-pwa" })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.success) throw new Error(result?.error || `Registrasi push gagal (${response.status})`);
  return result;
}

export async function registerGSmartPush({ user = auth.currentUser, role, requestPermission = false } = {}) {
  if (!user?.uid) return { enabled: false, reason: "not_authenticated" };
  const currentRole = roleOf(role || await loadRole(user.uid));
  if (!ALLOWED_ROLES.has(currentRole)) return { enabled: false, reason: "role_not_allowed" };
  if (!(await isSupported()) || !("serviceWorker" in navigator) || !("Notification" in window)) return { enabled: false, reason: "unsupported" };
  let permission = Notification.permission;
  if (permission === "default" && requestPermission) permission = await Notification.requestPermission();
  if (permission !== "granted") return { enabled: false, reason: permission };
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) return { enabled: false, reason: "token_empty" };
  await saveToken(user, currentRole, token);
  return { enabled: true, token, role: currentRole };
}

export async function enableGSmartPush(user = auth.currentUser, role) {
  return registerGSmartPush({ user, role, requestPermission: true });
}

function removeButton() { document.getElementById("gsmartEnablePushBtn")?.remove(); }
function showButton(user, role) {
  if (Notification.permission !== "default" || document.getElementById("gsmartEnablePushBtn")) return;
  const host = document.querySelector(".topbar-actions");
  if (!host) return;
  const b = document.createElement("button");
  b.id = "gsmartEnablePushBtn"; b.type = "button"; b.className = "icon-btn"; b.title = "Aktifkan push notification"; b.textContent = "🔔";
  b.onclick = async () => {
    b.disabled = true;
    try {
      const r = await enableGSmartPush(user, role);
      if (r.enabled) { removeButton(); alert("Notifikasi G-Smart berhasil diaktifkan pada perangkat ini."); }
      else if (r.reason === "denied") alert("Izin notifikasi ditolak. Aktifkan kembali melalui pengaturan browser/PWA.");
    } catch (e) { console.error(e); alert("Notifikasi belum dapat diaktifkan. Silakan coba lagi."); }
    finally { b.disabled = false; }
  };
  host.prepend(b);
}

onAuthStateChanged(auth, async user => {
  removeButton();
  if (!user) return;
  try {
    const role = await loadRole(user.uid);
    if (!ALLOWED_ROLES.has(role)) return;
    if (Notification.permission === "granted") await registerGSmartPush({ user, role });
    else if (Notification.permission === "default") showButton(user, role);
  } catch (e) { console.warn("FCM auto registration:", e); }
});

if (await isSupported()) {
  onMessage(getMessaging(app), payload => {
    window.dispatchEvent(new CustomEvent("gsmart:fcm-message", { detail: payload }));
    console.info("G-Smart push foreground:", payload);
  });
}
window.GSmartPush = { register: registerGSmartPush, enable: enableGSmartPush };
