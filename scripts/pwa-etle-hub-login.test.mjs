import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const src=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");

function loginModule({role="ADMIN",demo=false}={}){
  const roleStart=src.indexOf("function rolePermissions(){");
  const roleEnd=src.indexOf("function toast(msg){",roleStart);
  const start=src.indexOf("function openEtleHubLogin(){");
  const end=src.indexOf("function renderNav(){",start);
  assert.ok(roleStart>=0&&roleEnd>roleStart&&start>=0&&end>start,"Role and login helpers exist");
  const calls=[],warnings=[];
  const state={profile:{role},demo};
  const {openEtleHubLogin,perms,rolePermissions}=runInNewContext(
    src.slice(roleStart,roleEnd)+
    src.slice(start,end)+
    "\n({openEtleHubLogin,perms,rolePermissions})",
    {state,window:{open:(...args)=>calls.push(args)},toast:(s)=>warnings.push(s)}
  );
  return {openEtleHubLogin,calls,warnings,perms,rolePermissions};
}

test("Sidebar includes one non-invasive Login ETLE Hub entry",()=>{
  assert.match(src,/\["report","Laporan ETLE"\],\["etleHubLogin","Login ETLE Hub"\]/);
  assert.match(src,/etleHubLogin:"↗"/);
  assert.match(src,/const badgeCounts=/);
  assert.match(src,/id!=="loginHistory"&&id!=="health"/);
  assert.match(src,/function renderNav\(\)/);
});
test("The menu opens only official HTTPS port 9000 login in a new tab",()=>{
  const {openEtleHubLogin,calls}=loginModule();
  openEtleHubLogin();
  assert.deepEqual(calls,[["https://etilang-djpd.kemenhub.go.id:9000/main/","_blank","noopener,noreferrer"]]);
});
test("Clicking external login does not navigate away from G-Smart or change selected page",()=>{
  const navStart=src.indexOf("function renderNav(){");
  const navEnd=src.indexOf("function buildMonthOptions(){",navStart);
  assert.ok(navStart>=0&&navEnd>navStart);
  const nav=src.slice(navStart,navEnd);
  assert.match(nav,/setMobileSidebarOpen\(false\)/);
  assert.match(nav,/if\(b\.dataset\.id==="etleHubLogin"\)\{openEtleHubLogin\(\);return\}/);
  assert.match(nav,/openPage\(b\.dataset\.id\)/);
  assert.ok(nav.indexOf('if(b.dataset.id==="etleHubLogin")')<nav.indexOf("openPage(b.dataset.id)"));
});
test("No password/session management is added to G-Smart",()=>{
  const action=src.slice(src.indexOf("function openEtleHubLogin(){"),src.indexOf("function renderNav(){"));
  const executable=action.split("\n").filter(line=>!line.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(executable,/password|localStorage|fetch\(|service_role|cookie|authorization/i);
  assert.match(src,/function etleHubBackendDetailUrl\(c\)/);
  assert.match(src,/id="etleHubBackendBtn"/);
});
test("PWA cache updated and login available on mobile and desktop",()=>{
  assert.match(html,/app-v2\.js\?v=20261016-gita-dev1/);
  assert.match(sw,/app-v2\.js\?v=20261016-gita-dev1/);
  assert.match(sw,/gsmart-shell-v63/);
});


test("ETLE access permission is assigned only to active ADMIN and WASATPEL",()=>{
  for(const role of ["ADMIN","WASATPEL"," admin "," wasatpel "]){
    const ctx=loginModule({role});
    assert.equal(ctx.perms().etleHub,true,role);
    ctx.openEtleHubLogin();
    assert.equal(ctx.calls.length,1,role);
  }
  for(const role of ["OPERATOR","PETUGAS","VERIFIKATOR","VIEWER","USER","KASATPEL","",null,"ADMINISTRATOR"]){
    const ctx=loginModule({role});
    assert.equal(ctx.perms().etleHub,false,String(role));
    ctx.openEtleHubLogin();
    assert.equal(ctx.calls.length,0,String(role));
    assert.equal(ctx.warnings.length,1,String(role));
  }
  const preview=loginModule({role:"ADMIN",demo:true});
  assert.equal(preview.perms().etleHub,true);
  preview.openEtleHubLogin();
  assert.equal(preview.calls.length,0);
});

test("Sidebar hides ETLE Hub Login for unauthorized roles and demo",()=>{
  const from=src.indexOf("function renderNav(){");
  const to=src.indexOf("function buildMonthOptions(){",from);
  const nav=src.slice(from,to);
  assert.match(nav,/const canEtleHub=perms\(\)\.etleHub&&!state\.demo/);
  assert.match(nav,/id!=="etleHubLogin"\|\|canEtleHub/);
  assert.match(nav,/if\(b\.dataset\.id==="etleHubLogin"\)\{openEtleHubLogin\(\);return\}/);
});

test("Detail Perkara renders and opens backend only for permitted role",()=>{
  assert.match(src,/const etleHubUrl=p\.etleHub&&!state\.demo\?etleHubBackendDetailUrl\(c\):null/);
  assert.match(src,/etleHubUrl\?'<button class="detail-confirm-btn secondary" id="etleHubBackendBtn"/);
  assert.match(src,/if\(\$\("etleHubBackendBtn"\)\)\$\("etleHubBackendBtn"\)\.onclick=\(\)=>\{if\(!perms\(\)\.etleHub\|\|state\.demo\)/);
  assert.match(src,/id="confirmEtleBtn" type="button">Buka Konfirmasi ↗/);
  assert.match(src,/id="qrConfirmBtn" type="button">▦ QR Konfirmasi/);
});
