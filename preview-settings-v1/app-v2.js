import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { firebaseConfig, supabaseConfig } from "../config.js?v=20261002-3";
// Salinan preview hanya untuk pemeriksaan menu/role; larang penulisan data operasional.
const PREVIEW_READ_ONLY = true;

const $=id=>document.getElementById(id);
const state={profile:null,bundle:null,page:"dashboard",demo:false,month:null,detail:null,detailSource:"OTHER",dashboardStats:null,historyFocus:null,activityFocus:null,favoriteIds:null,favoritesRemote:false};
let interactiveLogin=false;
let auth=null,db=null;
const fb=initializeApp(firebaseConfig); auth=getAuth(fb); db=getFirestore(fb);

const menu=[["dashboard","Dashboard"],["shipping","Pengiriman Surat"],["blanko","Blanko Tilang Terbit"],["disputes","Pelanggaran Tersanggah"],["archive","Konfirmasi Daya Angkut Sosialisasi"],["terminated","Pelanggaran Dihentikan"],["court","Persidangan"],["new","Pelanggaran Terdata"],["history","Perpindahan Proses"],["analytics","Analitik ETLE"],["vehicles","Profil Kendaraan"],["favorites","Pelanggaran Dipantau"],["search","Pencarian Global"],["report","Laporan ETLE"],["health","Kesehatan Sistem"],["loginHistory","Riwayat Login"],["settings","Pengaturan"],["management","Manajemen"]];
const icons={dashboard:"⌂",shipping:"✉",blanko:"▣",disputes:"⚑",terminated:"⊘",court:"⚖",new:"+",history:"↻",analytics:"▥",vehicles:"▤",archive:"▦",favorites:"★",search:"⌕",report:"▧",health:"♡",loginHistory:"◷",settings:"⚙",management:"▤"};
const demo={cases:[{case_id:"demo-1",violation_id:"39567",ref_number:"516-FCBDC-S9319WI",tnkb:"S9319WI",no_registrasi:"516-FCBDC-S9319WI",jenis_pelanggaran:"DAYA ANGKUT",pasal:"Pasal 307",lokasi:"Jl. Raya Guyangan",tanggal_pelanggaran:"2026-09-19T14:09:00+07:00",status_etle:"TERTAGIH",status_bayar:"PAID",no_blanko:"AJ0001039",no_briva:"1682-DEMO-001",tanggal_blanko:"2026-09-20",tanggal_sidang:"2026-09-28",nama_pemilik:"PT MAJU JAYA LOGISTIK",first_seen_at:"2026-09-19T14:20:00+07:00"},{case_id:"demo-2",violation_id:"57993",ref_number:"70F-F02B3-AD8020Y",tnkb:"AD8020Y",jenis_pelanggaran:"DAYA ANGKUT",pasal:"Pasal 307",lokasi:"Jl. Raya Guyangan",tanggal_pelanggaran:"2026-09-21T03:30:40+07:00",status_etle:"TERSANGGAH",status_bayar:"INQUIRY",nama_pemilik:"CV SUMBER REJEKI",first_seen_at:"2026-09-21T04:00:00+07:00"},{case_id:"demo-3",violation_id:"48210",ref_number:"081-DC263-S8324NJ",tnkb:"S8324NJ",jenis_pelanggaran:"DOKUMEN",pasal:"Pasal 288",lokasi:"Jl. Raya Guyangan",tanggal_pelanggaran:"2026-09-17T09:12:00+07:00",status_etle:"DIHENTIKAN",nama_pemilik:"BUDI SANTOSO",first_seen_at:"2026-09-17T10:00:00+07:00"}],shipping:[{shipping_id:"s1",case_id:"demo-1",ref_number:"516-FCBDC-S9319WI",tnkb:"S9319WI",tracking_number:"JNE123456",courier:"JNE",status:"Terkirim",printed_date:"2026-09-19",delivered_at:"2026-09-22T11:00:00+07:00"},{shipping_id:"s2",case_id:"demo-2",ref_number:"70F-F02B3-AD8020Y",tnkb:"AD8020Y",tracking_number:"JNE234567",courier:"JNE",status:"Dalam Proses Pengiriman",printed_date:"2026-09-21"}],disputes:[{dispute_id:"d1",case_id:"demo-2",violation_id:"57993",status:"TERSANGGAH",confirmation_date:"2026-09-21T08:45:00+07:00",reason:"Masih tahap klarifikasi muatan"}],terminated:[{terminated_id:"t1",case_id:"demo-3",ref_number:"081-DC263-S8324NJ",tnkb:"S8324NJ",status:"Dihentikan",reason:"KIR MASIH HIDUP & VALID",officer_name:"Petugas UPPKB",terminated_at:"2026-09-17"}],courts:[{court_id:"c1",case_id:"demo-1",violation_id:"39567",tanggal_sidang:"2026-09-28",pengadilan:"Pengadilan Negeri Nganjuk",status_sidang:"COMPLETED",denda_putusan:150000}],offenders:[{offender_id:"o1",case_id:"demo-1",nama:"PAMBUDI",alamat:"Nganjuk",no_telp:"081234567890",email:"demo@example.com"}],histories:[{history_id:"h1",case_id:"demo-1",event_type:"LETTER_PRINTED",event_time:"2026-09-19T15:00:00+07:00",title:"Surat Konfirmasi Dicetak",source:"ETLE_SHIPPING"},{history_id:"h2",case_id:"demo-1",event_type:"BLANKO_ISSUED",event_time:"2026-09-20T09:00:00+07:00",title:"Blanko tilang diterbitkan",source:"ETLE_BLANKO"}],syncLogs:[]};
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const norm=v=>String(v??"").trim().toLowerCase();
const ym=v=>{if(!v)return null;const m=String(v).match(/^(\d{4})-(\d{2})/);return m?m[1]+"-"+m[2]:null};
const monthName=v=>{if(!v)return"Semua Data";const [y,m]=v.split("-");return new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(new Date(Number(y),Number(m)-1,1))};
const fmtDate=v=>{if(!v)return"-";const d=new Date(v);if(Number.isNaN(d.getTime()))return esc(v);return new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:String(v).includes("T")?"2-digit":undefined,minute:String(v).includes("T")?"2-digit":undefined,timeZone:"Asia/Jakarta"}).format(d)};
const money=v=>v==null||v===""?"-":"Rp "+new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(Number(v));
const caseById=id=>state.bundle?.cases.find(x=>x.case_id===id);
function favoriteStorageKey(){
  return "gsmart_favorites_"+String(state.profile?.uid||"guest")
}
function favoriteMigrationKey(){
  return "gsmart_favorites_migrated_"+String(state.profile?.uid||"guest")
}
function getLocalFavoriteIds(){
  try{
    const raw=localStorage.getItem(favoriteStorageKey());
    const arr=raw?JSON.parse(raw):[];
    return Array.isArray(arr)?arr.map(String):[]
  }catch(_){return[]}
}
function saveLocalFavoriteIds(ids){
  try{localStorage.setItem(favoriteStorageKey(),JSON.stringify(ids))}catch(_){}
}
function getFavoriteIds(){
  return Array.isArray(state.favoriteIds)?state.favoriteIds:getLocalFavoriteIds()
}
function isFavoriteCase(caseId){return getFavoriteIds().includes(String(caseId))}
async function loadFavoriteIds(){
  const local=getLocalFavoriteIds();
  if(!perms().watchCases){
    state.favoriteIds=[];
    state.favoritesRemote=false;
    return
  }
  if(state.demo||!state.profile?.uid){
    state.favoriteIds=local;
    state.favoritesRemote=false;
    return
  }
  try{
    let rows=await q("gsmart_case_favorites",{select:"case_id",filters:{user_uid:"eq."+state.profile.uid},order:"created_at.desc"});
    let remote=rows.map(x=>String(x.case_id)).filter(Boolean);
    let migrated=false;
    try{migrated=localStorage.getItem(favoriteMigrationKey())==="1"}catch(_){}
    if(!migrated&&local.length){
      const missing=local.filter(id=>!remote.includes(id));
      if(missing.length){
        await write("gsmart_case_favorites",missing.map(case_id=>({user_uid:state.profile.uid,case_id})),{onConflict:"user_uid,case_id"});
        remote=[...new Set([...local,...remote])]
      }
      try{localStorage.setItem(favoriteMigrationKey(),"1")}catch(_){}
    }
    state.favoriteIds=remote;
    state.favoritesRemote=true;
    saveLocalFavoriteIds(remote)
  }catch(err){
    console.warn("Favorite Supabase fallback lokal:",err);
    state.favoriteIds=local;
    state.favoritesRemote=false
  }
}
async function setFavoriteCase(caseId,active){
  const id=String(caseId||"").trim();
  if(!id||!perms().watchCases)return{active:false,remote:false};
  const current=getFavoriteIds();
  const next=active?[id,...current.filter(x=>x!==id)]:current.filter(x=>x!==id);
  state.favoriteIds=next;
  saveLocalFavoriteIds(next);
  if(state.demo||!state.profile?.uid)return{active,remote:false};
  try{
    if(active){
      await write("gsmart_case_favorites",{user_uid:state.profile.uid,case_id:id},{onConflict:"user_uid,case_id"})
    }else{
      await removeRows("gsmart_case_favorites",{user_uid:"eq."+state.profile.uid,case_id:"eq."+id})
    }
    state.favoritesRemote=true;
    return{active,remote:true}
  }catch(err){
    console.warn("Sinkronisasi favorit gagal:",err);
    state.favoritesRemote=false;
    return{active,remote:false}
  }
}
function rolePermissions(){const normalizedRole=(state.profile?.role||"").trim().toUpperCase();const isAdmin=normalizedRole==="ADMIN";const isWasatpel=normalizedRole==="WASATPEL";return{etleReportVisible:true,etleReportAccessible:isAdmin||isWasatpel,copyPhone:isAdmin||isWasatpel,watchCases:isAdmin||isWasatpel,adminPrivileges:isAdmin}}
const perms=()=>({report:rolePermissions().etleReportAccessible,copyPhone:rolePermissions().copyPhone,watchCases:rolePermissions().watchCases,admin:rolePermissions().adminPrivileges});
function toast(msg){$("toast").textContent=msg;$("toast").classList.remove("hidden");setTimeout(()=>$("toast").classList.add("hidden"),2600)}
function syncTimeLabel(when=new Date()){
  return new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Jakarta"}).format(when)+" WIB"
}
function dataStatusTime(v){
  if(!v)return "Belum tersedia";
  const d=new Date(v);
  if(!Number.isFinite(d.getTime()))return "Waktu tidak tersedia";
  return new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Jakarta"}).format(d)+" WIB"
}
function setSync(t){
  const el=$("syncState");
  if(!el)return;
  const label=t==="Siap"&&state.lastDataLoadedAt?"Data dimuat "+syncTimeLabel(state.lastDataLoadedAt):t;
  el.textContent=label;
  const parent=el.closest(".status");
  if(parent)parent.title="Status pemuatan data G-Smart dari Supabase. Bukan status sinkronisasi sumber ETLE Hub.";
}
function sourceSyncSummary(logs){
  const names={SHIPPING:"Pengiriman Surat",BLANKO:"Blanko Tilang",DISPUTES:"Pelanggaran Tersanggah",TERMINATED:"Pelanggaran Dihentikan"};
  const rows=(Array.isArray(logs)?logs:[]).filter(r=>r&&Object.hasOwn(names,String(r.module||"").toUpperCase()))
    .sort((a,b)=>new Date(b.finished_at||b.started_at||0)-new Date(a.finished_at||a.started_at||0));
  const latestByModule=new Map();
  rows.forEach(r=>{const key=String(r.module||"").toUpperCase();if(!latestByModule.has(key))latestByModule.set(key,r)});
  const records=[...latestByModule.values()];
  if(!records.length)return {level:"unknown",label:"Informasi belum tersedia",detail:"Waktu pembaruan terakhir dari ETLE Hub belum dapat ditampilkan."};
  const newest=rows[0];
  const lastRecordedAt=newest.finished_at||newest.started_at;
  const checked=lastRecordedAt?new Date(lastRecordedAt).getTime():NaN;
  const failed=records.some(r=>["FAILED","FAILURE","ERROR"].includes(String(r.status||"").toUpperCase()));
  const partial=records.some(r=>String(r.status||"").toUpperCase()==="PARTIAL"||Number(r.rows_failed)>0);
  const stale=records.some(r=>{const at=r.finished_at||r.started_at;const ms=at?new Date(at).getTime():NaN;return !Number.isFinite(ms)||Date.now()-ms>4*3600000});
  const allSuccess=records.every(r=>String(r.status||"").toUpperCase()==="SUCCESS"&&!(Number(r.rows_failed)>0));
  let level="unknown",label="Perlu diperiksa";
  if(failed){level="danger";label="Ada pembaruan yang gagal"}
  else if(partial){level="warn";label="Sebagian data berhasil diperbarui"}
  else if(records.length<4){level="unknown";label="Informasi tersedia untuk "+records.length+" dari 4 jenis data"}
  else if(stale){level="warn";label="Pembaruan terakhir sudah lama"}
  else if(allSuccess){level="good";label="Pembaruan seluruh jenis data berhasil"}
  const recentLabel=names[String(newest.module||"").toUpperCase()]||"ETLE";
  const when=Number.isFinite(checked)?dataStatusTime(checked):"waktu tidak tersedia";
  return {level,label,detail:"Pembaruan terakhir: "+recentLabel+" · "+when+". Ini bukan informasi kondisi langsung server ETLE Hub."};
}
function gsmartDataStatusHtml(){
  const online=navigator.onLine;
  const loaded=state.demo?"Data contoh":(state.lastDataLoadedAt?dataStatusTime(state.lastDataLoadedAt):"Belum dimuat");
  const sync=state.demo?{level:"unknown",label:"Mode demonstrasi",detail:"Contoh data, tidak terhubung ke sinkronisasi operasional."}:sourceSyncSummary(state.bundle?.syncLogs);
  return '<section id="gsmartDataStatus" class="gsmart-data-status" aria-label="Kejelasan status data">'+
    '<div class="gsmart-data-status-head"><b>Informasi Layanan G-Smart</b><span>Informasi koneksi dan pembaruan data ditampilkan secara terpisah</span></div>'+
    '<div class="gsmart-data-status-grid">'+
      '<div class="gsmart-data-status-cell"><span class="gsmart-data-status-caption">Koneksi Internet</span><strong class="gsmart-data-status-value"><i class="gsmart-data-dot '+(online?"good":"danger")+'"></i>'+(online?"Terhubung":"Tidak terhubung")+'</strong><small>'+(online?"Perangkat terhubung ke jaringan":"Perangkat tidak terhubung ke jaringan")+'</small></div>'+
      '<div class="gsmart-data-status-cell"><span class="gsmart-data-status-caption">Data Berhasil Ditampilkan</span><strong class="gsmart-data-status-value">'+esc(loaded)+'</strong><small>'+ (state.demo?"Menampilkan data contoh":"Waktu terakhir data ditampilkan")+'</small></div>'+
      '<div class="gsmart-data-status-cell gsmart-data-status-source"><span class="gsmart-data-status-caption">Pembaruan Data ETLE Hub</span><strong class="gsmart-data-status-value"><i class="gsmart-data-dot '+sync.level+'"></i>'+esc(sync.label)+'</strong><small>'+esc(sync.detail)+'</small>'+
      (perms().admin&&!state.demo?'<button id="gsmartHealthShortcut" type="button" class="gsmart-data-status-link">Lihat Detail Sistem →</button>':"")+'</div>'+
    '</div></section>';
}
function updateGsmartDataStatus(){
  const slot=$("gsmartDataStatus");
  if(!slot)return;
  slot.outerHTML=gsmartDataStatusHtml();
  $("gsmartHealthShortcut")?.addEventListener("click",()=>openPage("health"));
}
function updateConnectionStatus(){
  const el=$("connectionState");
  const wrap=$("connectionBadge");
  if(!el||!wrap)return;
  const online=navigator.onLine;
  el.textContent=online?"Online":"Offline";
  wrap.classList.toggle("offline",!online);
  wrap.classList.toggle("online",online);
  wrap.title=online?"Perangkat terhubung ke jaringan; status server ETLE Hub tidak diperiksa":"Perangkat sedang offline";
  updateGsmartDataStatus();
}
window.addEventListener("online",()=>{updateConnectionStatus();toast("Koneksi kembali online")});
window.addEventListener("offline",()=>{updateConnectionStatus();toast("Perangkat sedang offline")});
function setDesktopSidebarHidden(hidden){
  const shell=document.querySelector(".app-shell");
  if(!shell)return;
  shell.classList.toggle("sidebar-hidden",!!hidden);
  try{localStorage.setItem("gsmart_sidebar_hidden",hidden?"1":"0")}catch(_){}
}
function applySidebarPreference(){
  if(isMobileLayout()){
    document.querySelector(".app-shell")?.classList.remove("sidebar-hidden");
    return;
  }
  let hidden=false;
  try{hidden=localStorage.getItem("gsmart_sidebar_hidden")==="1"}catch(_){}
  setDesktopSidebarHidden(hidden);
}
function showApp(){$("loginView").classList.add("hidden");$("appView").classList.remove("hidden");renderProfile();buildMonthOptions();applySidebarPreference();updateConnectionStatus();openPage("dashboard");openRequestedCase()}
function showLogin(){$("appView").classList.add("hidden");$("loginView").classList.remove("hidden")}
function renderProfile(){const p=state.profile||{nama:"Preview Demo",role:"DEMO"};const photo=p.photoUrl?'<img class="profile-photo" src="'+esc(p.photoUrl)+'" alt="Foto profil">':'<div class="profile-fallback">'+esc((p.nama||"G")[0])+'</div>';$("profile").innerHTML='<div class="profile-card">'+photo+'<div class="profile"><b>'+esc(p.nama)+'</b><span>'+esc(p.role)+'</span></div></div>'}
function renderNav(){
  const b=state.bundle||demo;
  const c=counts(b);
  const canWatch=perms().watchCases;
  const isAdmin=perms().admin;
  const badgeCounts={shipping:c.shipping,blanko:c.blanko,disputes:c.disputes,terminated:c.terminated,court:c.court,new:c.newData,history:c.transitions,archive:c.archive,favorites:canWatch?getFavoriteIds().length:null};
  $("nav").innerHTML=menu.filter(([id])=>id!=="loginHistory"&&id!=="health"&&(id!=="management"||(isAdmin&&!state.demo))).map(([id,t])=>{
    const n=badgeCounts[id];
    const badge=Number.isFinite(n)?'<span class="nav-badge" aria-label="'+n+' data">'+n+'</span>':(id==="favorites"&&!canWatch?'<span class="nav-lock" aria-label="Akses dibatasi">🔒</span>':"");
    const restricted=id==="favorites"&&!canWatch;
    return '<button class="nav-btn '+(state.page===id?"active ":"")+(restricted?"restricted":"")+'" data-id="'+id+'"'+(restricted?' aria-disabled="true" title="Hanya Admin dan Wasatpel"':"")+'><span class="nav-icon">'+icons[id]+'</span><span class="nav-label">'+t+'</span>'+badge+'</button>'
  }).join("");
  $("nav").querySelectorAll("button").forEach(b=>b.onclick=()=>{
    setMobileSidebarOpen(false);
    if(b.dataset.id==="favorites"&&!perms().watchCases){toast("Pelanggaran Dipantau hanya dapat diakses Admin dan Wasatpel.");return}
    if((b.dataset.id==="loginHistory"||b.dataset.id==="health")&&!perms().admin){toast("Menu ini hanya dapat diakses Admin.");return}
    openPage(b.dataset.id)
  })
}
function buildMonthOptions(){const b=state.bundle||demo;const all=[...b.cases.flatMap(x=>[ym(x.tanggal_pelanggaran),ym(x.tanggal_blanko),ym(x.first_seen_at)]),...b.shipping.map(x=>ym(x.printed_date)),...b.disputes.map(x=>ym(x.confirmation_date)),...b.terminated.map(x=>ym(x.terminated_at)),...b.courts.map(x=>ym(x.tanggal_sidang)),...b.histories.map(x=>ym(x.event_time))].filter(Boolean);const months=[...new Set(all)].sort().reverse();$("globalMonth").innerHTML='<option value="">Semua Data</option>'+months.map(m=>'<option value="'+m+'">'+monthName(m)+'</option>').join("");$("globalMonth").value=state.month||""}
$("globalMonth").onchange=e=>{state.month=e.target.value||null;renderNav();renderPage()};
function openPage(p,{historyFocus=null,activityFocus=null}={}){state.page=p;state.historyFocus=p==="history"?historyFocus:null;state.activityFocus=activityFocus&&activityFocus.page===p?activityFocus:null;renderNav();const names=Object.fromEntries(menu);$("pageTitle").textContent=names[p];$("pageSub").textContent=p==="dashboard"?"Monitoring ETLE terintegrasi":"Data G-Smart UPPKB Guyangan";if(p==="report"&&!perms().report){$("content").innerHTML='<div class="notice">Role Anda tidak memiliki akses ke Laporan ETLE.</div>';return}if(p==="favorites"&&!perms().watchCases){$("content").innerHTML='<div class="notice">Role Anda tidak memiliki akses ke Pelanggaran Dipantau.</div>';return}if((p==="loginHistory"||p==="health")&&!perms().admin){$("content").innerHTML='<div class="notice">Menu ini hanya dapat diakses Admin.</div>';return}if(p==="management"&&(!perms().admin||state.demo)){$("content").innerHTML='<div class="notice">Manajemen hanya dapat diakses Admin aktif.</div>';return}renderPage()}
function period(v){return !state.month||ym(v)===state.month}
function activeDisputes(b){const term=new Set(b.terminated.map(x=>x.case_id).filter(Boolean));return b.disputes.filter(x=>period(x.confirmation_date)&&x.case_id&&!term.has(x.case_id))}
function socializationCaseIds(b){return new Set(b.cases.filter(x=>x.is_archived).map(x=>x.case_id).filter(Boolean))}
function activeShippingRows(b){
  const confirmed=socializationCaseIds(b);
  const confirmedRefs=new Set(b.cases.filter(x=>x.is_archived&&x.ref_number).map(x=>norm(x.ref_number)));
  return b.shipping.filter(x=>!confirmed.has(x.case_id)&&!(x.ref_number&&confirmedRefs.has(norm(x.ref_number))))
}
function counts(b){return{shipping:activeShippingRows(b).filter(x=>period(x.printed_date)).length,blanko:b.cases.filter(x=>x.no_blanko&&period(x.tanggal_blanko)).length,disputes:activeDisputes(b).length,terminated:b.terminated.filter(x=>period(x.terminated_at)).length,court:b.courts.filter(x=>period(x.tanggal_sidang)).length,newData:b.cases.filter(x=>period(x.first_seen_at)).length,transitions:new Set(b.histories.filter(x=>period(x.event_time)&&x.case_id).map(x=>x.case_id)).size,archive:b.cases.filter(x=>x.is_archived&&period(x.archived_at||x.tanggal_pelanggaran)).length,total:b.cases.filter(x=>period(x.tanggal_pelanggaran)).length}}
function latestHistoryPerCase(rows){
  const sorted=[...rows].filter(x=>x?.case_id).sort((a,z)=>String(z.event_time||"").localeCompare(String(a.event_time||"")));
  const seen=new Set();
  return sorted.filter(x=>{if(seen.has(x.case_id))return false;seen.add(x.case_id);return true})
}
function filteredRows(page,b){
  const focus=state.activityFocus?.mode==="today"&&state.activityFocus.page===page?state.activityFocus:null;
  if(focus){
    const day=focus.day;
    switch(page){
      case"new":return b.cases.filter(x=>wibDateKey(x.first_seen_at)===day);
      case"blanko":return b.cases.filter(x=>x.no_blanko&&wibDateKey(x.tanggal_blanko)===day);
      case"shipping":return activeShippingRows(b).filter(x=>wibDateKey(x.printed_date)===day||wibDateKey(x.delivered_at)===day);
      case"disputes":return activeDisputes(b).filter(x=>wibDateKey(x.confirmation_date)===day);
      case"court":return b.courts.filter(x=>wibDateKey(x.tanggal_sidang)===day);
    }
  }
  switch(page){
    case"shipping":return activeShippingRows(b).filter(x=>period(x.printed_date));
    case"blanko":return b.cases.filter(x=>x.no_blanko&&period(x.tanggal_blanko));
    case"disputes":return activeDisputes(b);
    case"terminated":return b.terminated.filter(x=>period(x.terminated_at));
    case"court":return b.courts.filter(x=>period(x.tanggal_sidang));
    case"new":return b.cases.filter(x=>period(x.first_seen_at));
    case"history":
      if(state.historyFocus?.mode==="today-changes"){
        const day=state.historyFocus.day;
        return latestHistoryPerCase(b.histories.filter(x=>x.case_id&&wibDateKey(x.event_time)===day))
      }
      return b.histories.filter(x=>period(x.event_time));
    default:return[]
  }
}
function renderPage(){const b=state.bundle||demo;if(state.page==="dashboard")return dashboard(b);if(state.page==="analytics")return analytics(b);if(state.page==="vehicles")return vehicleProfiles(b);if(state.page==="archive")return archivePage(b);if(state.page==="favorites")return favoritesPage(b);if(state.page==="search")return globalSearch(b);if(state.page==="report")return reportPage(b);if(state.page==="loginHistory")return loginHistoryPage();if(state.page==="health")return healthPage();if(state.page==="settings")return settingsPage();if(state.page==="management")return managementPage();return processPage(state.page,filteredRows(state.page,b))}
function animateDashboardStats(nextStats){
  const previous=state.dashboardStats||{};
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const formatter=new Intl.NumberFormat("id-ID");
  document.querySelectorAll("[data-stat-key][data-stat-value]").forEach((el,index)=>{
    const key=el.dataset.statKey;
    const target=Number(el.dataset.statValue)||0;
    const start=Number(previous[key]);
    const from=Number.isFinite(start)?start:0;
    if(reduced||from===target){el.textContent=formatter.format(target);return}
    const duration=620;
    const delay=Math.min(index*38,220);
    const started=performance.now()+delay;
    const ease=t=>1-Math.pow(1-t,3);
    const step=now=>{
      if(now<started){requestAnimationFrame(step);return}
      const p=Math.min(1,(now-started)/duration);
      const value=Math.round(from+(target-from)*ease(p));
      el.textContent=formatter.format(value);
      if(p<1)requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  state.dashboardStats={...nextStats};
}
function wibDateKey(v=new Date()){
  const d=v instanceof Date?v:new Date(v);
  if(Number.isNaN(d.getTime()))return"";
  const parts=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Jakarta"}).formatToParts(d);
  const map=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return map.year+"-"+map.month+"-"+map.day
}
function buildSmartActivities(b,c){
  const today=wibDateKey();
  const sameDay=v=>v&&wibDateKey(v)===today;
  const todayRows=[
    {id:"new",icon:"＋",count:b.cases.filter(x=>sameDay(x.first_seen_at)).length,label:"pelanggaran terdata hari ini",go:"new"},
    {id:"blanko",icon:"▣",count:b.cases.filter(x=>x.no_blanko&&sameDay(x.tanggal_blanko)).length,label:"blanko terbit hari ini",go:"blanko"},
    {id:"shipping",icon:"✉",count:activeShippingRows(b).filter(x=>sameDay(x.printed_date)||sameDay(x.delivered_at)).length,label:"aktivitas pengiriman hari ini",go:"shipping"},
    {id:"disputes",icon:"⚑",count:activeDisputes(b).filter(x=>sameDay(x.confirmation_date)).length,label:"sanggahan aktif hari ini",go:"disputes"},
    {id:"court",icon:"⚖",count:b.courts.filter(x=>sameDay(x.tanggal_sidang)).length,label:"jadwal sidang hari ini",go:"court"},
    {id:"history",icon:"↻",count:new Set(b.histories.filter(x=>sameDay(x.event_time)&&x.case_id).map(x=>x.case_id)).size,label:"pelanggaran berubah proses hari ini",go:"history"}
  ].filter(x=>x.count>0);

  if(todayRows.length)return todayRows;

  const periodLabel=state.month?monthName(state.month):"periode aktif";
  return [
    {id:"new",icon:"＋",count:c.newData,label:"pelanggaran terdata pada "+periodLabel,go:"new"},
    {id:"blanko",icon:"▣",count:c.blanko,label:"blanko terbit pada "+periodLabel,go:"blanko"},
    {id:"shipping",icon:"✉",count:c.shipping,label:"pengiriman surat pada "+periodLabel,go:"shipping"},
    {id:"disputes",icon:"⚑",count:c.disputes,label:"sanggahan aktif pada "+periodLabel,go:"disputes"},
    {id:"archive",icon:"▦",count:c.archive,label:"konfirmasi Daya Angkut sosialisasi pada "+periodLabel,go:"archive"},
    {id:"court",icon:"⚖",count:c.court,label:"persidangan pada "+periodLabel,go:"court"}
  ].filter(x=>x.count>0).slice(0,5)
}
function bindSmartActivityTracker(){
  const tracker=$("smartActivityTracker");
  if(!tracker)return;
  const items=[...tracker.querySelectorAll(".activity-item")];
  if(!items.length)return;
  let index=0;
  const show=i=>{
    items.forEach((el,n)=>el.classList.toggle("active",n===i));
    tracker.querySelectorAll(".activity-dot").forEach((el,n)=>el.classList.toggle("active",n===i));
  };
  show(0);
  items.forEach(el=>el.onclick=()=>{const go=el.dataset.go;const day=wibDateKey();if(go==="history")openPage("history",{historyFocus:{mode:"today-changes",day}});else openPage(go,{activityFocus:{mode:"today",page:go,day}})});
  tracker.querySelectorAll(".activity-dot").forEach((el,i)=>el.onclick=()=>{index=i;show(index)});
  if(items.length>1&&!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches){
    const timer=setInterval(()=>{
      if(!document.body.contains(tracker)){clearInterval(timer);return}
      if(document.hidden)return;
      index=(index+1)%items.length;
      show(index)
    },4200);
  }
}
function bindHeroParallax(){
  const hero=document.querySelector(".dashboard-hero");
  if(!hero)return;
  const truck=hero.querySelector(".hero-truck-cursor");
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const finePointer=window.matchMedia?.("(hover:hover) and (pointer:fine)")?.matches;
  let raf=0;
  let hideTimer=0;
  let lastTruckX=null;

  const applyParallax=(x,y)=>{
    if(reduced)return;
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      if(!document.body.contains(hero))return;
      hero.style.setProperty("--hero-px",(x*8).toFixed(2)+"px");
      hero.style.setProperty("--hero-py",(y*5).toFixed(2)+"px");
      hero.style.setProperty("--hero-side-x",(x*-5).toFixed(2)+"px");
      hero.style.setProperty("--hero-side-y",(y*-3).toFixed(2)+"px")
    })
  };

  const moveTruck=(clientX,clientY,transient=false)=>{
    if(!truck)return;
    const r=hero.getBoundingClientRect();
    const x=Math.max(16,Math.min(r.width-16,clientX-r.left));
    const y=Math.max(16,Math.min(r.height-16,clientY-r.top));
    const dir=lastTruckX!=null&&x<lastTruckX?-1:1;
    lastTruckX=x;
    truck.style.setProperty("--truck-x",x.toFixed(1)+"px");
    truck.style.setProperty("--truck-y",y.toFixed(1)+"px");
    truck.style.setProperty("--truck-dir",String(dir));
    truck.classList.add("visible");
    truck.classList.toggle("touching",transient);
    clearTimeout(hideTimer);
    if(transient)hideTimer=setTimeout(()=>truck.classList.remove("visible","touching"),720)
  };

  if(finePointer){
    hero.addEventListener("pointerenter",e=>moveTruck(e.clientX,e.clientY),{passive:true});
    hero.addEventListener("pointermove",e=>{
      const r=hero.getBoundingClientRect();
      const x=((e.clientX-r.left)/Math.max(r.width,1)-.5)*2;
      const y=((e.clientY-r.top)/Math.max(r.height,1)-.5)*2;
      applyParallax(Math.max(-1,Math.min(1,x)),Math.max(-1,Math.min(1,y)));
      moveTruck(e.clientX,e.clientY)
    },{passive:true});
    hero.addEventListener("pointerleave",()=>{
      applyParallax(0,0);
      truck?.classList.remove("visible","touching");
      lastTruckX=null
    },{passive:true})
  }else{
    const onScroll=()=>{
      if(!document.body.contains(hero)){window.removeEventListener("scroll",onScroll);return}
      const r=hero.getBoundingClientRect();
      const center=r.top+r.height/2;
      const viewport=window.innerHeight/2;
      const y=Math.max(-1,Math.min(1,(center-viewport)/Math.max(window.innerHeight,1)));
      applyParallax(0,y*.7)
    };
    window.addEventListener("scroll",onScroll,{passive:true});
    onScroll();

    const touchPoint=e=>e.touches?.[0]||e.changedTouches?.[0];
    hero.addEventListener("touchstart",e=>{
      const t=touchPoint(e);
      if(t)moveTruck(t.clientX,t.clientY,true)
    },{passive:true});
    hero.addEventListener("touchmove",e=>{
      const t=touchPoint(e);
      if(t)moveTruck(t.clientX,t.clientY,true)
    },{passive:true});
    hero.addEventListener("touchend",e=>{
      const t=touchPoint(e);
      if(t)moveTruck(t.clientX,t.clientY,true)
    },{passive:true})
  }
}

function dashboard(b){
  const c=counts(b);
  const dashboardStats={total:c.total,shipping:c.shipping,blanko:c.blanko,court:c.court,disputes:c.disputes,archive:c.archive,terminated:c.terminated,newData:c.newData,transitions:c.transitions};
  const smartActivities=buildSmartActivities(b,c);
  const cards=[
    ["Pelanggaran Diproses",c.total,"total","search"],
    ["Pengiriman Surat",c.shipping,"shipping","shipping"],
    ["Blanko Terbit",c.blanko,"blanko","blanko"],
    ["Persidangan",c.court,"court","court"],
    ["Tersanggah",c.disputes,"disputes","disputes"],
    ["Konfirmasi Daya Angkut Sosialisasi",c.archive,"archive","archive"],
    ["Dihentikan",c.terminated,"terminated","terminated"],
    ["Pelanggaran Terdata",c.newData,"newData","new"]
  ];
  const recent=b.cases
    .filter(x=>x.tanggal_pelanggaran&&period(x.tanggal_pelanggaran))
    .sort((a,z)=>new Date(z.tanggal_pelanggaran).getTime()-new Date(a.tanggal_pelanggaran).getTime())
    .slice(0,12);
  const profileName=state.profile?.nama||"Petugas";
  const profileRole=String(state.profile?.role||"PETUGAS").trim().toUpperCase();
  const profilePhoto=String(state.profile?.photoUrl||"").trim();
  const now=new Date();
  const dateLabel=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric",timeZone:"Asia/Jakarta"}).format(now);
  const timeLabel=new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Jakarta"}).format(now)+" WIB";
  const hourWib=Number(new Intl.DateTimeFormat("en-GB",{hour:"2-digit",hour12:false,timeZone:"Asia/Jakarta"}).format(now));
  const greeting=hourWib>=5&&hourWib<11?"Selamat pagi":hourWib>=11&&hourWib<15?"Selamat siang":hourWib>=15&&hourWib<18?"Selamat sore":"Selamat malam";
  const heroTimeClass=hourWib>=5&&hourWib<11?"hero-morning":hourWib>=11&&hourWib<15?"hero-day":hourWib>=15&&hourWib<18?"hero-evening":"hero-night";
  const online=navigator.onLine;
  const syncLabel=$("syncState")?.textContent||"Siap";
  const repeatTnkbCounts={};
  b.cases.filter(x=>period(x.tanggal_pelanggaran)&&x.tnkb).forEach(x=>{
    const key=norm(x.tnkb);
    if(key)repeatTnkbCounts[key]=(repeatTnkbCounts[key]||0)+1;
  });
  const repeatedViolations=Object.values(repeatTnkbCounts).filter(n=>n>1).length;
  const railRows=[
    ["＋","Pelanggaran terdata",c.newData],
    ["▣","Blanko terbit",c.blanko],
    ["⚖","Persidangan",c.court],
    ["↻","Pelanggaran berulang",repeatedViolations]
  ];
  $("content").innerHTML=
    '<section class="dashboard-hero hero-animated '+heroTimeClass+'">'+
      '<div class="hero-building-bg" aria-hidden="true"></div>'+
      '<span class="hero-truck-cursor" aria-hidden="true">🚚</span>'+
      '<div class="hero-content">'+
        '<div class="hero-copy">'+
          '<div class="hero-greeting-row"><span class="hero-greeting">'+esc(greeting)+'</span><span class="hero-wave" aria-hidden="true">👋</span></div>'+
          '<h1>'+esc(profileName)+'</h1>'+
          '<div class="hero-role">'+esc(profileRole)+' · UPPKB Guyangan</div>'+
          '<div class="hero-stats">'+
            '<span><b data-stat-key="total" data-stat-value="'+c.total+'">'+(state.dashboardStats?.total??0)+'</b> Pelanggaran</span>'+
            '<span><b data-stat-key="shipping" data-stat-value="'+c.shipping+'">'+(state.dashboardStats?.shipping??0)+'</b> Pengiriman</span>'+
            '<span><b data-stat-key="blanko" data-stat-value="'+c.blanko+'">'+(state.dashboardStats?.blanko??0)+'</b> Blanko</span>'+
          '</div>'+
          '<div class="hero-status-row">'+
            '<span class="hero-online '+(online?"online":"offline")+'"><i></i>'+(online?"Online":"Offline")+'</span>'+
            '<span class="hero-sync">'+esc(syncLabel)+'</span>'+
            '<button type="button" class="hero-search-btn" data-go="search">⌕ Cari Pelanggaran</button>'+
          '</div>'+
        '</div>'+
        '<div class="hero-side">'+
          '<div class="hero-meta"><small>'+esc(dateLabel)+'</small><strong>'+esc(timeLabel)+'</strong><span>'+esc(monthName(state.month))+'</span></div>'+
          (profilePhoto?'<div class="hero-user-photo-wrap"><span class="hero-user-glow"></span><img class="hero-user-photo" src="'+esc(profilePhoto)+'" alt="Foto '+esc(profileName)+'" decoding="async" fetchpriority="high"></div>':'<div class="hero-user-fallback" aria-label="Foto profil belum tersedia">'+esc((profileName||"P")[0])+'</div>')+
        '</div>'+
      '</div>'+
    '</section>'+
    (smartActivities.length?'<section id="smartActivityTracker" class="smart-activity-tracker" aria-label="Aktivitas G-Smart">'+
      '<div class="activity-label"><span class="activity-live-dot"></span><b>Aktivitas</b></div>'+
      '<div class="activity-stage">'+smartActivities.map((a,i)=>'<button type="button" class="activity-item'+(i===0?" active":"")+'" data-go="'+a.go+'"><span class="activity-icon">'+a.icon+'</span><span><strong>'+a.count+'</strong> '+esc(a.label)+'</span><span class="activity-arrow">›</span></button>').join("")+'</div>'+
      '<div class="activity-dots">'+smartActivities.map((a,i)=>'<button type="button" class="activity-dot'+(i===0?" active":"")+'" aria-label="Aktivitas '+(i+1)+'"></button>').join("")+'</div>'+
    '</section>':"")+
    '<div class="dashboard-layout">'+
      '<div class="dashboard-main">'+
        '<div class="cards dashboard-metrics">'+cards.map(x=>'<button type="button" class="card dashboard-metric-link metric-'+x[2]+'" data-go="'+x[3]+'" aria-label="Buka '+esc(x[0])+'">'+(x[2]==="shipping"?'<span class="metric-jne-logo" aria-label="JNE Express"><img src="https://upload.wikimedia.org/wikipedia/commons/9/92/New_Logo_JNE.png" alt="JNE Express" loading="eager" referrerpolicy="no-referrer"></span>':'')+'<div class="metric-label">'+x[0]+'</div><div class="metric-value" data-stat-key="'+x[2]+'" data-stat-value="'+x[1]+'">'+(state.dashboardStats?.[x[2]]??0)+'</div><div class="metric-note">'+monthName(state.month)+'</div><span class="metric-nav-arrow" aria-hidden="true">›</span></button>').join("")+'</div>'+
        '<div class="grid-2">'+
          '<div class="panel"><div class="title-row"><h3>Pelanggaran Terbaru</h3><span class="badge">'+recent.length+' tampil</span></div>'+caseTable(recent)+'</div>'+
          '<div class="panel"><h3 class="section-heading">Status Pengiriman</h3>'+shippingSummary(activeShippingRows(b).filter(x=>period(x.printed_date)))+'</div>'+
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
    '</div>'+
    gsmartDataStatusHtml();
  animateDashboardStats(dashboardStats);
  $("gsmartHealthShortcut")?.addEventListener("click",()=>openPage("health"));
  bindHeroParallax();
  bindSmartActivityTracker();
  document.querySelectorAll(".quick-btn[data-go], .hero-search-btn[data-go], .dashboard-metric-link[data-go]").forEach(btn=>btn.onclick=()=>openPage(btn.dataset.go));
  bindDetailRows();
}

/* Pengaturan & Manajemen V1: navigasi saja, tanpa perubahan Firebase Auth/Firestore/RLS. */
function settingsPage(){
  const p=state.profile||{};
  const email=state.demo?"Data contoh":(auth.currentUser?.email||"Belum tersedia");
  $("content").innerHTML=
    '<div class="gsmart-admin-hub">'+
      '<div class="panel gsmart-hub-intro"><h3>Pengaturan G-Smart</h3><p>Informasi akun dan preferensi penggunaan aplikasi.</p></div>'+
      '<div class="gsmart-hub-grid">'+
        '<section class="panel gsmart-hub-panel"><h3>Profil Saya</h3><dl class="gsmart-hub-fields">'+
          '<div><dt>Nama petugas</dt><dd>'+esc(p.nama||"-")+'</dd></div>'+
          '<div><dt>Role</dt><dd>'+esc(p.role||"-")+'</dd></div>'+
          '<div><dt>NIP</dt><dd>'+esc(p.nip||"-")+'</dd></div>'+
          '<div><dt>Username</dt><dd>'+esc(p.username||"-")+'</dd></div>'+
          '<div><dt>Email akun</dt><dd>'+esc(email)+'</dd></div>'+
        '</dl><p class="gsmart-hub-note">Data profil dan hak akses dikelola administrator, bukan diubah dari halaman ini.</p></section>'+
        '<section class="panel gsmart-hub-panel"><h3>Preferensi Aplikasi</h3>'+
          '<p>Tampilan G-Smart Vivid Color. Menu dapat disembunyikan pada desktop dengan tombol menu di kiri atas.</p>'+
          '<div class="gsmart-hub-actions"><button type="button" class="action-btn" id="settingsRefreshData">↻ Perbarui data G-Smart</button></div>'+
          '<p class="gsmart-hub-note">Tombol ini memuat ulang data G-Smart yang tersedia, bukan menjalankan sinkronisasi ETLE Hub.</p></section>'+
        '<section class="panel gsmart-hub-panel"><h3>Keamanan Akun</h3>'+
          '<p>Untuk mengatur ulang kata sandi, gunakan fasilitas <b>Lupa password?</b> pada halaman login G-Smart.</p>'+
          '<p class="gsmart-hub-note">Halaman ini tidak mengubah password, role, atau status akun.</p></section>'+
        '<section class="panel gsmart-hub-panel"><h3>Tentang G-Smart</h3>'+
          '<p>G-Smart UPPKB Guyangan · Monitoring ETLE terintegrasi.</p>'+
          '<p class="gsmart-hub-note">Versi Web/PWA. Pengaturan koneksi dan data ETLE tetap menggunakan konfigurasi yang telah berjalan.</p></section>'+
      '</div>'+
    '</div>';
  $("settingsRefreshData")?.addEventListener("click",()=>$("refreshDataBtn")?.click());
}
function managementPage(){
  if(!perms().admin||state.demo){
    $("content").innerHTML='<div class="notice">Manajemen hanya dapat diakses Admin aktif.</div>';
    return;
  }
  $("content").innerHTML=
    '<div class="gsmart-admin-hub">'+
      '<div class="panel gsmart-hub-intro"><h3>Manajemen G-Smart</h3><p>Pusat pemeriksaan operasional dan keamanan aplikasi khusus Admin.</p></div>'+
      '<div class="gsmart-hub-grid">'+
        '<section class="panel gsmart-hub-panel"><h3>Monitoring Sistem</h3>'+
          '<p>Periksa proses pembaruan data, hasil workflow, dan riwayat sinkronisasi yang sudah tersedia.</p>'+
          '<div class="gsmart-hub-actions"><button type="button" class="action-btn primary" id="managementHealth">Kesehatan Sistem →</button></div></section>'+
        '<section class="panel gsmart-hub-panel"><h3>Audit Login</h3>'+
          '<p>Lihat riwayat login akun G-Smart melalui layanan audit yang sudah digunakan.</p>'+
          '<div class="gsmart-hub-actions"><button type="button" class="action-btn primary" id="managementLoginHistory">Riwayat Login →</button></div></section>'+
        '<section class="panel gsmart-hub-panel"><h3>Manajemen Pengguna</h3>'+
          '<p>Pengelolaan pengguna, aktivasi akun, dan perubahan role belum diaktifkan.</p>'+
          '<p class="gsmart-hub-note">Akun tetap dikelola melalui prosedur admin yang berlaku.</p></section>'+
        '<section class="panel gsmart-hub-panel"><h3>Hak Akses</h3>'+
          '<p>Hak akses Admin, Wasatpel, dan Petugas tetap mengikuti aturan aplikasi saat ini.</p>'+
          '<p class="gsmart-hub-note">Halaman ini tidak menyediakan perubahan permission, Firebase, atau Supabase.</p></section>'+
      '</div>'+
    '</div>';
  $("managementHealth")?.addEventListener("click",()=>openPage("health"));
  $("managementLoginHistory")?.addEventListener("click",()=>openPage("loginHistory"));
}

function statusBadgeClass(v){
  const s=norm(v).replace(/[_-]+/g," ");
  if(!s)return"status-neutral";
  if(/terkirim|terbayar|paid|completed|selesai|tert(agih|agih)|confirmed|sudah dikonfirmasi/.test(s))return"status-success";
  if(/tersanggah|sanggah|dispute/.test(s))return"status-purple";
  if(/dihentikan|terminated|gagal|failed|batal/.test(s))return"status-danger";
  if(/sidang|court|siap sidang/.test(s))return"status-indigo";
  if(/blanko|terbit|issued/.test(s))return"status-gold";
  if(/proses|pengiriman|inquiry|pending|menunggu|tercetak|cetak/.test(s))return"status-warning";
  if(/baru|verifikasi|validasi|data di verifikasi/.test(s))return"status-info";
  return"status-neutral"
}
function statusBadge(v){
  return '<span class="status-badge '+statusBadgeClass(v)+'">'+esc(v||"-")+'</span>'
}
function shipClass(v){switch(norm(v)){case"tercetak":return["Tercetak",""];case"dalam proses pengiriman":return["Dalam Proses","warn"];case"terkirim":return["Terkirim","success"];case"gagal kirim":return["Gagal Kirim","danger"];case"dikembalikan":return["Dikembalikan","orange"];default:return["Lainnya","gray"]}}
function shippingSummary(rows){const cats=["Tercetak","Dalam Proses","Terkirim","Gagal Kirim","Dikembalikan","Lainnya"];const map=Object.fromEntries(cats.map(x=>[x,0]));rows.forEach(r=>map[shipClass(r.status)[0]]++);return'<div class="status-grid">'+cats.map(k=>'<div class="status-card"><b>'+map[k]+'</b><span>'+k+'</span></div>').join("")+'</div>'}
function processPage(page,rows){
  const titles=Object.fromEntries(menu);
  let extra="";
  if(page==="shipping")extra='<select id="statusFilter"><option value="">Semua Status</option><option>Tercetak</option><option>Dalam Proses</option><option>Terkirim</option><option>Gagal Kirim</option><option>Dikembalikan</option><option>Lainnya</option></select>';
  const historyFocused=page==="history"&&state.historyFocus?.mode==="today-changes";
  const activityFocused=state.activityFocus?.mode==="today"&&state.activityFocus.page===page;
  const pageTitle=historyFocused?"Perpindahan Proses Hari Ini":activityFocused?titles[page]+" Hari Ini":titles[page];
  const focusNote=historyFocused
    ?"Menampilkan satu perubahan terbaru dari setiap pelanggaran yang berubah proses hari ini."
    :activityFocused
      ?"Menampilkan hanya data yang membentuk angka aktivitas hari ini pada dashboard."
      :"";
  const focusAction=(historyFocused||activityFocused)?'<button type="button" id="showAllFocusedData" class="action-btn history-reset-btn">Lihat Semua Data</button>':"";
  $("content").innerHTML=
    '<div class="panel">'+
      '<div class="title-row"><div><h3>'+pageTitle+'</h3>'+(focusNote?'<p class="history-focus-note">'+focusNote+'</p>':'')+'</div><div class="history-title-actions"><span class="badge" id="resultCount">'+rows.length+' data</span>'+focusAction+'</div></div>'+
      '<div class="toolbar table-toolbar sticky-table-toolbar">'+
        '<div class="search-field-wrap"><span class="search-field-icon">⌕</span><input id="filter" placeholder="Cari TNKB, nomor, status, pemilik..."><button id="clearFilter" class="clear-filter-btn hidden" type="button" title="Hapus pencarian">✕</button></div>'+
        extra+
        '<button id="resetTableFilters" class="toolbar-reset-btn" type="button">Reset Filter</button>'+
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
  if($("resetTableFilters"))$("resetTableFilters").onclick=()=>{$("filter").value="";if($("statusFilter"))$("statusFilter").value="";apply()};
  if($("showAllFocusedData"))$("showAllFocusedData").onclick=()=>openPage(page);
  bindDetailRows();
}
function resolveCaseIdForRecord(page,r){if(!r)return null;const cases=state.bundle?.cases||[];if(r.case_id&&cases.some(c=>c.case_id===r.case_id))return r.case_id;if(page==="shipping"){if(r.ref_number){const byRef=cases.find(c=>norm(c.ref_number)===norm(r.ref_number));if(byRef)return byRef.case_id}if(r.violation_id){const byViolation=cases.find(c=>norm(c.violation_id)===norm(r.violation_id));if(byViolation)return byViolation.case_id}}return r.case_id||null}
function rowCaseId(page,r){return resolveCaseIdForRecord(page,r)}
function genericTable(page,rows){
  if(!rows.length)return'<div class="empty">Belum ada data pada periode ini.</div>';
  const defs={
    shipping:[["tnkb","TNKB"],["tracking_number","No. Resi"],["courier","Kurir"],["status","Status"],["printed_date","Tgl Cetak"]],
    blanko:[["tnkb","TNKB"],["jenis_pelanggaran","Jenis Pelanggaran"],["tanggal_blanko","Tgl Blanko"],...(rolePermissions().copyPhone?[["__phone","No. Telepon"]]:[]),["no_blanko","No. Blanko"],["no_briva","No. BRIVA"],["status_bayar","Status Bayar"]],
    disputes:[["violation_id","Violation ID"],["status","Status"],["confirmation_type","Jenis Konfirmasi"],["confirmation_date","Tgl Konfirmasi"],["reason","Alasan"]],
    terminated:[["tnkb","TNKB"],["status","Status"],["reason","Alasan"],["officer_name","Petugas"],["terminated_at","Tanggal"]],
    court:[["violation_id","Violation ID"],["tanggal_sidang","Tgl Sidang"],["pengadilan","Pengadilan"],["status_sidang","Status"],["denda_putusan","Denda"]],
    new:[["tnkb","TNKB"],["jenis_pelanggaran","Jenis Pelanggaran"],["tanggal_pelanggaran","Pelanggaran"],["first_seen_at","Pertama Masuk"],["status_etle","Status ETLE"]],
    history:[["event_time","Waktu"],["event_type","Event"],["title","Judul"],["source","Sumber"]]
  };
  const cols=defs[page]||[];
  return'<div class="table-wrap responsive-table"><table class="data-table"><thead><tr>'+
    cols.map(c=>'<th>'+c[1]+'</th>').join("")+
    '</tr></thead><tbody>'+
    rows.map(r=>'<tr class="'+(rowCaseId(page,r)?"clickable":"")+'" data-case="'+esc(rowCaseId(page,r)||"")+'">'+
      cols.map(([k,label])=>'<td data-label="'+esc(label)+'">'+cell(k,r[k],r)+'</td>').join("")+
    '</tr>').join("")+
    '</tbody></table></div>'
}
function historyDisplayTitle(h){
  const type=String(h?.event_type||"").toUpperCase();
  if(type==="LETTER_PRINTED")return"Surat Konfirmasi Dicetak";
  if(type==="SOURCE_ARCHIVED")return"Konfirmasi Daya Angkut Sosialisasi";
  if(type==="SOURCE_RESTORED")return"Data kembali tercatat di Pengiriman Surat";
  return h?.title||h?.event_type||"-"
}
function cell(k,v,row=null){
  if(k==="__phone"){
    if(!rolePermissions().copyPhone)return"-";
    const offender=state.bundle?.offenders?.find(o=>o.case_id===row?.case_id);
    return esc(offender?.no_telp||"-")
  }
  if(k==="title"&&row?.event_type)return esc(historyDisplayTitle(row));
  if(k.includes("date")||k.includes("tanggal")||k.includes("time")||k==="first_seen_at"||k==="event_time"||k==="terminated_at")return fmtDate(v);
  if(k.includes("denda")||k.includes("amount"))return money(v);
  if(k==="status"||k.includes("status"))return statusBadge(v);
  return esc(v||"-")
}
function caseTable(rows){
  if(!rows.length)return'<div class="empty">Belum ada pelanggaran.</div>';
  const cols=[["tnkb","TNKB"],["jenis_pelanggaran","Jenis Pelanggaran"],["tanggal_pelanggaran","Tanggal Pelanggaran"],["status_etle","Status ETLE"],["no_blanko","No. Blanko"],["no_briva","No. BRIVA"],["nama_pemilik","Nama Pemilik"]];
  return'<div class="table-wrap responsive-table"><table class="data-table"><thead><tr>'+
    cols.map(c=>'<th>'+c[1]+'</th>').join("")+
    '</tr></thead><tbody>'+
    rows.map(r=>'<tr class="clickable" data-case="'+esc(r.case_id)+'">'+
      cols.map(([k,label])=>'<td data-label="'+esc(label)+'">'+cell(k,r[k],r)+'</td>').join("")+
    '</tr>').join("")+
    '</tbody></table></div>'
}
function detailSourceForPage(page){return({shipping:"SHIPPING",blanko:"BLANKO",disputes:"DISPUTE",terminated:"TERMINATED",court:"COURT"})[page]||"OTHER"}
function bindDetailRows(){document.querySelectorAll("[data-case]").forEach(r=>r.onclick=()=>{if(!r.dataset.case)return;state.detailSource=detailSourceForPage(state.page);openDetail(r.dataset.case)})}
function analytics(b){
  const cases=b.cases.filter(x=>period(x.tanggal_pelanggaran));
  const c=counts(b);
  const byTnkb={};
  const byOwner={};
  const byType={DOKUMEN:0,"DAYA ANGKUT":0,KOMBINASI:0,LAINNYA:0};
  let missingTypeCount=0;
  const daily={};
  const monthly={};

  const classifyType=value=>{
    const s=String(value||"").trim().toUpperCase();
    if(!s)return null;
    if(s.includes("KOMBINASI"))return"KOMBINASI";
    if(s.includes("DOKUMEN"))return"DOKUMEN";
    if(s.includes("DAYA ANGKUT")||s.includes("DAYAANGKUT"))return"DAYA ANGKUT";
    return"LAINNYA"
  };

  const monthLabel=key=>{
    const [y,m]=String(key).split("-");
    if(!y||!m)return key;
    return new Intl.DateTimeFormat("id-ID",{month:"short",year:"numeric"}).format(new Date(Number(y),Number(m)-1,1))
  };
  const dayLabel=key=>{
    const d=new Date(key+"T00:00:00+07:00");
    if(Number.isNaN(d.getTime()))return key;
    return new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short"}).format(d)
  };

  cases.forEach(x=>{
    if(x.tnkb){
      const k=norm(x.tnkb);
      if(k){
        byTnkb[k]=byTnkb[k]||{label:x.tnkb,n:0,case_id:x.case_id,key:k};
        byTnkb[k].n++;
        byTnkb[k].case_id=x.case_id||byTnkb[k].case_id
      }
    }
    if(x.nama_pemilik){
      const k=norm(x.nama_pemilik);
      byOwner[k]=byOwner[k]||{label:x.nama_pemilik,n:0,key:k};
      byOwner[k].n++
    }
    const typeKey=classifyType(x.jenis_pelanggaran);
    if(typeKey)byType[typeKey]++;
    else missingTypeCount++;
    const day=wibDateKey(x.tanggal_pelanggaran);
    if(day)daily[day]=(daily[day]||0)+1
  });

  b.cases.forEach(x=>{
    const m=ym(x.tanggal_pelanggaran);
    if(m)monthly[m]=(monthly[m]||0)+1
  });

  const repeatAll=Object.values(byTnkb).filter(x=>x.n>1).sort((a,z)=>z.n-a.n||String(a.label).localeCompare(String(z.label)));
  const repeatRows=repeatAll.slice(0,12);
  const monthlyRows=Object.entries(monthly).sort((a,z)=>a[0].localeCompare(z[0])).map(([key,n])=>({label:monthLabel(key),n,key}));
  const dailyRows=Object.entries(daily).sort((a,z)=>a[0].localeCompare(z[0])).map(([key,n])=>({label:dayLabel(key),n,key}));
  const topDays=[...dailyRows].sort((a,z)=>z.n-a.n||z.key.localeCompare(a.key)).slice(0,5);
  const typeRows=Object.entries(byType).map(([label,n])=>({label,n,key:label})).filter(x=>x.n>0).sort((a,z)=>z.n-a.n);
  const ownerRows=Object.values(byOwner).sort((a,z)=>z.n-a.n||String(a.label).localeCompare(String(z.label))).slice(0,10);
  const periodLabel=monthName(state.month);

  const metric=(key,label,value,note="")=>'<button type="button" class="card analytics-action analytics-metric" data-analytics-kind="metric" data-analytics-key="'+esc(key)+'"><div class="metric-label">'+esc(label)+'</div><div class="metric-value">'+value+'</div>'+(note?'<div class="metric-note">'+esc(note)+'</div>':'')+'<span class="metric-nav-arrow" aria-hidden="true">›</span></button>';
  const repeatTable=repeatRows.length
    ?'<div class="table-wrap responsive-table"><table class="data-table"><thead><tr><th>TNKB</th><th>Jumlah Pelanggaran</th></tr></thead><tbody>'+repeatRows.map(r=>'<tr class="clickable analytics-repeat-row" data-tnkb-key="'+esc(r.key||norm(r.label))+'"><td data-label="TNKB">'+esc(r.label)+'</td><td data-label="Jumlah Pelanggaran">'+r.n+'</td></tr>').join("")+'</tbody></table></div>'
    :'<div class="empty">Belum ada pelanggaran berulang pada periode ini.</div>';

  $("content").innerHTML=
    '<div class="panel"><div class="title-row"><div><h3>Analitik ETLE</h3><p class="search-hint">Ringkasan analitik pelanggaran ETLE · '+esc(periodLabel)+'</p></div><span class="badge">'+cases.length+' perkara</span></div></div>'+
    '<div class="cards">'+
      metric("total","Pelanggaran Diproses",cases.length,periodLabel)+
      metric("tnkb","Total TNKB",Object.keys(byTnkb).length,periodLabel)+
      metric("repeat","Pelanggaran Berulang",repeatAll.length,"TNKB >1 pelanggaran")+
      metric("blanko","Blanko Terbit",c.blanko,periodLabel)+
      metric("disputes","Tersanggah",c.disputes,periodLabel)+
      metric("terminated","Dihentikan",c.terminated,periodLabel)+
      metric("court","Persidangan",c.court,periodLabel)+
    '</div>'+
    '<div class="grid-2">'+
      '<div class="panel"><div class="title-row"><h3>Tren Bulanan</h3><span class="badge">Klik titik</span></div>'+analyticsLineChart(monthlyRows,{kind:"month"})+'</div>'+
      '<div class="panel analytics-type-panel"><div class="title-row"><div><h3>Jenis Pelanggaran</h3>'+(missingTypeCount?'<p class="search-hint">'+missingTypeCount+' pelanggaran belum memiliki data jenis pelanggaran.</p>':'')+'</div><span class="badge">Klik batang</span></div>'+analyticsBars(typeRows,{gold:true,kind:"type"})+'</div>'+
    '</div>'+
    '<div class="grid-2">'+
      '<div class="panel analytics-daily-panel"><div class="title-row"><h3>Tren Harian · '+esc(periodLabel)+'</h3><span class="badge">Klik titik</span></div>'+analyticsLineChart(dailyRows,{kind:"day"})+'</div>'+
      '<div class="panel analytics-topdays-panel"><div class="title-row"><h3>Hari Dengan Pelanggaran Tertinggi</h3><span class="badge">Klik data</span></div>'+analyticsRankList(topDays,{kind:"day"})+'</div>'+
    '</div>'+
    '<div class="grid-2">'+
      '<div class="panel"><div class="title-row"><h3>Pelanggaran Berulang</h3><span class="badge">'+repeatAll.length+' kendaraan</span></div>'+repeatTable+'</div>'+
      '<div class="panel"><div class="title-row"><h3>Pemilik Terbanyak</h3><span class="badge">Klik untuk detail</span></div>'+ownerBars(ownerRows)+'</div>'+
    '</div>';

  if(window.matchMedia&&window.matchMedia("(max-width: 800px)").matches){
    requestAnimationFrame(()=>{
      const dailyScroll=document.querySelector('.analytics-daily-panel .analytics-line-scroll[data-chart-kind="day"]');
      if(dailyScroll){
        dailyScroll.scrollLeft=Math.max(0,dailyScroll.scrollWidth-dailyScroll.clientWidth);
        const hideHint=()=>{dailyScroll.classList.add("is-scrolled");dailyScroll.removeEventListener("scroll",hideHint)};
        dailyScroll.addEventListener("scroll",hideHint,{passive:true})
      }
    })
  }
  document.querySelectorAll(".analytics-action[data-analytics-kind]").forEach(btn=>{
    btn.onclick=()=>openAnalyticsDetail(btn.dataset.analyticsKind||"",btn.dataset.analyticsKey||"")
  });
  document.querySelectorAll(".analytics-repeat-row").forEach(row=>{
    row.onclick=()=>openAnalyticsDetail("tnkb",row.dataset.tnkbKey||"")
  });
  document.querySelectorAll(".owner-analytics-row").forEach(btn=>{
    btn.onclick=()=>openOwnerAnalyticsDetail(btn.dataset.ownerKey||"")
  })
}
function analyticsLineChart(rows,{kind=""}={}){
  if(!rows.length)return'<div class="empty">Belum ada data.</div>';
  const width=Math.max(620,rows.length*42);
  const height=250,left=42,right=24,top=24,bottom=42;
  const plotW=width-left-right,plotH=height-top-bottom;
  const max=Math.max(...rows.map(x=>Number(x.n)||0),1);
  const x=i=>rows.length===1?left+plotW/2:left+(i*plotW/(rows.length-1));
  const y=n=>top+plotH-(Number(n||0)/max)*plotH;
  const points=rows.map((r,i)=>x(i).toFixed(1)+","+y(r.n).toFixed(1)).join(" ");
  const area=left+","+(top+plotH)+" "+points+" "+(left+plotW)+","+(top+plotH);
  const grid=[0,.25,.5,.75,1].map(p=>{
    const yy=(top+plotH-(p*plotH)).toFixed(1),val=Math.round(max*p);
    return '<line x1="'+left+'" y1="'+yy+'" x2="'+(left+plotW)+'" y2="'+yy+'" class="analytics-grid-line"></line>'+
      '<text x="'+(left-8)+'" y="'+(Number(yy)+4)+'" text-anchor="end" class="analytics-axis-label">'+val+'</text>'
  }).join("");
  const nodes=rows.map((r,i)=>{
    const xx=x(i).toFixed(1),yy=y(r.n).toFixed(1);
    return '<g class="analytics-line-point analytics-action" data-analytics-kind="'+esc(kind)+'" data-analytics-key="'+esc(r.key??r.label)+'" tabindex="0" role="button" aria-label="'+esc(r.label)+': '+r.n+' pelanggaran">'+
      '<circle cx="'+xx+'" cy="'+yy+'" r="5"></circle>'+
      '<text x="'+xx+'" y="'+(Number(yy)-10)+'" text-anchor="middle" class="analytics-point-value">'+r.n+'</text>'+
      '<text x="'+xx+'" y="'+(height-13)+'" text-anchor="middle" class="analytics-axis-label analytics-x-label">'+esc(r.label)+'</text>'+
    '</g>'
  }).join("");
  return '<div class="analytics-line-scroll" data-chart-kind="'+esc(kind)+'"><svg class="analytics-line-chart" viewBox="0 0 '+width+' '+height+'" width="'+width+'" height="'+height+'" aria-label="Grafik tren">'+
    grid+'<polygon points="'+area+'" class="analytics-line-area"></polygon><polyline points="'+points+'" class="analytics-line-path"></polyline>'+nodes+
  '</svg>'+(kind==="day"?'<div class="analytics-swipe-hint" aria-hidden="true">‹ Geser untuk melihat tanggal lainnya ›</div>':'')+'</div>'
}
function analyticsRankList(rows,{kind=""}={}){
  if(!rows.length)return'<div class="empty">Belum ada data.</div>';
  return '<div class="analytics-rank-list">'+rows.map((x,i)=>
    '<button type="button" class="analytics-rank-row analytics-action" data-analytics-kind="'+esc(kind)+'" data-analytics-key="'+esc(x.key??x.label)+'">'+
      '<span><small>'+(i+1)+'</small>'+esc(x.label)+'</span><b>'+x.n+'</b>'+
    '</button>'
  ).join("")+'</div>'
}
function analyticsBars(rows,{gold=false,kind=""}={}){
  if(!rows.length)return'<div class="empty">Belum ada data.</div>';
  const max=Math.max(...rows.map(x=>x.n),1);
  return'<div class="chart-list">'+rows.map(x=>
    '<button type="button" class="bar-row analytics-action" data-analytics-kind="'+esc(kind)+'" data-analytics-key="'+esc(x.key??x.label)+'" title="Lihat detail '+esc(x.label)+'">'+
      '<span class="bar-label">'+esc(x.label)+'</span>'+
      '<span class="bar-track"><span class="bar-fill '+(gold?"gold":"")+'" style="width:'+Math.max(3,x.n/max*100)+'%"></span></span>'+
      '<b>'+x.n+'</b>'+
    '</button>'
  ).join("")+'</div>'
}
function ownerBars(rows){
  if(!rows.length)return'<div class="empty">Belum ada data.</div>';
  const max=Math.max(...rows.map(x=>x.n),1);
  return'<div class="chart-list">'+rows.map(x=>
    '<button type="button" class="bar-row owner-analytics-row" data-owner-key="'+esc(x.key||norm(x.label))+'" title="Lihat detail '+esc(x.label)+'">'+
      '<span class="bar-label">'+esc(x.label)+'</span>'+
      '<span class="bar-track"><span class="bar-fill" style="width:'+Math.max(3,x.n/max*100)+'%"></span></span>'+
      '<b>'+x.n+'</b>'+
    '</button>'
  ).join("")+'</div>'
}
function analyticsCaseTable(rows){
  if(!rows.length)return'<div class="empty">Tidak ada data pada pilihan ini.</div>';
  return'<div class="table-wrap responsive-table"><table class="data-table"><thead><tr><th>TNKB</th><th>Tanggal</th><th>Jenis Pelanggaran</th><th>Pemilik</th><th>Status ETLE</th><th>No. Blanko</th></tr></thead><tbody>'+
    rows.map(r=>'<tr class="clickable" data-case="'+esc(r.case_id||"")+'">'+
      '<td data-label="TNKB">'+esc(r.tnkb||"-")+'</td>'+
      '<td data-label="Tanggal">'+fmtDate(r.tanggal_pelanggaran)+'</td>'+
      '<td data-label="Jenis Pelanggaran">'+esc(r.jenis_pelanggaran||"-")+'</td>'+
      '<td data-label="Pemilik">'+esc(r.nama_pemilik||"-")+'</td>'+
      '<td data-label="Status ETLE">'+statusBadge(r.status_etle||"-")+'</td>'+
      '<td data-label="No. Blanko">'+esc(r.no_blanko||"-")+'</td>'+
    '</tr>').join("")+
  '</tbody></table></div>'
}
function openAnalyticsDetail(kind,key){
  const b=state.bundle||demo;
  const currentCases=b.cases.filter(x=>period(x.tanggal_pelanggaran));
  let rows=[];
  let title="Detail Analitik";
  let subtitle=monthName(state.month);

  if(kind==="metric"){
    if(key==="total"){rows=currentCases;title="Pelanggaran Diproses"}
    else if(key==="tnkb"){
      const groups={};
      currentCases.forEach(x=>{const k=norm(x.tnkb);if(k&&!groups[k])groups[k]=x});
      rows=Object.values(groups);
      title="Total TNKB";
      subtitle=rows.length+" TNKB unik · "+monthName(state.month)
    }else if(key==="repeat"){
      const counts={};
      currentCases.forEach(x=>{const k=norm(x.tnkb);if(k)counts[k]=(counts[k]||0)+1});
      rows=currentCases.filter(x=>(counts[norm(x.tnkb)]||0)>1);
      title="Pelanggaran Berulang"
    }else if(key==="blanko"){rows=currentCases.filter(x=>x.no_blanko);title="Blanko Terbit"}
    else if(key==="disputes"){
      const active=activeDisputes(b);
      const ids=new Set(active.map(x=>x.case_id).filter(Boolean));
      const violations=new Set(active.map(x=>norm(x.violation_id)).filter(Boolean));
      rows=currentCases.filter(x=>ids.has(x.case_id)||violations.has(norm(x.violation_id)));
      title="Pelanggaran Tersanggah"
    }else if(key==="terminated"){
      const items=b.terminated.filter(x=>period(x.terminated_at));
      const ids=new Set(items.map(x=>x.case_id).filter(Boolean));
      const refs=new Set(items.map(x=>norm(x.ref_number)).filter(Boolean));
      rows=currentCases.filter(x=>ids.has(x.case_id)||refs.has(norm(x.ref_number)));
      title="Pelanggaran Dihentikan"
    }else if(key==="court"){
      const items=b.courts.filter(x=>period(x.tanggal_sidang));
      const ids=new Set(items.map(x=>x.case_id).filter(Boolean));
      const violations=new Set(items.map(x=>norm(x.violation_id)).filter(Boolean));
      rows=currentCases.filter(x=>ids.has(x.case_id)||violations.has(norm(x.violation_id)));
      title="Persidangan"
    }
  }else if(kind==="month"){
    rows=b.cases.filter(x=>ym(x.tanggal_pelanggaran)===key);
    title="Tren Bulanan";
    subtitle=monthName(key)
  }else if(kind==="day"){
    rows=currentCases.filter(x=>wibDateKey(x.tanggal_pelanggaran)===key);
    title="Pelanggaran Harian";
    subtitle=key
  }else if(kind==="type"){
    const classify=value=>{
      const s=String(value||"").trim().toUpperCase();
      if(!s)return null;
      if(s.includes("KOMBINASI"))return"KOMBINASI";
      if(s.includes("DOKUMEN"))return"DOKUMEN";
      if(s.includes("DAYA ANGKUT")||s.includes("DAYAANGKUT"))return"DAYA ANGKUT";
      return"LAINNYA"
    };
    rows=currentCases.filter(x=>classify(x.jenis_pelanggaran)===key);
    title="Jenis Pelanggaran";
    subtitle=key+" · "+monthName(state.month)
  }else if(kind==="tnkb"){
    rows=currentCases.filter(x=>norm(x.tnkb)===key);
    title="Detail TNKB";
    subtitle=(rows[0]?.tnkb||key)+" · "+rows.length+" pelanggaran"
  }

  rows=[...rows].sort((a,z)=>String(z.tanggal_pelanggaran||"").localeCompare(String(a.tanggal_pelanggaran||"")));
  $("modalBackdrop").classList.remove("hidden");
  $("modalTitle").textContent=title;
  $("modalSubtitle").textContent=subtitle;
  $("modalBody").innerHTML=
    '<div class="cards owner-detail-metrics">'+
      '<div class="card"><div class="metric-label">Jumlah Data</div><div class="metric-value">'+rows.length+'</div></div>'+
      '<div class="card"><div class="metric-label">TNKB</div><div class="metric-value">'+new Set(rows.map(x=>norm(x.tnkb)).filter(Boolean)).size+'</div></div>'+
      '<div class="card"><div class="metric-label">Blanko</div><div class="metric-value">'+rows.filter(x=>x.no_blanko).length+'</div></div>'+
    '</div>'+
    '<div class="panel owner-detail-panel"><div class="title-row"><h3>Daftar Pelanggaran</h3><span class="badge">'+rows.length+' data</span></div>'+analyticsCaseTable(rows)+'</div>';
  bindDetailRows()
}
function openOwnerAnalyticsDetail(ownerKey){
  const b=state.bundle||demo;
  const rows=b.cases
    .filter(x=>period(x.tanggal_pelanggaran)&&norm(x.nama_pemilik)===ownerKey)
    .sort((a,z)=>String(z.tanggal_pelanggaran||"").localeCompare(String(a.tanggal_pelanggaran||"")));
  if(!rows.length){toast("Data pemilik tidak ditemukan.");return}
  const owner=rows[0].nama_pemilik||"-";
  const uniquePlates=new Set(rows.map(x=>norm(x.tnkb)).filter(Boolean)).size;
  const repeatPlates={};
  rows.forEach(x=>{const k=norm(x.tnkb);if(k)repeatPlates[k]=(repeatPlates[k]||0)+1});
  const repeated=Object.values(repeatPlates).filter(n=>n>1).length;
  $("modalBackdrop").classList.remove("hidden");
  $("modalTitle").textContent="Detail Pemilik";
  $("modalSubtitle").textContent=owner+" · "+monthName(state.month);
  $("modalBody").innerHTML=
    '<div class="cards owner-detail-metrics">'+
      '<div class="card"><div class="metric-label">Total Pelanggaran</div><div class="metric-value">'+rows.length+'</div></div>'+
      '<div class="card"><div class="metric-label">Total TNKB</div><div class="metric-value">'+uniquePlates+'</div></div>'+
      '<div class="card"><div class="metric-label">Pelanggaran Berulang</div><div class="metric-value">'+repeated+'</div></div>'+
    '</div>'+
    '<div class="panel owner-detail-panel"><div class="title-row"><h3>Daftar Pelanggaran</h3><span class="badge">'+rows.length+' data</span></div>'+analyticsCaseTable(rows)+'</div>';
  bindDetailRows()
}
function bars(rows,gold=false){if(!rows.length)return'<div class="empty">Belum ada data.</div>';const max=Math.max(...rows.map(x=>x.n),1);return'<div class="chart-list">'+rows.map(x=>'<div class="bar-row"><span class="bar-label" title="'+esc(x.label)+'">'+esc(x.label)+'</span><div class="bar-track"><div class="bar-fill '+(gold?"gold":"")+'" style="width:'+Math.max(3,x.n/max*100)+'%"></div></div><b>'+x.n+'</b></div>').join("")+'</div>'}
function archivePage(b){
  const rows=b.cases
    .filter(x=>x.is_archived&&period(x.archived_at||x.tanggal_pelanggaran))
    .sort((a,z)=>String(z.archived_at||"").localeCompare(String(a.archived_at||"")));
  $("content").innerHTML=
    '<div class="panel"><div class="title-row"><div><h3>Konfirmasi Daya Angkut Sosialisasi</h3><p class="search-hint">Daftar kendaraan yang telah melakukan konfirmasi pelanggaran Daya Angkut pada masa sosialisasi.</p></div><span class="badge">'+rows.length+' data</span></div></div>'+
    '<div class="panel"><div class="title-row"><h3>Daftar Konfirmasi</h3><span class="badge">'+rows.length+' data</span></div>'+
    (rows.length?'<div class="table-wrap responsive-table"><table class="data-table"><thead><tr><th>TNKB</th><th>Jenis Pelanggaran</th><th>Tanggal Pelanggaran</th><th>Mulai Tidak Tercatat</th></tr></thead><tbody>'+
      rows.map(r=>'<tr class="clickable" data-case="'+esc(r.case_id||"")+'"><td data-label="TNKB">'+esc(r.tnkb||"-")+'</td><td data-label="Jenis Pelanggaran">'+esc(r.jenis_pelanggaran||"-")+'</td><td data-label="Tanggal Pelanggaran">'+fmtDate(r.tanggal_pelanggaran)+'</td><td data-label="Mulai Tidak Tercatat">'+fmtDate(r.source_missing_since)+'</td></tr>').join("")+
    '</tbody></table></div>':'<div class="empty">Belum ada data konfirmasi Daya Angkut Sosialisasi.</div>')+
    '</div>';
  bindDetailRows()
}
function vehicleProfiles(b){const groups={};b.cases.forEach(x=>{const k=norm(x.tnkb);if(!k)return;if(!groups[k])groups[k]={tnkb:x.tnkb,owner:x.nama_pemilik,count:0,latest:null,case_id:x.case_id};groups[k].count++;if(!groups[k].latest||String(x.tanggal_pelanggaran)>String(groups[k].latest))groups[k].latest=x.tanggal_pelanggaran,groups[k].case_id=x.case_id});const rows=Object.values(groups).sort((a,z)=>z.count-a.count);$("content").innerHTML='<div class="panel"><div class="title-row"><h3>Profil Kendaraan</h3><span class="badge">'+rows.length+' kendaraan</span></div><div class="toolbar"><input id="filter" placeholder="Cari TNKB atau pemilik..."></div><div id="slot">'+vehicleTable(rows)+'</div></div>';$("filter").oninput=e=>{$("slot").innerHTML=vehicleTable(rows.filter(r=>JSON.stringify(r).toLowerCase().includes(norm(e.target.value))));bindDetailRows()};bindDetailRows()}
function vehicleTable(rows){return'<div class="table-wrap responsive-table"><table class="data-table"><thead><tr><th>TNKB</th><th>Nama Pemilik</th><th>Jumlah Pelanggaran</th><th>Pelanggaran Terakhir</th></tr></thead><tbody>'+rows.map(r=>'<tr class="clickable" data-case="'+esc(r.case_id)+'"><td data-label="TNKB">'+esc(r.tnkb)+'</td><td data-label="Nama Pemilik">'+esc(r.owner||"-")+'</td><td data-label="Jumlah Pelanggaran">'+r.count+'</td><td data-label="Pelanggaran Terakhir">'+fmtDate(r.latest)+'</td></tr>').join("")+'</tbody></table></div>'}
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
function favoritesPage(b){
  const ids=getFavoriteIds();
  const order=new Map(ids.map((id,i)=>[String(id),i]));
  const rows=b.cases.filter(x=>order.has(String(x.case_id))).sort((a,z)=>order.get(String(a.case_id))-order.get(String(z.case_id)));
  $("content").innerHTML=
    '<div class="panel favorites-panel">'+
      '<div class="title-row"><div><h3>Pelanggaran Dipantau</h3><p class="search-hint">'+(state.favoritesRemote?"Tersinkron ke Supabase dan tersedia di semua perangkat.":"Mode lokal sementara; sinkronisasi Supabase belum aktif.")+'</p></div><span class="badge">'+rows.length+' pelanggaran</span></div>'+
      (rows.length?caseTable(rows):'<div class="empty favorites-empty"><b>☆</b><span>Belum ada pelanggaran yang dipantau.</span><small>Buka Detail Perkara lalu pilih “Pantau”.</small></div>')+
    '</div>';
  bindDetailRows()
}
function globalSearch(b){
  $("content").innerHTML=
    '<div class="panel global-search-panel">'+
      '<div class="title-row"><div><h3>Pencarian Global</h3><p class="search-hint">Cari lintas pelanggaran, TNKB, registrasi, blanko, BRIVA, pelanggar, resi, status, dan persidangan.</p></div><span class="badge" id="globalSearchCount">Siap</span></div>'+
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
    $("searchResult").innerHTML=rows.length?caseTable(rows):'<div class="empty">Tidak ada pelanggaran yang cocok dengan pencarian tersebut.</div>';
    bindDetailRows();
  };
  $("globalQuery").oninput=run;
  $("clearGlobalQuery").onclick=()=>{$("globalQuery").value="";run();$("globalQuery").focus()};
}

