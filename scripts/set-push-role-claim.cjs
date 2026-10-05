const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is missing");

const serviceAccount = JSON.parse(raw);
if (typeof serviceAccount.private_key === "string") {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
}

initializeApp({ credential: cert(serviceAccount) });

async function main() {
  const auth = getAuth();
  let pageToken;
  let updated = 0;

  do {
    const page = await auth.listUsers(1000, pageToken);

    for (const user of page.users) {
      const claims = { ...(user.customClaims || {}) };

      // IMPORTANT:
      // Supabase Third-Party Auth expects the reserved JWT `role` claim to be
      // exactly `authenticated`. Application roles such as ADMIN/WASATPEL stay
      // in Firestore users/{uid}.role and must never replace this JWT role.
      claims.role = "authenticated";

      await auth.setCustomUserClaims(user.uid, claims);
      updated += 1;
      console.log(`RESTORED ${user.email || user.uid}: role=authenticated`);
    }

    pageToken = page.pageToken;
  } while (pageToken);

  console.log(`DONE: ${updated} Firebase user(s) restored for Supabase access.`);
  console.log("Users must sign out and sign in again so clients receive fresh ID tokens.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
