import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
const panel=readFileSync(new URL("../private-evidence-panel.js",import.meta.url),"utf8");
const index=readFileSync(new URL("../index.html",import.meta.url),"utf8");

test("private objection evidence panel is Admin-only and linked to a disputed case",()=>{
  assert.match(app,/p\.admin&&!state\.demo&&d\.dispute\?/);
  assert.match(app,/p\.admin&&!state\.demo&&d\.dispute&&\$\("gsmartPrivateEvidence"\)/);
  assert.match(app,/getToken:\(\)=>auth\.currentUser\.getIdToken\(true\)/);
  assert.match(app,/gsmart-dispute-private/);
});
test("existing ETLE vehicle photos remain unchanged",()=>{
  assert.match(app,/const photos=d\.photos\?\.filter\(x=>x\.photo_url\)\|\|\[\]/);
  assert.match(app,/id="detailMainPhoto"/);
  assert.match(app,/class="detail-photo-thumb/);
});
test("client code sends only Firebase token and case ID, never stores private content",()=>{
  assert.match(panel,/Authorization:"Bearer "\+token/);
  assert.match(panel,/cache:"no-store"/);
  assert.match(panel,/credentials:"omit"/);
  assert.match(panel,/case_id:caseId/);
  assert.doesNotMatch(panel,/localStorage|sessionStorage|console\.log/);
  assert.match(panel,/disposePrivateEvidencePreview/);
  assert.match(panel,/URL\.revokeObjectURL/);
});
test("private offender metadata is inserted as text, not raw HTML",()=>{
  assert.match(panel,/node\.textContent=String\(text\)/);
  assert.match(panel,/document\.createTextNode\(String\(result\.reason\)\)/);
  assert.doesNotMatch(panel,/innerHTML/);
});
test("build uses fresh PWA versioned script and stylesheet",()=>{
  assert.match(index,/app-v2\.js\?v=20261010-admin-evidence1/);
  assert.match(index,/private-evidence-panel\.css\?v=20261010-admin1/);
});
