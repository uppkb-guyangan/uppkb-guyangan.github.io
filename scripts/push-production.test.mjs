import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {withPlate} from "./push-production.mjs";
import {shippingLifecycleEvents,normalizeShippingStatus,SHIPPING_EVENT_TYPES} from "./shipping-lifecycle.mjs";

const HOME="https://uppkb-guyangan.github.io/";
const CASE_ID="00000000-0000-4000-8000-000000000123";

test("each real ETLE event displays its own TNKB and keeps the case identity",()=>{
  for(const [event_type,description] of [
    ["blanko","Blanko tilang baru telah terpantau."],
    ["dispute","Sanggahan baru telah terpantau."],
    ["shipping_processing","Surat telah masuk proses pengiriman JNE."]
  ]){
    const original={event_key:event_type+":"+CASE_ID,event_type,case_id:CASE_ID,title:"G-Smart · Status ETLE",body:description};
    const modified=withPlate(original," ae 8768 sk ");
    assert.equal(modified.body,"TNKB: AE 8768 SK · "+description);
    assert.equal(modified.case_id,CASE_ID);
    assert.equal(modified.event_key,original.event_key);
    assert.equal(modified.title,original.title);
    assert.equal(original.body,description,"source event remains unchanged");
  }
});
test("events without a valid plate or case stay unchanged",()=>{
  const event={event_key:"ping",case_id:"",body:"Uji notifikasi"};
  assert.strictEqual(withPlate(event,"AE8768SK"),event);
  const withCase={...event,case_id:CASE_ID};
  assert.strictEqual(withPlate(withCase,""),withCase);
  assert.strictEqual(withPlate(withCase,null),withCase);
});
test("adding TNKB twice does not duplicate it",()=>{
  const event={case_id:CASE_ID,body:"Surat diproses"};
  const first=withPlate(event,"AE8768SK");
  assert.strictEqual(withPlate(first,"AE8768SK"),first);
});

function pushWorker({windowClient=true,existingClient=null}={}){
  const handlers=new Map();
  const opened=[];
  const navigated=[];
  const focused=[];
  const client={focus:async()=>{focused.push("opened");}};
  const runtime={
    URL,
    console:{warn(){}},
    importScripts(){throw Error("Skip Firebase SDK during isolated click tests");},
    self:{
      addEventListener(name,fn){handlers.set(name,fn);},
      clients:{
        openWindow:async target=>{opened.push(target);return windowClient?client:null;},
        matchAll:async()=>existingClient?[{
          url:HOME,
          navigate:async target=>{navigated.push(target);return {focus:async()=>focused.push("existing")};},
          focus:async()=>focused.push("existing")
        }]:[]
      },
      registration:{showNotification:async()=>{}}
    }
  };
  const src=readFileSync(new URL("../gsmart-push-sw/firebase-messaging-sw.js",import.meta.url),"utf8");
  runInNewContext(src,runtime,{filename:"firebase-messaging-sw.js"});
  async function click(data){
    let completion;
    const notification={data,close(){}};
    handlers.get("notificationclick")({
      notification,
      stopImmediatePropagation(){},
      waitUntil(p){completion=p;}
    });
    assert.ok(completion,"notificationclick must register waitUntil");
    await completion;
  }
  return {click,opened,navigated,focused};
}

test("clicking a distinct TNKB event launches the corresponding case deep-link",async()=>{
  const w=pushWorker();
  await w.click({case_id:CASE_ID});
  assert.equal(w.opened[0],HOME+"?case="+CASE_ID);
  assert.deepEqual(w.focused,["opened"]);
});
test("FCM auto-notification wrapping still routes to the correct case",async()=>{
  const w=pushWorker();
  await w.click({FCM_MSG:{data:{case_id:CASE_ID}}});
  assert.equal(w.opened[0],HOME+"?case="+CASE_ID);
});
test("non-case and malformed notifications open the PWA home safely",async()=>{
  const w=pushWorker();
  await w.click({case_id:"../other-path?x=1"});
  assert.equal(w.opened[0],HOME);
});
test("existing PWA is navigated to the case when a new window is unavailable",async()=>{
  const w=pushWorker({windowClient:false,existingClient:true});
  await w.click({case_id:CASE_ID});
  assert.deepEqual(w.navigated,[HOME+"?case="+CASE_ID]);
  assert.deepEqual(w.focused,["existing"]);
});

