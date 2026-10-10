// Admin-only G-Smart dispute evidence panel. Server enforces actual access.
// Never writes Firebase tokens, personal records, or image URLs to localStorage.
let liveObjectUrl=null;
function clearPreview(){
  if(liveObjectUrl){URL.revokeObjectURL(liveObjectUrl);liveObjectUrl=null}
}
export function disposePrivateEvidencePreview(){clearPreview();const panel=document.getElementById("gsmartPrivateEvidence");if(panel)panel.dataset.privateCase=""}
async function requestEvidence(endpoint,apiKey,getToken,caseId,action,kind=null){
  const token=await getToken();
  const response=await fetch(endpoint,{
    method:"POST",
    cache:"no-store",
    credentials:"omit",
    headers:{
      apikey:apiKey,
      Authorization:"Bearer "+token,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({action,case_id:caseId,...(kind?{kind}:{})})
  });
  return response;
}
function element(tag,text,cls){
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!=null)node.textContent=String(text);
  return node;
}
function note(panel,message){
  panel.replaceChildren(element("p",message,"prefs-note"));
}
function metadataFields(record){
  const data=record?.offender||{};
  const labels=[
    ["nama","Nama pelanggar"],
    ["alamat","Alamat"],
    ["no_telp","Nomor telepon"],
    ["email","Email"],
    ["no_ktp","No. KTP"],
    ["no_sim","No. SIM"],
    ["golongan_sim","Golongan SIM"],
    ["masa_berlaku_sim","Masa berlaku SIM"],
    ["ttl","Tempat/tanggal lahir"],
    ["tempat_lahir","Tempat lahir"],
    ["tanggal_lahir","Tanggal lahir"],
    ["pekerjaan","Pekerjaan"]
  ];
  return labels.filter(([k])=>data[k]!==undefined&&data[k]!==null&&String(data[k]).trim())
    .map(([key,label])=>[label,String(data[key])]);
}
export async function mountPrivateEvidence(panel,{caseId,endpoint,apiKey,getToken}){
  if(!panel||!caseId)return;
  clearPreview();
  panel.dataset.privateCase=caseId;
  note(panel,"Memeriksa arsip sanggahan privat...");
  let result;
  try{
    const response=await requestEvidence(endpoint,apiKey,getToken,caseId,"detail");
    if(!panel.isConnected||panel.dataset.privateCase!==caseId)return;
    if(response.status===404){
      note(panel,"Foto SIM dan dokumen sanggahan belum disinkronkan untuk perkara ini.");
      return
    }
    if(response.status===401||response.status===403){
      note(panel,"Akses bukti sanggahan dibatasi untuk Admin aktif.");
      return
    }
    if(!response.ok)throw Error("PRIVATE_EVIDENCE_UNAVAILABLE");
    result=await response.json();
  }catch(_){
    if(panel.isConnected&&panel.dataset.privateCase===caseId)
      note(panel,"Arsip privat belum dapat dimuat. Coba buka kembali Detail Perkara.");
    return;
  }
  if(!panel.isConnected||panel.dataset.privateCase!==caseId)return;
  const wrap=element("div",null,"gsmart-private-details");
  const fields=metadataFields(result);
  if(fields.length){
    const dl=element("dl",null,"gsmart-private-fields");
    for(const [label,value] of fields){
      const row=element("div",null,"gsmart-private-row");
      row.append(element("dt",label),element("dd",value));
      dl.append(row);
    }
    wrap.append(dl);
  }
  if(result.reason){
    const reason=element("p",null,"gsmart-private-reason");
    reason.append(element("strong","Alasan sanggahan: "),document.createTextNode(String(result.reason)));
    wrap.append(reason);
  }
  const controls=element("div",null,"gsmart-private-actions");
  const preview=element("div",null,"gsmart-private-preview");
  for(const [kind,title] of [["sim","Lihat Foto SIM"],["document","Buka Dokumen Sanggahan"]]){
    if(!(kind==="sim"?result.has_sim:result.has_document))continue;
    const btn=element("button",title,"action-btn");
    btn.type="button";
    btn.addEventListener("click",async()=>{
      btn.disabled=true;
      clearPreview();
      preview.replaceChildren(element("p","Memuat bukti privat..."));
      try{
        const response=await requestEvidence(endpoint,apiKey,getToken,caseId,"media",kind);
        if(!response.ok)throw Error("MEDIA_UNAVAILABLE");
        const blob=await response.blob();
        if(!panel.isConnected||panel.dataset.privateCase!==caseId)return;
        if(blob.size>8388608 || !["image/jpeg","image/png","image/webp","application/pdf"].includes(blob.type))
          throw Error("UNSUPPORTED_MEDIA");
        liveObjectUrl=URL.createObjectURL(blob);
        preview.replaceChildren();
        if(blob.type==="application/pdf"){
          const a=element("a","Unduh Dokumen Sanggahan (PDF)","action-btn");
          a.href=liveObjectUrl;
          a.download="dokumen-sanggahan.pdf";
          preview.append(a);
        }else{
          const img=element("img",null,"gsmart-private-photo");
          img.src=liveObjectUrl;
          img.alt=kind==="sim"?"Foto SIM - akses Admin":"Dokumen sanggahan - akses Admin";
          img.loading="lazy";
          preview.append(img);
        }
      }catch(_){
        if(panel.isConnected&&panel.dataset.privateCase===caseId)
          preview.replaceChildren(element("p","Bukti tidak dapat dimuat. Coba lagi."));
      }finally{
        if(panel.isConnected&&panel.dataset.privateCase===caseId)btn.disabled=false;
      }
    });
    controls.append(btn);
  }
  if(controls.childNodes.length)wrap.append(controls,preview);
  if(!fields.length&&!result.reason&&!controls.childNodes.length)
    wrap.append(element("p","Belum ada detail atau bukti privat yang tersedia."));
  panel.replaceChildren(wrap);
}
