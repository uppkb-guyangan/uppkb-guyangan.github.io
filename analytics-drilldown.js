import { getApps } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { supabaseConfig } from "./config.js?v=20261002-3";

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmtDate=v=>{if(!v)return"-";const d=new Date(v);if(Number.isNaN(d.getTime()))return esc(v);return new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:String(v).includes("T")?"2-digit":undefined,minute:String(v).includes("T")?"2-digit":undefined,timeZone:"Asia/Jakarta"}).format(d)};

async function query(table,{filters={},order=null,limit=1000}={}){
  const apps=getApps();
  if(!apps.length) throw new Error("Firebase belum siap.");
  const user=getAuth(apps[0]).currentUser;
  if(!user) throw new Error("Sesi login tidak ditemukan.");
  const token=await user.getIdToken();
  const u=new URL(supabaseConfig.url+"/rest/v1/"+table);
  u.searchParams.set("select","*");
  u.searchParams.set("limit",String(limit));
  if(order)u.searchParams.set("order",order);
  Object.entries(filters).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u,{headers:{apikey:supabaseConfig.publishableKey,Authorization:"Bearer "+token}});
  if(!r.ok)throw new Error(table+" HTTP "+r.status);
  return r.json();
}

function modal(){return {backdrop:document.getElementById("modalBackdrop"),title:document.getElementById("modalTitle"),sub:document.getElementById("modalSubtitle"),body:document.getElementById("modalBody")}}
function openModal(title,sub="") {const m=modal();m.backdrop.classList.remove("hidden");m.title.textContent=title;m.sub.textContent=sub;m.body.innerHTML='<div class="loading">Memuat data...</div>';return m}
function currentMonth(){return document.getElementById("globalMonth")?.value||""}
function monthFilter(rows){const m=currentMonth();return !m?rows:rows.filter(x=>String(x.tanggal_pelanggaran||"").startsWith(m))}

function caseTable(rows,back){
  if(!rows.length)return'<div class="empty">Tidak ada perkara pada periode ini.</div>';
  return '<div class="analytics-drill-summary"><b>'+rows.length+' perkara</b><span>Klik baris untuk melihat detail perkara dan kendaraan.</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>TNKB</th><th>Pemilik</th><th>Jenis Pelanggaran</th><th>Tanggal</th><th>Status ETLE</th><th>No. Blanko</th></tr></thead><tbody>'+rows.map(x=>'<tr class="clickable analytics-case-row" data-case="'+esc(x.case_id)+'"><td><b>'+esc(x.tnkb||"-")+'</b></td><td>'+esc(x.nama_pemilik||"-")+'</td><td>'+esc(x.jenis_pelanggaran||"-")+'</td><td>'+fmtDate(x.tanggal_pelanggaran)+'</td><td><span class="badge">'+esc(x.status_etle||"-")+'</span></td><td>'+esc(x.no_blanko||"-")+'</td></tr>').join("")+'</tbody></table></div>';
}

