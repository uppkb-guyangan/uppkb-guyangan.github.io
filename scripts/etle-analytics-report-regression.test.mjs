import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const app=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
function codeBetween(start,end){
  const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,"Missing source range "+start);
  return app.slice(a,b);
}
const moduleText=[
  codeBetween("function analyticsProcessCaseRows(","function analytics(b){"),
  codeBetween("function wibDateKey(","function buildSmartActivities("),
  codeBetween("function reportSnapshot(b){","function reportText(s){"),
  'const norm=v=>String(v??"").trim().toLowerCase();',
  'function period(value){return !state.month||String(value||"").slice(0,7)===state.month}',
  'function activeDisputes(b){const ids=new Set(b.terminated.map(x=>x.case_id));return b.disputes.filter(x=>period(x.confirmation_date)&&x.case_id&&!ids.has(x.case_id))}',
  'function activeShippingRows(b){const ids=new Set(b.cases.filter(x=>x.is_archived).map(x=>x.case_id));return b.shipping.filter(x=>!ids.has(x.case_id))}',
  '({analyticsProcessCaseRows,reportSnapshot,state})'
].join("\n");
const {analyticsProcessCaseRows,reportSnapshot,state}=runInNewContext('const state={month:null};\n'+moduleText);
const fixture={
  cases:[
    {case_id:"a",tnkb:"AG1",tanggal_pelanggaran:"2026-09-20T10:00:00Z",no_blanko:"B01",tanggal_blanko:"2026-10-02"},
    {case_id:"b",tnkb:"AG2",tanggal_pelanggaran:"2026-10-03T10:00:00Z"},
    {case_id:"c",tnkb:"AG3",tanggal_pelanggaran:null},
    {case_id:"d",tnkb:"AG4",tanggal_pelanggaran:"2026-09-23T10:00:00Z",is_archived:true}
  ],
  shipping:[{case_id:"a",printed_date:"2026-10-02"},{case_id:"d",printed_date:"2026-10-02"}],
  disputes:[{case_id:"b",confirmation_date:"2026-10-04T08:00:00Z"}],
  terminated:[{case_id:"c",terminated_at:"2026-09-29"}],
  courts:[{case_id:"a",tanggal_sidang:"2026-11-11"}],
  histories:[
    {case_id:"a",event_time:"2026-09-30T18:00:00Z"},
    {case_id:"b",event_time:"2026-10-03T10:00:00Z"},
    {case_id:"c",event_time:"2026-09-25T04:00:00Z"},
    {case_id:"d",event_time:"2026-09-23T10:00:00Z"}
  ]
};
test("Analytics drilldown matches the actual process month, not violation month",()=>{
  state.month="2026-10";
  assert.deepEqual(Array.from(analyticsProcessCaseRows(fixture,"blanko"),c=>c.case_id),["a"]);
  assert.deepEqual(Array.from(analyticsProcessCaseRows(fixture,"disputes"),c=>c.case_id),["b"]);
  assert.equal(analyticsProcessCaseRows(fixture,"court").length,0);
  state.month="2026-11";
  assert.deepEqual(Array.from(analyticsProcessCaseRows(fixture,"court"),c=>c.case_id),["a"]);
  state.month="2026-09";
  assert.deepEqual(Array.from(analyticsProcessCaseRows(fixture,"terminated"),c=>c.case_id),["c"]);
  state.month=null;
});
test("Analytics metrics and clicked detail call exactly the same source function",()=>{
  for(const key of ["blanko","disputes","terminated","court"]){
    assert.match(app,new RegExp('metric\\("'+key+'","[^"]+",analyticsProcessCaseRows\\(b,"'+key+'"\\)\\.length'));
  }
  assert.match(app,/rows=analyticsProcessCaseRows\(b,key\)/);
});
test("Report counts the first history event in WIB but preserves the old cohort logic",()=>{
  state.month="2026-10";
  const summary=reportSnapshot(fixture);
  assert.equal(summary.total,2); // Sep 30 18:00 UTC is Oct 1 01:00 WIB
  assert.equal(summary.blanko,1);
  assert.equal(summary.disputes,1);
  assert.equal(summary.success,2);
  state.month=null;
  const all=reportSnapshot(fixture);
  assert.equal(all.total,4);
});
test("Original report wording, metrics and formula stay in place",()=>{
  assert.match(app,/Berhasil Konfirmasi/);
  assert.match(app,/Belum Konfirmasi/);
  assert.match(app,/Success Rate Konfirmasi Pelanggaran/);
  assert.match(app,/const success=ids\.filter\(id=>blanko\.has\(id\)\|\|disputes\.has\(id\)\|\|terminated\.has\(id\)\|\|socialization\.has\(id\)\)/);
});
test("Combination type is consistently classified in analytics chart and clicked detail",()=>{
  const matches=[...app.matchAll(/if\(s\.includes\("KOMBINASI"\)\|\|\(s\.includes\("DOKUMEN"\)&&\(s\.includes\("DAYA ANGKUT"\)/g)];
  assert.equal(matches.length,2);
  assert.match(app,/withoutDate\?'<p class="search-hint">/);
});
