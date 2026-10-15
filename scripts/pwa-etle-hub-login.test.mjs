import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const src=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");

function loginModule(){
  const start=src.indexOf("function openEtleHubLogin(){");
  const end=src.indexOf("function renderNav(){",start);
  assert.ok(start>=0&&end>start,"Isolated ETLE Hub login action exists");
  const calls=[];
  const {openEtleHubLogin}=runInNewContext(
    src.slice(start,end)+"\n({openEtleHubLogin})",
    {window:{open:(...args)=>calls.push(args)}}
  );
  return {openEtleHubLogin,calls};
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
  assert.match(html,/app-v2\.js\?v=20261015-etle-login1/);
  assert.match(sw,/app-v2\.js\?v=20261015-etle-login1/);
  assert.match(sw,/gsmart-shell-v61/);
});
