import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const src=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
const start=src.indexOf("function ownerIdentityKey(value){");
const end=src.indexOf("function analytics(b){",start);
assert.ok(start>=0&&end>start,"Owner helpers must be defined before Analitik");
const {ownerIdentityKey,analyticsOwnerGroups}=runInNewContext(
  src.slice(start,end)+"\n({ownerIdentityKey,analyticsOwnerGroups})"
);
const sample=[];
for(const [label,n] of [
  ["PT SEINO INDOMOBIL L",18],["PT. SEINO INDOMOBIL L",4],
  ["PT. PUTRA ABADI SUKSES MANDIRI",3],["PT.PUTRA ABADI SUKSES MANDIRI",2],
  ["PT. PLATINUM CEMERLANG INDONESIA",4],["PT PLATINUM CEMERLANG INDONESIA",2],
  ["PT HIBA LOGISTIK",10],["PT GRAHAPRIMA SUKSESMANDI",8],
  ["PT. SUPERIOR PRIMA SUKSES",11],
]){
  for(let i=0;i<n;i++)sample.push({case_id:label+":"+i,nama_pemilik:label,tanggal_pelanggaran:"2026-09-12"});
}
test("Canonical owner identity ignores punctuation, spacing and case but not actual letters",()=>{
  assert.equal(ownerIdentityKey("PT SEINO INDOMOBIL L"),ownerIdentityKey("pt.  seino indomobil l"));
  assert.equal(ownerIdentityKey("PT. PUTRA ABADI SUKSES MANDIRI"),ownerIdentityKey("PT.PUTRA ABADI SUKSES MANDIRI"));
  assert.equal(ownerIdentityKey("PT SENTRALSARI PRIMA SENTOSA"),ownerIdentityKey("PT SENTRALSARI PRIMASENTOSA"));
  assert.equal(ownerIdentityKey("PT. Grand Pasific Pratama,"),ownerIdentityKey("PT GRAND PASIFIC PRATAMA"));
  assert.notEqual(ownerIdentityKey("PT SEINO INDOMOBIL L"),ownerIdentityKey("PT SEINO INDOMOBIL LOGISTIK"));
  assert.notEqual(ownerIdentityKey("PT HIBA LOGISTIK"),ownerIdentityKey("PT HIBA LOGISTIKA"));
  assert.equal(ownerIdentityKey(" . / "), "");
});
test("All identical company keys combine, including Seino 18+4, Putra 3+2 and Platinum 4+2",()=>{
  const groups=analyticsOwnerGroups(sample);
  const seino=groups.find(g=>g.key===ownerIdentityKey("PT. SEINO INDOMOBIL L"));
  const putra=groups.find(g=>g.key===ownerIdentityKey("PT.PUTRA ABADI SUKSES MANDIRI"));
  const platinum=groups.find(g=>g.key===ownerIdentityKey("PT PLATINUM CEMERLANG INDONESIA"));
  assert.equal(seino.n,22);
  assert.equal(putra.n,5);
  assert.equal(platinum.n,6);
  assert.equal(seino.label,"PT SEINO INDOMOBIL L");
  assert.equal(putra.label,"PT. PUTRA ABADI SUKSES MANDIRI");
  assert.equal(groups[0].n,22);
  assert.equal(groups.length,6);
});
test("Owner detail uses same identity as ranking and still respects selected month",()=>{
  assert.match(src,/const ownerRows=analyticsOwnerGroups\(cases\)\.slice\(0,10\)/);
  assert.match(src,/period\(x\.tanggal_pelanggaran\)&&ownerIdentityKey\(x\.nama_pemilik\)===ownerKey/);
  assert.match(src,/const owner=analyticsOwnerGroups\(rows\)\[0\]\?\.label/);
  const key=ownerIdentityKey("PT.PUTRA ABADI SUKSES MANDIRI");
  const inSeptember=sample.filter(x=>x.tanggal_pelanggaran.startsWith("2026-09")&&ownerIdentityKey(x.nama_pemilik)===key);
  assert.equal(inSeptember.length,5);
  const inOctober=sample.filter(x=>x.tanggal_pelanggaran.startsWith("2026-10")&&ownerIdentityKey(x.nama_pemilik)===key);
  assert.equal(inOctober.length,0);
});
test("Raw owners are kept and unfamiliar company spellings are never guessed",()=>{
  const rows=[
    {nama_pemilik:"PT.TEST LOGISTIK",case_id:"1"},
    {nama_pemilik:"PT TEST LOGISTIK",case_id:"2"},
    {nama_pemilik:"PT TEST LOGISTIK INDONESIA",case_id:"3"},
    {nama_pemilik:"  ",case_id:"4"}
  ];
  const grouped=analyticsOwnerGroups(rows);
  assert.equal(grouped.length,2);
  assert.equal(grouped.find(g=>g.key==="PTTESTLOGISTIK").n,2);
  assert.equal(rows[0].nama_pemilik,"PT.TEST LOGISTIK");
  assert.equal(rows[1].nama_pemilik,"PT TEST LOGISTIK");
});
test("Web PWA cache bumped for this change with no unrelated UI version changes",()=>{
  assert.match(html,/app-v2\.js\?v=20261015-etlehub-roles1/);
  assert.match(sw,/app-v2\.js\?v=20261015-etlehub-roles1/);
  assert.match(sw,/gsmart-shell-v62/);
  assert.match(src,/const cases=b\.cases\.filter\(x=>period\(x\.tanggal_pelanggaran\)\)/);
});
