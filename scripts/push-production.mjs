/* G-Smart production Web Push sender: Firebase Auth-registered devices only.
 * ETLE source tables are READ ONLY. Does not import any browser/login/SW code.
 * Each event/device pair is claimed before sending (at most one FCM attempt).
 */
import {createSign} from "node:crypto";
import {snapshot,changes} from "./push-pilot.mjs";
import {SHIPPING_EVENT_TYPES,shippingLifecycleEvents} from "./shipping-lifecycle.mjs";
const FIREBASE_PROJECT="g-smart-guyangan";
const DB_PROJECT="pszyqzzqlzdgeefivydz";
const HOME="https://uppkb-guyangan.github.io/";
const MAX_EVENT_EXPAND=20,MAX_DELIVERY_SEND=30,MAX_DEVICES=200;
function required(name){
 const v=process.env[name]?.trim();if(!v)throw Error("Secret "+name+" tidak tersedia.");
 return v;
}
function database(){
 const url=required("SUPABASE_URL").replace(/\/$/,"");
 if(new URL(url).hostname!==DB_PROJECT+".supabase.co")throw Error("Proyek Supabase tidak sesuai.");
 const key=required("SUPABASE_SERVICE_ROLE_KEY");
 const head={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
 async function req(table,{method="GET",params="",body,prefer}={}){
   const res=await fetch(url+"/rest/v1/"+table+(params?"?"+params:""),{
     method,headers:{...head,...(prefer?{Prefer:prefer}:{})},
     body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)
   });
   const raw=await res.text();
   if(!res.ok)throw Error("Supabase "+table+" HTTP "+res.status+"; detail tidak dicatat.");
   return raw?JSON.parse(raw):null;
 }
 async function page(table,columns){
   const out=[];
   for(let off=0;off<100000;off+=500){
     const params=new URLSearchParams({select:columns,order:"case_id.asc",limit:"500",offset:String(off)});
     const rows=await req(table,{params:params.toString()});
     if(!Array.isArray(rows))throw Error("Respons Supabase tidak sesuai.");
     out.push(...rows);if(rows.length<500)return out;
   }
   throw Error("Batas pembacaan tabel ETLE terlampaui.");
 }
 const iso=()=>new Date().toISOString();
 return {
   data:async()=>{
     const [cases,disputes,shipping,terminated]=await Promise.all([
       page("etle_cases","case_id,no_blanko,tnkb"),page("etle_disputes","case_id,status"),
       page("etle_shipping","case_id,status"),page("etle_terminated_cases","case_id")
     ]);
     return {cases,disputes,shipping,terminated};
   },
   cursor:async()=>(await req("gsmart_web_push_cursor",{params:"select=snapshot&id=eq.production&limit=1"}))?.[0]?.snapshot??null,
   saveCursor:async(current)=>req("gsmart_web_push_cursor",{
     method:"POST",params:"on_conflict=id",
     prefer:"resolution=merge-duplicates,return=minimal",
     body:[{id:"production",snapshot:current,updated_at:iso()}]
   }),
   enqueueEvents:async(events)=>{
     for(let i=0;i<events.length;i+=100){
       const entries=events.slice(i,i+100).map(e=>({
         event_key:e.event_key,event_type:e.event_type,case_id:e.case_id,
         title:e.title.replace(/^G-Smart Uji · /,"G-Smart · "),body:e.body
       }));
       await req("gsmart_web_push_events",{
         method:"POST",params:"on_conflict=event_key",
         prefer:"resolution=ignore-duplicates,return=minimal",body:entries
       });
     }
   },
   devices:async()=>{
     const cutoff=new Date(Date.now()-90*86400000).toISOString();
     const params=new URLSearchParams({select:"id,token,active,role,created_at,last_seen_at,receive_blanko,receive_disputes,receive_shipping",
       active:"eq.true",last_seen_at:"gte."+cutoff,order:"id.asc",limit:String(MAX_DEVICES)});
     return await req("gsmart_web_push_devices",{params:params.toString()});
   },
   unexpanded:async()=>req("gsmart_web_push_events",{
     params:"select=event_key,event_type,case_id,title,body,created_at&expanded_at=is.null&order=created_at.asc&limit="+MAX_EVENT_EXPAND
   }),
   addDeliveries:async(entries)=>{
     for(let i=0;i<entries.length;i+=100){
       await req("gsmart_web_push_deliveries",{
         method:"POST",params:"on_conflict=event_key,device_id",prefer:"resolution=ignore-duplicates,return=minimal",
         body:entries.slice(i,i+100)
       });
     }
   },
   expanded:async(key)=>{
     const q=new URLSearchParams({event_key:"eq."+key,expanded_at:"is.null"});
     await req("gsmart_web_push_events",{method:"PATCH",params:q.toString(),
       prefer:"return=minimal",body:{expanded_at:iso()}});
   },
   pending:async()=>req("gsmart_web_push_deliveries",{
     params:"select=event_key,device_id,gsmart_web_push_events(event_key,event_type,title,body,case_id),gsmart_web_push_devices(id,token,active,receive_blanko,receive_disputes,receive_shipping,last_seen_at)&status=eq.pending&order=created_at.asc&limit="+MAX_DELIVERY_SEND
   }),
   claim:async(row)=>{
     const params=new URLSearchParams({event_key:"eq."+row.event_key,device_id:"eq."+row.device_id,status:"eq.pending",select:"event_key"});
     const rows=await req("gsmart_web_push_deliveries",{
       method:"PATCH",params:params.toString(),prefer:"return=representation",
       body:{status:"sending",updated_at:iso()}
     });
     return rows?.length===1;
   },
   finish:async(row,status,error)=>{
     const params=new URLSearchParams({event_key:"eq."+row.event_key,device_id:"eq."+row.device_id,status:"eq.sending"});
     await req("gsmart_web_push_deliveries",{
       method:"PATCH",params:params.toString(),prefer:"return=minimal",
       body:{status,updated_at:iso(),sent_at:status==="sent"?iso():null,last_error:error||null}
     });
   }
 };
}
function allowed(device,type){
 if(!device?.active)return false;
 if(!["blanko","dispute",...SHIPPING_EVENT_TYPES].includes(type))return false;
 if(type==="blanko")return device.receive_blanko;
 if(type==="dispute")return device.receive_disputes;
 return device.receive_shipping;
}
// Adds the plate to an individual event without changing its delivery identity.
export function withPlate(event,tnkb){
 const plate=String(tnkb||"").trim().replace(/\s+/g," ").toUpperCase();
 if(!event?.case_id||!plate)return event;
 if(String(event.body||"").startsWith("TNKB: "))return event;
 return {...event,body:"TNKB: "+plate+" · "+String(event.body||"")};
}
async function oauth(sa){
 if(sa.project_id!==FIREBASE_PROJECT||!sa.private_key||!sa.client_email)throw Error("Firebase server credentials tidak sesuai.");
 const timestamp=Math.floor(Date.now()/1000);
 const b64=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
 const payload=b64({alg:"RS256",typ:"JWT"})+"."+b64({
   iss:sa.client_email,scope:"https://www.googleapis.com/auth/firebase.messaging",
   aud:"https://oauth2.googleapis.com/token",iat:timestamp,exp:timestamp+3600
 });
 const signer=createSign("RSA-SHA256");signer.update(payload);signer.end();
 const jwt=payload+"."+signer.sign(sa.private_key,"base64url");
 const res=await fetch("https://oauth2.googleapis.com/token",{
   method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt}),
   signal:AbortSignal.timeout(25000)
 });
 const token=await res.json().catch(()=>({}));
 if(!res.ok||!token.access_token)throw Error("Firebase OAuth HTTP "+res.status);
 return token.access_token;
}
async function notify(access,device,event){
 const destination=new URL(HOME);
 if(event.case_id)destination.searchParams.set("case",String(event.case_id));
 const res=await fetch("https://fcm.googleapis.com/v1/projects/"+FIREBASE_PROJECT+"/messages:send",{
   method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json"},
   body:JSON.stringify({message:{
     token:device.token,
     notification:{title:event.title,body:event.body},
     data:{event_key:event.event_key,event_type:event.event_type,case_id:event.case_id},
     // Let the custom SW notificationclick open the installed PWA.
     webpush:{notification:{
       tag:event.event_key,icon:HOME+"G-SMART%20Traffic%20Monitoring%20Emblem.png",
       data:{case_id:String(event.case_id||""),url:destination.href}
     }}
   }}),
   signal:AbortSignal.timeout(25000)
 });
 if(!res.ok)throw Error("FCM HTTP "+res.status);
}
export async function runProduction(){
 const mode=(process.env.PUSH_MODE||"run").trim();
 if(!["run","ping"].includes(mode))throw Error("Mode Push Production tidak diizinkan.");
 const store=database();
 if(mode==="ping"){
   // Ping main PWA device; no ETLE reads or ledger writes.
   const devices=await store.devices();
   if(devices.length!==1)throw Error("Ping memerlukan tepat 1 perangkat PWA aktif; terdaftar: "+devices.length);
   const account=JSON.parse(required("FIREBASE_SERVICE_ACCOUNT_JSON"));
   const access=await oauth(account);
   await notify(access,devices[0],{
     event_key:"gsmart-pwa-ping:"+Date.now(),
     event_type:"pwa_ping",case_id:"",
     title:"G-Smart · Uji Notifikasi PWA",
     body:"Pesan uji langsung ke G-Smart PWA utama. Tidak ada data ETLE yang diubah."
   });
   return {mode:"ping",sent:1,recipients:1,source:"registered-main-pwa",etleDataRead:false,etleDataModified:false,deliveryLedgerModified:false};
 }
 const source=await store.data();
 const currentSnapshot=snapshot(source);
 const platesByCase=new Map(source.cases.filter(x=>x.case_id).map(x=>[String(x.case_id),x.tnkb]));
 const before=await store.cursor();
 if(before===null){
   // Baseline never broadcasts pre-existing shipping states.
   await store.saveCursor({...currentSnapshot,shippingEventCounts:{}});
   return {status:"baseline-created",sent:0,note:"No historical ETLE events sent."};
 }
 // The pilot detector still covers blanko and disputes. Production uses
 // the full Android-equivalent shipping lifecycle instead of processing-only.
 const detected=changes(before,currentSnapshot).filter(e=>e.event_type!=="shipping_processing");
 const lifecycle=shippingLifecycleEvents(before,currentSnapshot);
 detected.push(...lifecycle.events);
 const current={...currentSnapshot,shippingEventCounts:lifecycle.eventCounts};
 await store.enqueueEvents(detected.map(e=>withPlate(e,platesByCase.get(String(e.case_id)))));
 await store.saveCursor(current);
 const devices=await store.devices();
 const unexpanded=await store.unexpanded();
 let queued=0;
 for(const event of unexpanded){
   const targets=devices.filter(d=>allowed(d,event.event_type)&&new Date(d.created_at).getTime()<=new Date(event.created_at).getTime());
   if(targets.length){
     await store.addDeliveries(targets.map(d=>({event_key:event.event_key,device_id:d.id,status:"pending"})));
     queued+=targets.length;
   }
   await store.expanded(event.event_key);
 }
 const pending=await store.pending();
 let sent=0,failed=0,skipped=0;
 if(pending.length){
   const account=JSON.parse(required("FIREBASE_SERVICE_ACCOUNT_JSON"));
   const access=await oauth(account);
   const cutoff=Date.now()-90*86400000;
   for(const row of pending){
     if(!await store.claim(row))continue;
     const d=row.gsmart_web_push_devices,e=row.gsmart_web_push_events;
     if(!e||!d||!allowed(d,e.event_type)||new Date(d.last_seen_at).getTime()<cutoff){
       await store.finish(row,"failed","DEVICE_DISABLED_OR_STALE");skipped++;continue;
     }
     try{await notify(access,d,withPlate(e,platesByCase.get(String(e.case_id))));await store.finish(row,"sent",null);sent++}
     catch(error){failed++;await store.finish(row,"failed",String(error?.message||error).slice(0,100))}
   }
 }
 return {status:"ok",detected:detected.length,devices:devices.length,queued,sent,failed,skipped,limit:MAX_DELIVERY_SEND};
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 runProduction().then(x=>console.log(JSON.stringify(x))).catch(err=>{
   console.error("G-Smart push sender stopped:",String(err.message||err));process.exitCode=1;
 });
}
