import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { firebaseConfig, supabaseConfig } from "./config.js?v=20261002-3";

const $=id=>document.getElementById(id);
const state={profile:null,bundle:null,page:"dashboard",demo:false,month:null,detail:null,detailSource:"OTHER"};
let interactiveLogin=false;
let auth=null,db=null;
const fb=initializeApp(firebaseConfig); auth=getAuth(fb); db=getFirestore(fb);

const menu=[["dashboard","Dashboard"],["shipping","Pengiriman Surat"],["blanko","Blanko Tilang Terbit"],["disputes","Pelanggaran Tersanggah"],["terminated","Pelanggaran Dihentikan"],["court","Persidangan"],["new","Data Baru"],["history","Perpindahan Proses"],["analytics","Analitik ETLE"],["vehicles","Profil Kendaraan"],["search","Pencarian Global"],["report","Laporan ETLE"]];
const icons={dashboard:"⌂",shipping:"✉",blanko:"▣",disputes:"⚑",terminated:"⊘",court:"⚖",new:"+",history:"↻",analytics:"▥",vehicles:"▤",search:"⌕",report:"▧"};
const demo={cases:[{case_id:"demo-1",violation_id:"39567",ref_number:"516-FCBDC-S9319WI",tnkb:"S9319WI",no_registrasi:"516-FCBDC-S9319WI",jenis_pelanggaran:"DAYA ANGKUT",pasal:"Pasal 307",lokasi:"Jl. Raya Guyangan",tanggal_pelanggaran:"2026-09-19T14:09:00+07:00",status_etle:"TERTAGIH",status_bayar:"PAID",no_blanko:"AJ0001039",no_briva:"1682-DEMO-001",tanggal_blanko:"2026-09-20",tanggal_sidang:"2026-09-28",nama_pemilik:"PT MAJU JAYA LOGISTIK",first_seen_at:"2026-09-19T14:20:00+07:00"},{case_id:"demo-2",violation_id:"57993",ref_number:"70F-F02B3-AD8020Y",tnkb:"AD8020Y",jenis_pelanggaran:"DAYA ANGKUT",pasal:"Pasal 307",lokasi:"Jl. Raya Guyangan",tanggal_pelanggaran:"2026-09-21T03:30:40+07:00",status_etle:"TERSANGGAH",status_bayar:"INQUIRY",nama_pemilik:"CV SUMBER REJEKI",first_seen_at:"2026-09-21T04:00:00+07:00"},{case_id:"demo-3",violation_id:"48210",ref_number:"081-DC263-S8324NJ",tnkb:"S8324NJ",jenis_pelanggaran:"DOKUMEN",pasal:"Pasal 288",lokasi:"Jl. Raya Guyangan",tanggal_pelanggaran:"2026-09-17T09:12:00+07:00",status_etle:"DIHENTIKAN",nama_pemilik:"BUDI SANTOSO",first_seen_at:"2026-09-17T10:00:00+07:00"}],shipping:[{shipping_id:"s1",case_id:"demo-1",ref_number:"516-FCBDC-S9319WI",tnkb:"S9319WI",tracking_number:"JNE123456",courier:"JNE",status:"Terkirim",printed_date:"2026-09-19",delivered_at:"2026-09-22T11:00:00+07:00"},{shipping_id:"s2",case_id:"demo-2",ref_number:"70F-F02B3-AD8020Y",tnkb:"AD8020Y",tracking_number:"JNE234567",courier:"JNE",status:"Dalam Proses Pengiriman",printed_date:"2026-09-21"}],disputes:[{dispute_id:"d1",case_id:"demo-2",violation_id:"57993",status:"TERSANGGAH",confirmation_date:"2026-09-21T08:45:00+07:00",reason:"Masih tahap klarifikasi muatan"}],terminated:[{terminated_id:"t1",case_id:"demo-3",ref_number:"081-DC263-S8324NJ",tnkb:"S8324NJ",status:"Dihentikan",reason:"KIR MASIH HIDUP & VALID",officer_name:"Petugas UPPKB",terminated_at:"2026-09-17"}],courts:[{court_id:"c1",case_id:"demo-1",violation_id:"39567",tanggal_sidang:"2026-09-28",pengadilan:"Pengadilan Negeri Nganjuk",status_sidang:"COMPLETED",denda_putusan:150000}],offenders:[{offender_id:"o1",case_id:"demo-1",nama:"PAMBUDI",alamat:"Nganjuk",no_telp:"081234567890",email:"demo@example.com"}],histories:[{history_id:"h1",case_id:"demo-1",event_type:"LETTER_PRINTED",event_time:"2026-09-19T15:00:00+07:00",title:"Surat tilang dicetak",source:"ETLE_SHIPPING"},{history_id:"h2",case_id:"demo-1",event_type:"BLANKO_ISSUED",event_time:"2026-09-20T09:00:00+07:00",title:"Blanko tilang diterbitkan",source:"ETLE_BLANKO"}],syncLogs:[]};
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const norm=v=>String(v??"").trim().toLowerCase();
const ym=v=>{if(!v)return null;const m=String(v).match(/^(\d{4})-(\d{2})/);return m?m[1]+"-"+m[2]:null};
const monthName=v=>{if(!v)return"Semua Data";const [y,m]=v.split("-");return new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(new Date(Number(y),Number(m)-1,1))};
const fmtDate=v=>{if(!v)return"-";const d=new Date(v);if(Number.isNaN(d.getTime()))return esc(v);return new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:String(v).includes("T")?"2-digit":undefined,minute:String(v).includes("T")?"2-digit":undefined,timeZone:"Asia/Jakarta"}).format(d)};
const money=v=>v==null||v===""?"-":"Rp "+new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(Number(v));
const caseById=id=>state.bundle?.cases.find(x=>x.case_id===id);
function rolePermissions(){const normalizedRole=(state.profile?.role||"").trim().toUpperCase();const isAdmin=normalizedRole==="ADMIN";const isWasatpel=normalizedRole==="WASATPEL";return{etleReportVisible:true,etleReportAccessible:isAdmin||isWasatpel,copyPhone:isAdmin||isWasatpel,adminPrivileges:isAdmin}}
const perms=()=>({report:rolePermissions().etleReportAccessible,copyPhone:rolePermissions().copyPhone,admin:rolePermissions().adminPrivileges});
function toast(msg){$("toast").textContent=msg;$("toast").classList.remove("hidden");setTimeout(()=>$("toast").classList.add("hidden"),2600)}
function setSync(t){$("syncState").textContent=t}
function setDesktopSidebarHidden(hidden){
  const shell=document.querySelector(".app-shell");
  if(!shell)return;
  shell.classList.toggle("sidebar-hidden",!!hidden);
  try{localStorage.setItem("gsmart_sidebar_hidden",hidden?"1":"0")}catch(_){}
}
function applySidebarPreference(){
  if(window.matchMedia("(max-width:800px)").matches){
    document.querySelector(".app-shell")?.classList.remove("sidebar-hidden");
    return;
  }
  let hidden=false;
  try{hidden=localStorage.getItem("gsmart_sidebar_hidden")==="1"}catch(_){}
  setDesktopSidebarHidden(hidden);
}
function showApp(){$("loginView").classList.add("hidden");$("appView").classList.remove("hidden");renderProfile();buildMonthOptions();applySidebarPreference();openPage("dashboard")}
function showLogin(){$("appView").classList.add("hidden");$("loginView").classList.remove("hidden")}
function renderProfile(){const p=state.profile||{nama:"Preview Demo",role:"DEMO"};const photo=p.photoUrl?'<img class="profile-photo" src="'+esc(p.photoUrl)+'" alt="Foto profil">':'<div class="profile-fallback">'+esc((p.nama||"G")[0])+'</div>';$("profile").innerHTML='<div class="profile-card">'+photo+'<div class="profile"><b>'+esc(p.nama)+'</b><span>'+esc(p.role)+'</span></div></div>'}
function renderNav(){$("nav").innerHTML=menu.map(([id,t])=>'<button class="nav-btn '+(state.page===id?"active":"")+'" data-id="'+id+'"><span>'+icons[id]+'</span><span>'+t+'</span></button>').join("");$("nav").querySelectorAll("button").forEach(b=>b.onclick=()=>{document.querySelector(".sidebar").classList.remove("open");openPage(b.dataset.id)})}
function buildMonthOptions(){const b=state.bundle||demo;const all=[...b.cases.flatMap(x=>[ym(x.tanggal_pelanggaran),ym(x.tanggal_blanko),ym(x.first_seen_at)]),...b.shipping.map(x=>ym(x.printed_date)),...b.disputes.map(x=>ym(x.confirmation_date)),...b.terminated.map(x=>ym(x.terminated_at)),...b.courts.map(x=>ym(x.tanggal_sidang)),...b.histories.map(x=>ym(x.event_time))].filter(Boolean);const months=[...new Set(all)].sort().reverse();$("globalMonth").innerHTML='<option value="">Semua Data</option>'+months.map(m=>'<option value="'+m+'">'+monthName(m)+'</option>').join("");$("globalMonth").value=state.month||""}
$("globalMonth").onchange=e=>{state.month=e.target.value||null;renderPage()};
function openPage(p){state.page=p;renderNav();const names=Object.fromEntries(menu);$("pageTitle").textContent=names[p];$("pageSub").textContent=p==="dashboard"?"Monitoring ETLE terintegrasi":"Data G-Smart UPPKB Guyangan";if(p==="report"&&!perms().report){$("content").innerHTML='<div class="notice">Role Anda tidak memiliki akses ke Laporan ETLE.</div>';return}renderPage()}
function period(v){return !state.month||ym(v)===state.month}
function activeDisputes(b){const term=new Set(b.terminated.map(x=>x.case_id).filter(Boolean));return b.disputes.filter(x=>period(x.confirmation_date)&&x.case_id&&!term.has(x.case_id))}
function counts(b){return{shipping:b.shipping.filter(x=>period(x.printed_date)).length,blanko:b.cases.filter(x=>x.no_blanko&&period(x.tanggal_blanko)).length,disputes:activeDisputes(b).length,terminated:b.terminated.filter(x=>period(x.terminated_at)).length,court:b.courts.filter(x=>period(x.tanggal_sidang)).length,newData:b.cases.filter(x=>period(x.first_seen_at)).length,transitions:new Set(b.histories.filter(x=>period(x.event_time)&&x.case_id).map(x=>x.case_id)).size,total:b.cases.filter(x=>period(x.tanggal_pelanggaran)).length}}
function filteredRows(page,b){switch(page){case"shipping":return b.shipping.filter(x=>period(x.printed_date));case"blanko":return b.cases.filter(x=>x.no_blanko&&period(x.tanggal_blanko));case"disputes":return activeDisputes(b);case"terminated":return b.terminated.filter(x=>period(x.terminated_at));case"court":return b.courts.filter(x=>period(x.tanggal_sidang));case"new":return b.cases.filter(x=>period(x.first_seen_at));case"history":return b.histories.filter(x=>period(x.event_time));default:return[]}}
function renderPage(){const b=state.bundle||demo;if(state.page==="dashboard")return dashboard(b);if(state.page==="analytics")return analytics(b);if(state.page==="vehicles")return vehicleProfiles(b);if(state.page==="search")return globalSearch(b);if(state.page==="report")return reportPage(b);return processPage(state.page,filteredRows(state.page,b))}
function dashboard(b){
  const c=counts(b);
  const cards=[
    ["Total Perkara",c.total],
    ["Pengiriman Surat",c.shipping],
    ["Blanko Terbit",c.blanko],
    ["Persidangan",c.court],
    ["Tersanggah",c.disputes],
    ["Dihentikan",c.terminated],
    ["Data Baru",c.newData],
    ["Perpindahan Proses",c.transitions]
  ];
  const recent=b.cases.filter(x=>period(x.tanggal_pelanggaran)).sort((a,z)=>String(z.tanggal_pelanggaran).localeCompare(String(a.tanggal_pelanggaran))).slice(0,12);
  const profileName=state.profile?.nama||"Petugas";
  const now=new Date();
  const dateLabel=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric",timeZone:"Asia/Jakarta"}).format(now);
  const timeLabel=new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Jakarta"}).format(now)+" WIB";
  const uniqueTnkb=new Set(b.cases.filter(x=>period(x.tanggal_pelanggaran)&&x.tnkb).map(x=>norm(x.tnkb))).size;
  const railRows=[
    ["＋","Data baru",c.newData],
    ["▣","Blanko terbit",c.blanko],
    ["⚖","Persidangan",c.court],
    ["✓","TNKB unik",uniqueTnkb]
  ];
  $("content").innerHTML=
    '<section class="dashboard-hero">'+
      '<div class="hero-copy"><h1>Selamat datang, '+esc(profileName)+' 👋</h1><h2>G-Smart UPPKB Guyangan</h2><p>Monitoring dan pengelolaan data pelanggaran ETLE secara terintegrasi</p></div>'+
      '<div class="hero-meta"><small>'+esc(dateLabel)+'</small><strong>'+esc(timeLabel)+'</strong><span>'+esc(monthName(state.month))+'</span></div>'+
    '</section>'+
    '<div class="dashboard-layout">'+
      '<div class="dashboard-main">'+
        '<div class="cards dashboard-metrics">'+cards.map(x=>'<div class="card"><div class="metric-label">'+x[0]+'</div><div class="metric-value">'+x[1]+'</div><div class="metric-note">'+monthName(state.month)+'</div></div>').join("")+'</div>'+
        '<div class="grid-2">'+
          '<div class="panel"><div class="title-row"><h3>Perkara terbaru</h3><span class="badge">'+recent.length+' tampil</span></div>'+caseTable(recent)+'</div>'+
          '<div class="panel"><h3 class="section-heading">Status Pengiriman</h3>'+shippingSummary(b.shipping.filter(x=>period(x.printed_date)))+'</div>'+
        '</div>'+
      '</div>'+
      '<aside class="dashboard-rail">'+
        '<div class="panel"><div class="rail-title"><h3>Ringkasan Operasional</h3><span class="badge">'+monthName(state.month)+'</span></div><div class="rail-list">'+railRows.map(r=>'<div class="rail-row"><span class="rail-icon">'+r[0]+'</span><span class="rail-label">'+r[1]+'</span><span class="rail-value">'+r[2]+'</span></div>').join("")+'</div></div>'+
        '<div class="panel"><div class="rail-title"><h3>Quick Access</h3></div><div class="quick-grid">'+
          '<button class="quick-btn" data-go="search"><b>⌕</b>Pencarian Global</button>'+
          '<button class="quick-btn" data-go="vehicles"><b>▤</b>Profil Kendaraan</button>'+
          '<button class="quick-btn" data-go="report"><b>▧</b>Laporan ETLE</button>'+
          '<button class="quick-btn" data-go="analytics"><b>▥</b>Analitik ETLE</button>'+
        '</div></div>'+
      '</aside>'+
    '</div>';
  document.querySelectorAll(".quick-btn[data-go]").forEach(btn=>btn.onclick=()=>openPage(btn.dataset.go));
  bindDetailRows();
}
function shipClass(v){switch(norm(v)){case"tercetak":return["Tercetak",""];case"dalam proses pengiriman":return["Dalam Proses","warn"];case"terkirim":return["Terkirim","success"];case"gagal kirim":return["Gagal Kirim","danger"];case"dikembalikan":return["Dikembalikan","orange"];default:return["Lainnya","gray"]}}
function shippingSummary(rows){const cats=["Tercetak","Dalam Proses","Terkirim","Gagal Kirim","Dikembalikan","Lainnya"];const map=Object.fromEntries(cats.map(x=>[x,0]));rows.forEach(r=>map[shipClass(r.status)[0]]++);return'<div class="status-grid">'+cats.map(k=>'<div class="status-card"><b>'+map[k]+'</b><span>'+k+'</span></div>').join("")+'</div>'}
function processPage(page,rows){
  const titles=Object.fromEntries(menu);
  let extra="";
  if(page==="shipping")extra='<select id="statusFilter"><option value="">Semua Status</option><option>Tercetak</option><option>Dalam Proses</option><option>Terkirim</option><option>Gagal Kirim</option><option>Dikembalikan</option><option>Lainnya</option></select>';
  $("content").innerHTML=
    '<div class="panel">'+
      '<div class="title-row"><h3>'+titles[page]+'</h3><span class="badge" id="resultCount">'+rows.length+' data</span></div>'+
      '<div class="toolbar table-toolbar">'+
        '<div class="search-field-wrap"><span class="search-field-icon">⌕</span><input id="filter" placeholder="Cari TNKB, nomor, status, pemilik..."><button id="clearFilter" class="clear-filter-btn hidden" type="button" title="Hapus pencarian">✕</button></div>'+
        extra+
      '</div>'+
      '<div id="slot">'+genericTable(page,rows)+'</div>'+
    '</div>';
  const apply=()=>{
    const q=norm($("filter").value);
    let r=rows.filter(x=>!q||JSON.stringify(x).toLowerCase().includes(q));
    if(page==="shipping"&&$("statusFilter").value)r=r.filter(x=>shipClass(x.status)[0]===$("statusFilter").value);
    $("slot").innerHTML=genericTable(page,r);
    $("resultCount").textContent=r.length===rows.length?r.length+" data":r.length+" dari "+rows.length+" data";
    $("clearFilter").classList.toggle("hidden",!q);
    bindDetailRows();
  };
  $("filter").oninput=apply;
  $("clearFilter").onclick=()=>{$("filter").value="";apply();$("filter").focus()};
  if($("statusFilter"))$("statusFilter").onchange=apply;
  bindDetailRows();
}
function resolveCaseIdForRecord(page,r){if(!r)return null;const cases=state.bundle?.cases||[];if(r.case_id&&cases.some(c=>c.case_id===r.case_id))return r.case_id;if(page==="shipping"){if(r.ref_number){const byRef=cases.find(c=>norm(c.ref_number)===norm(r.ref_number));if(byRef)return byRef.case_id}if(r.violation_id){const byViolation=cases.find(c=>norm(c.violation_id)===norm(r.violation_id));if(byViolation)return byViolation.case_id}}return r.case_id||null}
function rowCaseId(page,r){return resolveCaseIdForRecord(page,r)}
function genericTable(page,rows){if(!rows.length)return'<div class="empty">Belum ada data pada periode ini.</div>';const defs={shipping:[["tnkb","TNKB"],["tracking_number","No. Resi"],["courier","Kurir"],["status","Status"],["printed_date","Tgl Cetak"]],blanko:[["tnkb","TNKB"],["jenis_pelanggaran","Jenis Pelanggaran"],["tanggal_blanko","Tgl Blanko"],...(rolePermissions().copyPhone?[["__phone","No. Telepon"]]:[]),["no_blanko","No. Blanko"],["no_briva","No. BRIVA"],["status_bayar","Status Bayar"]],disputes:[["violation_id","Violation ID"],["status","Status"],["confirmation_type","Jenis Konfirmasi"],["confirmation_date","Tgl Konfirmasi"],["reason","Alasan"]],terminated:[["tnkb","TNKB"],["status","Status"],["reason","Alasan"],["officer_name","Petugas"],["terminated_at","Tanggal"]],court:[["violation_id","Violation ID"],["tanggal_sidang","Tgl Sidang"],["pengadilan","Pengadilan"],["status_sidang","Status"],["denda_putusan","Denda"]],new:[["tnkb","TNKB"],["jenis_pelanggaran","Jenis Pelanggaran"],["tanggal_pelanggaran","Pelanggaran"],["first_seen_at","Pertama Masuk"],["status_etle","Status ETLE"]],history:[["event_time","Waktu"],["event_type","Event"],["title","Judul"],["source","Sumber"]]};const cols=defs[page]||[];return'<div class="table-wrap"><table class="data-table"><thead><tr>'+cols.map(c=>'<th>'+c[1]+'</th>').join("")+'</tr></thead><tbody>'+rows.map(r=>'<tr class="'+(rowCaseId(page,r)?"clickable":"")+'" data-case="'+esc(rowCaseId(page,r)||"")+'">'+cols.map(([k])=>'<td>'+cell(k,r[k],r)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>'}
function cell(k,v,row=null){if(k==="__phone"){if(!rolePermissions().copyPhone)return"-";const offender=state.bundle?.offenders?.find(o=>o.case_id===row?.case_id);return esc(offender?.no_telp||"-")}if(k.includes("date")||k.includes("tanggal")||k.includes("time")||k==="first_seen_at"||k==="event_time"||k==="terminated_at")return fmtDate(v);if(k.includes("denda")||k.includes("amount"))return money(v);if(k==="status"){const c=shipClass(v);return'<span class="badge '+c[1]+'">'+esc(v||"-")+'</span>'}if(k.includes("status"))return'<span class="badge">'+esc(v||"-")+'</span>';return esc(v||"-")}
function caseTable(rows){if(!rows.length)return'<div class="empty">Belum ada perkara.</div>';const cols=[["tnkb","TNKB"],["jenis_pelanggaran","Jenis Pelanggaran"],["tanggal_pelanggaran","Tanggal Pelanggaran"],["status_etle","Status ETLE"],["no_blanko","No. Blanko"],["no_briva","No. BRIVA"],["nama_pemilik","Nama Pemilik"]];return'<div class="table-wrap"><table class="data-table"><thead><tr>'+cols.map(c=>'<th>'+c[1]+'</th>').join("")+'</tr></thead><tbody>'+rows.map(r=>'<tr class="clickable" data-case="'+esc(r.case_id)+'">'+cols.map(([k])=>'<td>'+cell(k,r[k])+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>'}
function detailSourceForPage(page){return({shipping:"SHIPPING",blanko:"BLANKO",disputes:"DISPUTE",terminated:"TERMINATED",court:"COURT"})[page]||"OTHER"}
function bindDetailRows(){document.querySelectorAll("[data-case]").forEach(r=>r.onclick=()=>{if(!r.dataset.case)return;state.detailSource=detailSourceForPage(state.page);openDetail(r.dataset.case)})}
function analytics(b){const cases=b.cases.filter(x=>period(x.tanggal_pelanggaran));const byTnkb={};const byOwner={};const byType={};cases.forEach(x=>{if(x.tnkb)byTnkb[norm(x.tnkb)]=(byTnkb[norm(x.tnkb)]||{label:x.tnkb,n:0}),byTnkb[norm(x.tnkb)].n++;if(x.nama_pemilik)byOwner[norm(x.nama_pemilik)]=(byOwner[norm(x.nama_pemilik)]||{label:x.nama_pemilik,n:0}),byOwner[norm(x.nama_pemilik)].n++;const t=x.jenis_pelanggaran||"LAINNYA";byType[t]=(byType[t]||0)+1});const rank=o=>Object.values(o).sort((a,z)=>z.n-a.n).slice(0,10);const type=Object.entries(byType).map(([label,n])=>({label,n})).sort((a,z)=>z.n-a.n);const repeat=Object.values(byTnkb).filter(x=>x.n>1).length;const c=counts(b);$("content").innerHTML='<div class="cards"><div class="card"><div class="metric-label">Total Pelanggaran</div><div class="metric-value">'+cases.length+'</div></div><div class="card"><div class="metric-label">TNKB Unik</div><div class="metric-value">'+Object.keys(byTnkb).length+'</div></div><div class="card"><div class="metric-label">Kendaraan >1 Perkara</div><div class="metric-value">'+repeat+'</div></div><div class="card"><div class="metric-label">Blanko Terbit</div><div class="metric-value">'+c.blanko+'</div></div></div><div class="grid-3"><div class="panel"><h3 class="section-heading">TNKB Terbanyak</h3>'+bars(rank(byTnkb))+'</div><div class="panel"><h3 class="section-heading">Pemilik Terbanyak</h3>'+bars(rank(byOwner))+'</div><div class="panel"><h3 class="section-heading">Jenis Pelanggaran</h3>'+bars(type.slice(0,10),true)+'</div></div>'}
function bars(rows,gold=false){if(!rows.length)return'<div class="empty">Belum ada data.</div>';const max=Math.max(...rows.map(x=>x.n),1);return'<div class="chart-list">'+rows.map(x=>'<div class="bar-row"><span class="bar-label" title="'+esc(x.label)+'">'+esc(x.label)+'</span><div class="bar-track"><div class="bar-fill '+(gold?"gold":"")+'" style="width:'+Math.max(3,x.n/max*100)+'%"></div></div><b>'+x.n+'</b></div>').join("")+'</div>'}
function vehicleProfiles(b){const groups={};b.cases.forEach(x=>{const k=norm(x.tnkb);if(!k)return;if(!groups[k])groups[k]={tnkb:x.tnkb,owner:x.nama_pemilik,count:0,latest:null,case_id:x.case_id};groups[k].count++;if(!groups[k].latest||String(x.tanggal_pelanggaran)>String(groups[k].latest))groups[k].latest=x.tanggal_pelanggaran,groups[k].case_id=x.case_id});const rows=Object.values(groups).sort((a,z)=>z.count-a.count);$("content").innerHTML='<div class="panel"><div class="title-row"><h3>Profil Kendaraan</h3><span class="badge">'+rows.length+' kendaraan</span></div><div class="toolbar"><input id="filter" placeholder="Cari TNKB atau pemilik..."></div><div id="slot">'+vehicleTable(rows)+'</div></div>';$("filter").oninput=e=>{$("slot").innerHTML=vehicleTable(rows.filter(r=>JSON.stringify(r).toLowerCase().includes(norm(e.target.value))));bindDetailRows()};bindDetailRows()}
function vehicleTable(rows){return'<div class="table-wrap"><table class="data-table"><thead><tr><th>TNKB</th><th>Nama Pemilik</th><th>Jumlah Perkara</th><th>Pelanggaran Terakhir</th></tr></thead><tbody>'+rows.map(r=>'<tr class="clickable" data-case="'+esc(r.case_id)+'"><td>'+esc(r.tnkb)+'</td><td>'+esc(r.owner||"-")+'</td><td>'+r.count+'</td><td>'+fmtDate(r.latest)+'</td></tr>').join("")+'</tbody></table></div>'}
function searchTerms(v){return norm(v).split(/\s+/).filter(Boolean)}
function caseSearchText(c,b,includePhone=false){
  const offender=b.offenders.find(o=>o.case_id===c.case_id)||{};
  const shipping=b.shipping.find(x=>x.case_id===c.case_id||norm(x.ref_number)===norm(c.ref_number))||{};
  const court=b.courts.find(x=>x.case_id===c.case_id||norm(x.violation_id)===norm(c.violation_id))||{};
  const dispute=b.disputes.find(x=>x.case_id===c.case_id||norm(x.violation_id)===norm(c.violation_id))||{};
  const terminated=b.terminated.find(x=>x.case_id===c.case_id||norm(x.ref_number)===norm(c.ref_number))||{};
  const values=[
    c.case_id,c.violation_id,c.ref_number,c.tnkb,c.no_registrasi,c.jenis_pelanggaran,c.pasal,c.lokasi,
    c.status_etle,c.no_blanko,c.no_briva,c.status_bayar,c.nama_pemilik,
    offender.nama,offender.no_sim,offender.email,
    shipping.tracking_number,shipping.courier,shipping.status,shipping.status_description,
    court.pengadilan,court.status_sidang,court.no_amar_putusan,court.hakim,
    dispute.status,dispute.reason,terminated.status,terminated.reason
  ];
  if(includePhone)values.push(offender.no_telp);
  return values.filter(Boolean).join(" ").toLowerCase()
}
function globalSearch(b){
  $("content").innerHTML=
    '<div class="panel global-search-panel">'+
      '<div class="title-row"><div><h3>Pencarian Global</h3><p class="search-hint">Cari lintas perkara, TNKB, registrasi, blanko, BRIVA, pelanggar, resi, status, dan persidangan.</p></div><span class="badge" id="globalSearchCount">Siap</span></div>'+
      '<div class="toolbar table-toolbar"><div class="search-field-wrap global-search-wrap"><span class="search-field-icon">⌕</span><input id="globalQuery" placeholder="Contoh: AG 9632 UV, AJ0000468, BRIVA, nama pemilik, nomor resi..."><button id="clearGlobalQuery" class="clear-filter-btn hidden" type="button" title="Hapus pencarian">✕</button></div></div>'+
      '<div id="searchResult"><div class="empty">Masukkan minimal 2 karakter untuk mencari.</div></div>'+
    '</div>';
  const run=()=>{
    const raw=$("globalQuery").value;
    const q=norm(raw);
    $("clearGlobalQuery").classList.toggle("hidden",!q);
    if(q.length<2){
      $("globalSearchCount").textContent="Siap";
      $("searchResult").innerHTML='<div class="empty">Masukkan minimal 2 karakter untuk mencari.</div>';
      return;
    }
    const terms=searchTerms(raw);
    const isAdmin=rolePermissions().adminPrivileges;
    const rows=b.cases.filter(c=>{
      const haystack=caseSearchText(c,b,isAdmin);
      return terms.every(t=>haystack.includes(t))
    }).sort((a,z)=>String(z.tanggal_pelanggaran||z.first_seen_at||"").localeCompare(String(a.tanggal_pelanggaran||a.first_seen_at||""))).slice(0,100);
    $("globalSearchCount").textContent=rows.length+(rows.length===100?" hasil teratas":" hasil");
    $("searchResult").innerHTML=rows.length?caseTable(rows):'<div class="empty">Tidak ada perkara yang cocok dengan pencarian tersebut.</div>';
    bindDetailRows();
  };
  $("globalQuery").oninput=run;
  $("clearGlobalQuery").onclick=()=>{$("globalQuery").value="";run();$("globalQuery").focus()};
}
function reportSnapshot(b){const first={};b.histories.forEach(h=>{if(!h.case_id||!h.event_time)return;if(!first[h.case_id]||String(h.event_time)<String(first[h.case_id]))first[h.case_id]=h.event_time});const ids=Object.entries(first).filter(([,v])=>!state.month||ym(v)===state.month).map(([k])=>k);const blanko=new Set(b.cases.filter(x=>x.no_blanko).map(x=>x.case_id));const disputes=new Set(b.disputes.map(x=>x.case_id));const terminated=new Set(b.terminated.map(x=>x.case_id));const shipping=new Set(b.shipping.map(x=>x.case_id));const court=new Set(b.courts.map(x=>x.case_id));const success=ids.filter(id=>blanko.has(id)||disputes.has(id)||terminated.has(id));return{ids,total:ids.length,blanko:ids.filter(x=>blanko.has(x)).length,disputes:ids.filter(x=>disputes.has(x)).length,terminated:ids.filter(x=>terminated.has(x)).length,shipping:ids.filter(x=>shipping.has(x)).length,court:ids.filter(x=>court.has(x)).length,success:success.length,pending:ids.length-success.length}}
function reportText(s){const rate=s.total?s.success*100/s.total:0;const pending=s.total?s.pending*100/s.total:0;return'LAPORAN ETLE UPPKB GUYANGAN\nPeriode: '+monthName(state.month)+'\n\nRingkasan ETLE\n• Total Perkara: '+s.total+'\n• Pengiriman Surat: '+s.shipping+'\n• Blanko Tilang: '+s.blanko+'\n• Tersanggah: '+s.disputes+'\n• Dihentikan: '+s.terminated+'\n• Persidangan: '+s.court+'\n\nSuccess Rate Konfirmasi Pelanggaran\n• Berhasil Konfirmasi: '+s.success+' dari '+s.total+' perkara\n• Success Rate: '+rate.toFixed(2)+'%\n• Belum Konfirmasi: '+s.pending+' perkara ('+pending.toFixed(2)+'%)\n\nSumber: G-SMART UPPKB Guyangan'}
function reportPage(b){const s=reportSnapshot(b);$("content").innerHTML='<div class="cards"><div class="card"><div class="metric-label">Total Perkara</div><div class="metric-value">'+s.total+'</div></div><div class="card"><div class="metric-label">Berhasil Konfirmasi</div><div class="metric-value">'+s.success+'</div></div><div class="card"><div class="metric-label">Belum Konfirmasi</div><div class="metric-value">'+s.pending+'</div></div><div class="card"><div class="metric-label">Success Rate</div><div class="metric-value">'+(s.total?s.success*100/s.total:0).toFixed(1)+'%</div></div></div><div class="panel"><div class="title-row"><h3>Laporan ETLE</h3><div class="action-row"><button id="copyReport" class="action-btn">Salin Ringkasan</button><button id="printReport" class="action-btn primary">Cetak / PDF</button></div></div><div class="report-summary">'+esc(reportText(s))+'</div></div>';$("copyReport").onclick=async()=>{await navigator.clipboard.writeText(reportText(s));toast("Ringkasan laporan disalin")};$("printReport").onclick=()=>window.print()}
async function q(table,{select="*",filters={},order=null,limit=null}={}){const token=state.demo?null:await auth.currentUser.getIdToken(true);const base=new URL(supabaseConfig.url+"/rest/v1/"+table);base.searchParams.set("select",select);if(order)base.searchParams.set("order",order);Object.entries(filters).forEach(([k,v])=>base.searchParams.set(k,v));const h={apikey:supabaseConfig.publishableKey};if(token)h.Authorization="Bearer "+token;const PAGE_SIZE=1000;const requestedLimit=limit==null?null:Math.max(0,Number(limit)||0);if(requestedLimit===0)return[];let offset=0;const rows=[];while(true){const pageLimit=requestedLimit==null?PAGE_SIZE:Math.min(PAGE_SIZE,requestedLimit-rows.length);if(pageLimit<=0)break;const u=new URL(base);u.searchParams.set("limit",String(pageLimit));u.searchParams.set("offset",String(offset));const r=await fetch(u,{headers:h});if(!r.ok)throw new Error(table+" HTTP "+r.status);const page=await r.json();rows.push(...page);if(page.length<pageLimit)break;if(requestedLimit!=null&&rows.length>=requestedLimit)break;offset+=page.length}return requestedLimit==null?rows:rows.slice(0,requestedLimit)}
async function write(table,body,{onConflict=null}={}){const token=await auth.currentUser.getIdToken(true);const u=new URL(supabaseConfig.url+"/rest/v1/"+table);if(onConflict)u.searchParams.set("on_conflict",onConflict);const r=await fetch(u,{method:"POST",headers:{apikey:supabaseConfig.publishableKey,Authorization:"Bearer "+token,"Content-Type":"application/json",Prefer:onConflict?"resolution=merge-duplicates,missing=default,return=minimal":"missing=default,return=minimal"},body:JSON.stringify(body)});if(!r.ok)throw new Error("Gagal menyimpan "+table+" (HTTP "+r.status+")")}
async function openDetail(caseId){$("modalBackdrop").classList.remove("hidden");$("modalBody").innerHTML='<div class="loading">Memuat detail perkara...</div>';const c=caseById(caseId);$("modalTitle").textContent="Detail Perkara";$("modalSubtitle").textContent=(c?.tnkb||"-")+" · "+(c?.ref_number||c?.no_registrasi||"");try{const d=state.demo?demoDetail(caseId):await loadDetail(caseId);state.detail=d;renderDetail(d)}catch(e){$("modalBody").innerHTML='<div class="notice">'+esc(e.message)+'</div>'}}
function demoDetail(id){const c=caseById(id)||demo.cases[0];return{case:c,offender:demo.offenders.find(x=>x.case_id===id),vehicle:{case_id:id,nama_pemilik:c.nama_pemilik,merk:"MITSUBISHI",tipe:"FUSO",jenis_kendaraan:"MOBIL BARANG",tahun_rakit:"2020",bahan_bakar:"SOLAR",jbb:3200,jbi:3100,berat_timbang:3450,berat_lebih:350},photos:[],shipping:demo.shipping.find(x=>x.case_id===id),payment:c.no_blanko?{no_briva:c.no_briva,status_bayar:c.status_bayar,titipan:500000,denda_maksimum:500000,denda_pengadilan:150000,biaya_perkara:5000,nominal_sisa:350000}:null,dispute:demo.disputes.find(x=>x.case_id===id),terminated:demo.terminated.find(x=>x.case_id===id),court:demo.courts.find(x=>x.case_id===id),manual:{kategori_internal:"BELUM_DIPROSES",prioritas:"NORMAL",catatan_ringkas:"Preview"},notes:[],history:demo.histories.filter(x=>x.case_id===id)}}
async function loadDetail(caseId){const c=caseById(caseId);if(!c)throw new Error("Perkara tidak ditemukan.");const one=async(t,f,v)=>{if(!v)return null;const r=await q(t,{filters:{[f]:"eq."+v},limit:1});return r[0]||null};const [offender,vehicle,photos,shipping,payment,dispute,terminated,court,manual,notes,history]=await Promise.all([one("etle_offenders","case_id",caseId),one("etle_vehicles","case_id",caseId),q("etle_photos",{filters:{case_id:"eq."+caseId},order:"sort_order.asc"}),c.ref_number?one("etle_shipping","ref_number",c.ref_number):one("etle_shipping","case_id",caseId),one("etle_payments","case_id",caseId),c.violation_id?one("etle_disputes","violation_id",c.violation_id):one("etle_disputes","case_id",caseId),c.ref_number?one("etle_terminated_cases","ref_number",c.ref_number):one("etle_terminated_cases","case_id",caseId),c.violation_id?one("etle_court_info","violation_id",c.violation_id):one("etle_court_info","case_id",caseId),one("gsmart_case_status","case_id",caseId),q("gsmart_case_notes",{filters:{case_id:"eq."+caseId},order:"created_at.desc"}),q("gsmart_case_history",{filters:{case_id:"eq."+caseId},order:"event_time.desc.nullslast"})]);return{case:c,offender,vehicle,photos,shipping,payment,dispute,terminated,court,manual,notes,history}}
function infoGrid(obj,fields){return'<div class="detail-grid">'+fields.filter(([k])=>obj&&obj[k]!=null&&obj[k]!=="").map(([k,l,t])=>'<div class="detail-item"><small>'+l+'</small><b>'+esc(t==="money"?money(obj[k]):t==="date"?fmtDate(obj[k]):obj[k])+'</b></div>').join("")+'</div>'}
function positiveAmount(v){const n=Number(v);return Number.isFinite(n)&&n>0}
function hasCourtFine(d){return positiveAmount(d?.court?.denda_putusan)||positiveAmount(d?.payment?.denda_pengadilan)}
function kejaksaanUrl(noBlanko){return"https://tilang.kejaksaan.go.id/detail/"+encodeURIComponent(String(noBlanko||"").trim())}
function renderDetail(d){
  const p=perms();
  const c=d.case;
  const phone=d.offender?.no_telp;
  const canWhatsApp=p.admin&&state.detailSource==="BLANKO";
  const phoneAction=p.copyPhone&&phone
    ? '<button class="action-btn" id="copyPhone">Salin Telepon</button>'+(canWhatsApp?'<button class="action-btn gold" id="waBtn">WhatsApp</button>':"")
    : "";
  const kejaksaanAction=c.no_blanko&&hasCourtFine(d)
    ? '<button class="action-btn gold" id="kejaksaanBtn">⚖ Buka E-Tilang Kejaksaan ↗</button>'
    : "";
  const showManualStatus=state.detailSource!=="SHIPPING";
  const photos=d.photos?.filter(x=>x.photo_url)||[];
  const mainPhoto=photos[0]?.photo_url;
  const statusText=c.status_etle||d.shipping?.status||d.court?.status_sidang||"DATA PERKARA";
  const owner=d.vehicle?.nama_pemilik||c.nama_pemilik||d.offender?.nama||"-";
  const vehicleLabel=[d.vehicle?.merk,d.vehicle?.tipe].filter(Boolean).join(" ")||d.vehicle?.jenis_kendaraan||"-";
  const paymentFine=positiveAmount(d?.court?.denda_putusan)?d.court.denda_putusan:(positiveAmount(d?.payment?.denda_pengadilan)?d.payment.denda_pengadilan:null);

  $("modalBody").innerHTML=
    '<section class="detail-hero">'+
      '<div class="detail-photo-main">'+
        (mainPhoto?'<img src="'+esc(mainPhoto)+'" alt="Foto ETLE '+esc(c.tnkb||"")+'">':'<div class="detail-photo-empty"><b>▣</b><span>Foto ETLE belum tersedia</span></div>')+
        (photos.length?'<span class="detail-photo-count">'+photos.length+' foto</span>':'')+
      '</div>'+
      '<div class="detail-identity">'+
        '<div class="detail-identity-top"><span class="detail-tnkb">'+esc(c.tnkb||"-")+'</span><span class="detail-status-chip">'+esc(statusText)+'</span></div>'+
        '<div class="detail-reg detail-reg-action">No. Registrasi &nbsp;<b>'+esc(c.no_registrasi||c.ref_number||"-")+'</b>'+(c.no_registrasi||c.ref_number?'<button class="detail-confirm-btn" id="confirmEtleBtn" type="button">Buka Konfirmasi ↗</button>':'')+(c.tnkb?'<button class="detail-confirm-btn secondary" id="copyTnkbBtn" type="button">Salin TNKB</button>':'')+'</div>'+
        '<div class="detail-key-grid">'+
          '<div class="detail-key"><small>Jenis Pelanggaran</small><strong>'+esc(c.jenis_pelanggaran||"-")+'</strong></div>'+
          '<div class="detail-key"><small>Tanggal Pelanggaran</small><strong>'+fmtDate(c.tanggal_pelanggaran)+'</strong></div>'+
          '<div class="detail-key"><small>Lokasi</small><strong>'+esc(c.lokasi||"-")+'</strong></div>'+
          '<div class="detail-key"><small>Nama Pemilik</small><strong>'+esc(owner)+'</strong></div>'+
        '</div>'+
      '</div>'+
      '<div class="detail-summary-side">'+
        '<div class="detail-summary-card accent"><small>Status Perkara</small><b>'+esc(statusText)+'</b><span>'+esc(c.pasal||"")+'</span></div>'+
        '<div class="detail-summary-card"><small>Kendaraan</small><b>'+esc(vehicleLabel)+'</b><span>'+esc(d.vehicle?.jenis_kendaraan||"")+'</span></div>'+
        '<div class="detail-summary-card"><small>Denda / Putusan</small><b>'+(paymentFine!=null?money(paymentFine):"-")+'</b><span>'+esc(d.payment?.status_bayar||d.court?.status_sidang||"")+'</span></div>'+
      '</div>'+
    '</section>'+

    '<div class="detail-actionbar"><span class="detail-actionbar-label">Aksi Perkara</span><div class="action-row">'+
      '<button class="action-btn primary" id="copyCase">Salin Ringkasan</button>'+phoneAction+kejaksaanAction+
    '</div></div>'+

    '<div class="detail-workspace">'+
      '<div class="detail-main-column">'+
        '<section class="detail-card"><h3 class="detail-card-title"><span class="detail-card-icon">▣</span>Informasi Perkara</h3>'+
          infoGrid(c,[["tnkb","TNKB"],["no_registrasi","No. Registrasi"],["violation_id","Violation ID"],["jenis_pelanggaran","Jenis Pelanggaran"],["pasal","Pasal"],["lokasi","Lokasi"],["tanggal_pelanggaran","Tanggal Pelanggaran","date"],["status_etle","Status ETLE"],["no_blanko","No. Blanko"],["no_briva","No. BRIVA"]])+
        '</section>'+
        '<section class="detail-card"><h3 class="detail-card-title"><span class="detail-card-icon">◉</span>Data Pelanggar</h3>'+
          infoGrid(d.offender,[["nama","Nama"],["alamat","Alamat"],...(p.copyPhone?[["no_telp","No. Telepon"]]:[]),["email","Email"],["no_ktp","No. KTP"],["golongan_sim","Golongan SIM"],["tempat_lahir","Tempat Lahir"],["tanggal_lahir","Tanggal Lahir","date"],["pekerjaan","Pekerjaan"]])+
        '</section>'+
        '<section class="detail-card"><h3 class="detail-card-title"><span class="detail-card-icon">▤</span>Kendaraan & KIR</h3>'+
          infoGrid(d.vehicle,[["nama_pemilik","Nama Pemilik"],["alamat_pemilik","Alamat Pemilik"],["merk","Merk"],["tipe","Tipe"],["jenis_kendaraan","Jenis Kendaraan"],["tahun_rakit","Tahun"],["bahan_bakar","Bahan Bakar"],["no_uji","No. Uji"],["masa_berlaku_kir","Masa Berlaku KIR","date"],["jbb","JBB"],["jbi","JBI"],["berat_timbang","Berat Timbang"],["berat_lebih","Berat Lebih"]])+
        '</section>'+
        (photos.length?'<section class="detail-card"><h3 class="detail-card-title"><span class="detail-card-icon">▧</span>Foto ETLE</h3><div class="detail-photos-strip">'+photos.map(x=>'<img src="'+esc(x.photo_url)+'" alt="'+esc(x.description||x.photo_type||"Foto ETLE")+'">').join("")+'</div></section>':"")+
        '<section class="detail-card"><h3 class="detail-card-title"><span class="detail-card-icon">↻</span>Timeline Perkara</h3>'+timelineSection(d.history||[]).replace('<section class="detail-section"><h3 class="section-heading">Timeline Perkara</h3>','').replace('</section>','')+'</section>'+
      '</div>'+

      '<aside class="detail-side-column">'+
        '<section class="detail-card"><h3 class="detail-card-title"><span class="detail-card-icon">✉</span>Pengiriman Surat</h3>'+
          infoGrid(d.shipping,[["tracking_number","No. Resi"],["courier","Kurir"],["status","Status"],["status_description","Keterangan"],["printed_date","Tanggal Cetak","date"],["delivered_at","Terkirim","date"]])+
        '</section>'+
        '<section class="detail-card"><h3 class="detail-card-title"><span class="detail-card-icon">Rp</span>Pembayaran & Denda</h3>'+
          infoGrid(d.payment,[["no_briva","No. BRIVA"],["status_bayar","Status Bayar"],["titipan","Titipan","money"],["denda_maksimum","Denda Maksimum","money"],["denda_pengadilan","Denda Pengadilan","money"],["biaya_perkara","Biaya Perkara","money"],["nominal_sisa","Sisa","money"],["paid_at","Dibayar","date"]])+
        '</section>'+
        '<section class="detail-card"><h3 class="detail-card-title"><span class="detail-card-icon">⚖</span>Persidangan</h3>'+
          infoGrid(d.court,[["tanggal_sidang","Tanggal Sidang","date"],["pengadilan","Pengadilan"],["hakim","Hakim"],["no_amar_putusan","Amar Putusan"],["denda_putusan","Denda Putusan","money"],["biaya_perkara","Biaya Perkara","money"],["status_sidang","Status"]])+
        '</section>'+
        '<section class="detail-card"><h3 class="detail-card-title"><span class="detail-card-icon">⊘</span>Sanggah / Dihentikan</h3>'+
          infoGrid(d.dispute,[["status","Status Sanggah"],["confirmation_date","Tanggal","date"],["reason","Alasan"],["result","Hasil"]])+
          infoGrid(d.terminated,[["status","Status Dihentikan"],["reason","Alasan"],["officer_name","Petugas"],["terminated_at","Tanggal","date"]])+
        '</section>'+
        (showManualStatus?'<div class="detail-card">'+manualSection(d).replace('<section class="detail-section">','').replace('</section>','')+'</div>':"")+
        '<div class="detail-card">'+notesSection(d).replace('<section class="detail-section">','').replace('</section>','')+'</div>'+
      '</aside>'+
    '</div>';

  if($("copyPhone"))$("copyPhone").onclick=async()=>{await navigator.clipboard.writeText(phone);toast("Nomor telepon disalin")};
  if($("waBtn"))$("waBtn").onclick=()=>openWhatsApp(d);
  if($("kejaksaanBtn"))$("kejaksaanBtn").onclick=()=>window.open(kejaksaanUrl(c.no_blanko),"_blank","noopener,noreferrer");if($("confirmEtleBtn"))$("confirmEtleBtn").onclick=()=>{const reg=String(c.no_registrasi||c.ref_number||"").trim();const tnkb=String(c.tnkb||"").replace(/\s+/g,"").toUpperCase();if(!reg||!tnkb){toast("No. Registrasi atau TNKB belum tersedia");return}const url="https://etilang-djpd.kemenhub.go.id/konfirmasi?ref_number="+encodeURIComponent(reg)+"&plates="+encodeURIComponent(tnkb);window.open(url,"_blank","noopener,noreferrer");toast("Membuka Konfirmasi ETLE otomatis")};if($("copyTnkbBtn"))$("copyTnkbBtn").onclick=async()=>{const tnkb=String(c.tnkb||"").trim();if(!tnkb)return;try{await navigator.clipboard.writeText(tnkb);toast("TNKB disalin")}catch(_){toast("Gagal menyalin TNKB")}};
  $("copyCase").onclick=async()=>{await navigator.clipboard.writeText("TNKB: "+(c.tnkb||"-")+"\nNo. Registrasi: "+(c.no_registrasi||"-")+"\nJenis Pelanggaran: "+(c.jenis_pelanggaran||"-")+"\nNo. Blanko: "+(c.no_blanko||"-")+"\nBRIVA: "+(c.no_briva||"-"));toast("Ringkasan perkara disalin")};
  bindDetailActions(d);
}
function manualSection(d){const m=d.manual||{};if(!perms().admin)return'<section class="detail-section"><h3 class="section-heading">Status Manual G-Smart</h3>'+infoGrid(m,[["kategori_internal","Kategori"],["prioritas","Prioritas"],["status_lebih_bayar","Status Lebih Bayar"],["nominal_lebih_bayar","Nominal Lebih Bayar","money"],["status_pengembalian","Status Pengembalian"],["pic_name","PIC"],["catatan_ringkas","Catatan"]])+'<div class="action-row" style="margin-top:10px"><button class="action-btn" id="deniedManualEdit">🔒 Ubah Status G-SMART</button></div></section>';return'<section class="detail-section"><h3 class="section-heading">Status Manual G-Smart</h3><div class="form-grid"><label>Kategori<select id="manualCategory"><option>BELUM_DIPROSES</option><option>SUDAH_DIKONFIRMASI</option><option>SIAP_SIDANG</option><option>SELESAI</option></select></label><label>Prioritas<select id="manualPriority"><option>NORMAL</option><option>TINGGI</option><option>URGENT</option></select></label><label>Status Lebih Bayar<input id="overStatus" value="'+esc(m.status_lebih_bayar||"")+'"></label><label>Nominal Lebih Bayar<input id="overAmount" type="number" min="0" value="'+esc(m.nominal_lebih_bayar||"")+'"></label><label>Status Pengembalian<input id="refundStatus" value="'+esc(m.status_pengembalian||"")+'"></label><label class="full">Catatan<textarea id="manualNote" rows="3">'+esc(m.catatan_ringkas||"")+'</textarea></label><div class="full"><button id="saveManual" class="primary-btn">Simpan Status G-Smart</button></div></div></section>'}
function notesSection(d){return'<section class="detail-section"><h3 class="section-heading">Catatan Petugas</h3><div class="form-grid"><label class="full">Tambah Catatan<textarea id="newNote" rows="2" placeholder="Tulis catatan petugas..."></textarea></label><div class="full"><button id="addNote" class="action-btn primary">Tambah Catatan</button></div></div><div class="timeline" style="margin-top:14px">'+(d.notes?.length?d.notes.map(n=>'<div class="timeline-item"><b>'+esc(n.created_by_name||"Petugas")+'</b><span>'+esc(n.note)+'</span><small>'+fmtDate(n.created_at)+'</small></div>').join(""):'<div class="empty">Belum ada catatan.</div>')+'</div></section>'}
function timelineSection(rows){return'<section class="detail-section"><h3 class="section-heading">Timeline Perkara</h3><div class="timeline">'+(rows.length?rows.map(h=>'<div class="timeline-item"><b>'+esc(h.title||h.event_type)+'</b><span>'+esc(h.description||h.source||"")+'</span><small>'+fmtDate(h.event_time)+'</small></div>').join(""):'<div class="empty">Belum ada riwayat.</div>')+'</div></section>'}
function bindDetailActions(d){if($("deniedManualEdit"))$("deniedManualEdit").onclick=()=>toast("User Anda tidak mempunyai kewenangan untuk mengubah Status G-SMART. Silakan hubungi Administrator.");if($("manualCategory"))$("manualCategory").value=d.manual?.kategori_internal||"BELUM_DIPROSES";if($("manualPriority"))$("manualPriority").value=d.manual?.prioritas||"NORMAL";if($("saveManual"))$("saveManual").onclick=async()=>{try{setSync("Menyimpan");await write("gsmart_case_status",{case_id:d.case.case_id,kategori_internal:$("manualCategory").value,prioritas:$("manualPriority").value,status_lebih_bayar:$("overStatus").value||null,nominal_lebih_bayar:$("overAmount").value?Number($("overAmount").value):null,status_pengembalian:$("refundStatus").value||null,catatan_ringkas:$("manualNote").value||null,pic_uid:state.profile.uid,pic_name:state.profile.nama,updated_by:state.profile.uid},{onConflict:"case_id"});toast("Status G-Smart disimpan");await refreshDetail()}catch(e){toast(e.message)}finally{setSync("Siap")}};if($("addNote"))$("addNote").onclick=async()=>{const note=$("newNote").value.trim();if(!note)return;try{await write("gsmart_case_notes",{case_id:d.case.case_id,note,created_by:state.profile.uid,created_by_name:state.profile.nama});toast("Catatan ditambahkan");await refreshDetail()}catch(e){toast(e.message)}}}
async function refreshDetail(){const id=state.detail.case.case_id;state.detail=await loadDetail(id);renderDetail(state.detail)}
function openWhatsApp(d){const phone=normalizePhone(d.offender?.no_telp);if(!phone){toast("Nomor WhatsApp tidak valid");return}const c=d.case;let msg="Yth. Bapak/Ibu,\n\nKami dari Response Center ETLE Hub UPPKB Guyangan ingin mengonfirmasi terkait pelanggaran "+(c.jenis_pelanggaran||"ETLE")+" untuk kendaraan:\n\nNo. Polisi: "+(c.tnkb||"-")+"\n\nMohon konfirmasinya agar dapat kami lakukan pengecekan lebih lanjut pada sistem.";if(c.no_blanko&&hasCourtFine(d)){const fine=positiveAmount(d?.court?.denda_putusan)?d.court.denda_putusan:d?.payment?.denda_pengadilan;msg+="\n\nInformasi E-Tilang Kejaksaan:\nNo. Blanko: "+c.no_blanko+"\nDenda Putusan: "+money(fine)+"\nDetail E-Tilang Kejaksaan:\n"+kejaksaanUrl(c.no_blanko)}msg+="\n\nTerima kasih.\n\nResponse Center ETLE Hub UPPKB Guyangan";window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(msg),"_blank")}
function normalizePhone(v){const d=String(v||"").replace(/\D/g,"");if(d.startsWith("08"))return"62"+d.slice(1);if(d.startsWith("628"))return d;return null}
$("closeModal").onclick=()=>$("modalBackdrop").classList.add("hidden");$("modalBackdrop").onclick=e=>{if(e.target===$("modalBackdrop"))$("modalBackdrop").classList.add("hidden")};
async function loadProfile(user){const snap=await getDoc(doc(db,"users",user.uid));if(!snap.exists())throw new Error("Profil petugas belum terdaftar.");const p=snap.data();if(p.aktif===false)throw new Error("Akun Anda tidak aktif. Hubungi administrator.");if(!user.uid||p.aktif!==true)throw new Error("Profil petugas tidak lengkap. Hubungi administrator.");const required=key=>{const value=typeof p[key]==="string"?p[key].trim():"";if(!value)throw new Error("Profil petugas tidak lengkap. Hubungi administrator.");return value};const photoUrl=typeof p.photoUrl==="string"&&p.photoUrl.trim()?p.photoUrl.trim():null;return{uid:user.uid,nama:required("nama"),nip:required("nip"),username:required("username"),role:required("role"),aktif:true,photoUrl}}
async function loadDashboard(){setSync("Sinkronisasi");const[cases,shipping,disputes,terminated,courts,offenders,histories,syncLogs]=await Promise.all([q("etle_cases",{order:"tanggal_pelanggaran.desc.nullslast"}),q("etle_shipping",{order:"printed_date.desc.nullslast"}),q("etle_disputes",{order:"confirmation_date.desc.nullslast"}),q("etle_terminated_cases",{order:"terminated_at.desc.nullslast"}),q("etle_court_info",{order:"tanggal_sidang.desc.nullslast"}),q("etle_offenders",{order:"case_id.asc"}),q("gsmart_case_history",{order:"event_time.desc.nullslast"}),q("gsmart_sync_log",{order:"started_at.desc",limit:30})]);state.bundle={cases,shipping,disputes,terminated,courts,offenders,histories,syncLogs};setSync("Siap")}
$("loginForm").onsubmit=async e=>{e.preventDefault();interactiveLogin=true;$("loginMessage").textContent="Memverifikasi akun...";try{const c=await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value);state.profile=await loadProfile(c.user);state.demo=false;await loadDashboard();$("loginMessage").textContent="";if(window.gsmartPlaySplash)await window.gsmartPlaySplash("post-login");showApp()}catch(err){if(auth.currentUser)await signOut(auth).catch(()=>{});$("loginMessage").textContent=err.message||"Login gagal."}finally{interactiveLogin=false}};
$("demoBtn").onclick=()=>{state.demo=true;state.profile={uid:"demo",nama:"Preview Demo",role:"ADMIN"};state.bundle=demo;showApp()};
$("logoutBtn").onclick=async()=>{state.profile=null;state.bundle=null;state.demo=false;state.month=null;await signOut(auth);showLogin()};
$("menuBtn").onclick=()=>{
  const sidebar=document.querySelector(".sidebar");
  const shell=document.querySelector(".app-shell");
  if(window.matchMedia("(max-width:800px)").matches){
    sidebar?.classList.toggle("open");
  }else{
    setDesktopSidebarHidden(!shell?.classList.contains("sidebar-hidden"));
  }
};
if($("sidebarHideBtn"))$("sidebarHideBtn").onclick=()=>{
  const sidebar=document.querySelector(".sidebar");
  if(window.matchMedia("(max-width:800px)").matches){
    sidebar?.classList.remove("open");
  }else{
    setDesktopSidebarHidden(true);
  }
};
window.addEventListener("resize",()=>{
  if(window.matchMedia("(max-width:800px)").matches){
    document.querySelector(".app-shell")?.classList.remove("sidebar-hidden");
  }else{
    document.querySelector(".sidebar")?.classList.remove("open");
    applySidebarPreference();
  }
});
onAuthStateChanged(auth,async u=>{if(!u||state.demo||interactiveLogin)return;try{state.profile=await loadProfile(u);await loadDashboard();showApp()}catch(e){console.error(e);await signOut(auth);showLogin()}})
