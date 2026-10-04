const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is missing");

initializeApp({ credential: cert(JSON.parse(raw)) });

async function main() {
  const auth = getAuth();
  let pageToken;
  let scanned = 0;
  let updated = 0;
  let alreadyOk = 0;
  let skipped = 0;

  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      scanned += 1;
      const claims = user.customClaims || {};
      const currentRole = claims.role;

      if (currentRole === "authenticated") {
        alreadyOk += 1;
        continue;
      }

      if (currentRole) {
        skipped += 1;
        console.warn(`SKIP ${user.email || user.uid}: role already "${currentRole}"`);
        continue;
      }

      await auth.setCustomUserClaims(user.uid, {
        ...claims,
        role: "authenticated",
      });
      updated += 1;
      console.log(`UPDATED ${user.email || user.uid}: role=authenticated`);
    }
    pageToken = page.pageToken;
  } while (pageToken);

  console.log(`Done. scanned=${scanned}, updated=${updated}, already_ok=${alreadyOk}, skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
