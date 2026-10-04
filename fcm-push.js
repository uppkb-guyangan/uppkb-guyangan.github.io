import { firebaseConfig, supabaseConfig } from "./config.js?v=20261002-3";
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

function normalizeRole(value) { return String(value || "").trim().toUpperCase(); }
function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs))
  ]);
}
function reasonText(reason) {
  const messages = {
    not_authenticated: "User Firebase belum terdeteksi login.",
    role_not_allowed: "Role akun bukan ADMIN atau WASATPEL.",
    unsupported: "Browser/perangkat belum mendukung FCM Web Push.",
    denied: "Izin notifikasi diblokir. Aktifkan izin notifikasi G-Smart melalui pengaturan Chrome/PWA.",
    default: "Izin notifikasi belum diberikan.",
    token_empty: "Firebase tidak menghasilkan token perangkat."
  };
  return messages[reason] || String(reason || "Status tidak diketahui.");
}

async function getUserRole(uid) {
  if (!uid) return "";
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? normalizeRole(snapshot.data()?.role) : "";
}

async function registerTokenOnServer(user, fcmToken) {
  if (!user) throw new Error("User Firebase belum login.");
  const firebaseIdToken = await withTimeout(user.getIdToken(true), 10000, "Timeout saat mengambil Firebase ID token.");
  const response = await withTimeout(fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": supabaseConfig.publishableKey },
    body: JSON.stringify({
      token: fcmToken,
      firebase_id_token: firebaseIdToken,
      platform: navigator.userAgentData?.platform || navigator.platform || "web-pwa"
    })
  }), 15000, "Timeout saat menghubungi register-push-token Supabase.");
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.success) {
    throw new Error(result?.error || result?.detail || `Registrasi push gagal (${response.status})`);
  }
  return result;
}

export async function registerGSmartPush({ user = auth.currentUser, role = null, requestPermission = false } = {}) {
  if (!user?.uid) return { enabled: false, reason: "not_authenticated" };
  const currentRole = normalizeRole(role || await getUserRole(user.uid));
  if (!ALLOWED_ROLES.has(currentRole)) return { enabled: false, reason: "role_not_allowed", role: currentRole || "KOSONG" };

  const supported = await isSupported();
  if (!supported || !("serviceWorker" in navigator) || !("Notification" in window)) {
    return { enabled: false, reason: "unsupported", role: currentRole };
  }

  let permission = Notification.permission;
  if (permission === "default" && requestPermission) permission = await Notification.requestPermission();
  if (permission !== "granted") return { enabled: false, reason: permission, role: currentRole };

  const registration = await withTimeout(
    navigator.serviceWorker.ready,
    12000,
    "Service Worker G-Smart belum siap setelah 12 detik. Refresh halaman lalu coba lagi."
  );

  const fcmToken = await withTimeout(
    getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }),
    15000,
    "Firebase FCM tidak menghasilkan token setelah 15 detik."
  );
  if (!fcmToken) return { enabled: false, reason: "token_empty", role: currentRole };

  const serverResult = await registerTokenOnServer(user, fcmToken);
  return { enabled: true, token: fcmToken, role: normalizeRole(serverResult?.role || currentRole) };
}

export async function enableGSmartPush(user = auth.currentUser, role = null) {
  return registerGSmartPush({ user, role, requestPermission: true });
}

function removePushButton() { document.getElementById("gsmartEnablePushBtn")?.remove(); }
function waitForTopbar(timeoutMs = 15000) {
  return new Promise(resolve => {
    const existing = document.querySelector(".topbar-actions");
    if (existing) return resolve(existing);
    const observer = new MutationObserver(() => {
      const host = document.querySelector(".topbar-actions");
      if (host) { observer.disconnect(); resolve(host); }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(document.querySelector(".topbar-actions")); }, timeoutMs);
  });
}

async function showPushButton(user, role) {
  if (document.getElementById("gsmartEnablePushBtn")) return;
  const host = await waitForTopbar();
  if (!host) return console.warn("G-Smart FCM: topbar tidak ditemukan.");
  const button = document.createElement("button");
  button.id = "gsmartEnablePushBtn";
  button.type = "button";
  button.className = "icon-btn";
  button.title = "Notifikasi G-Smart";
  button.setAttribute("aria-label", "Notifikasi G-Smart");
  button.textContent = ("Notification" in window && Notification.permission === "granted") ? "🔔✓" : "🔔";

  button.addEventListener("click", async () => {
    button.disabled = true;
    const oldTitle = button.title;
    button.title = "Memeriksa notifikasi...";
    try {
      const result = await enableGSmartPush(user, role);
      if (result.enabled) {
        button.textContent = "🔔✓";
        alert("Notifikasi G-Smart AKTIF.\n\n" + `Role: ${result.role}\n` + "FCM Token: berhasil\nRegistrasi Supabase: berhasil\n\nPerangkat ini siap menerima push notification.");
      } else {
        alert("Notifikasi G-Smart BELUM AKTIF.\n\n" + `Role: ${result.role || role || "tidak terbaca"}\n` + `Status: ${reasonText(result.reason)}`);
      }
    } catch (error) {
      console.error("G-Smart FCM:", error);
      alert("Registrasi notifikasi gagal.\n\n" + (error instanceof Error ? error.message : String(error)));
    } finally {
      button.disabled = false;
      button.title = oldTitle;
    }
  });
  host.prepend(button);
}

onAuthStateChanged(auth, async user => {
  removePushButton();
  if (!user) return console.info("G-Smart FCM: belum login.");
  try {
    const role = await getUserRole(user.uid);
    console.info("G-Smart FCM diagnostic:", {
      uidDetected: true,
      role: role || "KOSONG",
      notificationPermission: "Notification" in window ? Notification.permission : "unsupported",
      serviceWorker: "serviceWorker" in navigator
    });
    if (!ALLOWED_ROLES.has(role)) return console.warn(`G-Smart FCM: role '${role || "KOSONG"}' tidak memiliki akses push.`);
    await showPushButton(user, role);
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const result = await registerGSmartPush({ user, role, requestPermission: false });
        console.info("G-Smart FCM auto registration:", result.enabled ? "berhasil" : reasonText(result.reason));
      } catch (error) {
        console.warn("G-Smart FCM auto registration gagal:", error);
      }
    }
  } catch (error) {
    console.warn("G-Smart FCM initialization:", error);
  }
});

if (await isSupported()) {
  onMessage(getMessaging(app), payload => {
    console.info("G-Smart push foreground:", payload);
    window.dispatchEvent(new CustomEvent("gsmart:fcm-message", { detail: payload }));
  });
}

window.GSmartPush = {
  register: registerGSmartPush,
  enable: enableGSmartPush,
  diagnostics: async () => ({
    loggedIn: Boolean(auth.currentUser?.uid),
    role: auth.currentUser?.uid ? await getUserRole(auth.currentUser.uid) : "",
    supported: await isSupported(),
    notificationPermission: "Notification" in window ? Notification.permission : "unsupported",
    serviceWorker: "serviceWorker" in navigator,
    serviceWorkerController: Boolean(navigator.serviceWorker?.controller)
  })
};
