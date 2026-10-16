import test from "node:test";
import assert from "node:assert/strict";
import {detectGitaMaintenanceIntent} from "../gita-maintenance-intent.mjs";

test("recognizes explicit technical audits",()=>{
  for(const input of ["GITA, audit seluruh aplikasi","GITA, cek bug aplikasi","cari error notifikasi","/dev audit login"]){
    const result=detectGitaMaintenanceIntent(input);
    assert.equal(result?.action,"audit",input);
    assert.equal(result?.requiresConfirmation,true);
  }
});
test("recognizes explicit technical fixes",()=>{
  for(const input of ["GITA, perbaiki bug filter Blanko","perbaiki tampilan PWA di HP","GITA, debug aplikasi","/dev perbaiki notifikasi"]){
    const result=detectGitaMaintenanceIntent(input);
    assert.equal(result?.action,"fix",input);
    assert.equal(result?.requiresConfirmation,true);
  }
});
test("does not route ordinary ETLE questions or data edits",()=>{
  for(const input of ["GITA, berapa jumlah pengiriman surat?","cari kendaraan AG 1234 XX","GITA, perbaiki data nomor plat kendaraan ini","tolong buat laporan ETLE","","a".repeat(401)]){
    assert.equal(detectGitaMaintenanceIntent(input),null,input);
  }
});
