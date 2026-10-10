import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const app=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const active=app.match(/function activeDisputes\(b\)\{[^\n]*\}/)?.[0];
const stopped=app.match(/function stoppedDisputes\(b\)\{[\s\S]*?\n\}/)?.[0];
if(!active || !stopped)throw Error("Cannot locate dispute grouping functions");
const {activeDisputes,stoppedDisputes}=vm.runInNewContext(
  active+"\n"+stopped+"\n({activeDisputes,stoppedDisputes})",
  {period:()=>true}
);

test("2 active and 5 stopped from seven disputed cases, no duplicates",()=>{
  const disputes=Array.from({length:7},(_,i)=>({
    case_id:"c"+i,violation_id:"v"+i,confirmation_date:"2026-10-01",status:"TERSANGGAH"
  }));
  const terminated=disputes.slice(0,5).map((x,i)=>({case_id:x.case_id,terminated_at:"2026-10-03"}));
  const activeRows=activeDisputes({disputes,terminated});
  const stoppedRows=stoppedDisputes({disputes,terminated});
  assert.equal(activeRows.length,2);
  assert.equal(stoppedRows.length,5);
  assert.equal(new Set([...activeRows,...stoppedRows].map(x=>x.case_id)).size,7);
  assert.ok(stoppedRows.every(x=>x.status==="DIHENTIKAN"));
  assert.ok(activeRows.every(x=>x.status==="TERSANGGAH"));
  assert.equal(disputes.length,7);
});
test("Dashboard counts retain active-sanggahan definition",()=>{
  assert.match(app,/disputes:activeDisputes\(b\)\.length/);
  assert.match(app,/case"disputes":return state\.disputeTab==="stopped"\?stoppedDisputes\(b\):activeDisputes\(b\)/);
  assert.match(app,/state\.disputeTab=value/);
});
test("shortcuts for today's sanggahan return to active tab",()=>{
  assert.match(app,/p==="disputes"&&activityFocus\?\.mode==="today"\)state\.disputeTab="active"/);
  assert.match(app,/case"disputes":return activeDisputes\(b\)\.filter/);
});
test("user-visible tabs and cache versions remain separate from existing case detail",()=>{
  assert.match(app,/Aktif \('/);
  assert.match(app,/Dihentikan \('/);
  assert.match(app,/state\.disputeTab==="stopped"\?\[\["terminated_at","Tgl Dihentikan"\]\]/);
  assert.match(html,/dispute-tabs\.css\?v=20261010-tab1/);
  assert.match(html,/app-v2\.js\?v=20261010-(?:dispute-tabs1|private-offender1|stopped-photo1|dispute-fields1|wasatpel1)/);
  assert.match(app,/mountPrivateEvidence\(\$\("gsmartPrivateEvidence"\)/);
});
