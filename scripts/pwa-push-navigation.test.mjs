import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const HOME="https://uppkb-guyangan.github.io/";
const ID="00000000-0000-4000-8000-000000000123";
const OTHER="00000000-0000-4000-8000-000000000456";

function rootPush({standalone=false,chromeTab=false,openReturnsClient=true}={}){
 const handlers=new Map(),opened=[],navigated=[],focused=[],messages=[];
 class MessageChannel {
  constructor(){
   this.port1={onmessage:null};
   const p1=this.port1;
   this.port2={respond(value){p1.onmessage?.({data:value})}};
  }
 }
 function client(label,isStandalone){
  return {
   url:HOME,
   postMessage(message,ports){
     if(message.type==="GSMART_IDENTIFY_WINDOW")ports[0].respond({standalone:isStandalone});
     else messages.push({label,...message});
   },
   async navigate(target){navigated.push({label,target});return this},
   async focus(){focused.push(label)}
  };
 }
 const app=client("pwa",true);
 const browser=client("chrome",false);
 const windows=[...(chromeTab?[browser]:[]),...(standalone?[app]:[])];
 const openClient=client("opened",true);
 const scope={
  self:{
   location:{origin:"https://uppkb-guyangan.github.io"},
   addEventListener(type,callback){handlers.set(type,callback)},
   skipWaiting(){},
   clients:{
    matchAll:async()=>windows,
    openWindow:async target=>{
     opened.push(target);
     return openReturnsClient?openClient:null
    }
   },
   registration:{showNotification:async()=>{}}
  },
  URL,MessageChannel,setTimeout,clearTimeout,
  caches:{},fetch:async()=>{},
  console:{warn(){}},
  importScripts(){throw Error("SDK intentionally excluded in isolated tests")}
 };
 const worker=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
 runInNewContext(worker,scope,{filename:"sw.js"});
 async function click(data){
   let pending;
   handlers.get("notificationclick")({
    notification:{data,close(){}},
    stopImmediatePropagation(){},
    waitUntil(value){pending=value}
   });
   assert.ok(pending,"click processing must remain alive");
   await pending;
 }
 return {click,opened,navigated,focused,messages};
}

test("root worker opens the case inside PWA when no app is running",async()=>{
 const env=rootPush();
 await env.click({case_id:ID});
 assert.deepEqual(env.opened,[HOME+"?case="+ID]);
 assert.deepEqual(env.focused,["opened"]);
 assert.deepEqual(env.messages.map(m=>m.case_id),[ID]);
});
test("existing installed PWA wins over a Chrome tab and loads correct case",async()=>{
 const env=rootPush({chromeTab:true,standalone:true});
 await env.click({FCM_MSG:{data:{case_id:OTHER}}});
 assert.deepEqual(env.navigated,[{label:"pwa",target:HOME+"?case="+OTHER}]);
 assert.deepEqual(env.focused,["pwa"]);
 assert.deepEqual(env.opened,[]);
 assert.deepEqual(env.messages.map(m=>m.case_id),[OTHER]);
});
test("Chrome tab is not preferred over launching the installed PWA",async()=>{
 const env=rootPush({chromeTab:true});
 await env.click({case_id:ID});
 assert.deepEqual(env.opened,[HOME+"?case="+ID]);
 assert.deepEqual(env.focused,["opened"]);
 assert.deepEqual(env.navigated,[]);
});
test("unrelated or malformed notification data does not create unsafe navigation",async()=>{
 const env=rootPush();
 await env.click({case_id:"../../unexpected"});
 assert.deepEqual(env.opened,[HOME]);
 assert.deepEqual(env.messages, [{label:"opened",type:"GSMART_PUSH_OPEN_CASE",case_id:""}]);
});
test("the app consumes live push messages after it is already loaded",()=>{
 const code=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
 assert.ok(code.includes('event.data?.type!=="GSMART_PUSH_OPEN_CASE"'));
 assert.ok(code.includes('history.replaceState(history.state,"",url.href)'));
 assert.ok(code.includes('if(state.bundle&&!$("appView").classList.contains("hidden"))openRequestedCase()'));
 assert.ok(code.includes('event.data?.type==="GSMART_IDENTIFY_WINDOW"'));
});
test("FCM sender provides the exact case destination as a click fallback",()=>{
 const code=readFileSync(new URL("./push-production.mjs",import.meta.url),"utf8");
 assert.ok(code.includes('fcm_options:{link:destination.href}'));
 assert.ok(code.includes('destination.searchParams.set("case",String(event.case_id))'));
});
