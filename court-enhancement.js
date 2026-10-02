import { getApps } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { supabaseConfig } from "./config.js?v=20261002-3";

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
let busy=false;
let casesCache=null;
let casesCacheAt=0;

async function query(table,{filters={},order=null,limit=1000}={}){
  const apps=getApps();
  if(!apps.length)throw new Error("Firebase belum siap");
  const user=getAuth(apps[0]).currentUser;
  if(!user)return [];
  const token=await user.getIdToken();
  const u=new URL(supabaseConfig.url+"/rest/v1/"+table);
  u.searchParams.set("select","*");u.searchParams.set("limit",String(limit));
  if(order)u.searchParams.set("order",order);
  Object.entries(filters).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u,{headers:{apikey:supabaseConfig.publishableKey,Authorization:"Bearer "+token}});
  if(!r.ok)throw new Error(table+" HTTP "+r.status);
  return r.json();
}
async function getCases(){
  if(casesCache&&Date.now()-casesCacheAt<60000)return casesCache;
  casesCache=await query("etle_cases",{order:"tanggal_pelanggaran.desc.nullslast",limit:1000});
  casesCacheAt=Date.now();
  return casesCache;
}
async function enhanceCourt(){
  if(busy||document.getElementById("pageTitle")?.textContent.trim()!=="Persidangan")return;
  const table=document.querySelector("#content table.data-table");
  if(!table)return;
  const head=table.querySelector("thead tr");
  if(!head)return;
  const alreadyEnhanced=head.children[0]?.dataset?.courtTnkb==="1";
  if(alreadyEnhanced)return;
  busy=true;
  try{
    const cases=await getCases();
    const byViolation=new Map(cases.filter(c=>c.violation_id!=null).map(c=>[String(c.violation_id).trim(),c]));
    const th=document.createElement("th");th.textContent="TNKB";th.dataset.courtTnkb="1";head.prepend(th);
    table.querySelectorAll("tbody tr").forEach(tr=>{
      const violation=tr.children[0]?.textContent?.trim()||"";
      const c=byViolation.get(violation);
      const td=document.createElement("td");td.dataset.courtTnkb="1";td.innerHTML=c?'<b>'+esc(c.tnkb||"-")+'</b>':"-";tr.prepend(td);
      if(c){
        tr.classList.add("clickable");
        tr.dataset.case=c.case_id;
        tr.title="Klik untuk melihat detail perkara";
        // Jangan membuat modal detail sendiri di sini. app-v2.js sudah memasang
        // handler baris Persidangan ke openDetail(), sehingga semua action utama
        // (Salin Ringkasan, Salin Telepon, WhatsApp sesuai role, dan Kejaksaan)
        // tetap berasal dari satu renderer Detail Perkara.
      }
    });
  }catch(e){console.warn("Court enhancement:",e)}finally{busy=false}
}
let scheduled=false;
function scheduleEnhance(){
  if(scheduled)return;
  scheduled=true;
  setTimeout(()=>{scheduled=false;enhanceCourt()},0);
}
const observer=new MutationObserver(scheduleEnhance);
observer.observe(document.getElementById("content"),{childList:true,subtree:true});
document.getElementById("globalMonth")?.addEventListener("change",()=>setTimeout(enhanceCourt,50));
scheduleEnhance();