const commandItems=[
  {id:"dashboard",label:"Dashboard",icon:"⌂",keys:"D",keywords:"beranda home ringkasan"},
  {id:"shipping",label:"Pengiriman Surat",icon:"✉",keys:"P",keywords:"jne resi kirim"},
  {id:"blanko",label:"Blanko Tilang Terbit",icon:"▣",keys:"B",keywords:"blanko briva bayar"},
  {id:"court",label:"Persidangan",icon:"⚖",keys:"S",keywords:"sidang pengadilan"},
  {id:"disputes",label:"Pelanggaran Tersanggah",icon:"⚑",keys:"",keywords:"sanggah keberatan"},
  {id:"archive",label:"Konfirmasi Daya Angkut Sosialisasi",icon:"▦",keys:"",keywords:"konfirmasi daya angkut sosialisasi"},
  {id:"terminated",label:"Pelanggaran Dihentikan",icon:"⊘",keys:"",keywords:"dihentikan terminated"},
  {id:"new",label:"Pelanggaran Terdata",icon:"+",keys:"N",keywords:"data baru pelanggaran baru terdata masuk"},
  {id:"history",label:"Perpindahan Proses",icon:"↻",keys:"H",keywords:"histori riwayat proses"},
  {id:"analytics",label:"Analitik ETLE",icon:"▥",keys:"A",keywords:"analitik statistik grafik"},
  {id:"vehicles",label:"Profil Kendaraan",icon:"▤",keys:"V",keywords:"kendaraan tnkb"},
  {id:"favorites",label:"Pelanggaran Dipantau",icon:"★",keys:"F",keywords:"pantau favorit watch"},
  {id:"search",label:"Pencarian Global",icon:"⌕",keys:"G",keywords:"cari search"},
  {id:"report",label:"Laporan ETLE",icon:"▧",keys:"",keywords:"laporan report"}
];

