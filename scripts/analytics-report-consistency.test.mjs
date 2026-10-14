import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const app=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
function section(start,end){
  const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,"Missing application section "+start);
  return app.slice(a,b);
}
const segments=[
 section("const ym=v=>{","const monthName="),
 section("function wibDateKey(","function buildSmartActivities("),
 section("function analyticsMetricCases(b,key){","function analytics(b){"),
 section("function reportSnapshot(b){","function reportText(s){"),
 section("function reportText(s){","function reportPage(b){"),
 'const norm=v=>String(v??"").trim().toLowerCase();',
 'function period(v){return !state.month||ym(v)===state.month}',
 'function activeDisputes(b){const stopped=new Set(b.terminated.map(x=>x.case_id));return b.disputes.filter(x=>period(x.confirmation_date)&&x.case_id&&!stopped.has(x.case_id))}',
 'function activeShippingRows(b){const archived=new Set(b.cases.filter(x=>x.is_archived).map(x=>x.case_id));return b.shipping.filter(x=>!archived.has(x.case_id))}',
 'function monthName(month){return month||"Semua Data"}',
 '({ym,analyticsMetricCases,reportSnapshot,reportText,state})'
].join("\n");
const {ym,analyticsMetricCases,reportSnapshot,reportText,state}=runInNewContext('const state={month:null};\n'+segments);
const fixture={
 cases:[
  {case_id:"a",tnkb:"A1",tanggal_pelanggaran:"2026-09-20T10:00:00Z",no_blanko:"X1",tanggal_blanko:"2026-10-02"},
  {case_id:"b",tnkb:"B2",tanggal_pelanggaran:"2026-10-03T10:00:00Z"},
  {case_id:"c",tnkb:"C3",tanggal_pelanggaran:null},
  {case_id:"d",tnkb:"D4",tanggal_pelanggaran:"2026-09-20T10:00:00Z",is_archived:true}
 ],
 shipping:[{case_id:"a",printed_date:"2026-10-02"},{case_id:"d",printed_date:"2026-10-02"}],
 disputes:[{case_id:"b",confirmation_date:"2026-10-04T00:00:00Z"}],
 terminated:[{case_id:"c",terminated_at:"2026-09-29"}],
 courts:[{case_id:"a",tanggal_sidang:"2026-11-11"}]
};
test("WIB monthly filters respect timestamp offsets but retain DATE literal",()=>{
 assert.equal(ym("2026-09-30T18:00:00Z"),"2026-10");
 assert.equal(ym("2026-09-30T16:59:00Z"),"2026-09");
 assert.equal(ym("2026-09-30"),"2026-09");
});
test("analytics metric drilldowns count cases by process date",()=>{
 state.month="2026-10";
 assert.deepEqual(Array.from(analyticsMetricCases(fixture,"blanko"),c=>c.case_id),["a"]);
 assert.deepEqual(Array.from(analyticsMetricCases(fixture,"disputes"),c=>c.case_id),["b"]);
 assert.equal(analyticsMetricCases(fixture,"court").length,0);
 state.month="2026-11";
 assert.deepEqual(Array.from(analyticsMetricCases(fixture,"court"),c=>c.case_id),["a"]);
 state.month="2026-09";
 assert.deepEqual(Array.from(analyticsMetricCases(fixture,"terminated"),c=>c.case_id),["c"]);
 state.month=null;
});
test("reports use violation cohort for totals and process dates for activity",()=>{
 state.month="2026-10";
 const oct=reportSnapshot(fixture);
 assert.equal(oct.total,1);
 assert.equal(oct.success,1);
 assert.equal(oct.blanko,1);
 assert.equal(oct.disputes,1);
 assert.equal(oct.shipping,1);
 assert.equal(oct.terminated,0);
 assert.equal(oct.court,0);
 state.month=null;
 const all=reportSnapshot(fixture);
 assert.equal(all.total,4);
 assert.equal(all.withoutDate,1);
});
test("official ETLE confirmation is never inferred from follow-up proxy",()=>{
 state.month=null;
 const report=reportText(reportSnapshot(fixture));
 assert.match(report,/Konfirmasi Resmi belum tersedia/);
 assert.match(report,/tanggal pelanggaran/i);
 assert.match(report,/tanggal masing-masing/i);
 assert.doesNotMatch(report,/Berhasil Konfirmasi: \d+/);
});
test("analytics retains combination and unclassified cases",()=>{
 assert.match(app,/s\.includes\("DOKUMEN"\)&&\(s\.includes\("DAYA ANGKUT"\)/);
 assert.match(app,/return"TANPA JENIS"/);
 assert.match(app,/if\(typeKey==="TANPA JENIS"\)missingTypeCount\+\+/);
 assert.match(app,/key==="no-date"/);
 for(const key of ["blanko","disputes","terminated","court"])assert.ok(app.includes('analyticsMetricCases(b,"'+key+'").length'));
 assert.match(app,/rows=analyticsMetricCases\(b,key\)/);
});
