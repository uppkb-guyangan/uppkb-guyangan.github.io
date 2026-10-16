// Loaded only after an explicit developer command. No background polling.
export function maintenanceScope(message) {
  const q=String(message).toLowerCase();
  if(/simulasi/.test(q))return 'simulasi';
  if(/sidang|persidangan/.test(q))return 'persidangan';
  if(/blanko/.test(q))return 'blanko';
  if(/analitik|laporan/.test(q))return 'analitik';
  if(/pwa|cache|offline|notifikasi/.test(q))return 'pwa';
  if(/seluruh|semua|aplikasi|g-?smart/.test(q))return 'aplikasi';
  return 'gita';
}
export async function showDeveloperCommand({intent,out,getSession,endpoint,apiKey,fetcher=fetch}) {
  const initial=await getSession();
  if(!['ADMIN','WASATPEL'].includes(initial.role))throw new Error('Developer Mode hanya untuk Admin dan Wasatpel aktif.');
  out.replaceChildren();
  const panel=document.createElement('section');panel.className='assistant-answer';
  const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;panel.append(el);return el;};
  node('b','GITA Developer Mode');
  node('p',`${intent.action==='fix'?'Perbaiki':'Audit'} kode pada branch pengembangan. Hasil perbaikan berupa draft PR untuk ditinjau.`);
  node('p','Audit AI dibatasi cuplikan kode; seluruh tes regresi tetap dijalankan.');
  node('p','Yang dikirim hanya jenis tindakan dan modul. Jangan masukkan data perkara atau kredensial.');
  const label=node('label','Modul: '),select=document.createElement('select');label.append(select);
  for(const scope of ['aplikasi','gita','pwa','blanko','persidangan','analitik','simulasi']){
    const option=document.createElement('option');option.value=scope;option.textContent=scope;select.append(option);
  }
  select.value=maintenanceScope(intent.request);
  const start=node('button','Jalankan '+(intent.action==='fix'?'perbaikan':'audit'));start.type='button';
  const cancel=node('button','Batal');cancel.type='button';
  const status=node('p','Belum dikirim. Produksi hanya berubah setelah persetujuan Anda.');status.setAttribute('aria-live','polite');
  const refresh=node('button','Periksa status');refresh.type='button';refresh.hidden=true;
  out.append(panel);
  const id=crypto.randomUUID();let pending=false,submitted=false;
  cancel.onclick=()=>{if(!pending&&!submitted)panel.remove();};
  async function call(operation){
    if(pending)return;
    pending=true;start.disabled=true;refresh.disabled=true;cancel.disabled=true;select.disabled=true;
    try{
      const session=await getSession();
      const body=operation==='status'?{operation,request_id:id}:{operation,request_id:id,action:intent.action,scope:select.value,confirmed:true};
      const r=await fetcher(endpoint,{method:'POST',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(30000),
        headers:{'Content-Type':'application/json',apikey:apiKey,Authorization:'Bearer '+session.token},body:JSON.stringify(body)});
      const result=await r.json();
      if(!r.ok||!result.success)throw new Error(result.error||'Layanan belum tersedia.');
      submitted=true;refresh.hidden=false;start.hidden=true;cancel.hidden=true;
      status.textContent=`Status: ${result.state}.`;
      for(const link of panel.querySelectorAll('a'))link.remove();
      for(const [key,text] of [['run_url','Lihat pengujian'],['pr_url','Buka draft PR']]){
        if(!result[key])continue;
        const url=new URL(result[key]);
        if(url.origin!=='https://github.com'||!url.pathname.startsWith('/uppkb-guyangan/uppkb-guyangan.github.io/'))continue;
        const a=node('a',text);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';
      }
    }catch(e){
      status.textContent=`Belum berhasil: ${e.message}. Jika pengiriman terputus, periksa status sebelum mencoba lagi.`;
      refresh.hidden=false;
    }finally{
      pending=false;start.disabled=submitted;refresh.disabled=false;cancel.disabled=submitted;select.disabled=submitted;
    }
  }
  start.onclick=()=>call('start');refresh.onclick=()=>call('status');
}
