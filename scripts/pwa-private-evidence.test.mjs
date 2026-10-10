import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
const panel=readFileSync(new URL("../private-evidence-panel.js",import.meta.url),"utf8");
const index=readFileSync(new URL("../index.html",import.meta.url),"utf8");

test("private objection evidence panel serves active Admin and Wasatpel only",()=>{
  assert.match(app,/p\.privateDispute&&!state\.demo&&d\.dispute\?/);
  assert.match(app,/p\.privateDispute&&!state\.demo&&d\.dispute&&\$\("gsmartPrivateEvidence"\)/);
  assert.match(app,/getToken:\(\)=>auth\.currentUser\.getIdToken\(true\)/);
  assert.match(app,/gsmart-dispute-private/);
});
test("Wasatpel receives evidence read-access, but not Admin management privileges",()=>{
  assert.match(app,/privateDisputeEvidence:isAdmin\|\|isWasatpel/);
  assert.match(app,/adminPrivileges:isAdmin/);
  assert.match(app,/privateDispute:rolePermissions\(\)\.privateDisputeEvidence/);
  assert.match(app,/· Admin &amp; Wasatpel/);
  assert.match(panel,/Akses bukti sanggahan hanya untuk Admin atau Wasatpel aktif/);
  assert.doesNotMatch(app,/adminPrivileges:isAdmin\|\|isWasatpel/);
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
  assert.doesNotMatch(panel,/\b(?:localStorage|sessionStorage)\s*\.|console\.log\s*\(/);
  assert.match(panel,/disposePrivateEvidencePreview/);
  assert.match(panel,/URL\.revokeObjectURL/);
});
test("authorized readers see imported offender fields inside Data Pelanggar without changing public table",()=>{
  const offenderStart=app.indexOf('Data Pelanggar</h3>');
  const vehicleStart=app.indexOf('Kendaraan & KIR</h3>',offenderStart);
  const panelStart=app.indexOf('id="gsmartPrivateOffender"',offenderStart);
  const evidenceStart=app.indexOf('id="gsmartPrivateEvidence"',offenderStart);
  assert.ok(offenderStart>=0 && vehicleStart>offenderStart);
  assert.ok(panelStart>offenderStart && panelStart<vehicleStart);
  assert.ok(evidenceStart>panelStart && evidenceStart<vehicleStart);
  assert.match(app,/p\.privateDispute&&!state\.demo&&d\.dispute\?/);
  assert.match(app,/offenderPanel:\$\("gsmartPrivateOffender"\)/);
  assert.match(app,/publicOffender:d\.offender\|\|\{\}/);
  assert.match(panel,/function metadataFields\(record,publicOffender=\{\}\)/);
  assert.match(panel,/offenderPanel\.replaceChildren\(title,dl\)/);
  assert.doesNotMatch(app,/write\("etle_offenders"/);
});
test("private offender metadata is inserted as text, not raw HTML",()=>{
  assert.match(panel,/node\.textContent=String\(text\)/);
  assert.match(panel,/element\("p",value,"gsmart-private-dispute-value"\)/);
  assert.doesNotMatch(panel,/innerHTML/);
});
test("build uses fresh PWA versioned script and stylesheet",()=>{
  assert.match(index,/app-v2\.js\?v=20261010-(?:admin-evidence1|dispute-tabs1|private-offender1|stopped-photo1|dispute-fields1|wasatpel1)/);
  assert.match(index,/private-evidence-panel\.css\?v=20261010-(?:admin1|offender1|dispute-fields1)/);
});