function commandPaletteOpen(){return !$("commandPalette")?.classList.contains("hidden")}
function closeCommandPalette(){
  $("commandPalette")?.classList.add("hidden");
  document.body.classList.remove("command-palette-open")
}
function openCommandPalette(mode="command",seed=""){
  if($("appView")?.classList.contains("hidden"))return;
  const modal=$("commandPalette");
  const input=$("commandPaletteInput");
  if(!modal||!input)return;
  modal.classList.remove("hidden");
  document.body.classList.add("command-palette-open");
  input.value=seed;
  input.dataset.mode=mode;
  renderCommandPalette();
  setTimeout(()=>{input.focus();input.select()},20)
}
function commandText(item){return norm([item.label,item.id,item.keywords].join(" "))}
function renderCommandPalette(){
  const input=$("commandPaletteInput");
  const out=$("commandPaletteResults");
  if(!input||!out)return;
  const raw=input.value.trim();
  const q=norm(raw);
  const mode=input.dataset.mode||"command";

  if(mode==="shortcuts"&&!raw){
    out.innerHTML=
      '<div class="cp-section-label">Shortcut keyboard</div>'+
      '<div class="shortcut-grid">'+
        '<div><kbd>Ctrl</kbd><kbd>K</kbd><span>Command Palette / Asisten</span></div>'+
        '<div><kbd>/</kbd><span>Cari atau tanya G-Smart</span></div>'+
        '<div><kbd>D</kbd><span>Dashboard</span></div>'+
        '<div><kbd>P</kbd><span>Pengiriman Surat</span></div>'+
        '<div><kbd>B</kbd><span>Blanko Tilang</span></div>'+
        '<div><kbd>S</kbd><span>Persidangan</span></div>'+
        '<div><kbd>N</kbd><span>Pelanggaran Terdata</span></div>'+
        '<div><kbd>H</kbd><span>Perpindahan Proses</span></div>'+
        '<div><kbd>A</kbd><span>Analitik ETLE</span></div>'+
        '<div><kbd>V</kbd><span>Profil Kendaraan</span></div>'+
        '<div><kbd>F</kbd><span>Pelanggaran Dipantau</span></div>'+
        '<div><kbd>G</kbd><span>Pencarian Global</span></div>'+
        '<div><kbd>R</kbd><span>Refresh data</span></div>'+
        '<div><kbd>Esc</kbd><span>Tutup dialog/detail</span></div>'+
      '</div>';
    return
  }

  if(!q&&mode==="assistant"){
    const firstName=String(state.profile?.nama||"Petugas").trim().split(/\s+/)[0]||"Petugas";
    out.innerHTML=
      '<div class="gita-assistant-welcome">'+
        '<div class="gita-mini-avatar" aria-hidden="true"><span class="gita-mini-eye"></span><span class="gita-mini-eye"></span><i></i></div>'+
        '<div><b>Halo, '+esc(firstName)+'! Saya GITA.</b><p>GITA siap membantu membaca data operasional G-Smart. Tanyakan pelanggaran, blanko, persidangan, kendaraan berulang, atau prioritas hari ini.</p></div>'+
      '</div>'+
      '<div class="cp-section-label cp-ai-label">Pertanyaan cepat <span>read-only</span></div>'+
      ['Apa yang perlu diprioritaskan hari ini?','Berapa blanko yang belum bayar?','Berapa sidang hari ini?','Kendaraan yang punya lebih dari satu pelanggaran'].map(x=>'<button class="cp-suggestion" data-ai-prompt="'+esc(x)+'">'+esc(x)+'</button>').join("");
    bindCommandPaletteActions();
    return
  }

  if(!q){
    out.innerHTML=
      '<div class="cp-section-label">Akses cepat</div>'+
      commandItems.slice(0,7).map(x=>'<button class="cp-result" data-command-page="'+x.id+'"><span class="cp-icon">'+x.icon+'</span><span><b>'+x.label+'</b><small>'+esc(x.keywords.split(" ").slice(0,3).join(" · "))+'</small></span>'+(x.keys?'<kbd>'+x.keys+'</kbd>':'')+'</button>').join("")+
      '<div class="cp-section-label cp-ai-label">✦ Asisten Data G-Smart <span>read-only</span></div>'+
      ['Berapa blanko yang belum bayar?','Kendaraan yang punya lebih dari satu pelanggaran','Berapa sidang hari ini?','Apa yang perlu diprioritaskan hari ini?'].map(x=>'<button class="cp-suggestion" data-ai-prompt="'+esc(x)+'">'+esc(x)+'</button>').join("");
    bindCommandPaletteActions();
    return
  }

  const terms=searchTerms(raw);
  const commands=commandItems.filter(x=>terms.every(t=>commandText(x).includes(t))).slice(0,6);
  const b=state.bundle||demo;
  const isAdmin=rolePermissions().adminPrivileges;
  const cases=q.length>=2?b.cases.filter(c=>terms.every(t=>caseSearchText(c,b,isAdmin).includes(t))).slice(0,5):[];
  out.innerHTML=
    (commands.length?'<div class="cp-section-label">Menu</div>'+commands.map(x=>'<button class="cp-result" data-command-page="'+x.id+'"><span class="cp-icon">'+x.icon+'</span><span><b>'+x.label+'</b><small>Buka menu G-Smart</small></span>'+(x.keys?'<kbd>'+x.keys+'</kbd>':'')+'</button>').join(""):"")+
    (cases.length?'<div class="cp-section-label">Pelanggaran</div>'+cases.map(c=>'<button class="cp-result" data-command-case="'+esc(c.case_id)+'"><span class="cp-icon">🚚</span><span><b>'+esc(c.tnkb||c.ref_number||"Pelanggaran")+'</b><small>'+esc(c.no_registrasi||c.ref_number||c.jenis_pelanggaran||"-")+'</small></span><span class="cp-status">'+esc(c.status_etle||"")+'</span></button>').join(""):"")+
    '<div class="cp-section-label cp-ai-label">✦ Asisten Data G-Smart <span>read-only</span></div>'+
    '<button class="cp-result cp-ai-run" data-ai-prompt="'+esc(raw)+'"><span class="cp-icon">✦</span><span><b>Tanya Asisten</b><small>'+esc(raw)+'</small></span><kbd>Enter</kbd></button>';
  bindCommandPaletteActions()
}
function bindCommandPaletteActions(){
  document.querySelectorAll("[data-command-page]").forEach(btn=>btn.onclick=()=>{
    closeCommandPalette();
    openPage(btn.dataset.commandPage)
  });
  document.querySelectorAll("[data-command-case]").forEach(btn=>btn.onclick=()=>{
    const id=btn.dataset.commandCase;
    closeCommandPalette();
    state.detailSource="OTHER";
    openDetail(id)
  });
  document.querySelectorAll("[data-ai-prompt]").forEach(btn=>btn.onclick=()=>{
    const prompt=btn.dataset.aiPrompt||"";
    if($("commandPaletteInput"))$("commandPaletteInput").value=prompt;
    runAssistantQuery(prompt)
  })
}
function monthKeyFromAssistantText(text){
  const months={januari:"01",februari:"02",maret:"03",april:"04",mei:"05",juni:"06",juli:"07",agustus:"08",september:"09",oktober:"10",november:"11",desember:"12"};
  const q=norm(text);
  const entry=Object.entries(months).find(([name])=>q.includes(name));
  if(!entry)return state.month||null;
  const yearMatch=q.match(/\b(20\d{2})\b/);
  const currentYear=new Intl.DateTimeFormat("en",{year:"numeric",timeZone:"Asia/Jakarta"}).format(new Date());
  return (yearMatch?.[1]||currentYear)+"-"+entry[1]
}
function assistantDateFilter(rows,dateGetter,question){
  const q=norm(question);
  if(q.includes("hari ini")){
    const today=wibDateKey();
    return rows.filter(x=>wibDateKey(dateGetter(x))===today)
  }
  const month=monthKeyFromAssistantText(question);
  if(month)return rows.filter(x=>ym(dateGetter(x))===month);
  return rows
}
function assistantCaseButton(c){
  return '<button class="assistant-case" data-command-case="'+esc(c.case_id)+'"><b>'+esc(c.tnkb||"-")+'</b><span>'+esc(c.no_registrasi||c.ref_number||c.jenis_pelanggaran||"-")+'</span><small>'+esc(c.status_etle||"-")+'</small></button>'
}
function assistantAnswerHtml(question){
  const b=state.bundle||demo;
  const q=norm(question);
  const cases=b.cases||[];
  const paid=c=>/paid|terbayar|lunas|selesai/.test(norm(c.status_bayar));
  const plateMatch=question.toUpperCase().match(/\b[A-Z]{1,2}\s*\d{1,4}\s*[A-Z]{0,3}\b/);
  const specific=plateMatch?norm(plateMatch[0]).replace(/\s+/g,""):null;

  if(/kendaraan.*(lebih dari|>\s*1|berulang|beberapa).*perkara|lebih dari satu perkara/.test(q)){
    const groups={};
    cases.forEach(c=>{const k=norm(c.tnkb).replace(/\s+/g,"");if(!k)return;(groups[k]??=[]).push(c)});
    const repeated=Object.values(groups).filter(x=>x.length>1).sort((a,z)=>z.length-a.length);
    return '<div class="assistant-answer"><b>'+repeated.length+' kendaraan</b><p>memiliki lebih dari satu pelanggaran pada data G-Smart yang sedang dimuat.</p>'+
      (repeated.length?'<div class="assistant-list">'+repeated.slice(0,8).map(g=>'<button class="assistant-case" data-command-case="'+esc(g[0].case_id)+'"><b>'+esc(g[0].tnkb)+'</b><span>'+g.length+' pelanggaran</span><small>Buka riwayat pelanggaran</small></button>').join("")+'</div>':'')+'</div>'
  }

  if((q.includes("blanko")||q.includes("briva"))&&(q.includes("belum bayar")||q.includes("belum terbayar")||q.includes("unpaid"))){
    let rows=cases.filter(c=>c.no_blanko&&!paid(c));
    rows=assistantDateFilter(rows,c=>c.tanggal_blanko||c.tanggal_pelanggaran,question);
    return '<div class="assistant-answer"><b>'+rows.length+' blanko belum bayar</b><p>'+esc(monthKeyFromAssistantText(question)?'Periode '+monthName(monthKeyFromAssistantText(question)):'Berdasarkan data yang sedang dimuat')+'.</p>'+
      (rows.length?'<div class="assistant-list">'+rows.slice(0,8).map(assistantCaseButton).join("")+'</div>':'')+
      '<button class="assistant-open-page" data-command-page="blanko">Buka Blanko Tilang →</button></div>'
  }

  if(q.includes("prioritas")||q.includes("perlu tindakan")||q.includes("perlu diprioritaskan")){
    const today=wibDateKey();
    const courtIds=new Set((b.courts||[]).filter(x=>wibDateKey(x.tanggal_sidang)===today).map(x=>String(x.case_id)));
    const disputeIds=new Set(activeDisputes(b).map(x=>String(x.case_id)));
    const unpaidIds=new Set(cases.filter(c=>c.no_blanko&&!paid(c)).map(x=>String(x.case_id)));
    const rows=cases.filter(c=>courtIds.has(String(c.case_id))||disputeIds.has(String(c.case_id))||unpaidIds.has(String(c.case_id)))
      .sort((a,z)=>Number(courtIds.has(String(z.case_id)))-Number(courtIds.has(String(a.case_id)))).slice(0,12);
    return '<div class="assistant-answer"><b>'+rows.length+' pelanggaran terindikasi perlu perhatian</b><p>Indikator read-only: sidang hari ini, sanggahan aktif, atau blanko belum bayar. Ini bukan perubahan status dan tidak menulis ke database.</p>'+
      (rows.length?'<div class="assistant-list">'+rows.slice(0,8).map(assistantCaseButton).join("")+'</div>':'')+'</div>'
  }

  const categoryMap=[
    {test:/sidang|persidangan/,label:"persidangan",rows:()=>assistantDateFilter(b.courts||[],x=>x.tanggal_sidang,question),page:"court"},
    {test:/sanggah|tersanggah/,label:"sanggahan aktif",rows:()=>assistantDateFilter(activeDisputes(b),x=>x.confirmation_date,question),page:"disputes"},
    {test:/dihentikan|penghentian/,label:"pelanggaran dihentikan",rows:()=>assistantDateFilter(b.terminated||[],x=>x.terminated_at,question),page:"terminated"},
    {test:/pengiriman|surat|jne|resi/,label:"pengiriman surat",rows:()=>assistantDateFilter(b.shipping||[],x=>x.printed_date||x.delivered_at,question),page:"shipping"},
    {test:/blanko/,label:"blanko terbit",rows:()=>assistantDateFilter(cases.filter(c=>c.no_blanko),x=>x.tanggal_blanko,question),page:"blanko"},
    {test:/data baru|perkara baru|pelanggaran baru|pelanggaran terdata/,label:"pelanggaran terdata",rows:()=>assistantDateFilter(cases,x=>x.first_seen_at,question),page:"new"}
  ];
  const cat=categoryMap.find(x=>x.test.test(q));
  if(cat&&(q.includes("berapa")||q.includes("jumlah")||q.includes("hari ini")||q.includes("bulan"))){
    const rows=cat.rows();
    return '<div class="assistant-answer"><b>'+rows.length+' '+cat.label+'</b><p>'+esc(monthKeyFromAssistantText(question)?'Periode '+monthName(monthKeyFromAssistantText(question)):(q.includes("hari ini")?"Hari ini":"Berdasarkan data yang sedang dimuat"))+'.</p><button class="assistant-open-page" data-command-page="'+cat.page+'">Buka data →</button></div>'
  }

  if(specific||q.includes("ringkas perkara")||q.includes("ringkasan perkara")){
    const terms=specific?[specific]:searchTerms(question.replace(/ringkas(an)? perkara/ig,""));
    const matches=cases.filter(c=>{
      const compact=caseSearchText(c,b,rolePermissions().adminPrivileges).replace(/\s+/g,"");
      return terms.filter(Boolean).every(t=>compact.includes(norm(t).replace(/\s+/g,"")))
    }).slice(0,5);
    if(matches.length===1){
      const c=matches[0];
      const ship=(b.shipping||[]).find(x=>String(x.case_id)===String(c.case_id));
      const court=(b.courts||[]).find(x=>String(x.case_id)===String(c.case_id));
      return '<div class="assistant-answer"><b>'+esc(c.tnkb||"Pelanggaran")+'</b><p>'+
        esc(c.jenis_pelanggaran||"Pelanggaran ETLE")+' · '+esc(c.status_etle||"Status belum tersedia")+
        (c.no_blanko?' · Blanko '+esc(c.no_blanko):'')+
        (ship?.status?' · Pengiriman '+esc(ship.status):'')+
        (court?.tanggal_sidang?' · Sidang '+fmtDate(court.tanggal_sidang):'')+
        '</p><button class="assistant-open-page" data-command-case="'+esc(c.case_id)+'">Buka Detail Perkara →</button></div>'
    }
    if(matches.length>1)return '<div class="assistant-answer"><b>'+matches.length+' pelanggaran cocok</b><p>Pilih pelanggaran yang dimaksud.</p><div class="assistant-list">'+matches.map(assistantCaseButton).join("")+'</div></div>'
  }

  return '<div class="assistant-answer assistant-help"><b>Saya belum memahami pertanyaan itu.</b><p>Versi awal Asisten G-Smart bersifat read-only dan fokus pada data operasional. Coba pertanyaan seperti:</p><div class="assistant-examples"><button data-ai-prompt="Berapa sidang hari ini?">Berapa sidang hari ini?</button><button data-ai-prompt="Berapa blanko yang belum bayar?">Blanko belum bayar</button><button data-ai-prompt="Kendaraan yang punya lebih dari satu pelanggaran">Kendaraan berulang</button><button data-ai-prompt="Apa yang perlu diprioritaskan hari ini?">Prioritas hari ini</button></div></div>'
}
function runAssistantQuery(question){
  const out=$("commandPaletteResults");
  const q=String(question||"").trim();
  if(!out||!q)return;
  out.innerHTML='<div class="assistant-thinking"><span>✦</span> Menganalisis data G-Smart…</div>';
  setTimeout(()=>{
    if(!commandPaletteOpen())return;
    out.innerHTML='<div class="cp-section-label cp-ai-label">✦ Asisten Data G-Smart <span>read-only</span></div>'+assistantAnswerHtml(q);
    bindCommandPaletteActions()
  },120)
}

