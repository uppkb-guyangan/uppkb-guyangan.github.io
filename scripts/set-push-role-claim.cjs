const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is missing");

const uid = String(process.env.FIREBASE_UID || "").trim();
if (!uid) throw new Error("FIREBASE_UID is missing");

const serviceAccount = JSON.parse(raw);
if (typeof serviceAccount.private_key === "string") {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
}

initializeApp({ credential: cert(serviceAccount) });

async function main() {
  const auth = getAuth();
  const user = await auth.getUser(uid);
  const claims = { ...(user.customClaims || {}) };

  // Roll back the push-notification experiment. Supabase/PostgREST uses the
  // JWT `role` claim for database authorization, so ADMIN/WASATPEL must not be
  // stored in Firebase's reserved `role` claim. Application roles remain in
  // Firestore users/{uid}.role as before.
  delete claims.role;

  await auth.setCustomUserClaims(uid, claims);

  const refreshed = await auth.getUser(uid);
  console.log(`ROLLED BACK ${refreshed.email || uid}: Firebase custom role claim removed`);
  console.log("User must sign out and sign in again so the client receives a fresh ID token.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
