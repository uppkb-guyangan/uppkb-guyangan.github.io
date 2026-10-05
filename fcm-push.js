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
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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

async function getGSmartServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("Service Worker tidak didukung browser ini.");
  let registration = await navigator.serviceWorker.getRegistration("./");
  if (!registration) {
    registration = await withTimeout(
      navigator.serviceWorker.register("./sw.js", { scope: "./" }),
      12000,
      "Registrasi Service Worker G-Smart timeout setelah 12 detik."
    );
  }
  if (registration.active) return registration;
  const worker = registration.installing || registration.waiting;
  if (worker) {
    await withTimeout(new Promise((resolve, reject) => {
      if (worker.state === "activated") return resolve();
      const onStateChange = () => {
        if (worker.state === "activated") { worker.removeEventListener("statechange", onStateChange); resolve(); }
        else if (worker.state === "redundant") { worker.removeEventListener("statechange", onStateChange); reject(new Error("Service Worker menjadi redundant saat aktivasi.")); }
      };
      worker.addEventListener("statechange", onStateChange);
    }), 12000, "Service Worker terdaftar tetapi belum aktif setelah 12 detik.");
  }
  const refreshed = await navigator.serviceWorker.getRegistration("./");
  if (refreshed?.active) return refreshed;
  throw new Error("Service Worker G-Smart terdaftar tetapi tidak memiliki worker aktif.");
}

async function registerTokenOnServer(user, fcmToken) {
  if (!user) throw new Error("User Firebase belum login.");
  // Tidak memaksa refresh token setiap registrasi; token valid yang masih aktif
  // lebih cepat dan mengurangi request jaringan saat startup.
  const firebaseIdToken = await withTimeout(user.getIdToken(false), 8000, "Timeout saat mengambil Firebase ID token.");
  const response = await withTimeout(fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": supabaseConfig.publishableKey },
    body: JSON.stringify({
      token: fcmToken,
      firebase_id_token: firebaseIdToken,
      platform: navigator.userAgentData?.platform || navigator.platform || "web-pwa"
    })
  }), 18000, "Timeout saat menghubungi register-push-token Supabase.");

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.success) {
    const stage = result?.stage ? ` [${result.stage}]` : "";
    const timing = Number.isFinite(result?.elapsed_ms) ? ` (${result.elapsed_ms} ms)` : "";
    const detail = result?.detail && result?.detail !== result?.error ? `\n${result.detail}` : "";
    throw new Error(`${result?.error || `Registrasi push gagal (${response.status})`}${stage}${timing}${detail}`);
  }
  return result;
}

export async function registerGSmartPush({ user = auth.currentUser, role = null, requestPermission = false } = {}) {
  if (!user?.uid) return { enabled: false, reason: "not_authenticated" };
  const currentRole = normalizeRole(role || await getUserRole(user.uid));
  if (!ALLOWED_ROLES.has(currentRole)) return { enabled: false, reason: "role_not_allowed", role: currentRole || "KOSONG" };
  const supported = await isSupported();
  if (!supported || !("serviceWorker" in navigator) || !("Notification" in window)) return { enabled: false, reason: "unsupported", role: currentRole };

  let permission = Notification.permission;
  if (permission === "default" && requestPermission) permission = await Notification.requestPermission();
  if (permission !== "granted") return { enabled: false, reason: permission, role: currentRole };

  const registration = await getGSmartServiceWorker();
  const fcmToken = await withTimeout(
    getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }),
    12000,
    "Firebase FCM tidak menghasilkan token setelah 12 detik."
  );
  if (!fcmToken) return { enabled: false, reason: "token_empty", role: currentRole };

  const serverResult = await registerTokenOnServer(user, fcmToken);
  return {
    enabled: true,
    token: fcmToken,
    role: normalizeRole(serverResult?.role || currentRole),
    elapsedMs: serverResult?.elapsed_ms ?? null
  };
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
  if (!host) return;
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
        const timing = result.elapsedMs != null ? `\nBackend: ${result.elapsedMs} ms` : "";
        alert("Notifikasi G-Smart AKTIF.\n\n" + `Role: ${result.role}\n` + "Service Worker: aktif\nFCM Token: berhasil\nRegistrasi Supabase: berhasil" + timing + "\n\nPerangkat ini siap menerima push notification.");
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

// FCM dimuat kembali, tetapi registrasi jaringan TIDAK dijalankan otomatis saat
// login/startup. Ini menjaga optimasi performa; request berat baru berjalan saat
// ADMIN/WASATPEL menekan tombol lonceng.
onAuthStateChanged(auth, async user => {
  removePushButton();
  if (!user) return;
  try {
    const role = await getUserRole(user.uid);
    if (!ALLOWED_ROLES.has(role)) return;
    await showPushButton(user, role);
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
  diagnostics: async () => {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("./") : null;
    return {
      loggedIn: Boolean(auth.currentUser?.uid),
      role: auth.currentUser?.uid ? await getUserRole(auth.currentUser.uid) : "",
      supported: await isSupported(),
      notificationPermission: "Notification" in window ? Notification.permission : "unsupported",
      serviceWorker: "serviceWorker" in navigator,
      serviceWorkerRegistered: Boolean(registration),
      serviceWorkerActive: Boolean(registration?.active),
      serviceWorkerController: Boolean(navigator.serviceWorker?.controller)
    };
  }
};
