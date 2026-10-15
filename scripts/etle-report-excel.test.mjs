import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildEtleExcel } from "../gsmart-report-excel.mjs";

const decoder=new TextDecoder();
function entries(blob){
  const bytes=blob instanceof Uint8Array?blob:new Uint8Array(blob);
  const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files=new Map();
  let p=0;
  while(p+4<=bytes.byteLength&&data.getUint32(p,true)===0x04034b50){
    assert.equal(data.getUint16(p+8,true),0,"XLSX file uses a stored ZIP entry");
    const size=data.getUint32(p+18,true),nameSize=data.getUint16(p+26,true),extra=data.getUint16(p+28,true);
    const name=decoder.decode(bytes.slice(p+30,p+30+nameSize));
    const bodyStart=p+30+nameSize+extra;
    assert.ok(bodyStart+size<=bytes.byteLength,"ZIP entry stays in bounds");
    files.set(name,decoder.decode(bytes.slice(bodyStart,bodyStart+size)));
    p=bodyStart+size;
  }
  assert.equal(data.getUint32(p,true),0x02014b50,"ZIP central directory follows entries");
  assert.equal(data.getUint32(bytes.byteLength-22,true),0x06054b50,"ZIP ends with EOCD");
  return files;
}
const original={
  cases:[
    {case_id:"a",tnkb:"AG 0001 XD",no_registrasi:"REF 001",jenis_pelanggaran:"DOKUMEN",tanggal_pelanggaran:"2026-09-19T12:00:00Z",first_seen_at:"2026-09-20T10:00:00Z",status_etle:"BLANKO_TERBIT",no_blanko:"AJ 1001",tanggal_blanko:"2026-10-02",status_bayar:"PAID"},
    {case_id:"b",tnkb:"AG 0002 XD",no_registrasi:"REF 002",jenis_pelanggaran:"DAYA ANGKUT, DOKUMEN",tanggal_pelanggaran:"2026-09-20T10:00:00Z",first_seen_at:"2026-09-22T10:00:00Z",status_etle:"DIHENTIKAN"},
    {case_id:"c",tnkb:"AG 0003 XD",no_registrasi:"REF 003",jenis_pelanggaran:"DAYA ANGKUT",tanggal_pelanggaran:"2026-10-01T01:00:00Z",first_seen_at:"2026-10-01T02:00:00Z",status_etle:"SURAT_DICETAK"},
  ],
  shipping:[
    {case_id:"a",printed_date:"2026-09-26",tracking_number:"ABC 1",status:"Terkirim"},
    {case_id:"b",printed_date:"2026-10-04",tracking_number:"ABC 2",status:"Tercetak"},
  ],
  disputes:[
    {case_id:"a",confirmation_date:"2026-09-29T09:00:00Z",reason:"Pernah sanggah"},
    {case_id:"b",confirmation_date:"2026-10-01T11:00:00Z",reason:"=HYPERLINK(\"https://invalid.test\")"},
  ],
  terminated:[{case_id:"b",terminated_at:"2026-10-03",reason:"KIR masih berlaku"}],
  courts:[{case_id:"a",tanggal_sidang:"2026-11-02",status_sidang:"SCHEDULED",pengadilan:"PN Nganjuk"}],
  histories:[]
};
function classify(c){const s=String(c?.jenis_pelanggaran||"");return s.includes("DOKUMEN")&&s.includes("DAYA ANGKUT")?"DOKUMEN DAYA ANGKUT":s||null}
const summary={ids:["a","b","c"],total:3,shipping:2,blanko:1,disputes:2,socialization:0,terminated:1,court:1,success:2,pending:1,
 types:{dokumen:1,dayaAngkut:1,dokumenDayaAngkut:1,lainnya:0,tidakDiketahui:0}};
const args={bundle:original,summary,month:null,periodLabel:"Semua Data",updatedAt:"2026-10-14T07:00:00Z",classify,includePayment:true,shippingRows:original.shipping};

