import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const source=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
function part(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,"Missing code fragment "+start);
  return source.slice(a,b);
}
const code=[
  'const state={month:null};',
  "const ym=v=>{if(!v)return null;const m=String(v).match(/^(\\d{4})-(\\d{2})/);return m?m[1]+'-'+m[2]:null};".replaceAll("\\\\","\\"),
  "const norm=v=>String(v??'').trim().toLowerCase();",
  "const monthName=v=>v||'Semua Data';",
  "function period(v){return !state.month||ym(v)===state.month}",
  part("function activeDisputes(b){","function stoppedDisputes(b){"),
  "function activeShippingRows(b){const archived=new Set(b.cases.filter(x=>x.is_archived).map(x=>x.case_id));return b.shipping.filter(x=>!archived.has(x.case_id))}",
  part("function wibDateKey(","function buildSmartActivities("),
  part("function etleViolationCategory(","function analytics(b){"),
  part("function reportPeriodOverview(b){","function reportSnapshot(b){"),
  part("function reportSnapshot(b){","function reportPage(b){"),
  "({state,etleViolationCategory,analyticsProcessCases,reportSnapshot,reportText})"
].join("\n");
const {state,etleViolationCategory,analyticsProcessCases,reportSnapshot,reportText}=runInNewContext(code);
function makeCase(id,type,extra={}){
  return {case_id:id,jenis_pelanggaran:type,status_etle:"SURAT_DICETAK",tanggal_pelanggaran:"2026-09-15T09:00:00+07:00",first_seen_at:"2026-09-15T10:00:00+07:00",...extra};
}
function historic(id){
  return makeCase(id,null,{status_etle:"DIHENTIKAN",tanggal_pelanggaran:null,first_seen_at:"2026-09-24T22:45:00Z"});
}
test("The three agreed categories are recognized without double counting",()=>{
  assert.equal(etleViolationCategory(makeCase("1","DOKUMEN")),"DOKUMEN");
  assert.equal(etleViolationCategory(makeCase("2","DAYA ANGKUT")),"DAYA ANGKUT");
  assert.equal(etleViolationCategory(makeCase("3","DAYA ANGKUT, DOKUMEN")),"DOKUMEN DAYA ANGKUT");
  assert.equal(etleViolationCategory(makeCase("4","KOMBINASI")),"DOKUMEN DAYA ANGKUT");
  assert.equal(etleViolationCategory(makeCase("5","OTHER")),"LAINNYA");
});
test("Only identifiable historical stopped cases with missing types count as Dokumen",()=>{
  assert.equal(etleViolationCategory(historic("old")),"DOKUMEN");
  assert.equal(etleViolationCategory(makeCase("new",null,{status_etle:"DIHENTIKAN",tanggal_pelanggaran:null,first_seen_at:"2026-10-15T12:00:00Z"})),null);
  assert.equal(etleViolationCategory(makeCase("x",null)),null);
});
test("Clicking process cards follows process dates and excludes resolved disputes",()=>{
  const b={cases:[
    makeCase("b","DOKUMEN",{no_blanko:"B001",tanggal_blanko:"2026-10-02"}),
    makeCase("d","DOKUMEN"),makeCase("t","DOKUMEN"),makeCase("c","DAYA ANGKUT"),makeCase("r","DOKUMEN",{no_blanko:"B002",tanggal_blanko:"2026-10-05"})
  ],disputes:[{case_id:"d",confirmation_date:"2026-10-02"},{case_id:"t",confirmation_date:"2026-10-02"},{case_id:"r",confirmation_date:"2026-10-02"}],
  terminated:[{case_id:"t",terminated_at:"2026-10-03"}],courts:[{case_id:"c",tanggal_sidang:"2026-10-04"}],
  histories:[],shipping:[]};
  state.month="2026-10";
  assert.deepEqual(Array.from(analyticsProcessCases(b,"blanko"),x=>x.case_id),["b","r"]);
  assert.deepEqual(Array.from(analyticsProcessCases(b,"disputes"),x=>x.case_id),["d"]);
  assert.deepEqual(Array.from(analyticsProcessCases(b,"terminated"),x=>x.case_id),["t"]);
  assert.deepEqual(Array.from(analyticsProcessCases(b,"court"),x=>x.case_id),["c"]);
  state.month="2026-09";
  assert.equal(analyticsProcessCases(b,"blanko").length,0);
  state.month=null;
});
test("Cards use the exact same query as their detail and shared classification",()=>{
  for(const key of ["blanko","disputes","terminated","court"]){
    assert.ok(source.includes('analyticsProcessCases(b,"'+key+'").length'));
  }
  assert.match(source,/rows=analyticsProcessCases\(b,key\)/);
  assert.match(source,/const typeKey=etleViolationCategory\(x\)/);
  assert.match(source,/rows=currentCases\.filter\(x=>etleViolationCategory\(x\)===key\)/);
});
test("626-case sample produces 340 Dokumen, 281 Daya Angkut, 5 combined and 50 successful",()=>{
  const cases=[
    ...Array.from({length:330},(_,i)=>makeCase("d"+i,"DOKUMEN")),
    ...Array.from({length:281},(_,i)=>makeCase("a"+i,"DAYA ANGKUT")),
    ...Array.from({length:5},(_,i)=>makeCase("c"+i,"DAYA ANGKUT, DOKUMEN")),
    ...Array.from({length:10},(_,i)=>historic("old"+i))
  ];
  for(let i=0;i<23;i++)cases[i].no_blanko="BL"+i;
  for(let i=0;i<10;i++)cases[i+100].is_archived=true;
  const b={cases,shipping:[],disputes:[{case_id:"a9",confirmation_date:"2026-09-25"}],
    terminated:Array.from({length:17},(_,i)=>({case_id:"a"+i,terminated_at:"2026-09-25"})),
    courts:[],histories:cases.map(x=>({case_id:x.case_id,event_time:"2026-09-25T10:00:00Z"}))};
  state.month=null;
  const s=reportSnapshot(b);
  assert.equal(s.total,626);
  assert.deepEqual([s.types.dokumen,s.types.dayaAngkut,s.types.dokumenDayaAngkut,s.types.lainnya,s.types.tidakDiketahui],[340,281,5,0,0]);
  assert.equal(s.success,50);
  assert.equal(s.pending,576);
  const summary=reportText(s);
  assert.equal(s.periodOverview.violations,616);
  assert.equal(s.periodOverview.unknownViolationDate,10);
  assert.match(summary,/Jenis Pelanggaran \(tanggal kejadian\)\n• Dokumen: 330\n• Daya Angkut: 281\n• Dokumen Daya Angkut: 5/);
  assert.match(summary,/Berhasil Konfirmasi: 50 dari 626/);
  assert.match(summary,/Success Rate: 7\.99%/);
  assert.ok(summary.indexOf("Jenis Pelanggaran")<summary.indexOf("KONFIRMASI PERKARA TERSEBUT"));
  assert.equal(summary.includes("Lainnya: "),false);
});
test("Report dates use WIB while first-history cohort source remains unchanged",()=>{
  const b={cases:[makeCase("aug","DOKUMEN"),makeCase("sep","DAYA ANGKUT")],shipping:[],disputes:[],terminated:[],courts:[],
    histories:[{case_id:"aug",event_time:"2026-08-31T16:59:00Z"},{case_id:"sep",event_time:"2026-08-31T17:01:00Z"}]};
  state.month="2026-08";
  assert.equal(reportSnapshot(b).types.dokumen,1);
  assert.equal(reportSnapshot(b).total,1);
  state.month="2026-09";
  assert.equal(reportSnapshot(b).types.dayaAngkut,1);
  assert.equal(reportSnapshot(b).total,1);
  state.month=null;
});
test("Unknown future categories and missing types are distinct",()=>{
  const cases=[makeCase("a","NEW CATEGORY"),makeCase("b",null)];
  const b={cases,shipping:[],disputes:[],terminated:[],courts:[],histories:cases.map(x=>({case_id:x.case_id,event_time:"2026-09-20T10:00:00Z"}))};
  state.month=null;
  const s=reportSnapshot(b);
  assert.equal(s.types.lainnya,1);
  assert.equal(s.types.tidakDiketahui,1);
  assert.match(reportText(s),/Lainnya: 1/);
  assert.match(reportText(s),/Jenis belum diketahui: 1/);
});
test("Original report copy/print and app shell caches remain connected",()=>{
  assert.match(source,/navigator\.clipboard\.writeText\(reportText\(s\)\)/);
  assert.match(source,/\$\("printReport"\)\.onclick=\(\)=>window\.print\(\)/);
  assert.match(html,/app-v2\.js\?v=20261015-reportperiod1/);
  assert.match(sw,/app-v2\.js\?v=20261015-reportperiod1/);
  assert.match(sw,/gsmart-shell-v58/);
});

