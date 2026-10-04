import { firebaseConfig, supabaseConfig } from "./config.js?v=20261002-3";

import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getMessaging,
  getToken,
  onMessage,
  isSupported
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";


// ============================================================
// G-SMART FCM PUSH NOTIFICATION
// ADMIN & WASATPEL
// ============================================================

const VAPID_KEY =
  "BC4m__KPNTgQJFOiIOEpD5VTlPDXtxz9yVbWCtVufTUrt-8BzKTmDu4d_sTAcMK61TOpifLJJkZ9UlhUosVgQ4o";

const REGISTER_URL =
  `${supabaseConfig.url}/functions/v1/register-push-token`;

const ALLOWED_ROLES =
  new Set([
    "ADMIN",
    "WASATPEL"
  ]);


// ============================================================
// FIREBASE
// ============================================================

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig);

const auth =
  getAuth(app);

const db =
  getFirestore(app);


// ============================================================
// HELPERS
// ============================================================

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}


function reasonText(reason) {

  const messages = {

    not_authenticated:
      "User Firebase belum terdeteksi login.",

    role_not_allowed:
      "Role akun bukan ADMIN atau WASATPEL.",

    unsupported:
      "Browser/perangkat belum mendukung FCM Web Push.",

    denied:
      "Izin notifikasi diblokir. Aktifkan izin notifikasi G-Smart melalui pengaturan Chrome/PWA.",

    default:
      "Izin notifikasi belum diberikan.",

    token_empty:
      "Firebase tidak menghasilkan token perangkat."
  };

  return (
    messages[reason] ||
    String(
      reason ||
      "Status tidak diketahui."
    )
  );
}


// ============================================================
// ROLE FIRESTORE
// ============================================================

async function getUserRole(uid) {

  if (!uid) {
    return "";
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "users",
        uid
      )
    );

  if (!snapshot.exists()) {
    return "";
  }

  return normalizeRole(
    snapshot.data()?.role
  );
}


// ============================================================
// REGISTER TOKEN KE SUPABASE
// ============================================================

async function registerTokenOnServer(
  user,
  fcmToken
) {

  if (!user) {
    throw new Error(
      "User Firebase belum login."
    );
  }

  const firebaseIdToken =
    await user.getIdToken(true);

  const response =
    await fetch(
      REGISTER_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "apikey":
            supabaseConfig.publishableKey
        },

        body: JSON.stringify({

          token:
            fcmToken,

          firebase_id_token:
            firebaseIdToken,

          platform:
            navigator.userAgentData?.platform ||
            navigator.platform ||
            "web-pwa"
        })
      }
    );

  const result =
    await response
      .json()
      .catch(() => ({}));

  if (
    !response.ok ||
    !result?.success
  ) {

    throw new Error(
      result?.error ||
      result?.detail ||
      `Registrasi push gagal (${response.status})`
    );
  }

  return result;
}


// ============================================================
// REGISTER PUSH
// ============================================================