test("Excel workbook has all seven approved sheets and required OOXML parts",()=>{
  const bytes=buildEtleExcel(args),files=entries(bytes);
  assert.equal(bytes[0],0x50); assert.equal(bytes[1],0x4b);
  assert.ok(bytes.length>5000);
  assert.ok(files.has("[Content_Types].xml"));
  assert.ok(files.has("xl/_rels/workbook.xml.rels"));
  assert.ok(files.has("xl/styles.xml"));
  assert.equal([...files.keys()].filter(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x)).length,7);
  const workbook=files.get("xl/workbook.xml");
  for(const name of ["Ringkasan ETLE","Daftar Perkara","Pengiriman Surat","Blanko Tilang","Tersanggah","Dihentikan","Persidangan"])
    assert.ok(workbook.includes('sheet name="'+name+'"'));
});
test("Summary reuses existing G-Smart snapshot with formulas and no new status logic",()=>{
  const ws=entries(buildEtleExcel(args)).get("xl/worksheets/sheet1.xml");
  for(const phrase of ["PERKARA MULAI TERCATAT","BERHASIL KONFIRMASI","BELUM KONFIRMASI","SUCCESS RATE","JENIS PELANGGARAN","Dokumen Daya Angkut","Tersanggah (Riwayat Pengajuan)"])assert.ok(ws.includes(phrase));
  assert.match(ws,/<f>SUM\(D22:D26\)<\/f>/);
  assert.match(ws,/<f>IFERROR\(D31\/A8,0\)<\/f>/);
  assert.ok(ws.includes('<c r="A8" s="13"><v>3</v></c>'));
  assert.ok(ws.includes('<c r="C8" s="13"><v>2</v></c>'));
});
test("Month selection restricts each process sheet by its own event date",()=>{
  const sept=entries(buildEtleExcel({...args,month:"2026-09",periodLabel:"September 2026"}));
  const oct=entries(buildEtleExcel({...args,month:"2026-10",periodLabel:"Oktober 2026"}));
  const s=(e,i)=>e.get("xl/worksheets/sheet"+i+".xml");
  assert.ok(s(sept,3).includes("ABC 1"));assert.ok(!s(sept,3).includes("ABC 2"));
  assert.ok(!s(sept,4).includes("AJ 1001"));assert.ok(s(oct,4).includes("AJ 1001"));
  assert.ok(s(sept,5).includes("Pernah sanggah"));assert.ok(!s(sept,5).includes("KIR masih"));
  assert.ok(s(oct,6).includes("KIR masih berlaku"));assert.ok(!s(sept,6).includes("KIR masih berlaku"));
  assert.ok(!s(oct,7).includes("PN Nganjuk"));
  const nov=entries(buildEtleExcel({...args,month:"2026-11",periodLabel:"November 2026"}));
  assert.ok(s(nov,7).includes("PN Nganjuk"));
  assert.ok(s(oct,2).includes("REF 001"),"Daftar Perkara follows summary.ids, not the processing date");
  assert.ok(s(oct,1).includes("Oktober 2026"));
});
test("Tersanggah remains a history record after Blanko or Dihentikan",()=>{
  const s=entries(buildEtleExcel(args)).get("xl/worksheets/sheet5.xml");
  assert.ok(s.includes("Pernah sanggah"));
  assert.ok(s.includes("Blanko Terbit"));
  assert.ok(s.includes("Dihentikan"));
});
test("Payment details are restricted by caller role without hiding other blanko columns",()=>{
  const s=entries(buildEtleExcel({...args,includePayment:false})).get("xl/worksheets/sheet4.xml");
  assert.ok(s.includes("Akses dibatasi"));
  assert.ok(!s.includes("PAID"));
  assert.ok(s.includes("AJ 1001"));
});
test("User-supplied formula-like text remains literal and XML-safe",()=>{
  const s=entries(buildEtleExcel(args)).get("xl/worksheets/sheet5.xml");
  assert.ok(s.includes('=HYPERLINK(&quot;https://invalid.test&quot;)'));
  assert.ok(!s.includes("<f>HYPERLINK"));
  assert.ok(s.includes("Akses")===false);
});
test("Date cells are Excel numbers, worksheets contain filters, frozen headings and A4 print",()=>{
  const s=entries(buildEtleExcel(args)).get("xl/worksheets/sheet3.xml");
  assert.match(s,/<c r="B7" s="10"><v>\d+<\/v><\/c>/);
  assert.ok(s.includes('<autoFilter ref="A6:I8"/>'));
  assert.ok(s.includes('ySplit="6"'));
  assert.ok(s.includes('paperSize="9"'));
});
test("Zero-row month creates a valid worksheet and keeps the report headings",()=>{
  const s=entries(buildEtleExcel({...args,month:"2027-01",periodLabel:"Januari 2027"})).get("xl/worksheets/sheet6.xml");
  assert.ok(s.includes("Tidak ada data untuk periode ini."));
  assert.ok(s.includes("Tanggal Dihentikan"));
  assert.ok(s.includes('autoFilter ref="A6:G6"'));
});
test("Export uses browser-only data already loaded; it has no network dependencies",()=>{
  const source=readFileSync(new URL("../gsmart-report-excel.mjs",import.meta.url),"utf8");
  const app=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
  const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
  const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
  assert.ok(!/\bfetch\(|supabase\.co|https:\/\/cdnjs/.test(source));
  assert.ok(app.includes('id="exportExcel"'));
  assert.ok(app.includes("shippingRows:activeShippingRows(b)"));
  assert.ok(app.includes("includePayment:perms().copyPhone"));
  assert.ok(app.includes('import("./gsmart-report-excel.mjs?v=20261015-reportperiod1")'));
  assert.ok(html.includes("app-v2.js?v=20261015-etlehub-link1"));
  assert.ok(sw.includes("gsmart-shell-v59"));
  assert.ok(sw.includes("gsmart-report-excel.mjs?v=20261015-reportperiod1"));
});