async function showCaseDetail(c,back){
  const m=modal();m.title.textContent="Detail Perkara";m.sub.textContent=(c.tnkb||"-")+" · "+(c.ref_number||c.no_registrasi||"");m.body.innerHTML='<div class="loading">Memuat detail kendaraan...</div>';
  let vehicle=null,photos=[];
  try{[vehicle,photos]=await Promise.all([
    query("etle_vehicles",{filters:{case_id:"eq."+c.case_id},limit:1}).then(r=>r[0]||null),
    query("etle_photos",{filters:{case_id:"eq."+c.case_id},order:"sort_order.asc",limit:20})
  ])}catch(e){console.warn(e)}
  const item=(label,value)=>value!=null&&value!==""?'<div class="detail-item"><small>'+label+'</small><b>'+esc(value)+'</b></div>':"";
  m.body.innerHTML='<div class="action-row"><button id="analyticsBack" class="action-btn">← Kembali ke daftar</button></div>'+
    '<section class="detail-section"><h3 class="section-heading">Perkara</h3><div class="detail-grid">'+item("TNKB",c.tnkb)+item("No. Registrasi",c.no_registrasi)+item("Jenis Pelanggaran",c.jenis_pelanggaran)+item("Pasal",c.pasal)+item("Lokasi",c.lokasi)+item("Tanggal Pelanggaran",fmtDate(c.tanggal_pelanggaran))+item("Status ETLE",c.status_etle)+item("No. Blanko",c.no_blanko)+item("No. BRIVA",c.no_briva)+'</div></section>'+
    '<section class="detail-section"><h3 class="section-heading">Kendaraan / BLUE</h3><div class="detail-grid">'+item("Nama Pemilik",vehicle?.nama_pemilik||c.nama_pemilik)+item("Alamat Pemilik",vehicle?.alamat_pemilik)+item("Merk",vehicle?.merk)+item("Tipe",vehicle?.tipe)+item("Jenis Kendaraan",vehicle?.jenis_kendaraan)+item("Masa Berlaku KIR",vehicle?.masa_berlaku_kir?fmtDate(vehicle.masa_berlaku_kir):null)+item("JBB",vehicle?.jbb)+item("JBI",vehicle?.jbi)+'</div></section>'+
    (photos.filter(x=>x.photo_url).length?'<section class="detail-section"><h3 class="section-heading">Foto ETLE</h3><div class="photo-grid">'+photos.filter(x=>x.photo_url).map(x=>'<img src="'+esc(x.photo_url)+'" alt="Foto ETLE">').join("")+'</div></section>':"");
  document.getElementById("analyticsBack").onclick=back;
}

async function showList(kind,label){
  const titles={tnkb:"Riwayat Kendaraan",owner:"Perkara Pemilik",type:"Jenis Pelanggaran"};
  const m=openModal(titles[kind],label);
  try{
    let filter;
    if(kind==="tnkb")filter={tnkb:"ilike."+label};
    else if(kind==="owner")filter={nama_pemilik:"ilike."+label};
    else filter={jenis_pelanggaran:"eq."+label};
    let rows=await query("etle_cases",{filters:filter,order:"tanggal_pelanggaran.desc.nullslast",limit:1000});
    rows=monthFilter(rows);
    const render=()=>{
      m.title.textContent=titles[kind];m.sub.textContent=label;m.body.innerHTML=caseTable(rows);
      m.body.querySelectorAll(".analytics-case-row").forEach(tr=>tr.onclick=()=>{const c=rows.find(x=>String(x.case_id)===tr.dataset.case);if(c)showCaseDetail(c,render)});
    };
    render();
  }catch(e){m.body.innerHTML='<div class="notice">Gagal memuat detail: '+esc(e.message)+'</div>'}
}

function activate(){
  const title=document.getElementById("pageTitle");
  if(title?.textContent.trim()!=="Analitik ETLE")return;
  const panels=[...document.querySelectorAll("#content .grid-3 .panel")];
  const kinds=["tnkb","owner","type"];
  panels.forEach((panel,i)=>{
    panel.querySelectorAll(".bar-row").forEach(row=>{
      row.classList.add("analytics-drill-row");
      row.title="Klik untuk melihat detail";
      row.setAttribute("tabindex","0");
      const run=()=>{const label=row.querySelector(".bar-label")?.getAttribute("title")||row.querySelector(".bar-label")?.textContent?.trim();if(label)showList(kinds[i],label)};
      row.onclick=run;row.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();run()}};
    });
  });
}

const style=document.createElement("style");
style.textContent='.analytics-drill-row{cursor:pointer;border-radius:8px;padding:5px 6px;margin-left:-6px;margin-right:-6px;transition:background .15s,transform .15s}.analytics-drill-row:hover,.analytics-drill-row:focus{background:#eef5ff;transform:translateX(2px);outline:none}.analytics-drill-row:hover .bar-label{text-decoration:underline}.analytics-drill-summary{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:14px;padding:10px 12px;background:#f4f7fb;border-radius:10px}.analytics-drill-summary span{font-size:12px;color:#64748b}@media(max-width:700px){.analytics-drill-summary{align-items:flex-start;flex-direction:column}}';
document.head.appendChild(style);

const observer=new MutationObserver(()=>queueMicrotask(activate));
observer.observe(document.getElementById("content"),{childList:true,subtree:true});
activate();
