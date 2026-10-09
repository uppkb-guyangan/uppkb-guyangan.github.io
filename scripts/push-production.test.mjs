import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {withPlate} from "./push-production.mjs";

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
  assert.strictEqual(withPlate({...event,case_id:CASE_ID},""),withPlate({...event,case_id:CASE_ID},null));
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