const CASE_TWO="00000000-0000-4000-8000-000000000456";
const SHIPPING_CASES=[
  ["Tercetak","shipping_printed","Surat ETLE Tercetak"],
  ["Dalam Proses Pengiriman","shipping_processing","Surat Dalam Proses Pengiriman"],
  ["Terkirim","shipping_delivered","Surat Berhasil Terkirim"],
  ["Gagal Kirim","shipping_failed","Pengiriman Surat Gagal"],
  ["Dikembalikan","shipping_returned","Surat Dikembalikan"]
];
test("all five Android JNE statuses generate distinct PWA event types",()=>{
  const expected=[];
  for(const [status,type,title] of SHIPPING_CASES){
    const out=shippingLifecycleEvents({shipping:{[CASE_ID]:"BELUM DIKETAHUI"}},{shipping:{[CASE_ID]:status}});
    assert.equal(out.events.length,1);
    assert.equal(out.events[0].event_type,type);
    assert.equal(out.events[0].title,"G-Smart · "+title);
    assert.equal(out.events[0].case_id,CASE_ID);
    assert.equal(out.events[0].event_key,type+":"+CASE_ID);
    assert.equal(withPlate(out.events[0],"AE 8768 SK").body.startsWith("TNKB: AE 8768 SK · "),true);
    expected.push(type);
  }
  assert.deepEqual([...SHIPPING_EVENT_TYPES].sort(),expected.sort());
});
test("real status transitions send once, retries and unchanged states send none",()=>{
  const previous={shipping:{[CASE_ID]:"TERCETAK"}};
  const current={shipping:{[CASE_ID]:"DALAM PROSES PENGIRIMAN"}};
  const first=shippingLifecycleEvents(previous,current);
  const retry=shippingLifecycleEvents(previous,current);
  assert.deepEqual(first.events,retry.events,"retries must use same ledger key");
  const nextCursor={...current,shippingEventCounts:first.eventCounts};
  assert.equal(shippingLifecycleEvents(nextCursor,current).events.length,0);
  const delivered=shippingLifecycleEvents(nextCursor,{shipping:{[CASE_ID]:"TERKIRIM"}});
  assert.deepEqual(delivered.events.map(x=>x.event_type),["shipping_delivered"]);
  assert.equal(delivered.events[0].event_key,"shipping_delivered:"+CASE_ID);
});
test("repeated real transition back to delivered gets a new versioned key",()=>{
  const first=shippingLifecycleEvents({shipping:{[CASE_ID]:"DALAM PROSES PENGIRIMAN"}},{shipping:{[CASE_ID]:"TERKIRIM"}});
  const failed=shippingLifecycleEvents({shipping:{[CASE_ID]:"TERKIRIM"},shippingEventCounts:first.eventCounts},{shipping:{[CASE_ID]:"GAGAL KIRIM"}});
  const deliveredAgain=shippingLifecycleEvents({shipping:{[CASE_ID]:"GAGAL KIRIM"},shippingEventCounts:failed.eventCounts},{shipping:{[CASE_ID]:"TERKIRIM"}});
  assert.equal(deliveredAgain.events[0].event_key,"shipping_delivered:"+CASE_ID+":v2");
  assert.notEqual(first.events[0].event_key,deliveredAgain.events[0].event_key);
});
test("multiple TNKB cases are independent and do not overwrite each other's status",()=>{
  const previous={shipping:{[CASE_ID]:"TERCETAK",[CASE_TWO]:"DALAM PROSES PENGIRIMAN"}};
  const current={shipping:{[CASE_ID]:"TERKIRIM",[CASE_TWO]:"DIKEMBALIKAN"}};
  const out=shippingLifecycleEvents(previous,current);
  assert.equal(out.events.length,2);
  assert.equal(new Set(out.events.map(x=>x.case_id)).size,2);
  assert.deepEqual(new Set(out.events.map(x=>x.event_type)),new Set(["shipping_delivered","shipping_returned"]));
});
test("only genuinely new shipping rows can notify; unchanged baseline is quiet",()=>{
  const baseline={shipping:{[CASE_ID]:"TERKIRIM"}};
  assert.equal(shippingLifecycleEvents(baseline,baseline).events.length,0);
  assert.equal(shippingLifecycleEvents({shipping:{}},baseline).events[0].event_type,"shipping_delivered");
});
test("unrecognized shipping statuses and missing/unchanged values are ignored",()=>{
  const prev={shipping:{[CASE_ID]:"TERCETAK"}};
  assert.equal(shippingLifecycleEvents(prev,{shipping:{[CASE_ID]:"  "}}).events.length,0);
  assert.equal(shippingLifecycleEvents(prev,{shipping:{[CASE_ID]:"DALAM PENYELIDIKAN"}}).events.length,0);
  assert.equal(shippingLifecycleEvents(prev,{shipping:{[CASE_ID]:"   Tercetak "}}).events.length,0);
  assert.equal(normalizeShippingStatus("SUDAH_DICETAK"),"TERCETAK");
  assert.equal(normalizeShippingStatus("  Gagal   Kirim  "),"GAGAL KIRIM");
});