test("An unrelated archived record does not automatically count as Sosialisasi in reports",()=>{
  const row=makeCase("other","DOKUMEN",{is_archived:true,archive_reason:"ARSIP LAIN"});
  const b={cases:[row],shipping:[],disputes:[],terminated:[],courts:[],histories:[{case_id:"other",event_time:"2026-09-20T10:00:00Z"}]};
  state.month=null;
  assert.equal(reportSnapshot(b).success,0);
});

test("History pagination uses a stable tie-breaker across 1000-row page boundaries",()=>{
  assert.match(source,/dashboardQ\("gsmart_case_history",\{order:"event_time\.desc\.nullslast,history_id\.desc"\}\)/);
});


test("September violations processed in October remain September events but October workloads",()=>{
  const cases=[
    makeCase("s1","DOKUMEN",{tanggal_pelanggaran:"2026-09-30T14:00:00Z",first_seen_at:"2026-10-03T12:00:00Z"}),
    makeCase("o1","DAYA ANGKUT",{tanggal_pelanggaran:"2026-10-04T06:00:00Z",first_seen_at:"2026-10-05T10:00:00Z"}),
    makeCase("s2","DOKUMEN",{tanggal_pelanggaran:"2026-09-18T06:00:00Z",first_seen_at:"2026-09-20T06:00:00Z",no_blanko:"BL-01",tanggal_blanko:"2026-10-06"})
  ];
  const b={
    cases,
    shipping:[
      {case_id:"s1",printed_date:"2026-10-05"},{case_id:"o1",printed_date:"2026-10-06"},
      {case_id:"s2",printed_date:"2026-09-25"}
    ],
    disputes:[{case_id:"s1",confirmation_date:"2026-10-08"}],
    terminated:[],courts:[{case_id:"s2",tanggal_sidang:"2026-11-02"}],
    histories:[
      {case_id:"s1",event_time:"2026-10-03T12:00:00Z"},
      {case_id:"o1",event_time:"2026-10-05T10:00:00Z"},
      {case_id:"s2",event_time:"2026-09-20T06:00:00Z"}
    ]
  };
  state.month="2026-10";
  const s=reportSnapshot(b),p=s.periodOverview;
  assert.equal(p.violations,1,"Only the October incident counts as an October violation");
  assert.equal(p.types.dayaAngkut,1);
  assert.equal(p.types.dokumen,0);
  assert.equal(p.process.shipping,2,"October letters include September incidents");
  assert.equal(p.process.blanko,1,"October blanko for September cohort must be counted as workload");
  assert.equal(p.process.disputes,1);
  assert.equal(p.process.court,0);
  assert.equal(s.total,2,"Cohort remains based on first history, not incident date");
  assert.equal(s.success,0,"The October cohort is not confirmed by September cohort's blanko");
  assert.deepEqual(Array.from(p.shippingOrigins,x=>[x.month,x.count]),[["2026-09",1],["2026-10",1]]);
  const text=reportText(s);
  assert.match(text,/Pelanggaran Terjadi: 1/);
  assert.match(text,/Pengiriman Surat Dicetak: 2/);
  assert.match(text,/2026-09: 1/);
  assert.match(text,/2026-10: 1/);
  assert.match(text,/Perkara Mulai Tercatat: 2/);
  state.month="2026-09";
  assert.equal(reportSnapshot(b).periodOverview.violations,2);
  assert.equal(reportSnapshot(b).periodOverview.process.shipping,1);
  assert.equal(reportSnapshot(b).total,1);
  state.month=null;
});
test("UTC crossing midnight is grouped into the Jakarta-local violation month",()=>{
  const c=makeCase("cross","DAYA ANGKUT",{tanggal_pelanggaran:"2026-09-30T18:45:00Z"});
  const b={cases:[c],shipping:[{case_id:"cross",printed_date:"2026-10-01"}],disputes:[],
    terminated:[],courts:[],histories:[{case_id:"cross",event_time:"2026-09-30T18:45:00Z"}]};
  state.month="2026-09";
  assert.equal(reportSnapshot(b).periodOverview.violations,0);
  state.month="2026-10";
  assert.equal(reportSnapshot(b).periodOverview.violations,1);
  assert.equal(reportSnapshot(b).periodOverview.process.shipping,1);
  state.month=null;
});
