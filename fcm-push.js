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
// Hanya untuk ADMIN dan WASATPEL
// ============================================================

const VAPID_KEY =
  "BC4m__KPNTgQJFOiIOEpD5VTlPDXtxz9yVbWCtVufTUrt-8BzKTmDu4d_sTAcMK61TOpifLJJkZ9UlhUosVgQ4o";

const REGISTER_URL =
  `${supabaseConfig.url}/functions/v1/register-push-token`;

const ALLOWED_ROLES = new Set([
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

const auth = getAuth(app);

const db = getFirestore(app);


// ============================================================
// HELPER
// ============================================================

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}


// ============================================================
// AMBIL ROLE DARI FIRESTORE
// ============================================================

async function getUserRole(uid) {

  if (!uid) {
    return "";
  }

  const userRef = doc(
    db,
    "users",
    uid
  );

  const snapshot =
    await getDoc(userRef);

  if (!snapshot.exists()) {
    return "";
  }

  return normalizeRole(
    snapshot.data()?.role
  );
}


// ============================================================
// KIRIM TOKEN KE SUPABASE EDGE FUNCTION
//
// PENTING:
// Frontend TIDAK mengirim firebase_uid atau role
// sebagai identitas yang dipercaya.
//
// Edge Function akan:
// 1. Verifikasi Firebase ID Token
// 2. Mendapatkan UID asli
// 3. Membaca role asli
// 4. Memastikan hanya ADMIN/WASATPEL
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

  const response = await fetch(
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
        token: fcmToken,

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

  // ------------------------------
  // User harus login
  // ------------------------------

  if (!user?.uid) {

    return {
      enabled: false,
      reason: "not_authenticated"
    };
  }


  // ------------------------------
  // Ambil role
  // ------------------------------

  const currentRole =
    normalizeRole(
      role ||
      await getUserRole(user.uid)
    );


  // ------------------------------
  // Hanya ADMIN / WASATPEL
  // ------------------------------

  if (
    !ALLOWED_ROLES.has(
      currentRole
    )
  ) {

    return {
      enabled: false,
      reason: "role_not_allowed"
    };
  }


  // ------------------------------
  // Cek dukungan browser
  // ------------------------------

  const supported =
    await isSupported();

  if (
    !supported ||
    !("serviceWorker" in navigator) ||
    !("Notification" in window)
  ) {

    return {
      enabled: false,
      reason: "unsupported"
    };
  }


  // ------------------------------
  // Permission
  // ------------------------------

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
      reason: permission
    };
  }


  // ------------------------------
  // Tunggu Service Worker
  // ------------------------------

  const registration =
    await navigator
      .serviceWorker
      .ready;


  // ------------------------------
  // Ambil FCM token
  // ------------------------------

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
      reason: "token_empty"
    };
  }


  // ------------------------------
  // Register ke backend
  // ------------------------------

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
// USER MEMINTA AKTIFKAN PUSH
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
// TOMBOL NOTIFIKASI
// ============================================================

function removePushButton() {

  document
    .getElementById(
      "gsmartEnablePushBtn"
    )
    ?.remove();
}


function showPushButton(
  user,
  role
) {

  if (
    Notification.permission !==
    "default"
  ) {
    return;
  }


  if (
    document.getElementById(
      "gsmartEnablePushBtn"
    )
  ) {
    return;
  }


  const host =
    document.querySelector(
      ".topbar-actions"
    );


  if (!host) {
    console.info(
      "G-Smart FCM: .topbar-actions belum tersedia."
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
    "Aktifkan push notification";

  button.setAttribute(
    "aria-label",
    "Aktifkan push notification"
  );

  button.textContent =
    "🔔";


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

          removePushButton();

          alert(
            "Notifikasi G-Smart berhasil diaktifkan pada perangkat ini."
          );

          return;
        }


        if (
          result.reason ===
          "denied"
        ) {

          alert(
            "Izin notifikasi ditolak. Aktifkan kembali melalui pengaturan browser/PWA."
          );

          return;
        }


        console.warn(
          "G-Smart push belum aktif:",
          result
        );

      } catch (error) {

        console.error(
          "G-Smart FCM:",
          error
        );

        alert(
          "Notifikasi belum dapat diaktifkan. Silakan coba lagi."
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
// AUTO REGISTER SETELAH LOGIN
// ============================================================

onAuthStateChanged(
  auth,
  async (user) => {

    removePushButton();


    if (!user) {
      return;
    }


    try {

      const role =
        await getUserRole(
          user.uid
        );


      if (
        !ALLOWED_ROLES.has(
          role
        )
      ) {

        console.info(
          "G-Smart FCM: role tidak memiliki akses push."
        );

        return;
      }


      // Jika permission sebelumnya sudah diberikan,
      // token langsung diperbarui.

      if (
        Notification.permission ===
        "granted"
      ) {

        const result =
          await registerGSmartPush({
            user,
            role,
            requestPermission:
              false
          });


        console.info(
          "G-Smart FCM:",
          result.enabled
            ? "perangkat terdaftar"
            : result.reason
        );

        return;
      }


      // Jika user belum pernah memilih,
      // tampilkan tombol lonceng.
      //
      // Permission TIDAK diminta otomatis
      // agar browser tidak memblokir prompt.

      if (
        Notification.permission ===
        "default"
      ) {

        showPushButton(
          user,
          role
        );
      }

    } catch (error) {

      console.warn(
        "G-Smart FCM auto registration:",
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


      // Bisa digunakan UI G-Smart
      // untuk toast / badge / refresh data.

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
// GLOBAL API
// ============================================================

window.GSmartPush = {

  register:
    registerGSmartPush,

  enable:
    enableGSmartPush
};
