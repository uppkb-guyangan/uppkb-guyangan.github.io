import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const app=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");

const start=app.indexOf("async function ensurePersistentAuth(){");
const end=app.indexOf("const authPersistenceReady=ensurePersistentAuth();",start);
assert.ok(start>=0&&end>start);
const block=app.slice(start,end)+"\nensurePersistentAuth";

function environment(handler){
  const attempted=[];
  const persistence={
    indexedDBLocalPersistence:{type:"LOCAL_IDB"},
    browserLocalPersistence:{type:"LOCAL_STORAGE"}
  };
  const ensure=runInNewContext(block,{
    auth:{id:"auth"},
    ...persistence,
    setPersistence:async (_auth,storage)=>{
      attempted.push(storage.type);
      await handler(storage.type);
    },
    console:{warn(){}}
  });
  return {attempted,ensure};
}
test("restores an existing session using persistent IndexedDB when supported",async()=>{
  const {attempted,ensure}=environment(async()=>{});
  assert.equal(await ensure(),"indexeddb");
  assert.deepEqual(attempted,["LOCAL_IDB"]);
});
test("uses persistent localStorage when IndexedDB is unavailable",async()=>{
  const {attempted,ensure}=environment(async type=>{
    if(type==="LOCAL_IDB")throw Object.assign(new Error("IDB blocked"),{code:"auth/unsupported-persistence-type"});
  });
  assert.equal(await ensure(),"localstorage");
  assert.deepEqual(attempted,["LOCAL_IDB","LOCAL_STORAGE"]);
});
test("storage unavailable never blocks startup or silently promises persistence",async()=>{
  const {attempted,ensure}=environment(async()=>{throw new Error("Storage is unavailable")});
  assert.equal(await ensure(),"unavailable");
  assert.deepEqual(attempted,["LOCAL_IDB","LOCAL_STORAGE"]);
});
test("auth restoration and manual password sign-in both await persistence selection",()=>{
  assert.match(app,/const authPersistenceReady=ensurePersistentAuth\(\);/);
  assert.match(app,/await authPersistenceReady;\s*const c=await signInWithEmailAndPassword/);
  assert.match(app,/void authPersistenceReady\.then\(\(\)=>\{\s*onAuthStateChanged\(auth,u=>\{/);
  assert.doesNotMatch(block,/browserSessionPersistence|sessionStorage|password/i);
  assert.match(html,/app-v2\.js\?v=\d{8}-[a-zA-Z0-9-]+/);
  assert.match(sw,/gsmart-shell-v51/);
  assert.match(sw,/app-v2\.js\?v=\d{8}-[a-zA-Z0-9-]+/);
  assert.match(app,/function showApp\(\)\{hideAuthBoot\(\)/);
  assert.match(app,/openRequestedCase\(\);launchPushMigration\(\)/);
});
