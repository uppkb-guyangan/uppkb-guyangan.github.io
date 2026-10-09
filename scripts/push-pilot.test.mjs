import test from "node:test";
import assert from "node:assert/strict";
import {snapshot,changes,norm,isProcessing,assertMode} from "./push-pilot.mjs";
const uuid=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
test("existing events at baseline send nothing",()=>{
 const s=snapshot({cases:[{case_id:uuid(1),no_blanko:"A"}],shipping:[{case_id:uuid(2),status:"Dalam Proses Pengiriman"}]});
 assert.deepEqual(changes(s,s),[]);
});
test("new blanko and dispute are single events",()=>{
 const a=snapshot({});
 const b=snapshot({cases:[{case_id:uuid(1),no_blanko:"B"},{case_id:uuid(1),no_blanko:"B"}],disputes:[{case_id:uuid(2),status:"TERSANGGAH"}]});
 assert.deepEqual(changes(a,b).map(x=>x.event_type).sort(),["blanko","dispute"]);
});
test("exclude terminated dispute",()=>{
 const s=snapshot({disputes:[{case_id:uuid(1),status:"TERSANGGAH"}],terminated:[{case_id:uuid(1)}]});
 assert.equal(s.disputes.length,0);
});
test("ship status transitions only when old row exists",()=>{
 const a=snapshot({shipping:[{case_id:uuid(1),status:"Tercetak"},{case_id:uuid(2),status:"Dalam Proses Pengiriman"}]});
 const b=snapshot({shipping:[{case_id:uuid(1),status:"Dalam Proses Pengiriman"},{case_id:uuid(2),status:"Dalam Proses Pengiriman"},{case_id:uuid(3),status:"Dalam Proses Pengiriman"}]});
 assert.deepEqual(changes(a,b).map(x=>x.case_id),[uuid(1)]);
});
test("no notifications for failed shipping",()=>{
 const a=snapshot({shipping:[{case_id:uuid(1),status:"Tercetak"}]});
 const b=snapshot({shipping:[{case_id:uuid(1),status:"Gagal Kirim"}]});
 assert.equal(changes(a,b).length,0);
});
test("normalize status case and spacing",()=>{
 assert.equal(norm(" dalam  proses pengiriman "),"DALAM PROSES PENGIRIMAN");
 assert.equal(isProcessing("Dalam Proses Pengiriman"),true);
});
test("disallow other modes",()=>{assert.throws(()=>assertMode("broadcast"));assert.equal(assertMode("inspect"),"inspect");assert.equal(assertMode("ping"),"ping")});
