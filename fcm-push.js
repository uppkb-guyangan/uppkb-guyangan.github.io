import { firebaseConfig, supabaseConfig } from "./config.js?v=20261004-fcm1";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const VAPID_KEY = "BC4m__KPNTgQJFOiIOEpD5VTlPDXtxz9yVbWCtVufTUrt-8BzKTmDu4d_sTAcMK61TOpifLJJkZ9UlhUosVgQ4o";
const ALLOWED_ROLES = new Set(["ADMIN", "WASATPEL"]);
const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey);

function normalizedRole(value) {
  return String(value || "").trim().toUpperCase();
}

async function saveToken({ uid, role, token }) {
  const { error } = await supabase.from("gsmart_push_tokens").upsert({
    firebase_uid: uid,
    role,
    token,
    user_agent: navigator.userAgent,
    platform: navigator.userAgentData?.platform || navigator.platform || null,
    active: true,
    last_seen_at: new Date().toISOString()
  }, { onConflict: "token" });
  if (error) throw error;
}

export async function registerGSmartPush({ user, role, requestPermission = false } = {}) {
  const currentRole = normalizedRole(role);
  if (!user?.uid || !ALLOWED_ROLES.has(currentRole)) {
    return { enabled: false, reason: "role_not_allowed" };
  }
  if (!(await isSupported())) return { enabled: false, reason: "unsupported" };
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    return { enabled: false, reason: "unsupported" };
  }

  let permission = Notification.permission;
  if (permission === "default" && requestPermission) permission = await Notification.requestPermission();
  if (permission !== "granted") return { enabled: false, reason: permission };

  const registration = await navigator.serviceWorker.ready;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) return { enabled: false, reason: "token_empty" };

  await saveToken({ uid: user.uid, role: currentRole, token });
  return { enabled: true, token };
}

export async function enableGSmartPush(user, role) {
  return registerGSmartPush({ user, role, requestPermission: true });
}

export async function initGSmartForegroundMessaging() {
  if (!(await isSupported())) return;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  onMessage(messaging, (payload) => {
    window.dispatchEvent(new CustomEvent("gsmart:fcm-message", { detail: payload }));
    console.info("G-Smart push foreground:", payload);
  });
}

window.GSmartPush = { register: registerGSmartPush, enable: enableGSmartPush };
initGSmartForegroundMessaging().catch((err) => console.warn("FCM foreground init:", err));