function reportSnapshot(b){const first={};b.histories.forEach(h=>{if(!h.case_id||!h.event_time)return;if(!first[h.case_id]||String(h.event_time)<String(first[h.case_id]))first[h.case_id]=h.event_time});const ids=Object.entries(first).filter(([,v])=>!state.month||ym(v)===state.month).map(([k])=>k);const blanko=new Set(b.cases.filter(x=>x.no_blanko).map(x=>x.case_id));const disputes=new Set(b.disputes.map(x=>x.case_id));const terminated=new Set(b.terminated.map(x=>x.case_id));const socialization=new Set(b.cases.filter(x=>x.is_archived).map(x=>x.case_id));const shipping=new Set(activeShippingRows(b).map(x=>x.case_id));const court=new Set(b.courts.map(x=>x.case_id));const success=ids.filter(id=>blanko.has(id)||disputes.has(id)||terminated.has(id)||socialization.has(id));return{ids,total:ids.length,blanko:ids.filter(x=>blanko.has(x)).length,disputes:ids.filter(x=>disputes.has(x)).length,terminated:ids.filter(x=>terminated.has(x)).length,socialization:ids.filter(x=>socialization.has(x)).length,shipping:ids.filter(x=>shipping.has(x)).length,court:ids.filter(x=>court.has(x)).length,success:success.length,pending:ids.length-success.length}}
function reportText(s){const rate=s.total?s.success*100/s.total:0;const pending=s.total?s.pending*100/s.total:0;return'LAPORAN ETLE UPPKB GUYANGAN\nPeriode: '+monthName(state.month)+'\n\nRingkasan ETLE\n• Pelanggaran Diproses: '+s.total+'\n• Pengiriman Surat: '+s.shipping+'\n• Blanko Tilang: '+s.blanko+'\n• Tersanggah: '+s.disputes+'\n• Konfirmasi Daya Angkut Sosialisasi: '+s.socialization+'\n• Dihentikan: '+s.terminated+'\n• Persidangan: '+s.court+'\n\nSuccess Rate Konfirmasi Pelanggaran\n• Berhasil Konfirmasi: '+s.success+' dari '+s.total+' pelanggaran\n• Success Rate: '+rate.toFixed(2)+'%\n• Belum Konfirmasi: '+s.pending+' pelanggaran ('+pending.toFixed(2)+'%)\n\nSumber: G-SMART UPPKB Guyangan'}
function reportPage(b){const s=reportSnapshot(b);$("content").innerHTML='<div class="cards"><div class="card"><div class="metric-label">Total Pelanggaran</div><div class="metric-value">'+s.total+'</div></div><div class="card"><div class="metric-label">Berhasil Konfirmasi</div><div class="metric-value">'+s.success+'</div></div><div class="card"><div class="metric-label">Belum Konfirmasi</div><div class="metric-value">'+s.pending+'</div></div><div class="card"><div class="metric-label">Success Rate</div><div class="metric-value">'+(s.total?s.success*100/s.total:0).toFixed(1)+'%</div></div></div><div class="panel"><div class="title-row"><h3>Laporan ETLE</h3><div class="action-row"><button id="copyReport" class="action-btn">Salin Ringkasan</button><button id="printReport" class="action-btn primary">Cetak / PDF</button></div></div><div class="report-summary">'+esc(reportText(s))+'</div></div>';$("copyReport").onclick=async()=>{await navigator.clipboard.writeText(reportText(s));toast("Ringkasan laporan disalin")};$("printReport").onclick=()=>window.print()}

