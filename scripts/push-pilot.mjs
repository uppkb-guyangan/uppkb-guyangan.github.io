/* Isolated G-Smart Supabase -> FCM pilot; no production browser changes.
 * Modes: test, inspect, baseline, pilot. No default broadcasts, no cron.
 */
import {createSign} from "node:crypto";
const PROJECT="g-smart-guyangan";
const TEST_URL="https://uppkb-guyangan.github.io/preview-push-v1/";
const MAX_SEND=3;
export const norm=v=>String(v??"").trim().replace(/\s+/g," ").toUpperCase();
export const isProcessing=v=>norm(v)==="DALAM PROSES PENGIRIMAN";
export function snapshot({cases=[],disputes=[],shipping=[],terminated=[]}){
  const stopped=new Set(terminated.map(r=>r.case_id).filter(Boolean));
  const blanko=new Set(),sanggah=new Set(),shipment={};
  for(const r of cases)if(r.case_id&&norm(r.no_blanko))blanko.add(r.case_id+":"+norm(r.no_blanko));
  for(const r of disputes)if(r.case_id&&!stopped.has(r.case_id)&&norm(r.status)==="TERSANGGAH")sanggah.add(r.case_id);
  for(const r of shipping)if(r.case_id)shipment[r.case_id]=norm(r.status);
  return {blanko:[...blanko].sort(),disputes:[...sanggah].sort(),shipping:shipment};
}
export function changes(previous,current){
  const b=new Set(previous.blanko||[]),d=new Set(previous.disputes||[]);
  const old=previous.shipping||{},events=[];
  for(const key of current.blanko||[])if(!b.has(key)){
    events.push({event_key:"blanko:"+key,event_type:"blanko",case_id:key.slice(0,36),
      title:"G-Smart Uji · Blanko Baru",body:"Blanko tilang baru telah terpantau."});
  }
  for(const id of current.disputes||[])if(!d.has(id)){
    events.push({event_key:"dispute:"+id,event_type:"dispute",case_id:id,
      title:"G-Smart Uji · Sanggahan Baru",body:"Sanggahan baru telah terpantau."});
  }
  for(const [id,status] of Object.entries(current.shipping||{})){
    if(isProcessing(status)&&old[id]!==undefined&&!isProcessing(old[id])){
      events.push({event_key:"shipping_processing:"+id,event_type:"shipping_processing",case_id:id,
        title:"G-Smart Uji · Surat Diproses",body:"Surat telah masuk proses pengiriman JNE."});
    }
  }
  return events.sort((x,y)=>x.event_key.localeCompare(y.event_key));
}
export function assertMode(mode){
  if(!["test","inspect","baseline","pilot"].includes(mode))throw Error("Mode tidak diizinkan");
  return mode;
}
function required(k){
  const v=process.env[k]?.trim();
  if(!v)throw Error("Secret "+k+" belum tersedia. Pengiriman dibatalkan.");
  return v;
}
function database(){
  const url=required("SUPABASE_URL").replace(/\/$/,"");
  if(new URL(url).hostname!=="pszyqzzqlzdgeefivydz.supabase.co")throw Error("Proyek Supabase tidak cocok");
  const key=required("SUPABASE_SERVICE_ROLE_KEY");
  const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
  async function req(table,{method="GET",params="",body,prefer}={}){
    const res=await fetch(url+"/rest/v1/"+table+(params?"?"+params:""),{
      method,headers:{...headers,...(prefer?{Prefer:prefer}:{})},
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)
    });
    const text=await res.text();
    if(!res.ok)throw Error("Supabase "+table+" HTTP "+res.status+" (detail dirahasiakan)");
    return text?JSON.parse(text):null;
  }
  async function paginate(table,fields){
    const list=[];
    for(let offset=0;offset<100000;offset+=500){
      const params=new URLSearchParams({select:fields,order:"case_id.asc",limit:"500",offset:String(offset)});
      const rows=await req(table,{params:params.toString()});
      if(!Array.isArray(rows))throw Error("Respons database tidak valid");
      list.push(...rows);
      if(rows.length<500)return list;
    }
    throw Error("Terlalu banyak data, hentikan agar aman");
  }
  return {
    read:async()=>{
      const [cases,disputes,shipping,terminated]=await Promise.all([
        paginate("etle_cases","case_id,no_blanko"),
        paginate("etle_disputes","case_id,status"),
        paginate("etle_shipping","case_id,status"),
        paginate("etle_terminated_cases","case_id")
      ]);
      return {cases,disputes,shipping,terminated};
    },
    cursor:async()=>(await req("gsmart_push_pilot_cursor",{params:"select=snapshot&id=eq.pilot&limit=1"}))?.[0]?.snapshot??null,
    save:async(data)=>req("gsmart_push_pilot_cursor",{
      method:"POST",params:"on_conflict=id",prefer:"resolution=merge-duplicates,return=minimal",
      body:[{id:"pilot",snapshot:data,updated_at:new Date().toISOString()}]
    }),
    enqueue:async(events)=>{
      for(let n=0;n<events.length;n+=100)await req("gsmart_push_pilot_delivery",{
        method:"POST",params:"on_conflict=event_key",prefer:"resolution=ignore-duplicates,return=minimal",
        body:events.slice(n,n+100).map(x=>({...x,status:"pending"}))
      });
    },
    pending:async()=>req("gsmart_push_pilot_delivery",{
      params:"select=event_key,event_type,case_id,title,body&status=eq.pending&order=created_at.asc&limit="+MAX_SEND
    }),
    claim:async(key)=>{
      const params=new URLSearchParams({event_key:"eq."+key,status:"eq.pending",select:"event_key"});
      const rows=await req("gsmart_push_pilot_delivery",{
        method:"PATCH",params:params.toString(),prefer:"return=representation",
        body:{status:"sending",updated_at:new Date().toISOString()}
      });
      return rows?.length===1;
    },
    complete:async(key,status,error)=>{
      const params=new URLSearchParams({event_key:"eq."+key,status:"eq.sending"});
      return req("gsmart_push_pilot_delivery",{
        method:"PATCH",params:params.toString(),prefer:"return=minimal",
        body:{status,updated_at:new Date().toISOString(),sent_at:status==="sent"?new Date().toISOString():null,last_error:error??null}
      });
    }
  };
}
async function oauth(sa){
  if(sa.project_id!==PROJECT||!sa.client_email||!sa.private_key)throw Error("Kredensial Firebase tidak cocok");
  const now=Math.floor(Date.now()/1000);
  const enc=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
  const unsigned=enc({alg:"RS256",typ:"JWT"})+"."+enc({
    iss:sa.client_email,scope:"https://www.googleapis.com/auth/firebase.messaging",
    aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600
  });
  const signer=createSign("RSA-SHA256");signer.update(unsigned);signer.end();
  const jwt=unsigned+"."+signer.sign(sa.private_key,"base64url");
  const res=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt}),
    signal:AbortSignal.timeout(30000)
  });
  const body=await res.json().catch(()=>({}));
  if(!res.ok||!body.access_token)throw Error("Google OAuth HTTP "+res.status+" (detail rahasia tidak dicatat)");
  return body.access_token;
}
async function send(access,recipient,event){
  const res=await fetch("https://fcm.googleapis.com/v1/projects/"+PROJECT+"/messages:send",{
    method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json"},
    body:JSON.stringify({message:{
      token:recipient,
      notification:{title:event.title,body:event.body},
      data:{event_type:event.event_type,case_id:event.case_id},
      webpush:{fcm_options:{link:TEST_URL},notification:{
        icon:"https://uppkb-guyangan.github.io/G-SMART%20Traffic%20Monitoring%20Emblem.png"
      }}
    }}),
    signal:AbortSignal.timeout(30000)
  });
  if(!res.ok)throw Error("FCM HTTP "+res.status);
}
export async function run(mode=process.env.PUSH_MODE||"test",mockStore){
  assertMode(mode);
  if(mode==="test")return {mode,description:"Offline; run node --test scripts/push-pilot.test.mjs"};
  const account=mode==="pilot"?JSON.parse(required("FIREBASE_SERVICE_ACCOUNT_JSON")):null;
  const target=mode==="pilot"?required("GSMART_PILOT_FCM_TOKEN"):null;
  if(account&&account.project_id!==PROJECT)throw Error("Firebase project mismatch");
  const store=mockStore||database();
  const current=snapshot(await store.read());
  const before=await store.cursor();
  const totals={blanko:current.blanko.length,disputes:current.disputes.length,shipping:Object.keys(current.shipping).length};
  if(mode==="inspect")return {mode,baseline:before!==null,totals,potential:before?changes(before,current).length:null,sent:0};
  if(mode==="baseline"){
    if(before!==null)throw Error("Baseline sudah ada; tidak boleh ditimpa otomatis");
    await store.save(current);
    return {mode,totals,baselineSaved:true,sent:0};
  }
  if(before===null)throw Error("Baseline belum ada. Jalankan mode baseline dahulu.");
  const events=changes(before,current);
  await store.enqueue(events);
  await store.save(current);
  const pending=await store.pending();
  if(!pending.length)return {mode,detected:events.length,sent:0};
  const access=await oauth(account);
  let sent=0,failed=0;
  for(const event of pending){
    if(!await store.claim(event.event_key))continue;
    try{await send(access,target,event);await store.complete(event.event_key,"sent",null);sent++}
    catch(e){failed++;await store.complete(event.event_key,"failed",String(e.message||e).slice(0,100))}
  }
  return {mode,detected:events.length,sent,failed,limit:MAX_SEND};
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
  run().then(x=>console.log(JSON.stringify(x))).catch(e=>{
    console.error("G-Smart pilot dihentikan:",e.message);
    process.exitCode=1;
  });
}
