import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
function between(start,end){
  const first=app.indexOf(start);
  const last=app.indexOf(end,first+start.length);
  assert.ok(first>=0&&last>first,"Missing startup section: "+start);
  return app.slice(first,last);
}

test("initial paint hides the login form pending Firebase state",()=>{
  assert.match(html,/id="loginView" class="login-shell hidden"/);
  assert.match(html,/id="gsmartAuthBoot" class="gsmart-auth-boot"/);
  assert.match(html,/id="gsmartAuthBootText">Memulihkan sesi G-Smart/);
  assert.match(html,/id="gsmartAuthRetry" type="button" class="hidden"/);
  assert.match(html,/id="gsmartAuthLogout" type="button" class="secondary hidden"/);
  assert.match(html,/app-v2\.js\?v=20261011-authpersist1/);
  assert.match(sw,/app-v2\.js\?v=20261011-authpersist1/);
});
test("login page is revealed only after boot concludes",()=>{
  const sections=between("function hideAuthBoot(){","function renderProfile(");
  const ids=["gsmartAuthBoot","loginView","appView","gsmartAuthRetry","gsmartAuthLogout","gsmartAuthBootText"];
  const classes=new Map(ids.map(id=>[id,new Set()]));
  const nodes=new Map(ids.map(id=>{
    const obj={classList:{
      add(k){if(!classes.has(id))classes.set(id,new Set());classes.get(id).add(k)},
      remove(k){classes.get(id)?.delete(k)},
      toggle(k,forced){if(!classes.has(id))classes.set(id,new Set());if(forced)classes.get(id).add(k);else classes.get(id).delete(k)}
    },textContent:""};
    return [id,obj];
  }));
  let resets=0;
  const helpers=runInNewContext(sections+"\n({showAuthBoot,showLogin})",{$:id=>nodes.get(id),resetPreviewAppearance:()=>resets++});
  helpers.showAuthBoot("Menyiapkan data...",{retry:true,logout:true});
  assert.equal(classes.get("loginView").has("hidden"),true);
  assert.equal(classes.get("gsmartAuthBoot").has("hidden"),false);
  assert.equal(nodes.get("gsmartAuthBootText").textContent,"Menyiapkan data...");
  assert.equal(classes.get("gsmartAuthRetry").has("hidden"),false);
  helpers.showLogin();
  assert.equal(classes.get("gsmartAuthBoot").has("hidden"),true);
  assert.equal(classes.get("loginView").has("hidden"),false);
  assert.equal(resets,1);
});
function makeRestore(options={}){
  const section=between("async function restoreSignedInSession(user){",'$("gsmartAuthRetry").onclick');
  const events=[];
  const user={uid:"u1"};
  const state={profile:null,bundle:null};
  const auth={currentUser:user};
  const showAuthBoot=(message,actions)=>events.push({kind:"boot",message,actions});
  const showLogin=()=>events.push({kind:"login"});
  const showApp=()=>events.push({kind:"app"});
  const signOut=async()=>{events.push({kind:"logout"});auth.currentUser=null};
  const loadProfile=async()=>{if(options.profileError)throw options.profileError;return{uid:"u1",role:"PETUGAS",aktif:true}};
  const loadDashboard=async()=>{if(options.dataError)throw options.dataError;state.bundle={cases:[]}};
  const $=id=>id==="loginMessage"?{set textContent(value){events.push({kind:"login-error",value})}}:null;
  const restore=runInNewContext(section+"\nrestoreSignedInSession",{
    state,auth,showAuthBoot,showLogin,showApp,signOut,loadProfile,loadDashboard,$,
    console:{error(){}}
  });
  return {restore,user,events,auth,state};
}
test("saved valid Firebase session opens app without a login screen",async()=>{
  const t=makeRestore();
  await t.restore(t.user);
  assert.ok(t.events.some(e=>e.kind==="app"));
  assert.equal(t.events.some(e=>e.kind==="login"),false);
  assert.equal(t.events.some(e=>e.kind==="logout"),false);
});
test("temporary Supabase failure keeps Firebase session and offers retry",async()=>{
  const t=makeRestore({dataError:new Error("Network unavailable")});
  await t.restore(t.user);
  assert.equal(t.auth.currentUser?.uid,"u1");
  assert.equal(t.events.some(e=>e.kind==="logout"),false);
  assert.equal(t.events.some(e=>e.kind==="app"),false);
  assert.ok(t.events.some(e=>e.kind==="boot"&&e.actions?.retry&&e.actions?.logout));
});
test("temporary profile lookup failure does not invalidate a valid session",async()=>{
  const t=makeRestore({profileError:new Error("Firestore unavailable")});
  await t.restore(t.user);
  assert.equal(t.auth.currentUser?.uid,"u1");
  assert.equal(t.events.some(e=>e.kind==="logout"),false);
  assert.ok(t.events.some(e=>e.actions?.retry));
});
test("explicitly inactive account is signed out, never allowed into dashboard",async()=>{
  const err=new Error("Akun Anda tidak aktif");
  err.code="gsmart/profile-denied";
  const t=makeRestore({profileError:err});
  await t.restore(t.user);
  assert.equal(t.events.some(e=>e.kind==="logout"),true);
  assert.equal(t.events.some(e=>e.kind==="login"),true);
  assert.equal(t.events.some(e=>e.kind==="app"),false);
});
test("signed out users see the real login and notification deep links stay intact",()=>{
  assert.match(app,/onAuthStateChanged\(auth,u=>\{/);
  assert.match(app,/if\(!u\)\{[\s\S]*?showLogin\(\);[\s\S]*?return;/);
  assert.match(app,/function showApp\(\)\{hideAuthBoot\(\)/);
  assert.match(app,/openRequestedCase\(\);launchPushMigration\(\)/);
  assert.match(app,/function requestedCaseId\(\)/);
  assert.match(sw,/self\.addEventListener\('notificationclick'/);
  assert.doesNotMatch(between("async function restoreSignedInSession(user){",'$("gsmartAuthRetry").onclick'),/localStorage|sessionStorage/);
});
