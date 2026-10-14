import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
function between(a,b){
  const i=source.indexOf(a),j=source.indexOf(b,i+a.length);
  assert.ok(i!==-1&&j>i,"required function not found: "+a);
  return source.slice(i,j);
}
const sourceCode=[
  "const state={month:null};",
  "const ym=v=>{if(!v)return null;const m=String(v).match(/^(\\d{4})-(\\d{2})/);return m?m[1]+'-'+m[2]:null};",
  "function monthName(v){return v||'Semua Data'}",
  "function activeShippingRows(b){const archived=new Set(b.cases.filter(x=>x.is_archived).map(x=>x.case_id));return b.shipping.filter(x=>!archived.has(x.case_id))}",
  between("function wibDateKey(","function buildSmartActivities("),
  between("function reportViolationCategory(","function reportPage("),
  "({state,reportViolationCategory,reportSnapshot,reportText})"
].join("\n");
const {state,reportViolationCategory,reportSnapshot,reportText}=runInNewContext(sourceCode);

function makeCase(id,type,extra={}){
  return {case_id:id,jenis_pelanggaran:type,status_etle:"SURAT_DICETAK",tanggal_pelanggaran:"2026-09-10T10:00:00+07:00",first_seen_at:"2026-09-10T11:00:00+07:00",...extra};
}
const historic=makeCase("old",null,{status_etle:"DIHENTIKAN",tanggal_pelanggaran:null,first_seen_at:"2026-09-24T23:45:00Z"});
const unknown=makeCase("unknown",null,{status_etle:"DIHENTIKAN",tanggal_pelanggaran:null,first_seen_at:"2026-10-10T11:00:00Z"});
test("Report displays Dokumen Daya Angkut as one group, not double counting",()=>{
  assert.equal(reportViolationCategory(makeCase("a","DAYA ANGKUT, DOKUMEN")),"dokumenDayaAngkut");
  assert.equal(reportViolationCategory(makeCase("b","DOKUMEN")),"dokumen");
  assert.equal(reportViolationCategory(makeCase("c","DAYA ANGKUT")),"dayaAngkut");
  assert.equal(reportViolationCategory(makeCase("d","KOMBINASI")),"dokumenDayaAngkut");
});
test("Only recognized historical stopped cases without a type become Dokumen",()=>{
  assert.equal(reportViolationCategory(historic),"dokumen");
  assert.equal(reportViolationCategory(unknown),"lainnya");
  assert.equal(reportViolationCategory(makeCase("other",null)),"lainnya");
});
test("626 total are allocated 340/281/5 with exactly 10 historical cases",()=>{
  const cases=[
    ...Array.from({length:330},(_,i)=>makeCase("d"+i,"DOKUMEN")),
    ...Array.from({length:281},(_,i)=>makeCase("l"+i,"DAYA ANGKUT")),
    ...Array.from({length:5},(_,i)=>makeCase("c"+i,"DAYA ANGKUT, DOKUMEN")),
    ...Array.from({length:10},(_,i)=>makeCase("o"+i,null,{status_etle:"DIHENTIKAN",tanggal_pelanggaran:null,first_seen_at:"2026-09-24T23:45:00Z"}))
  ];
  const b={cases,histories:cases.map(x=>({case_id:x.case_id,event_time:"2026-09-25T10:00:00Z"})),shipping:[],disputes:[],terminated:[],courts:[]};
  state.month=null;
  const s=reportSnapshot(b);
  assert.equal(s.total,626);
  assert.equal(s.typeCounts.dokumen,340);
  assert.equal(s.typeCounts.dayaAngkut,281);
  assert.equal(s.typeCounts.dokumenDayaAngkut,5);
  assert.equal(s.typeCounts.lainnya,0);
  const output=reportText(s);
  assert.ok(output.includes("Jenis Pelanggaran\n• Dokumen: 340\n• Daya Angkut: 281\n• Dokumen Daya Angkut: 5"));
  assert.ok(!output.includes("• Lainnya: "));
  assert.ok(output.indexOf("Jenis Pelanggaran")<output.indexOf("Success Rate Konfirmasi"));
});
test("Report type breakdown respects the report's existing month cohort",()=>{
  const b={cases:[makeCase("aug","DOKUMEN"),makeCase("sep","DAYA ANGKUT")],
    histories:[{case_id:"aug",event_time:"2026-08-25T10:00:00Z"},{case_id:"sep",event_time:"2026-09-02T10:00:00Z"}],
    shipping:[],disputes:[],terminated:[],courts:[]};
  state.month="2026-09";
  const s=reportSnapshot(b);
  assert.equal(s.total,1);
  assert.equal(s.typeCounts.dokumen,0);
  assert.equal(s.typeCounts.dayaAngkut,1);
  state.month=null;
});
test("Unrecognized types show Lainnya, and the original confirmation calculation remains unchanged",()=>{
  const b={cases:[makeCase("a","OTHER"),makeCase("b","DOKUMEN",{no_blanko:"B1"})],
    histories:[{case_id:"a",event_time:"2026-09-02T10:00:00Z"},{case_id:"b",event_time:"2026-09-02T10:00:00Z"}],
    shipping:[],disputes:[{case_id:"a"}],terminated:[],courts:[]};
  state.month=null;
  const s=reportSnapshot(b);
  assert.equal(s.total,2);
  assert.equal(s.success,2); // Existing production formula, intentionally left unchanged.
  assert.equal(s.pending,0);
  assert.ok(reportText(s).includes("• Lainnya: 1"));
});