function loginAuditDeviceMeta(){
  const ua=navigator.userAgent||"";
  let browser="Browser";
  if(/Edg\//.test(ua))browser="Microsoft Edge";
  else if(/OPR\//.test(ua))browser="Opera";
  else if(/SamsungBrowser\//.test(ua))browser="Samsung Internet";
  else if(/Chrome\//.test(ua))browser="Google Chrome";
  else if(/Firefox\//.test(ua))browser="Mozilla Firefox";
  else if(/Safari\//.test(ua))browser="Safari";
  let platform=navigator.userAgentData?.platform||navigator.platform||"";
  if(/Android/i.test(ua))platform="Android";
  else if(/iPhone|iPad|iPod/i.test(ua))platform="iOS";
  else if(/Windows/i.test(ua))platform="Windows";
  else if(/Macintosh|Mac OS X/i.test(ua))platform="macOS";
  else if(/Linux/i.test(ua)&&!/Android/i.test(ua))platform="Linux";
  const deviceType=/iPad|Tablet/i.test(ua)?"Tablet":(/Android|iPhone|iPod|Mobile/i.test(ua)?"Mobile":"Desktop");
  const standalone=window.matchMedia?.("(display-mode: standalone)")?.matches||navigator.standalone===true;
  return{
    browser,
    platform,
    deviceType,
    accessMode:standalone?"PWA":"Browser",
    userAgent:ua,
    screenWidth:Math.round(window.screen?.width||window.innerWidth||0),
    screenHeight:Math.round(window.screen?.height||window.innerHeight||0)
  }
}
async function callLoginAudit(action,payload={}){
  if(state.demo||!auth.currentUser)return null;
  const token=await auth.currentUser.getIdToken(false);
  const r=await fetch(supabaseConfig.url+"/functions/v1/login-audit",{
    method:"POST",
    headers:{apikey:supabaseConfig.publishableKey,Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({action,...payload})
  });
  if(!r.ok){
    const err=await r.json().catch(()=>({}));
    throw new Error(err?.error||("LOGIN_AUDIT_HTTP_"+r.status))
  }
  return r.json()
}
async function recordSuccessfulLogin(){
  if(PREVIEW_READ_ONLY)return;
  try{await callLoginAudit("record",{meta:loginAuditDeviceMeta()})}
  catch(err){console.warn("Login audit tidak tercatat:",err)}
}
function loginHistoryTime(v){
  if(!v)return"-";
  const d=new Date(v);
  if(Number.isNaN(d.getTime()))return esc(v);
  return new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,timeZone:"Asia/Jakarta"}).format(d)+" WIB"
}

/* Kesehatan Sistem: read-only administrative monitoring. No ETLE sync is triggered here. */
function healthTime(v){
  if(!v)return "Belum tercatat";
  return loginHistoryTime(v);
}
function healthAgeHours(v){
  const ms=new Date(v||"").getTime();
  return Number.isFinite(ms)?Math.max(0,(Date.now()-ms)/3600000):Infinity;
}
function healthPill(level,label){
  return '<span class="health-pill '+level+'">'+esc(label)+'</span>';
}
function healthWorkflowStatus(report,limitHours){
  if(!report||!report.available)return {level:"unknown",label:"Belum terhubung",detail:"Pemeriksaan workflow belum tersedia."};
  const run=report.run;
  if(!run)return {level:"unknown",label:"Belum ada eksekusi",detail:"Workflow terdaftar, tetapi riwayat eksekusinya belum ditemukan."};
  const status=String(run.status||"").toLowerCase();
  const conclusion=String(run.conclusion||"").toLowerCase();
  if(status!=="completed")return {level:"warn",label:"Sedang berjalan",detail:"Eksekusi sedang berjalan atau masih menunggu antrean."};
  if(["failure","timed_out","startup_failure","action_required"].includes(conclusion))return {level:"danger",label:"Gagal",detail:run.explanation||"Eksekusi terakhir gagal. Periksa tahapan dan log GitHub Actions."};
  if(conclusion==="cancelled"||conclusion==="skipped")return {level:"warn",label:conclusion==="cancelled"?"Dibatalkan":"Dilewati",detail:"Eksekusi terakhir tidak selesai."};
  if(conclusion!=="success")return {level:"unknown",label:"Belum diketahui",detail:"Hasil eksekusi terakhir tidak tersedia."};
  if(healthAgeHours(run.started_at)>limitHours)return {level:"warn",label:"Terlambat",detail:"Eksekusi terakhir berhasil, tetapi belum ada eksekusi baru dalam rentang pemantauan."};
  return {level:"good",label:"Berhasil",detail:"Eksekusi terakhir selesai tanpa kesalahan GitHub Actions."};
}
function healthModuleStatus(row){
  if(!row)return {level:"unknown",label:"Belum tercatat"};
  const status=String(row.status||"").toUpperCase();
  if(["FAILED","FAILURE","ERROR"].includes(status))return {level:"danger",label:"Gagal"};
  if(status==="PARTIAL"||Number(row.rows_failed)>0)return {level:"warn",label:"Sebagian berhasil"};
  if(status!=="SUCCESS")return {level:"unknown",label:status||"Tidak diketahui"};
  return {level:"good",label:"Berhasil"};
}
function healthModuleFreshness(row,limitHours){
  if(!row)return {stale:false,text:"Belum memiliki catatan sinkronisasi."};
  const hours=healthAgeHours(row.finished_at||row.started_at);
  if(!Number.isFinite(hours))return {stale:false,text:"Waktu sinkronisasi tidak tersedia."};
  if(hours>limitHours){
    const elapsed=hours>=24?Math.floor(hours/24)+" hari":Math.floor(hours)+" jam";
    return {stale:true,text:"Belum ada pencatatan sinkronisasi baru selama "+elapsed+". Ini tidak berarti proses terakhir gagal."};
  }
  if(Number(row.rows_found)===0&&String(row.status).toUpperCase()==="SUCCESS")
    return {stale:false,text:"Proses terakhir berhasil tanpa data yang perlu diproses."};
  return {stale:false,text:"Catatan pemrosesan masih dalam rentang pemantauan."};
}
async function requestHealthCheck(){
  if(state.demo||!perms().admin||!auth.currentUser)throw new Error("UNAUTHORIZED");
  const token=await auth.currentUser.getIdToken(false);
  const response=await fetch(supabaseConfig.url+"/functions/v1/system-health",{
    method:"POST",
    headers:{apikey:supabaseConfig.publishableKey,Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({action:"status"}),
    cache:"no-store"
  });
  if(!response.ok){
    const error=await response.json().catch(()=>({}));
    throw new Error(error.error||("HEALTH_HTTP_"+response.status));
  }
  return response.json();
}
async function healthPage(){
  if(!perms().admin){
    $("content").innerHTML='<div class="notice">Kesehatan Sistem hanya dapat diakses Admin.</div>';
    return;
  }
  $("content").innerHTML='<div class="panel health-panel"><div class="loading">Memeriksa kesehatan sistem...</div></div>';
  try{
    const data=await requestHealthCheck();
    if(state.page!=="health")return;
    const workflowReports=Array.isArray(data.github?.workflows)?data.github.workflows:[];
    const byWorkflow=Object.fromEntries(workflowReports.map(r=>[r.key,r]));
    const jobs=[
      {key:"incremental",name:"Incremental Sync",maxAge:3,url:"https://github.com/julastri-cloud/gsmart-etle-cloud/actions/workflows/sync_supabase.yml"},
      {key:"full",name:"Full Weekly",maxAge:216,url:"https://github.com/julastri-cloud/gsmart-etle-cloud/actions/workflows/full_sync_weekly.yml"},
      {key:"sosialisasi",name:"Konfirmasi Daya Angkut Sosialisasi",maxAge:36,url:"https://github.com/julastri-cloud/gsmart-etle-cloud/actions/workflows/daya_angkut_sosialisasi.yml"}
    ];
    const logRows=Array.isArray(data.logs)?data.logs:[];
    const syncStates=Array.isArray(data.states)?data.states:[];
    const logByModule=new Map();
    logRows.forEach(r=>{if(r.module&&!logByModule.has(r.module))logByModule.set(r.module,r)});
    const stateByModule=new Map(syncStates.map(r=>[r.module,r]));
    const githubOk=workflowReports.some(r=>r.available);
    const jobStatuses=jobs.map(job=>healthWorkflowStatus(byWorkflow[job.key],job.maxAge));
    const overall=jobStatuses.some(x=>x.level==="danger")?"danger":
      jobStatuses.some(x=>x.level==="warn")?"warn":
      jobStatuses.some(x=>x.level==="unknown")?"unknown":"good";
    const overallHeading=overall==="good"?"Workflow berjalan normal":overall==="danger"?"Ada workflow gagal":overall==="warn"?"Perlu perhatian":"Pemeriksaan belum lengkap";
    const overallDescription=overall==="good"?"Seluruh workflow terpantau berhasil dalam rentang pemeriksaan.":
      overall==="danger"?"Satu atau lebih eksekusi GitHub Actions mengalami kegagalan.":
      overall==="warn"?"Ada workflow yang terlambat atau masih berjalan.":
      "Data Supabase dapat diperiksa, tetapi status GitHub Actions belum lengkap.";
    const jobCards=jobs.map((job,index)=>{
      const report=byWorkflow[job.key];
      const run=report?.run;
      const st=jobStatuses[index];
      const link=run?.html_url||job.url;
      const step=st.level==="danger"&&run?.failure_step?
        '<div class="health-failure-step">Tahap gagal: '+esc(run.failure_step)+'</div>':"";
      return '<div class="health-card"><div class="health-card-line"><div class="health-card-title">'+esc(job.name)+'</div>'+healthPill(st.level,st.label)+'</div>'+
        '<div class="health-card-meta">Terakhir berjalan: '+esc(healthTime(run?.started_at))+'</div>'+
        step+'<div class="health-card-meta">'+esc(st.detail)+'</div>'+
        '<a class="health-link" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">Lihat GitHub Actions ↗</a></div>';
    }).join("");
    const modules=[["SHIPPING","Pengiriman Surat",4],["BLANKO","Blanko Tilang",4],["DISPUTES","Pelanggaran Tersanggah",4],["TERMINATED","Pelanggaran Dihentikan",4]];
    const moduleCards=modules.map(([key,name,limit])=>{
      const log=logByModule.get(key);
      const st=healthModuleStatus(log);
      const freshness=healthModuleFreshness(log,limit);
      const stateRow=stateByModule.get(key);
      return '<div class="health-card"><div class="health-card-line"><div class="health-card-title">'+esc(name)+'</div>'+healthPill(st.level,st.label)+'</div>'+
        '<div class="health-card-meta">Terakhir dicatat: '+esc(healthTime(log?.finished_at||log?.started_at))+'</div>'+
        '<div class="health-card-meta">Terakhir sukses: '+esc(healthTime(stateRow?.last_success_at))+'</div>'+
        '<div class="health-card-meta">Ditemukan: '+esc(log?.rows_found??"-")+' · Diperbarui: '+esc(log?.rows_updated??"-")+' · Gagal: '+esc(log?.rows_failed??"-")+'</div>'+
        '<div class="health-freshness '+(freshness.stale?"is-stale":"")+'">'+esc(freshness.text)+'</div></div>';
    }).join("");
    const historyRows=logRows.slice(0,15).map(log=>{
      const st=healthModuleStatus(log);
      return '<tr><td class="health-time">'+esc(healthTime(log.started_at))+'</td><td>'+esc(log.module||"-")+'</td><td>'+healthPill(st.level,st.label)+'</td>'+
        '<td>'+esc(log.rows_found??0)+'</td><td>'+esc(log.rows_failed??0)+'</td></tr>';
    }).join("");
    const ghNote=githubOk?
      '<div class="health-note">Setiap workflow diperiksa secara terpisah. Nama tahap gagal berasal dari GitHub Actions; dugaan penyebab dinyatakan sebagai kemungkinan.</div>':
      '<div class="health-note">Status GitHub Actions belum dapat dibaca. Kemungkinan akses ke repo sedang dibatasi; status belum diketahui tidak berarti workflow berhasil ataupun gagal.</div>';
    $("content").innerHTML=
      '<div class="health-page">'+
      '<div class="panel health-panel"><div class="health-head"><div><h3>Kesehatan Sistem</h3><p>Monitoring baca-saja · hanya Admin · Diperiksa: '+esc(healthTime(data.checked_at))+'</p></div>'+
      '<button type="button" class="action-btn health-refresh" id="healthRefresh">↻ Perbarui status</button></div></div>'+
      '<div class="health-overview health-'+(overall==="unknown"?"warn":overall)+'"><span class="health-main-icon" aria-hidden="true">'+(overall==="good"?"✓":overall==="danger"?"!":"i")+'</span>'+
      '<div><h3>'+esc(overallHeading)+'</h3><p>'+esc(overallDescription)+'</p></div></div>'+
      '<div class="panel health-panel"><h3 class="health-small-title">Workflow GitHub Actions</h3><p class="health-status-footnote">Setiap workflow diperiksa secara terpisah · ambang: Incremental 3 jam, Full Weekly 9 hari, Sosialisasi 36 jam.</p><div class="health-grid">'+jobCards+'</div>'+ghNote+'</div>'+
      '<div class="panel health-panel"><h3 class="health-small-title">Pencatatan Sinkronisasi Supabase</h3><p class="health-status-footnote">Hasil eksekusi dan kesegaran data ditampilkan terpisah. Kegagalan sebelum Python berjalan tidak tercatat di tabel ini.</p><div class="health-grid">'+moduleCards+'</div></div>'+
      '<div class="panel health-panel"><h3 class="health-small-title">Riwayat Pemrosesan Terakhir</h3>'+
      '<div class="health-table-wrap"><table class="health-table"><thead><tr><th>Waktu WIB</th><th>Modul</th><th>Status</th><th>Data</th><th>Gagal</th></tr></thead><tbody>'+(
        historyRows||'<tr><td colspan="5">Belum ada catatan yang bisa ditampilkan.</td></tr>'
      )+'</tbody></table></div></div>'+
      '<div class="panel health-panel"><h3 class="health-small-title">Ketersediaan ETLE Hub</h3>'+
      '<div class="health-note">Belum diperiksa secara langsung. Website ETLE Hub menggunakan sesi login, sehingga kondisi server tidak boleh disimpulkan hanya dari koneksi internet G-Smart atau waktu pembaruan data.</div></div>'+
      '</div>';
    $("healthRefresh")?.addEventListener("click",()=>healthPage());
  }catch(err){
    if(state.page!=="health")return;
    const msg=String(err?.message||"");
    const label=msg==="FORBIDDEN"?"Akses hanya untuk Admin aktif.":
      msg==="UNAUTHORIZED"?"Sesi login perlu diperbarui.":
      "Layanan pemeriksaan belum dapat dihubungi.";
    $("content").innerHTML='<div class="panel health-panel"><h3 class="health-small-title">Kesehatan Sistem</h3><div class="notice">'+esc(label)+
      '</div><button type="button" id="healthRefresh" class="action-btn">↻ Coba lagi</button></div>';
    $("healthRefresh")?.addEventListener("click",()=>healthPage());
  }
}

async function loginHistoryPage(days=30){
  if(!perms().admin){
    $("content").innerHTML='<div class="notice">Riwayat Login hanya dapat diakses Admin.</div>';
    return
  }
  $("content").innerHTML='<div class="panel"><div class="loading">Memuat riwayat login...</div></div>';
  try{
    const data=await callLoginAudit("list",{days:Number(days),limit:500});
    const rows=Array.isArray(data?.rows)?data.rows:[];
    const today=wibDateKey();
    const todayRows=rows.filter(x=>wibDateKey(x.login_at)===today);
    const uniqueUsers=new Set(rows.map(x=>x.firebase_uid).filter(Boolean)).size;
    const latestByUser=new Map();
    rows.forEach(x=>{if(x.firebase_uid&&!latestByUser.has(x.firebase_uid))latestByUser.set(x.firebase_uid,x)});
    const rangeLabel=Number(days)===0?"Semua riwayat":Number(days)+" hari terakhir";
    $("content").innerHTML=
      '<div class="panel"><div class="title-row"><div><h3>Riwayat Login</h3><p class="search-hint">Audit login berhasil G-Smart · khusus ADMIN</p></div><span class="badge">'+esc(rangeLabel)+'</span></div>'+
      '<div class="login-audit-toolbar"><label>Periode <select id="loginAuditDays"><option value="7">7 hari</option><option value="30">30 hari</option><option value="90">90 hari</option><option value="365">1 tahun</option><option value="0">Semua</option></select></label><button id="loginAuditRefresh" class="action-btn">↻ Muat ulang</button></div></div>'+
      '<div class="cards login-audit-metrics">'+
        '<div class="card"><div class="metric-label">Login Hari Ini</div><div class="metric-value">'+todayRows.length+'</div></div>'+
        '<div class="card"><div class="metric-label">User Tercatat</div><div class="metric-value">'+uniqueUsers+'</div></div>'+
        '<div class="card"><div class="metric-label">Total Login</div><div class="metric-value">'+rows.length+'</div></div>'+
        '<div class="card"><div class="metric-label">User Login Terakhir</div><div class="metric-value login-audit-latest">'+esc(rows[0]?.display_name||"-")+'</div></div>'+
      '</div>'+
      '<div class="panel"><div class="title-row"><h3>Aktivitas Login</h3><span class="badge">'+rows.length+' data</span></div>'+
      (rows.length?'<div class="table-wrap responsive-table"><table class="data-table login-audit-table"><thead><tr><th>Waktu Login</th><th>User</th><th>Role</th><th>Perangkat</th><th>Platform</th><th>Browser</th><th>Akses</th></tr></thead><tbody>'+
        rows.map(r=>'<tr><td data-label="Waktu Login">'+loginHistoryTime(r.login_at)+'</td><td data-label="User"><b>'+esc(r.display_name||"-")+'</b><small class="login-audit-email">'+esc(r.email||"")+'</small></td><td data-label="Role">'+esc(r.app_role||"-")+'</td><td data-label="Perangkat">'+esc(r.device_type||"-")+'</td><td data-label="Platform">'+esc(r.platform||"-")+'</td><td data-label="Browser">'+esc(r.browser||"-")+'</td><td data-label="Akses">'+esc(r.access_mode||"-")+'</td></tr>').join("")+
      '</tbody></table></div>':'<div class="empty">Belum ada riwayat login pada periode ini.</div>')+
      '</div>';
    const select=$("loginAuditDays");
    if(select){select.value=String(days);select.onchange=()=>loginHistoryPage(Number(select.value))}
    if($("loginAuditRefresh"))$("loginAuditRefresh").onclick=()=>loginHistoryPage(Number($("loginAuditDays")?.value||days))
  }catch(err){
    console.error(err);
    $("content").innerHTML='<div class="notice">Riwayat login belum dapat dimuat. Coba beberapa saat lagi.</div>'
  }
}
async function q(table,{select="*",filters={},order=null,limit=null}={}){const token=state.demo?null:await auth.currentUser.getIdToken(true);const base=new URL(supabaseConfig.url+"/rest/v1/"+table);base.searchParams.set("select",select);if(order)base.searchParams.set("order",order);Object.entries(filters).forEach(([k,v])=>base.searchParams.set(k,v));const h={apikey:supabaseConfig.publishableKey};if(token)h.Authorization="Bearer "+token;const PAGE_SIZE=1000;const requestedLimit=limit==null?null:Math.max(0,Number(limit)||0);if(requestedLimit===0)return[];let offset=0;const rows=[];while(true){const pageLimit=requestedLimit==null?PAGE_SIZE:Math.min(PAGE_SIZE,requestedLimit-rows.length);if(pageLimit<=0)break;const u=new URL(base);u.searchParams.set("limit",String(pageLimit));u.searchParams.set("offset",String(offset));const r=await fetch(u,{headers:h});if(!r.ok)throw new Error(table+" HTTP "+r.status);const page=await r.json();rows.push(...page);if(page.length<pageLimit)break;if(requestedLimit!=null&&rows.length>=requestedLimit)break;offset+=page.length}return requestedLimit==null?rows:rows.slice(0,requestedLimit)}
async function write(table,body,{onConflict=null}={}){if(PREVIEW_READ_ONLY)throw new Error("Mode uji coba: perubahan data dinonaktifkan.");const token=await auth.currentUser.getIdToken(true);const u=new URL(supabaseConfig.url+"/rest/v1/"+table);if(onConflict)u.searchParams.set("on_conflict",onConflict);const r=await fetch(u,{method:"POST",headers:{apikey:supabaseConfig.publishableKey,Authorization:"Bearer "+token,"Content-Type":"application/json",Prefer:onConflict?"resolution=merge-duplicates,missing=default,return=minimal":"missing=default,return=minimal"},body:JSON.stringify(body)});if(!r.ok)throw new Error("Gagal menyimpan "+table+" (HTTP "+r.status+")")}
async function removeRows(table,filters={}){if(PREVIEW_READ_ONLY)throw new Error("Mode uji coba: penghapusan data dinonaktifkan.");const token=await auth.currentUser.getIdToken(true);const u=new URL(supabaseConfig.url+"/rest/v1/"+table);Object.entries(filters).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u,{method:"DELETE",headers:{apikey:supabaseConfig.publishableKey,Authorization:"Bearer "+token,Prefer:"return=minimal"}});if(!r.ok)throw new Error("Gagal menghapus "+table+" (HTTP "+r.status+")")}
function etleConfirmationUrl(c){
  const reg=String(c?.no_registrasi||c?.ref_number||"").trim();
  const tnkb=String(c?.tnkb||"").replace(/\s+/g,"").toUpperCase();
  if(!reg||!tnkb)return null;
  return "https://etilang-djpd.kemenhub.go.id/konfirmasi?ref_number="+encodeURIComponent(reg)+"&plates="+encodeURIComponent(tnkb)
}
function caseDeepLink(caseId){
  const url=new URL(window.location.href);
  url.hash="";
  url.search="";
  url.searchParams.set("case",String(caseId||"").trim());
  return url.toString()
}
function requestedCaseId(){
  try{return new URL(window.location.href).searchParams.get("case")?.trim()||null}catch(_){return null}
}
function openRequestedCase(){
  const caseId=requestedCaseId();
  if(!caseId||!state.bundle)return;
  const exists=state.bundle.cases.some(x=>String(x.case_id)===String(caseId));
  if(!exists){toast("Perkara dari QR tidak ditemukan pada data G-Smart.");return}
  state.detailSource="OTHER";
  setTimeout(()=>openDetail(caseId),80)
}
async function openDetail(caseId){$("modalBackdrop").classList.remove("hidden");$("modalBody").innerHTML='<div class="loading">Memuat detail perkara...</div>';const c=caseById(caseId);$("modalTitle").textContent="Detail Perkara";$("modalSubtitle").textContent=(c?.tnkb||"-")+" · "+(c?.ref_number||c?.no_registrasi||"");try{const d=state.demo?demoDetail(caseId):await loadDetail(caseId);state.detail=d;renderDetail(d)}catch(e){$("modalBody").innerHTML='<div class="notice">'+esc(e.message)+'</div>'}}
function demoDetail(id){const c=caseById(id)||demo.cases[0];return{case:c,offender:demo.offenders.find(x=>x.case_id===id),vehicle:{case_id:id,nama_pemilik:c.nama_pemilik,merk:"MITSUBISHI",tipe:"FUSO",jenis_kendaraan:"MOBIL BARANG",tahun_rakit:"2020",bahan_bakar:"SOLAR",jbb:3200,jbi:3100,berat_timbang:3450,berat_lebih:350},photos:[],shipping:demo.shipping.find(x=>x.case_id===id),payment:c.no_blanko?{no_briva:c.no_briva,status_bayar:c.status_bayar,titipan:500000,denda_maksimum:500000,denda_pengadilan:150000,biaya_perkara:5000,nominal_sisa:350000}:null,dispute:demo.disputes.find(x=>x.case_id===id),terminated:demo.terminated.find(x=>x.case_id===id),court:demo.courts.find(x=>x.case_id===id),manual:{kategori_internal:"BELUM_DIPROSES",prioritas:"NORMAL",catatan_ringkas:"Preview"},notes:[],history:demo.histories.filter(x=>x.case_id===id)}}
async function loadDetail(caseId){const c=caseById(caseId);if(!c)throw new Error("Perkara tidak ditemukan.");const one=async(t,f,v)=>{if(!v)return null;const r=await q(t,{filters:{[f]:"eq."+v},limit:1});return r[0]||null};const [offender,vehicle,photos,shipping,payment,dispute,terminated,court,manual,notes,history]=await Promise.all([one("etle_offenders","case_id",caseId),one("etle_vehicles","case_id",caseId),q("etle_photos",{filters:{case_id:"eq."+caseId},order:"sort_order.asc"}),c.ref_number?one("etle_shipping","ref_number",c.ref_number):one("etle_shipping","case_id",caseId),one("etle_payments","case_id",caseId),c.violation_id?one("etle_disputes","violation_id",c.violation_id):one("etle_disputes","case_id",caseId),c.ref_number?one("etle_terminated_cases","ref_number",c.ref_number):one("etle_terminated_cases","case_id",caseId),c.violation_id?one("etle_court_info","violation_id",c.violation_id):one("etle_court_info","case_id",caseId),one("gsmart_case_status","case_id",caseId),q("gsmart_case_notes",{filters:{case_id:"eq."+caseId},order:"created_at.desc"}),q("gsmart_case_history",{filters:{case_id:"eq."+caseId},order:"event_time.desc.nullslast"})]);return{case:c,offender,vehicle,photos,shipping,payment,dispute,terminated,court,manual,notes,history}}
function infoGrid(obj,fields){return'<div class="detail-grid">'+fields.filter(([k])=>obj&&obj[k]!=null&&obj[k]!=="").map(([k,l,t])=>'<div class="detail-item"><small>'+l+'</small><b>'+esc(t==="money"?money(obj[k]):t==="date"?fmtDate(obj[k]):obj[k])+'</b></div>').join("")+'</div>'}
function positiveAmount(v){const n=Number(v);return Number.isFinite(n)&&n>0}
function hasCourtFine(d){return positiveAmount(d?.court?.denda_putusan)||positiveAmount(d?.payment?.denda_pengadilan)}
function kejaksaanUrl(noBlanko){return"https://tilang.kejaksaan.go.id/detail/"+encodeURIComponent(String(noBlanko||"").trim())}
async function shareCase(d){
  const c=d?.case;
  if(!c)return;
  const url=caseDeepLink(c.case_id);
  const status=c.status_etle||d.shipping?.status||d.court?.status_sidang||"-";
  const text=[
    "G-Smart UPPKB Guyangan",
    "TNKB: "+(c.tnkb||"-"),
    "No. Registrasi: "+(c.no_registrasi||c.ref_number||"-"),
    "Jenis Pelanggaran: "+(c.jenis_pelanggaran||"-"),
    "Status: "+status,
    "Detail: "+url
  ].join("\n");
  if(navigator.share){
    try{
      await navigator.share({title:"G-Smart · "+(c.tnkb||"Perkara ETLE"),text,url});
      return
    }catch(err){
      if(err?.name==="AbortError")return
    }
  }
  try{await navigator.clipboard.writeText(text);toast("Ringkasan dan tautan perkara disalin")}catch(_){toast("Gagal membagikan perkara")}
}
function showConfirmQr(d){
  const c=d?.case;
  const url=etleConfirmationUrl(c);
  if(!url){toast("No. Registrasi atau TNKB belum tersedia");return}
  closeCaseQr();
  const overlay=document.createElement("div");
  overlay.id="caseQrOverlay";
  overlay.className="case-qr-overlay";
  overlay.innerHTML=
    '<section class="case-qr-dialog" role="dialog" aria-modal="true" aria-label="QR Konfirmasi ETLE">'+
      '<button type="button" class="case-qr-close" id="caseQrClose" aria-label="Tutup">✕</button>'+
      '<div class="case-qr-kicker">G-SMART · QR KONFIRMASI ETLE</div>'+
      '<h3>'+esc(c.tnkb||"Perkara ETLE")+'</h3>'+
      '<p class="case-qr-reg">'+esc(c.no_registrasi||c.ref_number||"")+'</p>'+
      '<div id="caseQrCode" class="case-qr-code"></div>'+
      '<p class="case-qr-note">Scan untuk langsung membuka halaman Konfirmasi ETLE Kemenhub dengan nomor registrasi dan TNKB terisi otomatis.</p>'+
      '<div class="case-qr-actions">'+
        '<button type="button" class="action-btn" id="openConfirmLink">Buka Konfirmasi</button>'+
        '<button type="button" class="action-btn primary" id="downloadCaseQr">Simpan QR</button>'+
      '</div>'+
    '</section>';
  document.body.appendChild(overlay);
  const target=document.getElementById("caseQrCode");
  if(window.QRCode&&target){
    new window.QRCode(target,{text:url,width:220,height:220,colorDark:"#071a31",colorLight:"#ffffff",correctLevel:window.QRCode.CorrectLevel.M})
  }else if(target){
    target.innerHTML='<div class="notice">QR belum dapat dibuat. Pastikan perangkat terhubung ke internet lalu coba lagi.</div>'
  }
  document.getElementById("caseQrClose").onclick=closeCaseQr;
  overlay.onclick=e=>{if(e.target===overlay)closeCaseQr()};
  document.getElementById("openConfirmLink").onclick=()=>window.open(url,"_blank","noopener,noreferrer");
  document.getElementById("downloadCaseQr").onclick=()=>{
    const canvas=target?.querySelector("canvas");
    const img=target?.querySelector("img");
    const href=canvas?.toDataURL("image/png")||img?.src;
    if(!href){toast("QR belum siap disimpan");return}
    const a=document.createElement("a");
    const safe=String(c.tnkb||c.case_id||"konfirmasi").replace(/[^a-z0-9_-]+/gi,"-");
    a.href=href;a.download="G-Smart-QR-Konfirmasi-"+safe+".png";document.body.appendChild(a);a.click();a.remove()
  }
}
function closeCaseQr(){
  document.getElementById("caseQrOverlay")?.remove()
}
function showCaseQr(d){
  const c=d?.case;
  if(!c?.case_id)return;
  const url=caseDeepLink(c.case_id);
  closeCaseQr();
  const overlay=document.createElement("div");
  overlay.id="caseQrOverlay";
  overlay.className="case-qr-overlay";
  overlay.innerHTML=
    '<section class="case-qr-dialog" role="dialog" aria-modal="true" aria-label="QR Perkara">'+
      '<button type="button" class="case-qr-close" id="caseQrClose" aria-label="Tutup">✕</button>'+
      '<div class="case-qr-kicker">G-SMART · QR PERKARA</div>'+
      '<h3>'+esc(c.tnkb||"Perkara ETLE")+'</h3>'+
      '<p class="case-qr-reg">'+esc(c.no_registrasi||c.ref_number||c.case_id)+'</p>'+
      '<div id="caseQrCode" class="case-qr-code"></div>'+
      '<p class="case-qr-note">Scan untuk membuka Detail Perkara di G-Smart. Login tetap diperlukan.</p>'+
      '<div class="case-qr-actions">'+
        '<button type="button" class="action-btn" id="copyCaseLink">Salin Tautan</button>'+
        '<button type="button" class="action-btn primary" id="downloadCaseQr">Simpan QR</button>'+
      '</div>'+
    '</section>';
  document.body.appendChild(overlay);
  const target=document.getElementById("caseQrCode");
  if(window.QRCode&&target){
    new window.QRCode(target,{text:url,width:220,height:220,colorDark:"#071a31",colorLight:"#ffffff",correctLevel:window.QRCode.CorrectLevel.M})
  }else if(target){
    target.innerHTML='<div class="notice">QR belum dapat dibuat. Pastikan perangkat terhubung ke internet lalu coba lagi.</div>'
  }
  document.getElementById("caseQrClose").onclick=closeCaseQr;
  overlay.onclick=e=>{if(e.target===overlay)closeCaseQr()};
  document.getElementById("copyCaseLink").onclick=async()=>{
    try{await navigator.clipboard.writeText(url);toast("Tautan perkara disalin")}catch(_){toast("Gagal menyalin tautan")}
  };
  document.getElementById("downloadCaseQr").onclick=()=>{
    const canvas=target?.querySelector("canvas");
    const img=target?.querySelector("img");
    const href=canvas?.toDataURL("image/png")||img?.src;
    if(!href){toast("QR belum siap disimpan");return}
    const a=document.createElement("a");
    const safe=String(c.tnkb||c.case_id||"perkara").replace(/[^a-z0-9_-]+/gi,"-");
    a.href=href;a.download="G-Smart-QR-"+safe+".png";document.body.appendChild(a);a.click();a.remove()
  }
}
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
  const statusText=c.is_archived?"Konfirmasi Daya Angkut Sosialisasi":(c.status_etle||d.shipping?.status||d.court?.status_sidang||"DATA PERKARA");
  const owner=d.vehicle?.nama_pemilik||c.nama_pemilik||d.offender?.nama||"-";
  const vehicleLabel=[d.vehicle?.merk,d.vehicle?.tipe].filter(Boolean).join(" ")||d.vehicle?.jenis_kendaraan||"-";
  const paymentFine=positiveAmount(d?.court?.denda_putusan)?d.court.denda_putusan:(positiveAmount(d?.payment?.denda_pengadilan)?d.payment.denda_pengadilan:null);
  const vehicleDetail=d.vehicle?{...d.vehicle}:null;
  if(vehicleDetail){
    const jbi=Number(vehicleDetail.jbi);
    const lebih=Number(vehicleDetail.berat_lebih);
    if(Number.isFinite(jbi)&&jbi>0&&Number.isFinite(lebih)&&lebih>=0){
      vehicleDetail.persentase_lebih=(lebih/jbi*100).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2})+"%";
    }
  }

  $("modalBody").innerHTML=
    '<section class="detail-hero">'+
      '<div class="detail-photo-main">'+
        (mainPhoto?'<img id="detailMainPhoto" src="'+esc(mainPhoto)+'" alt="Foto ETLE '+esc(c.tnkb||"")+'" decoding="async" fetchpriority="high">':'<div class="detail-photo-empty"><b>▣</b><span>Foto ETLE belum tersedia</span></div>')+
        (photos.length?'<span class="detail-photo-count">'+photos.length+' foto</span>':'')+
      '</div>'+
      '<div class="detail-identity">'+
        '<div class="detail-identity-top"><span class="detail-tnkb">'+esc(c.tnkb||"-")+'</span><span class="detail-status-chip '+statusBadgeClass(statusText)+'">'+esc(statusText)+'</span></div>'+
        '<div class="detail-reg detail-reg-action">No. Registrasi &nbsp;<b>'+esc(c.no_registrasi||c.ref_number||"-")+'</b>'+(c.no_registrasi||c.ref_number?'<button class="detail-confirm-btn" id="confirmEtleBtn" type="button">Buka Konfirmasi ↗</button>':'')+(c.tnkb&&c.no_registrasi||c.tnkb&&c.ref_number?'<button class="detail-confirm-btn secondary" id="qrConfirmBtn" type="button">▦ QR Konfirmasi</button>':'')+'</div>'+
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

    '<div class="detail-actionbar"><span class="detail-actionbar-label">Aksi Perkara</span><div class="action-row detail-primary-actions">'+
      '<button class="action-btn primary" id="shareCaseBtn">↗ Bagikan</button>'+
      '<button class="action-btn favorite-action '+(p.watchCases?(isFavoriteCase(c.case_id)?"active":""):"restricted")+'" id="favoriteCaseBtn"'+(!p.watchCases?' aria-disabled="true" title="Hanya Admin dan Wasatpel"':"")+'>'+(p.watchCases?(isFavoriteCase(c.case_id)?"★ Dipantau":"☆ Pantau"):"🔒 Pantau")+'</button>'+
      '<details class="detail-more" id="detailMore"><summary class="action-btn">Lainnya ⋮</summary><div class="detail-more-menu">'+
        '<button class="detail-more-item" id="copyCase">Salin Ringkasan</button>'+
        '<button class="detail-more-item" id="qrCaseBtn">▦ QR Perkara</button>'+
        phoneAction+kejaksaanAction+
      '</div></details>'+
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
          infoGrid(vehicleDetail,[["nama_pemilik","Nama Pemilik"],["alamat_pemilik","Alamat Pemilik"],["merk","Merk"],["tipe","Tipe"],["jenis_kendaraan","Jenis Kendaraan"],["tahun_rakit","Tahun"],["bahan_bakar","Bahan Bakar"],["no_uji","No. Uji"],["masa_berlaku_kir","Masa Berlaku KIR","date"],["jbb","JBB"],["jbi","JBI"],["berat_timbang","Berat Timbang"],["berat_lebih","Berat Lebih"],["persentase_lebih","Persentase Lebih"]])+
        '</section>'+
        (photos.length?'<section class="detail-card"><h3 class="detail-card-title"><span class="detail-card-icon">▧</span>Foto ETLE</h3><div class="detail-photos-strip">'+photos.map((x,i)=>'<button type="button" class="detail-photo-thumb'+(i===0?" active":"")+'" data-photo="'+esc(x.photo_url)+'" aria-label="Tampilkan '+esc(x.description||x.photo_type||"foto ETLE")+'"><img src="'+esc(x.photo_url)+'" alt="'+esc(x.description||x.photo_type||"Foto ETLE")+'" loading="lazy" decoding="async" fetchpriority="low"></button>').join("")+'</div></section>':"")+
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

  document.querySelectorAll(".detail-photo-thumb").forEach(btn=>btn.onclick=()=>{
    const main=$("detailMainPhoto");
    const src=btn.dataset.photo;
    if(main&&src&&main.src!==src){
      main.src=src;
      main.alt="Foto ETLE "+(c.tnkb||"");
    }
    document.querySelectorAll(".detail-photo-thumb").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
  });
  if($("shareCaseBtn"))$("shareCaseBtn").onclick=()=>shareCase(d);
  if($("favoriteCaseBtn"))$("favoriteCaseBtn").onclick=async()=>{
    if(!perms().watchCases){toast("Fitur Pantau hanya dapat digunakan Admin dan Wasatpel.");return}
    const next=!isFavoriteCase(c.case_id);
    const result=await setFavoriteCase(c.case_id,next);
    renderNav();
    if(state.page==="favorites")favoritesPage(state.bundle||demo);
    renderDetail(d);
    if(result.remote)toast(next?"Perkara Dipantau tersinkron ke Supabase":"Perkara dihapus dari Dipantau");
    else toast(next?"Perkara disimpan lokal; sinkronisasi Supabase belum aktif":"Perkara dihapus dari Dipantau")
  };
    if($("qrCaseBtn"))$("qrCaseBtn").onclick=()=>showCaseQr(d);if($("copyPhone"))$("copyPhone").onclick=async()=>{await navigator.clipboard.writeText(phone);toast("Nomor telepon disalin")};
  if($("waBtn"))$("waBtn").onclick=()=>openWhatsApp(d);
  if($("kejaksaanBtn"))$("kejaksaanBtn").onclick=()=>window.open(kejaksaanUrl(c.no_blanko),"_blank","noopener,noreferrer");if($("confirmEtleBtn"))$("confirmEtleBtn").onclick=()=>{const url=etleConfirmationUrl(c);if(!url){toast("No. Registrasi atau TNKB belum tersedia");return}window.open(url,"_blank","noopener,noreferrer");toast("Membuka Konfirmasi ETLE otomatis")};if($("qrConfirmBtn"))$("qrConfirmBtn").onclick=()=>showConfirmQr(d);
  $("copyCase").onclick=async()=>{await navigator.clipboard.writeText("TNKB: "+(c.tnkb||"-")+"\nNo. Registrasi: "+(c.no_registrasi||"-")+"\nJenis Pelanggaran: "+(c.jenis_pelanggaran||"-")+"\nNo. Blanko: "+(c.no_blanko||"-")+"\nBRIVA: "+(c.no_briva||"-"));toast("Ringkasan perkara disalin")};
  bindDetailActions(d);
}
function manualSection(d){const m=d.manual||{};if(!perms().admin)return'<section class="detail-section"><h3 class="section-heading">Status Manual G-Smart</h3>'+infoGrid(m,[["kategori_internal","Kategori"],["prioritas","Prioritas"],["status_lebih_bayar","Status Lebih Bayar"],["nominal_lebih_bayar","Nominal Lebih Bayar","money"],["status_pengembalian","Status Pengembalian"],["pic_name","PIC"],["catatan_ringkas","Catatan"]])+'<div class="action-row" style="margin-top:10px"><button class="action-btn" id="deniedManualEdit">🔒 Ubah Status G-SMART</button></div></section>';return'<section class="detail-section"><h3 class="section-heading">Status Manual G-Smart</h3><div class="form-grid"><label>Kategori<select id="manualCategory"><option>BELUM_DIPROSES</option><option>SUDAH_DIKONFIRMASI</option><option>SIAP_SIDANG</option><option>SELESAI</option></select></label><label>Prioritas<select id="manualPriority"><option>NORMAL</option><option>TINGGI</option><option>URGENT</option></select></label><label>Status Lebih Bayar<input id="overStatus" value="'+esc(m.status_lebih_bayar||"")+'"></label><label>Nominal Lebih Bayar<input id="overAmount" type="number" min="0" value="'+esc(m.nominal_lebih_bayar||"")+'"></label><label>Status Pengembalian<input id="refundStatus" value="'+esc(m.status_pengembalian||"")+'"></label><label class="full">Catatan<textarea id="manualNote" rows="3">'+esc(m.catatan_ringkas||"")+'</textarea></label><div class="full"><button id="saveManual" class="primary-btn">Simpan Status G-Smart</button></div></div></section>'}
function notesSection(d){return'<section class="detail-section"><h3 class="section-heading">Catatan Petugas</h3><div class="form-grid"><label class="full">Tambah Catatan<textarea id="newNote" rows="2" placeholder="Tulis catatan petugas..."></textarea></label><div class="full"><button id="addNote" class="action-btn primary">Tambah Catatan</button></div></div><div class="timeline" style="margin-top:14px">'+(d.notes?.length?d.notes.map(n=>'<div class="timeline-item"><b>'+esc(n.created_by_name||"Petugas")+'</b><span>'+esc(n.note)+'</span><small>'+fmtDate(n.created_at)+'</small></div>').join(""):'<div class="empty">Belum ada catatan.</div>')+'</div></section>'}
function timelineSection(rows){return'<section class="detail-section"><h3 class="section-heading">Timeline Perkara</h3><div class="timeline">'+(rows.length?rows.map(h=>'<div class="timeline-item"><b>'+esc(historyDisplayTitle(h))+'</b><span>'+esc(h.description||h.source||"")+'</span><small>'+fmtDate(h.event_time)+'</small></div>').join(""):'<div class="empty">Belum ada riwayat.</div>')+'</div></section>'}
function bindDetailActions(d){if($("deniedManualEdit"))$("deniedManualEdit").onclick=()=>toast("User Anda tidak mempunyai kewenangan untuk mengubah Status G-SMART. Silakan hubungi Administrator.");if($("manualCategory"))$("manualCategory").value=d.manual?.kategori_internal||"BELUM_DIPROSES";if($("manualPriority"))$("manualPriority").value=d.manual?.prioritas||"NORMAL";if($("saveManual"))$("saveManual").onclick=async()=>{try{setSync("Menyimpan");await write("gsmart_case_status",{case_id:d.case.case_id,kategori_internal:$("manualCategory").value,prioritas:$("manualPriority").value,status_lebih_bayar:$("overStatus").value||null,nominal_lebih_bayar:$("overAmount").value?Number($("overAmount").value):null,status_pengembalian:$("refundStatus").value||null,catatan_ringkas:$("manualNote").value||null,pic_uid:state.profile.uid,pic_name:state.profile.nama,updated_by:state.profile.uid},{onConflict:"case_id"});toast("Status G-Smart disimpan");await refreshDetail()}catch(e){toast(e.message)}finally{setSync("Siap")}};if($("addNote"))$("addNote").onclick=async()=>{const note=$("newNote").value.trim();if(!note)return;try{await write("gsmart_case_notes",{case_id:d.case.case_id,note,created_by:state.profile.uid,created_by_name:state.profile.nama});toast("Catatan ditambahkan");await refreshDetail()}catch(e){toast(e.message)}}}
async function refreshDetail(){const id=state.detail.case.case_id;state.detail=await loadDetail(id);renderDetail(state.detail)}
function openWhatsApp(d){const phone=normalizePhone(d.offender?.no_telp);if(!phone){toast("Nomor WhatsApp tidak valid");return}const c=d.case;let msg="Yth. Bapak/Ibu,\n\nKami dari Response Center ETLE Hub UPPKB Guyangan ingin mengonfirmasi terkait pelanggaran "+(c.jenis_pelanggaran||"ETLE")+" untuk kendaraan:\n\nNo. Polisi: "+(c.tnkb||"-")+"\n\nMohon konfirmasinya agar dapat kami lakukan pengecekan lebih lanjut pada sistem.";if(c.no_blanko&&hasCourtFine(d)){const fine=positiveAmount(d?.court?.denda_putusan)?d.court.denda_putusan:d?.payment?.denda_pengadilan;msg+="\n\nInformasi E-Tilang Kejaksaan:\nNo. Blanko: "+c.no_blanko+"\nDenda Putusan: "+money(fine)+"\nDetail E-Tilang Kejaksaan:\n"+kejaksaanUrl(c.no_blanko)}msg+="\n\nTerima kasih.\n\nResponse Center ETLE Hub UPPKB Guyangan";window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(msg),"_blank")}
function normalizePhone(v){const d=String(v||"").replace(/\D/g,"");if(d.startsWith("08"))return"62"+d.slice(1);if(d.startsWith("628"))return d;return null}
$("closeModal").onclick=()=>$("modalBackdrop").classList.add("hidden");$("modalBackdrop").onclick=e=>{if(e.target===$("modalBackdrop"))$("modalBackdrop").classList.add("hidden")};
async function loadProfile(user){const snap=await getDoc(doc(db,"users",user.uid));if(!snap.exists())throw new Error("Profil petugas belum terdaftar.");const p=snap.data();if(p.aktif===false)throw new Error("Akun Anda tidak aktif. Hubungi administrator.");if(!user.uid||p.aktif!==true)throw new Error("Profil petugas tidak lengkap. Hubungi administrator.");const required=key=>{const value=typeof p[key]==="string"?p[key].trim():"";if(!value)throw new Error("Profil petugas tidak lengkap. Hubungi administrator.");return value};const photoUrl=typeof p.photoUrl==="string"&&p.photoUrl.trim()?p.photoUrl.trim():null;return{uid:user.uid,nama:required("nama"),nip:required("nip"),username:required("username"),role:required("role"),aktif:true,photoUrl}}
async function loadDashboard(){
  setSync("Memuat...");
  const[cases,shipping,disputes,terminated,courts,offenders,histories,syncLogs]=await Promise.all([
    q("etle_cases",{order:"tanggal_pelanggaran.desc.nullslast"}),
    q("etle_shipping",{order:"printed_date.desc.nullslast"}),
    q("etle_disputes",{order:"confirmation_date.desc.nullslast"}),
    q("etle_terminated_cases",{order:"terminated_at.desc.nullslast"}),
    q("etle_court_info",{order:"tanggal_sidang.desc.nullslast"}),
    q("etle_offenders",{order:"case_id.asc"}),
    q("gsmart_case_history",{order:"event_time.desc.nullslast"}),
    q("gsmart_sync_log",{order:"started_at.desc",limit:30})
  ]);
  state.bundle={cases,shipping,disputes,terminated,courts,offenders,histories,syncLogs};
  await loadFavoriteIds();
  state.lastDataLoadedAt=new Date();
  setSync("Data dimuat "+syncTimeLabel(state.lastDataLoadedAt))
}
$("loginForm").onsubmit=async e=>{e.preventDefault();interactiveLogin=true;$("loginMessage").textContent="Memverifikasi akun...";try{const c=await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value);state.profile=await loadProfile(c.user);state.demo=false;recordSuccessfulLogin();await loadDashboard();$("loginMessage").textContent="";if(window.gsmartPlaySplash)await window.gsmartPlaySplash("post-login");showApp()}catch(err){if(auth.currentUser)await signOut(auth).catch(()=>{});$("loginMessage").textContent=err.message||"Login gagal."}finally{interactiveLogin=false}};
$("forgotPasswordBtn").onclick=async()=>{const email=$("email").value.trim();const message=$("loginMessage");if(!email){message.textContent="Masukkan email akun G-Smart terlebih dahulu."; $("email").focus();return}const btn=$("forgotPasswordBtn");btn.disabled=true;const oldText=btn.textContent;btn.textContent="Mengirim link reset...";message.textContent="";try{await sendPasswordResetEmail(auth,email);message.classList.add("success");message.textContent="Link reset password sudah dikirim. Silakan cek inbox atau folder spam email Anda."}catch(err){message.classList.remove("success");if(err?.code==="auth/invalid-email")message.textContent="Format email tidak valid.";else if(err?.code==="auth/too-many-requests")message.textContent="Terlalu banyak percobaan. Silakan coba lagi beberapa saat.";else message.textContent="Permintaan reset password belum dapat diproses. Pastikan email akun benar lalu coba lagi."}finally{btn.disabled=false;btn.textContent=oldText}};
$("demoBtn").onclick=()=>{state.lastDataLoadedAt=null;state.demo=true;state.profile={uid:"demo",nama:"Preview Demo",role:"ADMIN"};state.bundle=demo;state.favoriteIds=getLocalFavoriteIds();state.favoritesRemote=false;showApp()};
$("logoutBtn").onclick=async()=>{state.profile=null;state.bundle=null;state.lastDataLoadedAt=null;state.demo=false;state.month=null;state.favoriteIds=null;state.favoritesRemote=false;await signOut(auth);showLogin()};
if($("refreshDataBtn"))$("refreshDataBtn").onclick=async()=>{
  if(state.demo){toast("Mode preview menggunakan data contoh");return}
  const btn=$("refreshDataBtn");
  if(btn.disabled)return;
  btn.disabled=true;
  btn.classList.add("refreshing");
  try{
    await loadDashboard();
    buildMonthOptions();
    renderNav();
    renderPage();
    toast("Data G-Smart berhasil diperbarui");
  }catch(err){
    console.error(err);
    setSync("Gagal memuat");
    toast("Gagal memperbarui data. Periksa koneksi lalu coba lagi.")
  }finally{
    btn.disabled=false;
    btn.classList.remove("refreshing")
  }
};
function isMobileLayout(){return window.matchMedia("(max-width:800px)").matches||window.innerWidth<=800||(window.visualViewport&&window.visualViewport.width<=800)}
function setMobileSidebarOpen(open){
  const sidebar=document.querySelector(".sidebar");
  const backdrop=$("mobileNavBackdrop");
  sidebar?.classList.toggle("open",!!open);
  backdrop?.classList.toggle("open",!!open);
  document.body.classList.toggle("mobile-nav-open",!!open);
}
$("menuBtn").onclick=e=>{
  e.preventDefault();
  e.stopPropagation();
  const sidebar=document.querySelector(".sidebar");
  const shell=document.querySelector(".app-shell");
  if(isMobileLayout()){
    setMobileSidebarOpen(!sidebar?.classList.contains("open"));
  }else{
    setDesktopSidebarHidden(!shell?.classList.contains("sidebar-hidden"));
  }
};
if($("mobileNavBackdrop"))$("mobileNavBackdrop").onclick=()=>setMobileSidebarOpen(false);
if($("sidebarHideBtn"))$("sidebarHideBtn").onclick=()=>{
  const sidebar=document.querySelector(".sidebar");
  if(isMobileLayout()){
    setMobileSidebarOpen(false);
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

function isShortcutTypingTarget(el){
  if(!el)return false;
  const tag=el.tagName?.toLowerCase();
  return tag==="input"||tag==="textarea"||tag==="select"||el.isContentEditable
}
if($("assistantBtn"))$("assistantBtn").onclick=()=>openCommandPalette("assistant");
if($("gitaAvatarBtn")){
  const gitaBtn=$("gitaAvatarBtn");
  const gitaBubble=$("gitaGreeting");
  gitaBtn.onclick=()=>{gitaBubble?.classList.remove("show");openCommandPalette("assistant")};
  gitaBtn.onpointerenter=e=>{
    const r=gitaBtn.getBoundingClientRect();
    const x=((e.clientX-r.left)/Math.max(r.width,1)-.5)*2;
    const y=((e.clientY-r.top)/Math.max(r.height,1)-.5)*2;
    gitaBtn.style.setProperty("--gita-rx",(y*-7).toFixed(1)+"deg");
    gitaBtn.style.setProperty("--gita-ry",(x*7).toFixed(1)+"deg")
  };
  gitaBtn.onpointermove=gitaBtn.onpointerenter;
  gitaBtn.onpointerleave=()=>{gitaBtn.style.setProperty("--gita-rx","0deg");gitaBtn.style.setProperty("--gita-ry","0deg")};
  if(gitaBubble){
    setTimeout(()=>{if(!$("appView")?.classList.contains("hidden"))gitaBubble.classList.add("show")},1100);
    setTimeout(()=>gitaBubble.classList.remove("show"),6500);
    gitaBubble.onclick=()=>{gitaBubble.classList.remove("show");openCommandPalette("assistant")}
  }
}
if($("commandPaletteClose"))$("commandPaletteClose").onclick=closeCommandPalette;
if($("commandPalette"))$("commandPalette").onclick=e=>{if(e.target===$("commandPalette"))closeCommandPalette()};
if($("commandPaletteInput")){
  $("commandPaletteInput").oninput=()=>{if($("commandPaletteInput").dataset.mode==="shortcuts")$("commandPaletteInput").dataset.mode="command";renderCommandPalette()};
  $("commandPaletteInput").onkeydown=e=>{
    if(e.key==="Enter"){
      e.preventDefault();
      const raw=$("commandPaletteInput").value.trim();
      const first=document.querySelector("#commandPaletteResults [data-command-page],#commandPaletteResults [data-command-case]");
      if(raw&&document.querySelector("#commandPaletteResults .cp-ai-run"))runAssistantQuery(raw);
      else first?.click()
    }
  }
}
document.addEventListener("keydown",e=>{
  const appVisible=!$("appView")?.classList.contains("hidden");
  if(!appVisible)return;

  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){
    e.preventDefault();openCommandPalette("command");return
  }
  if(e.key==="Escape"){
    if(commandPaletteOpen()){e.preventDefault();closeCommandPalette();return}
    if(!$("modalBackdrop")?.classList.contains("hidden")){$("modalBackdrop").classList.add("hidden");return}
    setMobileSidebarOpen(false);return
  }
  if(isShortcutTypingTarget(e.target))return;
  if(e.altKey||e.ctrlKey||e.metaKey)return;

  if(e.key==="?"){e.preventDefault();openCommandPalette("shortcuts");return}
  if(e.key==="/"){e.preventDefault();openCommandPalette("command");return}

  const key=e.key.toLowerCase();
  const pages={d:"dashboard",p:"shipping",b:"blanko",s:"court",n:"new",h:"history",a:"analytics",v:"vehicles",f:"favorites",g:"search"};
  if(pages[key]){e.preventDefault();openPage(pages[key]);return}
  if(key==="r"){
    e.preventDefault();
    $("refreshDataBtn")?.click()
  }
});

onAuthStateChanged(auth,async u=>{if(!u||state.demo||interactiveLogin)return;try{state.profile=await loadProfile(u);await loadDashboard();showApp()}catch(e){console.error(e);await signOut(auth);showLogin()}})
