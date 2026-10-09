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

test("three simulation messages are clearly marked and have stable unique IDs",async()=>{
 const {simulationEvents}=await import("./push-pilot.mjs");
 const items=simulationEvents();
 assert.equal(items.length,3);
 assert.equal(new Set(items.map(x=>x.event_key)).size,3);
 assert.deepEqual(items.map(x=>x.event_type),["blanko","dispute","shipping_processing"]);
 for(const e of items){assert.match(e.title,/SIMULASI/);assert.match(e.body,/SIMULASI/);assert.equal(e.case_id,"");}
});
test("simulation sends three to mock receiver once and rerun sends zero",async()=>{
 const {executeSimulation}=await import("./push-pilot.mjs");
 const state=new Map();const notifications=[];
 const store={
  simEnsure:async a=>{for(const e of a)if(!state.has(e.event_key))state.set(e.event_key,"pending")},
  simPending:async()=>[...state].filter(([,status])=>status==="pending").map(([event_key])=>({event_key})),
  simClaim:async k=>{if(state.get(k)!=="pending")return false;state.set(k,"sending");return true},
  simComplete:async(k,s)=>state.set(k,s)
 };
 const first=await executeSimulation(store,async event=>notifications.push(event.event_type));
 const second=await executeSimulation(store,async event=>notifications.push(event.event_type));
 assert.deepEqual(notifications,["blanko","dispute","shipping_processing"]);
 assert.equal(first.sent,3);assert.equal(second.sent,0);
 assert.equal(first.etleDataRead,false);assert.equal(first.etleDataModified,false);
 assert.deepEqual([...state.values()],["sent","sent","sent"]);
});
test("failed simulation message is never retried automatically",async()=>{
 const {executeSimulation}=await import("./push-pilot.mjs");
 const rows=new Map();let attempts=0;
 const store={
  simEnsure:async a=>{for(const e of a)if(!rows.has(e.event_key))rows.set(e.event_key,"pending")},
  simPending:async()=>[...rows].filter(([,s])=>s==="pending").map(([event_key])=>({event_key})),
  simClaim:async k=>{if(rows.get(k)!=="pending")return false;rows.set(k,"sending");return true},
  simComplete:async(k,s)=>rows.set(k,s)
 };
 const one=await executeSimulation(store,async()=>{attempts++;throw Error("simulate network error")});
 const two=await executeSimulation(store,async()=>{attempts++});
 assert.equal(one.failed,3);assert.equal(two.sent,0);assert.equal(attempts,3);
});
