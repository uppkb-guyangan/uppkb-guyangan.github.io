import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {compactNotification} from "./push-presentation.mjs";

const cases=[
 ["shipping_printed","🖨️ Surat ETLE Tercetak"],
 ["shipping_processing","🚚 Surat Dalam Proses Pengiriman"],
 ["shipping_delivered","✅ Surat Berhasil Terkirim"],
 ["shipping_failed","⚠️ Pengiriman Surat Gagal"],
 ["shipping_returned","↩️ Surat Dikembalikan"],
 ["blanko","🧾 Blanko Tilang Terbit"],
 ["dispute","⚠️ Pelanggaran Tersanggah"]
];
test("all ETLE notification titles match the concise Android naming and emoji",()=>{
 for(const [event_type,title] of cases){
  assert.equal(compactNotification({event_type,title:"G-Smart · Long title",body:"TNKB: L8048UDC · Surat telah diterima di tujuan."}).title,title);
 }
});
test("plate starts the body without redundant TNKB label or trailing full stop",()=>{
 const data={event_type:"shipping_delivered",title:"Old title",
             body:"TNKB: L8048UDC · Surat telah diterima di tujuan."};
 const display=compactNotification(data);
 assert.deepEqual(display,{title:"✅ Surat Berhasil Terkirim",body:"L8048UDC • Surat telah diterima di tujuan"});
 assert.equal(data.body,"TNKB: L8048UDC · Surat telah diterima di tujuan.","ledger event body is unchanged");
});
test("multiple vehicles retain their own plate and message",()=>{
 const items=["L8837VB","L9901AE","AE8256SO"].map(plate=>
  compactNotification({event_type:"shipping_failed",body:"TNKB: "+plate+" · Pengiriman surat mengalami kendala."})
 );
 assert.deepEqual(items.map(x=>x.body),[
  "L8837VB • Pengiriman surat mengalami kendala",
  "L9901AE • Pengiriman surat mengalami kendala",
  "AE8256SO • Pengiriman surat mengalami kendala"
 ]);
});
test("ping and unmatched legacy bodies keep their original text",()=>{
 assert.deepEqual(
  compactNotification({event_type:"pwa_ping",title:"G-Smart · Uji Notifikasi PWA",body:"Pesan uji"}),
  {title:"G-Smart · Uji Notifikasi PWA",body:"Pesan uji"}
 );
 const msg=compactNotification({event_type:"shipping_failed",body:"No plate available."});
 assert.equal(msg.body,"No plate available.");
});
test("Web Push uses app identity rather than a second large icon on the right",()=>{
 const sender=readFileSync(new URL("./push-production.mjs",import.meta.url),"utf8");
 const area=sender.split("webpush:{fcm_options:")[1]?.split("}}")[0]||"";
 assert.ok(area.includes("tag:event.event_key"));
 assert.equal(/\bicon\s*:/.test(area),false);
 assert.ok(sender.includes("const display=compactNotification(event);"));
 assert.ok(sender.includes("notification:{title:display.title,body:display.body}"));
});