export async function registerGSmartPush({
  user = auth.currentUser,
  role = null,
  requestPermission = false
} = {}) {

  // --------------------------------
  // AUTH
  // --------------------------------

  if (!user?.uid) {

    return {
      enabled: false,
      reason: "not_authenticated"
    };
  }


  // --------------------------------
  // ROLE
  // --------------------------------

  const currentRole =
    normalizeRole(
      role ||
      await getUserRole(
        user.uid
      )
    );


  if (
    !ALLOWED_ROLES.has(
      currentRole
    )
  ) {

    return {
      enabled: false,
      reason: "role_not_allowed",
      role:
        currentRole ||
        "KOSONG"
    };
  }


  // --------------------------------
  // SUPPORT
  // --------------------------------

  const supported =
    await isSupported();

  if (
    !supported ||
    !("serviceWorker" in navigator) ||
    !("Notification" in window)
  ) {

    return {
      enabled: false,
      reason: "unsupported",
      role: currentRole
    };
  }


  // --------------------------------
  // PERMISSION
  // --------------------------------

  let permission =
    Notification.permission;


  if (
    permission === "default" &&
    requestPermission
  ) {

    permission =
      await Notification
        .requestPermission();
  }


  if (
    permission !== "granted"
  ) {

    return {
      enabled: false,
      reason: permission,
      role: currentRole
    };
  }


  // --------------------------------
  // SERVICE WORKER
  // --------------------------------

  const registration =
    await navigator
      .serviceWorker
      .ready;


  // --------------------------------
  // FCM TOKEN
  // --------------------------------

  const messaging =
    getMessaging(app);


  const fcmToken =
    await getToken(
      messaging,
      {
        vapidKey:
          VAPID_KEY,

        serviceWorkerRegistration:
          registration
      }
    );


  if (!fcmToken) {

    return {
      enabled: false,
      reason: "token_empty",
      role: currentRole
    };
  }


  // --------------------------------
  // BACKEND
  // --------------------------------

  const serverResult =
    await registerTokenOnServer(
      user,
      fcmToken
    );


  return {

    enabled: true,

    token:
      fcmToken,

    role:
      normalizeRole(
        serverResult?.role ||
        currentRole
      )
  };
}


// ============================================================
// ENABLE PUSH
// ============================================================

export async function enableGSmartPush(
  user = auth.currentUser,
  role = null
) {

  return registerGSmartPush({
    user,
    role,
    requestPermission: true
  });
}


// ============================================================
// PUSH BUTTON
// ============================================================

function removePushButton() {

  document
    .getElementById(
      "gsmartEnablePushBtn"
    )
    ?.remove();
}


// ============================================================
// TUNGGU TOPBAR
//
// FIX PENTING:
// Versi lama hanya mencari .topbar-actions sekali.
// Jika UI belum selesai render, tombol tidak pernah muncul.
//
// Versi ini menunggu sampai topbar tersedia.
// ============================================================

function waitForTopbar(
  timeoutMs = 15000
) {

  return new Promise(
    (resolve) => {

      const existing =
        document.querySelector(
          ".topbar-actions"
        );


      if (existing) {

        resolve(existing);

        return;
      }


      const observer =
        new MutationObserver(
          () => {

            const host =
              document.querySelector(
                ".topbar-actions"
              );


            if (host) {

              observer.disconnect();

              resolve(host);
            }
          }
        );


      observer.observe(
        document.documentElement,
        {
          childList: true,
          subtree: true
        }
      );


      setTimeout(
        () => {

          observer.disconnect();

          resolve(
            document.querySelector(
              ".topbar-actions"
            )
          );

        },
        timeoutMs
      );
    }
  );
}


// ============================================================
// SHOW BUTTON
// ============================================================

async function showPushButton(
  user,
  role
) {

  if (
    document.getElementById(
      "gsmartEnablePushBtn"
    )
  ) {
    return;
  }


  const host =
    await waitForTopbar();


  if (!host) {

    console.warn(
      "G-Smart FCM: topbar tidak ditemukan."
    );

    return;
  }


  const button =
    document.createElement(
      "button"
    );


  button.id =
    "gsmartEnablePushBtn";

  button.type =
    "button";

  button.className =
    "icon-btn";

  button.title =
    "Notifikasi G-Smart";

  button.setAttribute(
    "aria-label",
    "Notifikasi G-Smart"
  );


  // Tombol tetap terlihat walaupun
  // permission sudah GRANTED.

  button.textContent =
    (
      "Notification" in window &&
      Notification.permission ===
        "granted"
    )
      ? "🔔✓"
      : "🔔";


  // --------------------------------
  // CLICK
  // --------------------------------

  button.addEventListener(
    "click",
    async () => {

      button.disabled =
        true;


      try {

        const result =
          await enableGSmartPush(
            user,
            role
          );


        if (
          result.enabled
        ) {

          button.textContent =
            "🔔✓";


          alert(
            "Notifikasi G-Smart AKTIF.\n\n" +
            `Role: ${result.role}\n` +
            "FCM Token: berhasil\n" +
            "Registrasi Supabase: berhasil\n\n" +
            "Perangkat ini siap menerima push notification."
          );


          return;
        }


        alert(
          "Notifikasi G-Smart BELUM AKTIF.\n\n" +
          `Role: ${
            result.role ||
            role ||
            "tidak terbaca"
          }\n` +
          `Status: ${
            reasonText(
              result.reason
            )
          }`
        );

      } catch (error) {

        console.error(
          "G-Smart FCM:",
          error
        );


        alert(
          "Registrasi notifikasi gagal.\n\n" +
          (
            error instanceof Error
              ? error.message
              : String(error)
          )
        );

      } finally {

        button.disabled =
          false;
      }
    }
  );


  host.prepend(
    button
  );
}


