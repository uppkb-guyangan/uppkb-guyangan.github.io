import { getApps } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { supabaseConfig } from "./config.js?v=20261002-3";

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmtDate=v=>{if(!v)return"-";const d=new Date(v);if(Number.isNaN(d.getTime()))return esc(v);return new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:String(v).includes("T")?"2-digit":undefined,minute:String(v).includes("T")?"2-digit":undefined,timeZone:"Asia/Jakarta"}).format(d)};
const positiveAmount=v=>{const n=Number(v);return Number.isFinite(n)&&n>0};
const kejaksaanUrl=noBlanko=>"https://tilang.kejaksaan.go.id/detail/"+encodeURIComponent(String(noBlanko||"").trim());
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
function modal(){return{backdrop:document.getElementById("modalBackdrop"),title:document.getElementById("modalTitle"),sub:document.getElementById("modalSubtitle"),body:document.getElementById("modalBody")}}
async function showCase(c){
  const m=modal();m.backdrop.classList.remove("hidden");m.title.textContent="Detail Perkara";m.sub.textContent=(c.tnkb||"-")+" · "+(c.ref_number||c.no_registrasi||"");m.body.innerHTML='<div class="loading">Memuat detail perkara...</div>';
  let vehicle=null,photos=[],payment=null,court=null;
  try{
    const courtFilter=c.violation_id?{violation_id:"eq."+c.violation_id}:{case_id:"eq."+c.case_id};
    [vehicle,photos,payment,court]=await Promise.all([
      query("etle_vehicles",{filters:{case_id:"eq."+c.case_id},limit:1}).then(r=>r[0]||null),
      query("etle_photos",{filters:{case_id:"eq."+c.case_id},order:"sort_order.asc",limit:20}),
      query("etle_payments",{filters:{case_id:"eq."+c.case_id},limit:1}).then(r=>r[0]||null).catch(()=>null),
      query("etle_court_info",{filters:courtFilter,limit:1}).then(r=>r[0]||null).catch(()=>null)
    ]);
  }catch(e){console.warn(e)}
  const item=(l,v)=>v!=null&&v!==""?'<div class="detail-item"><small>'+esc(l)+'</small><b>'+esc(v)+'</b></div>':"";
  const hasFine=positiveAmount(court?.denda_putusan)||positiveAmount(payment?.denda_pengadilan);
  const kejaksaanAction=c.no_blanko&&hasFine?'<div class="action-row"><button class="action-btn gold" id="courtKejaksaanBtn">⚖ Buka E-Tilang Kejaksaan ↗</button></div>':"";
  m.body.innerHTML=kejaksaanAction+'<section class="detail-section"><h3 class="section-heading">Perkara</h3><div class="detail-grid">'+item("TNKB",c.tnkb)+item("No. Registrasi",c.no_registrasi)+item("Violation ID",c.violation_id)+item("Jenis Pelanggaran",c.jenis_pelanggaran)+item("Pasal",c.pasal)+item("Lokasi",c.lokasi)+item("Tanggal Pelanggaran",fmtDate(c.tanggal_pelanggaran))+item("Status ETLE",c.status_etle)+item("No. Blanko",c.no_blanko)+item("No. BRIVA",c.no_briva)+'</div></section><section class="detail-section"><h3 class="section-heading">Kendaraan / BLUE</h3><div class="detail-grid">'+item("Nama Pemilik",vehicle?.nama_pemilik||c.nama_pemilik)+item("Alamat Pemilik",vehicle?.alamat_pemilik)+item("Merk",vehicle?.merk)+item("Tipe",vehicle?.tipe)+item("Jenis Kendaraan",vehicle?.jenis_kendaraan)+item("Masa Berlaku KIR",vehicle?.masa_berlaku_kir?fmtDate(vehicle.masa_berlaku_kir):null)+item("JBB",vehicle?.jbb)+item("JBI",vehicle?.jbi)+'</div></section>'+(photos.filter(x=>x.photo_url).length?'<section class="detail-section"><h3 class="section-heading">Foto ETLE</h3><div class="photo-grid">'+photos.filter(x=>x.photo_url).map(x=>'<img src="'+esc(x.photo_url)+'" alt="Foto ETLE">').join("")+'</div></section>':"");
  const btn=document.getElementById("courtKejaksaanBtn");
  if(btn)btn.onclick=e=>{e.stopPropagation();window.open(kejaksaanUrl(c.no_blanko),"_blank","noopener,noreferrer")};
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
      if(c){tr.classList.add("clickable");tr.dataset.case=c.case_id;tr.title="Klik untuk melihat detail perkara";tr.onclick=()=>showCase(c)}
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
