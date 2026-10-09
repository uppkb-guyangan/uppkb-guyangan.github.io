/* G-Smart PWA shipping lifecycle: mirrors status types already used by Android.
 * Pure event detection. Never reads or changes ETLE tables.
 */
const TYPES={
  "TERCETAK":["shipping_printed","Surat ETLE Tercetak","Surat pelanggaran telah dicetak."],
  "DALAM PROSES PENGIRIMAN":["shipping_processing","Surat Dalam Proses Pengiriman","Surat sedang diproses oleh JNE."],
  "TERKIRIM":["shipping_delivered","Surat Berhasil Terkirim","Surat telah diterima di tujuan."],
  "GAGAL KIRIM":["shipping_failed","Pengiriman Surat Gagal","Pengiriman surat mengalami kendala."],
  "DIKEMBALIKAN":["shipping_returned","Surat Dikembalikan","Surat dikembalikan oleh jasa pengiriman."]
};
export const SHIPPING_EVENT_TYPES=Object.freeze(Object.values(TYPES).map(x=>x[0]));

export function normalizeShippingStatus(status){
 const normalized=String(status??"").trim().replace(/\s+/g," ").replace(/_/g," ").toUpperCase();
 return normalized==="SUDAH DICETAK"?"TERCETAK":normalized;
}
export function shippingLifecycleEvents(previous,current){
 const was=previous?.shipping||{};
 const now=current?.shipping||{};
 // Snapshot counters make multiple real transitions back to the same status distinct,
 // while stable event keys and the server delivery ledger protect retries.
 const eventCounts={...(previous?.shippingEventCounts||{})};
 const events=[];
 for(const [caseId,rawStatus] of Object.entries(now)){
   if(!caseId)continue;
   const status=normalizeShippingStatus(rawStatus);
   const previousStatus=normalizeShippingStatus(was[caseId]);
   if(status===previousStatus)continue;
   const event=TYPES[status];
   if(!event)continue;
   const [eventType,label,body]=event;
   const baseKey=eventType+":"+caseId;
   const nextCount=(Number(eventCounts[baseKey])||0)+1;
   eventCounts[baseKey]=nextCount;
   events.push({
     event_key:baseKey+(nextCount===1?"":":v"+nextCount),
     event_type:eventType,
     case_id:caseId,
     title:"G-Smart · "+label,
     body
   });
 }
 return {events:events.sort((a,b)=>a.event_key.localeCompare(b.event_key)),eventCounts};
}