// ============================================================
// FIREBASE AUTH LISTENER
// ============================================================

onAuthStateChanged(
  auth,
  async (user) => {

    removePushButton();


    if (!user) {

      console.info(
        "G-Smart FCM: belum login."
      );

      return;
    }


    try {

      const role =
        await getUserRole(
          user.uid
        );


      // --------------------------------
      // DIAGNOSTIC LOG
      // --------------------------------

      console.info(
        "G-Smart FCM diagnostic:",
        {

          uidDetected:
            true,

          role:
            role ||
            "KOSONG",

          notificationPermission:
            "Notification" in window
              ? Notification.permission
              : "unsupported",

          serviceWorker:
            "serviceWorker" in navigator
        }
      );


      // --------------------------------
      // ROLE SECURITY
      // --------------------------------

      if (
        !ALLOWED_ROLES.has(
          role
        )
      ) {

        console.warn(
          `G-Smart FCM: role '${
            role ||
            "KOSONG"
          }' tidak memiliki akses push.`
        );

        return;
      }


      // ======================================================
      // ADMIN/WASATPEL:
      // tombol SELALU tersedia.
      // ======================================================

      await showPushButton(
        user,
        role
      );


      // --------------------------------
      // AUTO REFRESH TOKEN
      // --------------------------------

      if (
        "Notification" in window &&
        Notification.permission ===
          "granted"
      ) {

        try {

          const result =
            await registerGSmartPush({
              user,
              role,
              requestPermission:
                false
            });


          console.info(
            "G-Smart FCM auto registration:",
            result.enabled
              ? "berhasil"
              : reasonText(
                  result.reason
                )
          );

        } catch (error) {

          console.warn(
            "G-Smart FCM auto registration gagal:",
            error
          );
        }
      }

    } catch (error) {

      console.warn(
        "G-Smart FCM initialization:",
        error
      );
    }
  }
);


// ============================================================
// FOREGROUND MESSAGE
// ============================================================

if (
  await isSupported()
) {

  const messaging =
    getMessaging(app);


  onMessage(
    messaging,
    (payload) => {

      console.info(
        "G-Smart push foreground:",
        payload
      );


      window.dispatchEvent(
        new CustomEvent(
          "gsmart:fcm-message",
          {
            detail:
              payload
          }
        )
      );
    }
  );
}


// ============================================================
// GLOBAL DIAGNOSTIC API
// ============================================================

window.GSmartPush = {

  register:
    registerGSmartPush,

  enable:
    enableGSmartPush,


  diagnostics:
    async () => {

      const user =
        auth.currentUser;


      return {

        loggedIn:
          Boolean(
            user?.uid
          ),

        role:
          user?.uid
            ? await getUserRole(
                user.uid
              )
            : "",

        supported:
          await isSupported(),

        notificationPermission:
          "Notification" in window
            ? Notification.permission
            : "unsupported",

        serviceWorker:
          "serviceWorker" in navigator
      };
    }
};
