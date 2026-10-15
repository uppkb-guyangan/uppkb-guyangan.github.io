import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const app=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
const start=app.indexOf("function etleHubBackendDetailUrl(c){");
const end=app.indexOf("function caseDeepLink(caseId){",start);
assert.ok(start>=0&&end>start,"Validated ETLE Hub URL helper is available");
const {etleHubBackendDetailUrl}=runInNewContext(
  app.slice(start,end)+"\n({etleHubBackendDetailUrl})"
);

test("ETLE Hub backend link points to authenticated detail page on the fixed port 9000",()=>{
  assert.equal(etleHubBackendDetailUrl({violation_id:"100035"}),
    "https://etilang-djpd.kemenhub.go.id:9000/admin-etle/terkonfirmasi_detail.php?id=100035");
  assert.equal(etleHubBackendDetailUrl({violation_id:100567}),
    "https://etilang-djpd.kemenhub.go.id:9000/admin-etle/terkonfirmasi_detail.php?id=100567");
  assert.equal(etleHubBackendDetailUrl({violation_id:" 123 "}),
    "https://etilang-djpd.kemenhub.go.id:9000/admin-etle/terkonfirmasi_detail.php?id=123");
});


test("Blanko Tilang opens the correct backend tagihan detail shown by ETLE Hub",()=>{
  const correct="https://etilang-djpd.kemenhub.go.id:9000/admin-etle/tertagih_detail.php?violation_id=100035";
  assert.equal(etleHubBackendDetailUrl({violation_id:"100035",status_etle:"BLANKO_TERBIT",no_blanko:"AJ0001691"}),correct);
  assert.equal(etleHubBackendDetailUrl({violation_id:"100035",no_blanko:"AJ0001691"}),correct);
  assert.equal(etleHubBackendDetailUrl({violation_id:"100035",status_etle:"TERTAGIH"}),correct);
  assert.equal(etleHubBackendDetailUrl({violation_id:"100035",status_etle:"TERBAYAR"}),correct);
  assert.equal(etleHubBackendDetailUrl({violation_id:100035,status_etle:"PERSIDANGAN"}),correct);
});

test("Non-blanko cases keep original confirmation detail; missing IDs stay blocked",()=>{
  const original="https://etilang-djpd.kemenhub.go.id:9000/admin-etle/terkonfirmasi_detail.php?id=100567";
  assert.equal(etleHubBackendDetailUrl({violation_id:"100567",status_etle:"TERSANGGAH"}),original);
  assert.equal(etleHubBackendDetailUrl({violation_id:"100567",status_etle:"DIHENTIKAN",no_blanko:""}),original);
  assert.equal(etleHubBackendDetailUrl({violation_id:"100567",status_etle:"TERTAGIH",no_blanko:"-"}),
    "https://etilang-djpd.kemenhub.go.id:9000/admin-etle/tertagih_detail.php?violation_id=100567");
  assert.equal(etleHubBackendDetailUrl({violation_id:"bad",no_blanko:"BL-1"}),null);
});

test("Never construct backend links from invalid identifiers or user-supplied paths",()=>{
  for(const id of ["",null,undefined,"abc","3?admin=1","1/../2","-1","1234567890123","100035#fragment","https://example.org"]){
    assert.equal(etleHubBackendDetailUrl({violation_id:id}),null,String(id));
  }
  assert.equal(etleHubBackendDetailUrl(null),null);
  assert.equal(etleHubBackendDetailUrl({case_id:"demo-case",tnkb:"AE8149YC"}),null);
});

test("Existing public Konfirmasi and QR buttons remain untouched; backend is additional",()=>{
  assert.match(app,/id="confirmEtleBtn" type="button">Buka Konfirmasi ↗/);
  assert.match(app,/id="qrConfirmBtn" type="button">▦ QR Konfirmasi/);
  assert.match(app,/id="etleHubBackendBtn" type="button" title="Buka detail di backend ETLE Hub \(perlu login\)">Buka ETLE Hub ↗/);
  assert.match(app,/etleHubUrl\?'/);
  assert.match(app,/if\(\$\("etleHubBackendBtn"\)\)/);
  assert.match(app,/window\.open\(url,"_blank","noopener,noreferrer"\)/);
  assert.match(app,/function etleConfirmationUrl\(c\)\{/);
  assert.match(app,/https:\/\/etilang-djpd\.kemenhub\.go\.id\/konfirmasi\?ref_number=/);
});

test("Changes propagate via PWA cache and remain available on HP and desktop",()=>{
  assert.match(html,/app-v2\.js\?v=20261015-etlehub-roles1/);
  assert.match(sw,/app-v2\.js\?v=20261015-etlehub-roles1/);
  assert.match(sw,/gsmart-shell-v62/);
});
