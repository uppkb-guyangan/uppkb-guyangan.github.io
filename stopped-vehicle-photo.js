// Loads protected ETLE stopped-case vehicle photo only for authenticated PWA users.
// No public ETLE URL, no persistent browser storage. Independent of SIM/objection.
let activeUrl=null;
let generation=0;
export function disposeStoppedVehiclePhoto(){
  generation++;
  if(activeUrl){URL.revokeObjectURL(activeUrl);activeUrl=null}
}
export async function loadStoppedVehiclePhoto(container,{caseId,endpoint,apiKey,getToken}){
  if(!container || !caseId || !container.isConnected)return;
  disposeStoppedVehiclePhoto();
  const generationHere=generation;
  const placeholder=container.querySelector(".detail-photo-empty");
  if(!placeholder)return;
  const label=placeholder.querySelector("span");
  if(label)label.textContent="Memuat foto kendaraan dari arsip ETLE...";
  try{
    const token=await getToken();
    if(generation!==generationHere || !container.isConnected)return;
    const response=await fetch(endpoint,{
      method:"POST",cache:"no-store",credentials:"omit",
      headers:{
        apikey:apiKey,Authorization:"Bearer "+token,"Content-Type":"application/json"
      },body:JSON.stringify({case_id:caseId})
    });
    if(generation!==generationHere || !container.isConnected)return;
    if(response.status===404){
      if(label)label.textContent="Foto kendaraan belum tersedia di arsip ETLE";
      return;
    }
    if(response.status===401||response.status===403){
      if(label)label.textContent="Foto ETLE memerlukan akses G-Smart yang aktif";
      return;
    }
    if(!response.ok)throw Error("PRIVATE_VEHICLE_UNAVAILABLE");
    const blob=await response.blob();
    if(generation!==generationHere || !container.isConnected)return;
    if(blob.size<1000||blob.size>10485760||!["image/jpeg","image/png","image/webp"].includes(blob.type))
      throw Error("INVALID_VEHICLE_PHOTO");
    const url=URL.createObjectURL(blob);
    if(generation!==generationHere || !container.isConnected){
      URL.revokeObjectURL(url);return;
    }
    activeUrl=url;
    const img=document.createElement("img");
    img.id="detailMainPhoto";
    img.alt="Foto kendaraan pelanggaran dari arsip ETLE";
    img.decoding="async";
    img.src=url;
    container.replaceChildren(img);
  }catch(_){
    if(generation===generationHere && label && container.isConnected)
      label.textContent="Foto kendaraan belum dapat dimuat. Coba buka kembali.";
  }
}
