import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
const component=readFileSync(new URL("../stopped-vehicle-photo.js",import.meta.url),"utf8");
const index=readFileSync(new URL("../index.html",import.meta.url),"utf8");

test("fallback only for STOPPED cases with missing existing ETLE photos",()=>{
 assert.match(app,/if\(!mainPhoto&&!state\.demo&&d\.terminated\)/);
 assert.match(app,/loadStoppedVehiclePhoto\(container,/);
 assert.match(app,/gsmart-stopped-vehicle/);
 assert.match(app,/getToken:\(\)=>auth\.currentUser\.getIdToken\(true\)/);
});
test("existing shipping photo rendering and gallery remain unchanged",()=>{
 assert.match(app,/const mainPhoto=photos\[0\]\?\.photo_url/);
 assert.match(app,/mainPhoto\?\'<img id="detailMainPhoto"/);
 assert.match(app,/class="detail-photo-thumb/);
});
test("private stopped photos never leak credentials or signed sources",()=>{
 assert.match(component,/cache:"no-store"/);
 assert.match(component,/credentials:"omit"/);
 assert.match(component,/Authorization:"Bearer "\+token/);
 assert.match(component,/case_id:caseId/);
 assert.doesNotMatch(component,/(?:localStorage|sessionStorage)\s*\.|innerHTML|console\.log/);
 assert.match(component,/URL\.revokeObjectURL/);
 assert.match(app,/disposeStoppedVehiclePhoto\(\)/);
});
test("PWA asset cache busting updated",()=>{
 assert.match(index,/app-v2\.js\?v=20261010-(?:stopped-photo1|dispute-fields1)/);
 assert.match(app,/stopped-vehicle-photo\.js\?v=20261010-stopped1/);
});
