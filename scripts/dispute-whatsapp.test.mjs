import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const src=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");

function disputeWhatsAppModule({admin=true,source="DISPUTE"}={}){
  const start=src.indexOf("function isDisputeAccepted(dispute){");
  const end=src.indexOf("function openWhatsApp(d){",start);
  assert.ok(start>=0&&end>start,"Dispute WhatsApp helpers exist");
  const calls=[],notices=[];
  const phoneStart=src.indexOf("function normalizePhone(v){");
  const phoneEnd=src.indexOf("\n",phoneStart);
  assert.ok(phoneStart>=0&&phoneEnd>phoneStart,"Phone normalizer exists");
  const helpers=runInNewContext(
    src.slice(start,end)+"\n"+src.slice(phoneStart,phoneEnd)+"\\n({isDisputeAccepted,openDisputeWhatsApp,normalizePhone})",
    {
      perms:()=>({admin}),
      state:{detailSource:source},
      fmtDate:()=> "16 November 2026",
      toast:message=>notices.push(message),
      window:{open:(...args)=>calls.push(args)}
    }
  );
  return {...helpers,calls,notices};
}

test("Phone numbers normalize to Indonesian international format 62",()=>{
  const {normalizePhone}=disputeWhatsAppModule();
  for(const [input,expected] of [
    ["081234567890","6281234567890"],
    ["81234567890","6281234567890"],
    ["6281234567890","6281234567890"],
    ["+62 812-3456-7890","6281234567890"],
    ["0062 812 3456 7890","6281234567890"],
    ["62081234567890","6281234567890"]
  ]) assert.equal(normalizePhone(input),expected,input);
  for(const input of ["","021234","12345","628","abc"]) assert.equal(normalizePhone(input),null,input);
});

test("Accepted status classifier remains available for other workflows",()=>{
  const {isDisputeAccepted}=disputeWhatsAppModule();
  assert.equal(isDisputeAccepted({status:"TERSANGGAH"}),false);
  assert.equal(isDisputeAccepted({result:"SANGGAHAN DITERIMA"}),true);
  assert.equal(isDisputeAccepted({result:"DITERIMA"}),true);
  assert.equal(isDisputeAccepted({result:"DITOLAK"}),false);
});

test("Accepted WhatsApp message can be opened regardless of dispute status",()=>{
  const {openDisputeWhatsApp,calls,notices}=disputeWhatsAppModule();
  openDisputeWhatsApp({
    case:{tnkb:"S 1234 AB"},
    offender:{no_telp:"081234567890"},
    dispute:{status:"TERSANGGAH",result:""}
  },"accepted");
  assert.equal(calls.length,1);
  assert.match(decodeURIComponent(calls[0][0].split("?text=")[1]),/DINYATAKAN DITERIMA/);
});

test("Both templates work even when dispute metadata is absent",()=>{
  const accepted=disputeWhatsAppModule();
  accepted.openDisputeWhatsApp({case:{tnkb:"S 1234 AB"},offender:{no_telp:"081234567890"}},"accepted");
  assert.equal(accepted.calls.length,1);
  const followup=disputeWhatsAppModule();
  followup.openDisputeWhatsApp({case:{tnkb:"S 1234 AB"},offender:{no_telp:"081234567890"}},"followup");
  assert.equal(followup.calls.length,1);
});

test("Follow-up template opens WhatsApp with case data and editable text",()=>{
  const {openDisputeWhatsApp,calls}=disputeWhatsAppModule();
  openDisputeWhatsApp({
    case:{tnkb:"S 1234 AB",jenis_pelanggaran:"DAYA ANGKUT",tanggal_pelanggaran:"2026-11-01"},
    offender:{no_telp:"081234567890"},
    dispute:{status:"TERSANGGAH"}
  },"followup");
  assert.equal(calls.length,1);
  assert.match(calls[0][0],/^https:\/\/wa\.me\/6281234567890\?text=/);
  const message=decodeURIComponent(calls[0][0].split("?text=")[1]);
  assert.match(message,/Nomor Polisi: S 1234 AB/);
  assert.match(message,/Jenis Pelanggaran: DAYA ANGKUT/);
  assert.match(message,/16 November 2026/);
  assert.match(message,/konfirmasi ulang/i);
  assert.match(message,/dokumen pendukung/i);
  assert.equal(calls[0][1],"_blank");
  assert.equal(calls[0][2],"noopener,noreferrer");
});

test("Dispute WhatsApp action is restricted to Admin and the dispute detail view",()=>{
  const deniedRole=disputeWhatsAppModule({admin:false});
  deniedRole.openDisputeWhatsApp({dispute:{result:"DITERIMA"}},"accepted");
  assert.equal(deniedRole.calls.length,0);
  const wrongPage=disputeWhatsAppModule({source:"BLANKO"});
  wrongPage.openDisputeWhatsApp({dispute:{result:"DITERIMA"}},"accepted");
  assert.equal(wrongPage.calls.length,0);
});
