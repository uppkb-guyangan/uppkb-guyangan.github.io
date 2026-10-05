const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is missing");

const uid = String(process.env.FIREBASE_UID || "").trim();
const role = String(process.env.FIREBASE_ROLE || "").trim().toUpperCase();

if (!uid) throw new Error("FIREBASE_UID is missing");
if (!["ADMIN", "WASATPEL"].includes(role)) {
  throw new Error("FIREBASE_ROLE must be ADMIN or WASATPEL");
}

const serviceAccount = JSON.parse(raw);
if (typeof serviceAccount.private_key === "string") {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
}

initializeApp({ credential: cert(serviceAccount) });

async function main() {
  const auth = getAuth();
  const user = await auth.getUser(uid);
  const claims = user.customClaims || {};

  await auth.setCustomUserClaims(uid, {
    ...claims,
    role,
  });

  const refreshed = await auth.getUser(uid);
  console.log(`UPDATED ${refreshed.email || uid}: role=${refreshed.customClaims?.role}`);
  console.log("User must sign out and sign in again so the client receives a fresh ID token.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
