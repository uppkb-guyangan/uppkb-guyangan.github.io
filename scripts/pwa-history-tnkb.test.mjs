import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const app=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
function sourceBetween(start,end){
  const first=app.indexOf(start);
  const last=app.indexOf(end,first+start.length);
  assert.ok(first>=0&&last>first,"Missing app block "+start);
  return app.slice(first,last);
}
const helper=sourceBetween("function enrichHistoryWithTnkb(rows,cases){","function processPage(");
const enrichHistoryWithTnkb=runInNewContext(helper+"\nenrichHistoryWithTnkb",{Map,String});

test("history TNKB is resolved by case_id without changing events or their count",()=>{
  const records=[
    {case_id:"a",event_type:"LETTER_DELIVERED",event_time:"2026-10-10T15:13:00+07:00"},
    {case_id:"a",event_type:"LETTER_PRINTED",event_time:"2026-10-10T10:00:00+07:00"},
    {case_id:"b",event_type:"CASE_STOPPED",event_time:"2026-10-10T14:00:00+07:00"}
  ];
  const original=JSON.stringify(records);
  const result=enrichHistoryWithTnkb(records,[
    {case_id:"a",tnkb:"AG 9741 VJ"},{case_id:"b",tnkb:"L1234AB"}
  ]);
  assert.equal(result.length,3);
  assert.deepEqual(Array.from(result,r=>r.tnkb),["AG 9741 VJ","AG 9741 VJ","L1234AB"]);
  assert.equal(result[0].event_type,"LETTER_DELIVERED");
  assert.equal(JSON.stringify(records),original,"Source history must remain untouched");
  assert.notStrictEqual(result[0],records[0]);
});

test("missing or unlinked TNKB is safe, never throws or hides the event",()=>{
  const result=enrichHistoryWithTnkb([
    {case_id:"missing",event_type:"LETTER_DELIVERED"},
    {case_id:null,event_type:"CASE_STOPPED"},
    {case_id:"blank",event_type:"LETTER_PRINTED"}
  ],[{case_id:"blank",tnkb:"  "}]);
  assert.equal(result.length,3);
  assert.deepEqual(Array.from(result,r=>r.tnkb),["-","-","-"]);
  assert.equal(enrichHistoryWithTnkb([],[]).length,0);
});

test("renders TNKB as first history column on desktop and mobile cards",()=>{
  assert.match(app,/history:\[\["tnkb","TNKB"\],\["event_time","Waktu"\]/);
  assert.match(app,/if\(page==="history"\)rows=enrichHistoryWithTnkb\(rows,\(state\.bundle\|\|demo\)\.cases\)/);
  const tableSource=sourceBetween("function genericTable(page,rows){","function historyDisplayTitle(");
  const genericTable=runInNewContext(tableSource+"\ngenericTable",{
    rowCaseId:(_page,r)=>r.case_id,
    state:{disputeTab:"active"},
    rolePermissions:()=>({copyPhone:false}),
    esc:x=>String(x??""),
    cell:(_key,value)=>String(value??"-")
  });
  const result=genericTable("history",[{case_id:"a",tnkb:"AG 9741 VJ",event_time:"2026-10-10",event_type:"LETTER_DELIVERED",title:"Surat diterima",source:"ETLE_SHIPPING"}]);
  assert.match(result,/<th>TNKB<\/th><th>Waktu<\/th>/);
  assert.match(result,/<td data-label="TNKB">AG 9741 VJ<\/td>/);
  assert.match(result,/data-case="a"/);
});

test("history search accepts TNKB with or without whitespace",()=>{
  const pageSource=sourceBetween("function processPage(page,rows){","function resolveCaseIdForRecord(");
  assert.match(pageSource,/q\.replace\(\/\\s\+\/g,""\)/);
  assert.match(pageSource,/String\(x\.tnkb\|\|""\)\.toLowerCase\(\)\.replace\(\/\\s\+\/g,""\)\.includes\(compactQuery\)/);
  assert.match(pageSource,/JSON\.stringify\(x\)\.toLowerCase\(\)\.includes\(q\)/);
});

test("no per-row API requests or legacy global fetch interception",()=>{
  assert.doesNotMatch(helper,/\bfetch\s*\(|\bawait\b|supabase|\.table\(/i);
  assert.doesNotMatch(html,/script src="\.\/history-tnkb\.js/);
  assert.match(html,/app-v2\.js\?v=20261010-history-tnkb1/);
  assert.match(app,/const\[cases,shipping,disputes,terminated,courts,offenders,histories,syncLogs\]=await Promise\.all\(/);
});

test("other table columns and case navigation remain intact",()=>{
  assert.match(app,/shipping:\[\["tnkb","TNKB"\],\["tracking_number","No\. Resi"\]/);
  assert.match(app,/case"history":/);
  assert.match(app,/function bindDetailRows\(\)\{/);
  assert.match(app,/const caseId=rowCaseId\(page,r\)/);
});
