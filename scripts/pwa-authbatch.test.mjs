import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const source=readFileSync(new URL("../app-v2.js",import.meta.url),"utf8");
const extract=(start,end)=>{
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"Expected function segment "+start);
 return source.slice(a,b);
};

test("dashboard reuses one freshly requested token across all eight tables",()=>{
 const block=extract("async function loadDashboard(){",'$("loginForm").onsubmit');
 assert.equal((block.match(/getIdToken\(true\)/g)||[]).length,1);
 assert.equal((block.match(/dashboardQ\("/g)||[]).length,8);
 assert.match(block,/Promise\.all\(/);
 for(const table of ["etle_cases","etle_shipping","etle_disputes","etle_terminated_cases",
                     "etle_court_info","etle_offenders","gsmart_case_history","gsmart_sync_log"]){
   assert.ok(block.includes('dashboardQ("'+table+'"'),"Missing "+table);
 }
});

test("case detail reuses one fresh token but retains eleven data lookups",()=>{
 const block=extract("async function loadDetail(caseId){","function infoGrid(");
 assert.equal((block.match(/getIdToken\(true\)/g)||[]).length,1);
 assert.ok(block.includes("const detailQ=(table,opts)=>q(table,{...opts,authToken})"));
 assert.match(block,/Promise\.all\(/);
 for(const table of ["etle_offenders","etle_vehicles","etle_photos",
                     "etle_shipping","etle_payments","etle_disputes","etle_terminated_cases",
                     "etle_court_info","gsmart_case_status","gsmart_case_notes","gsmart_case_history"]){
   assert.ok(block.includes('"'+table+'"'),"Missing "+table);
 }
 assert.ok(block.includes('detailQ("etle_photos"'));
 assert.ok(block.includes('detailQ("gsmart_case_notes"'));
 assert.ok(block.includes('detailQ("gsmart_case_history"'));
});

test("q accepts provided fresh token without requesting it again",async()=>{
 const code=extract("async function q(table,","async function write(");
 let authCalls=0;const seen=[];
 const context={
  URL, state:{demo:false},
  auth:{currentUser:{getIdToken:async()=>{authCalls++;return "fresh-token"}}},
  supabaseConfig:{url:"https://test.supabase.co",publishableKey:"public-key"},
  fetch:async(url,options)=>{
    seen.push({url:String(url),headers:options.headers});
    return {ok:true,json:async()=>[{case_id:"case-1"}]};
  }
 };
 const q=runInNewContext(code+"\nq",context);
 const a=await q("etle_cases",{limit:1,authToken:"batch-token"});
 const b=await q("etle_shipping",{limit:1,authToken:"batch-token"});
 assert.equal(authCalls,0);
 assert.equal(a.length,1);assert.equal(b.length,1);
 assert.deepEqual(seen.map(x=>x.headers.Authorization),["Bearer batch-token","Bearer batch-token"]);
 await q("etle_cases",{limit:1});
 assert.equal(authCalls,1,"Other calls still freshen Firebase token");
 assert.equal(seen[2].headers.Authorization,"Bearer fresh-token");
});
