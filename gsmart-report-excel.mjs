// G-Smart ETLE Excel exporter. Browser-only, no CDN, no extra database calls.
// Produces standards-based XLSX (OOXML in an uncompressed ZIP container).
const xml = value => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").slice(0,32767).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[char]));
const encoder = new TextEncoder();
const asBytes = value => typeof value === "string" ? encoder.encode(value) : value;
const joinBytes = parts => { const length=parts.reduce((n,x)=>n+x.length,0);const result=new Uint8Array(length);let at=0;parts.forEach(x=>{result.set(x,at);at+=x.length});return result; };
const uint16=n=>Uint8Array.of(n&255,(n>>>8)&255);
const uint32=n=>Uint8Array.of(n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255);
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let b=0;b<8;b++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0});
const crc32=bytes=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0};
function zip(files){
  if(files.length>65535)throw Error("Terlalu banyak berkas Excel");
  const locals=[],centrals=[];let offset=0;
  for(const [filename,body] of files){
    const name=asBytes(filename),data=asBytes(body);
    const n=data.length,crc=crc32(data),flags=0x800;
    const local=joinBytes([uint32(0x04034b50),uint16(20),uint16(flags),uint16(0),uint16(0),uint16(33),
      uint32(crc),uint32(n),uint32(n),uint16(name.length),uint16(0),name,data]);
    const central=joinBytes([uint32(0x02014b50),uint16(20),uint16(20),uint16(flags),uint16(0),uint16(0),
      uint16(33),uint32(crc),uint32(n),uint32(n),uint16(name.length),uint16(0),uint16(0),uint16(0),
      uint16(0),uint32(0),uint32(offset),name]);
    locals.push(local);centrals.push(central);offset+=local.length;
  }
  const index=joinBytes(centrals);
  const end=joinBytes([uint32(0x06054b50),uint16(0),uint16(0),uint16(files.length),uint16(files.length),uint32(index.length),uint32(offset),uint16(0)]);
  return joinBytes([...locals,index,end]);
}
const letters=index=>{let s="";for(let n=index+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
const textCell=(at,value,style=4)=>'<c r="'+at+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
const numberCell=(at,n,style=6)=>'<c r="'+at+'" s="'+style+'"><v>'+Number(n||0)+'</v></c>';
const formulaCell=(at,formula,style=6)=>'<c r="'+at+'" s="'+style+'"><f>'+xml(formula)+'</f></c>';
const row=(n,cells,height=22)=>'<row r="'+n+'" ht="'+height+'" customHeight="1">'+cells.join("")+'</row>';
const num=v=>({number:Number(v||0)});
const dateValue=v=>({date:v});
function dateKey(value){
  if(!value)return "";
  if(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return "";
  const parts=new Intl.DateTimeFormat("en-US",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Jakarta"}).formatToParts(d);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return p.year+"-"+p.month+"-"+p.day;
}
const inMonth=(date,month)=>!month||dateKey(date).slice(0,7)===month;
const excelDate=value=>{
  const d=dateKey(value);if(!d)return null;
  const [y,m,day]=d.split("-").map(Number);
  return (Date.UTC(y,m-1,day)-Date.UTC(1899,11,30))/86400000;
};
function dataCell(at,value,index){
  const alternate=index%2===1;
  if(value&&typeof value==="object"&&Object.hasOwn(value,"date")){
    const n=excelDate(value.date);
    return n==null?textCell(at,"",alternate?5:4):numberCell(at,n,alternate?11:10);
  }
  if(value&&typeof value==="object"&&Object.hasOwn(value,"number"))
    return numberCell(at,value.number,alternate?7:6);
  return textCell(at,value??"",alternate?5:4);
}
const sheetHead='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  +'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
const pageSettings='<pageMargins left="0.3" right="0.3" top="0.55" bottom="0.55" header="0.2" footer="0.2"/>'
  +'<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
const widthTag=widths=>'<cols>'+widths.map((width,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+width+'" customWidth="1"/>').join("")+'</cols>';
function listSheet({title,period,updated,note,headers,rows,widths}){
  const count=headers.length,last=letters(count-1);
  let content=[
    row(1,[textCell("A1","G-SMART  /  "+title,1)],31),
    row(3,[textCell("A3","UPPKB GUYANGAN  •  LAPORAN OPERASIONAL ETLE",2)],23),
    row(4,[textCell("A4","Periode: "+period+"    |    Data dimuat: "+updated,2)],23),
    row(5,[textCell("A5",note,12)],32),
    row(6,headers.map((x,i)=>textCell(letters(i)+"6",x,3)),34),
  ];
  rows.forEach((values,i)=>content.push(row(i+7,values.map((v,j)=>dataCell(letters(j)+(i+7),v,i)),23)));
  if(!rows.length)content.push(row(7,[textCell("A7","Tidak ada data untuk periode ini.",12)],24));
  const lastRow=Math.max(6,rows.length+6),endMerge=last+"5";
  return sheetHead+'<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
    +'<dimension ref="A1:'+last+Math.max(7,lastRow)+'"/>'
    +'<sheetViews><sheetView workbookViewId="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    +'<sheetFormatPr defaultRowHeight="20"/>'+widthTag(widths)
    +'<sheetData>'+content.join("")+'</sheetData>'
    +'<mergeCells count="4"><mergeCell ref="A1:'+last+'2"/><mergeCell ref="A3:'+last+'3"/><mergeCell ref="A4:'+last+'4"/><mergeCell ref="A5:'+endMerge+'"/></mergeCells>'
    +'<autoFilter ref="A6:'+last+lastRow+'"/>'+pageSettings+'</worksheet>';
}
function summarySheet(report,period,updated){
  const cat=report.types||{};
  const info=[
    ["Pelanggaran Diproses",report.total],
    ["Pengiriman Surat",report.shipping],
    ["Blanko Tilang",report.blanko],
    ["Tersanggah (Riwayat)",report.disputes],
    ["Konfirmasi Daya Angkut Sosialisasi",report.socialization],
    ["Dihentikan",report.terminated],
    ["Persidangan",report.court],
  ];
  const typeRows=[
    ["Dokumen",cat.dokumen||0],["Daya Angkut",cat.dayaAngkut||0],
    ["Dokumen Daya Angkut",cat.dokumenDayaAngkut||0],["Lainnya",cat.lainnya||0],
    ["Belum diketahui",cat.tidakDiketahui||0],
  ];
  const rows=[
    row(1,[textCell("A1","G-SMART  |  LAPORAN OPERASIONAL ETLE",1)],33),
    row(3,[textCell("A3","UPPKB GUYANGAN  •  RINGKASAN PERKARA",2)]),
    row(5,[textCell("A5","Periode: "+period+"  |  Data dimuat: "+updated,2)],28),
    row(7,[textCell("A7","TOTAL PERKARA",3),textCell("C7","BERHASIL KONFIRMASI",3),
      textCell("E7","BELUM KONFIRMASI",3),textCell("G7","SUCCESS RATE",3)],27),
    row(8,[numberCell("A8",report.total,13),numberCell("C8",report.success,13),
      numberCell("E8",report.pending,13),numberCell("G8",report.total?report.success/report.total:0,8)],34),
    row(10,[textCell("A10","RINGKASAN ETLE",9)],28),
  ];
  info.forEach(([label,value],i)=>rows.push(row(11+i,[textCell("A"+(i+11),label,i%2?5:4),numberCell("D"+(i+11),value,i%2?7:6)],22)));
  rows.push(row(19,[textCell("A19","JENIS PELANGGARAN",9)],28));
  typeRows.forEach(([label,value],i)=>rows.push(row(20+i,[textCell("A"+(i+20),label,i%2?5:4),numberCell("D"+(i+20),value,i%2?7:6)],22)));
  rows.push(row(25,[textCell("A25","TOTAL JENIS PELANGGARAN",9),formulaCell("D25","SUM(D20:D24)",13)],27));
  rows.push(row(27,[textCell("A27","KONFIRMASI PELANGGARAN",9)],27));
  rows.push(row(28,[textCell("A28","Berhasil Konfirmasi",4),numberCell("D28",report.success)]));
  rows.push(row(29,[textCell("A29","Belum Konfirmasi",5),numberCell("D29",report.pending,7)]));
  rows.push(row(30,[textCell("A30","Success Rate",4),formulaCell("D30","IFERROR(D28/A8,0)",8)]));
  rows.push(row(32,[textCell("A32","CATATAN",9)],27));
  rows.push(row(33,[textCell("A33","Ringkasan mengikuti perhitungan Laporan ETLE G-Smart pada periode terpilih.",12)],32));
  rows.push(row(34,[textCell("A34","Sheet rincian memakai tanggal proses masing-masing; total antar-sheet tidak dijumlahkan.",12)],32));
  rows.push(row(35,[textCell("A35","Tersanggah merupakan riwayat proses; perkara dapat berlanjut ke Blanko atau Dihentikan.",12)],32));
  const merged=["A1:H2","A3:H3","A5:H5","A10:H10","A19:H19","A27:H27","A32:H32","A33:H33","A34:H34","A35:H35"];
  return sheetHead+'<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
    +'<dimension ref="A1:H35"/>'
    +'<sheetViews><sheetView workbookViewId="0"/></sheetViews>'+widthTag([27,13,26,16,25,13,23,17])
    +'<sheetData>'+rows.join("")+'</sheetData>'
    +'<mergeCells count="'+merged.length+'">'+merged.map(ref=>'<mergeCell ref="'+ref+'"/>').join("")+'</mergeCells>'
    +pageSettings+'</worksheet>';
}
function xlsxFiles(namedSheets){
  const names=namedSheets.map(x=>x[0]);
  const root='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const main='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const relationships='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const workbook=root+'<workbook xmlns="'+main+'" xmlns:r="'+relationships+'"><sheets>'
    +names.map((name,i)=>'<sheet name="'+xml(name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join("")
    +'</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>';
  const relRoot='http://schemas.openxmlformats.org/package/2006/relationships';
  const wrels=root+'<Relationships xmlns="'+relRoot+'">'
    +names.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+relationships+'/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join("")
    +'<Relationship Id="rId'+(names.length+1)+'" Type="'+relationships+'/styles" Target="styles.xml"/>'
    +'</Relationships>';
  const types=root+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    +'<Default Extension="xml" ContentType="application/xml"/>'
    +'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    +'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    +names.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("")
    +'</Types>';
  const rels=root+'<Relationships xmlns="'+relRoot+'"><Relationship Id="rId1" Type="'+relationships+'/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const fonts='<fonts count="4">'
    +'<font><sz val="10"/><name val="Aptos"/><color rgb="FF24344A"/></font>'
    +'<font><b/><sz val="16"/><name val="Aptos Display"/><color rgb="FFFFFFFF"/></font>'
    +'<font><b/><sz val="10"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font>'
    +'<font><b/><sz val="11"/><name val="Aptos"/><color rgb="FF173B69"/></font>'
    +'</fonts>';
  const fills='<fills count="6"><fill><patternFill patternType="none"/></fill>'
    +'<fill><patternFill patternType="gray125"/></fill>'
    +'<fill><patternFill patternType="solid"><fgColor rgb="FF102E4F"/><bgColor indexed="64"/></patternFill></fill>'
    +'<fill><patternFill patternType="solid"><fgColor rgb="FF2563A7"/><bgColor indexed="64"/></patternFill></fill>'
    +'<fill><patternFill patternType="solid"><fgColor rgb="FFEBF3FC"/><bgColor indexed="64"/></patternFill></fill>'
    +'<fill><patternFill patternType="solid"><fgColor rgb="FFF5F9FE"/><bgColor indexed="64"/></patternFill></fill></fills>';
  const borders='<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'
    +'<border><left/><right/><top/><bottom style="hair"><color rgb="FFD7E2ED"/></bottom><diagonal/></border></borders>';
  const xf=(font,fill,border,numfmt,alignment='')=>'<xf numFmtId="'+numfmt+'" fontId="'+font+'" fillId="'+fill+'" borderId="'+border+'" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" '+alignment+'/></xf>';
  const styles=root+'<styleSheet xmlns="'+main+'">'+fonts+fills+borders
    +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    +'<cellXfs count="14">'
    +xf(0,0,0,0)+xf(1,2,0,0)+xf(3,4,0,0)+xf(2,3,0,0,'wrapText="1"')
    +xf(0,0,1,0)+xf(0,5,1,0)+xf(0,0,1,3,'horizontal="right"')+xf(0,5,1,3,'horizontal="right"')
    +xf(3,4,0,10,'horizontal="right"')+xf(3,4,0,0)+xf(0,0,1,14)+xf(0,5,1,14)
    +xf(3,4,0,0,'wrapText="1"')+xf(3,4,0,3,'horizontal="right"')
    +'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  return zip([["[Content_Types].xml",types],["_rels/.rels",rels],["xl/workbook.xml",workbook],
    ["xl/_rels/workbook.xml.rels",wrels],["xl/styles.xml",styles],
    ...namedSheets.map(([_,content],i)=>["xl/worksheets/sheet"+(i+1)+".xml",content])]);
}
const sortDesc=(rows,getDate)=>[...rows].sort((a,b)=>dateKey(getDate(b)).localeCompare(dateKey(getDate(a))));
const registration=c=>c?.no_registrasi||c?.ref_number||"";
const typeText=(c,classify)=>classify(c)||"Belum diketahui";
export function buildEtleExcel({bundle,summary,month=null,periodLabel="Semua Data",classify,shippingRows,includePayment=false,updatedAt=null}){
  if(!bundle||!summary||!Array.isArray(summary.ids)||typeof classify!=="function")throw Error("Data laporan Excel belum siap");
  const period=periodLabel,loaded=updatedAt?dateKey(updatedAt):dateKey(new Date());
  const cases=bundle.cases||[],byId=new Map(cases.map(c=>[String(c.case_id),c]));
  const stoppedRows=bundle.terminated||[],disputeRows=bundle.disputes||[],courtRows=bundle.courts||[];
  const stopped=new Map(stoppedRows.map(x=>[String(x.case_id),x]));
  const disputed=new Set(disputeRows.map(x=>String(x.case_id)));
  const ids=new Set(summary.ids.map(String));
  const format=status=>String(status||"").replaceAll("_"," ");
  const detailRecords=sortDesc(cases.filter(x=>ids.has(String(x.case_id))),x=>x.first_seen_at)
    .map((c,i)=>[num(i+1),registration(c),c.tnkb||"",dateValue(c.tanggal_pelanggaran),
      typeText(c,classify),dateValue(c.first_seen_at),format(c.status_etle),c.no_blanko||"",
      dateValue(c.tanggal_blanko),dateValue(c.archived_at),dateValue(stopped.get(String(c.case_id))?.terminated_at),
      c.no_blanko?"Blanko Terbit":stopped.has(String(c.case_id))?"Dihentikan":c.is_archived?"Sosialisasi":disputed.has(String(c.case_id))?"Tersanggah":"Belum Konfirmasi"]);
  const shipping=sortDesc((shippingRows||bundle.shipping||[]).filter(x=>inMonth(x.printed_date,month)),x=>x.printed_date)
    .map((x,i)=>{const c=byId.get(String(x.case_id));return[num(i+1),dateValue(x.printed_date),registration(c)||x.ref_number||"",
      c?.tnkb||x.tnkb||"",typeText(c,classify),x.tracking_number||"",x.courier||"",format(x.status),
      dateValue(x.delivered_at)]});
  const blanko=sortDesc(cases.filter(x=>x.no_blanko&&inMonth(x.tanggal_blanko,month)),x=>x.tanggal_blanko)
    .map((c,i)=>[num(i+1),dateValue(c.tanggal_blanko),registration(c),c.tnkb||"",typeText(c,classify),
      c.no_blanko||"",includePayment?format(c.status_bayar):"Akses dibatasi",format(c.status_etle)]);
  const disputes=sortDesc(disputeRows.filter(x=>inMonth(x.confirmation_date,month)),x=>x.confirmation_date)
    .map((x,i)=>{const c=byId.get(String(x.case_id));const current=stopped.has(String(x.case_id))?"Dihentikan":c?.no_blanko?"Blanko Terbit":format(c?.status_etle||x.status||"Tersanggah");return[
      num(i+1),dateValue(x.confirmation_date),registration(c),c?.tnkb||"",typeText(c,classify),
      x.reason||"",current,stopped.has(String(x.case_id))||c?.no_blanko?"Riwayat sanggahan tetap tercatat":"Masih dalam proses"
    ]});
  const stoppedList=sortDesc(stoppedRows.filter(x=>inMonth(x.terminated_at,month)),x=>x.terminated_at)
    .map((x,i)=>{const c=byId.get(String(x.case_id));return[num(i+1),dateValue(x.terminated_at),
      registration(c)||x.ref_number||"",c?.tnkb||x.tnkb||"",typeText(c,classify),
      x.reason||"",disputed.has(String(x.case_id))?"Ya":"Tidak"]});
  const court=sortDesc(courtRows.filter(x=>inMonth(x.tanggal_sidang,month)),x=>x.tanggal_sidang)
    .map((x,i)=>{const c=byId.get(String(x.case_id));return[num(i+1),dateValue(x.tanggal_sidang),registration(c),
      c?.tnkb||"",c?.no_blanko||"",format(x.status_sidang),x.pengadilan||""]});
  const ctx={period,updated:loaded};
  const common="Sheet rincian mengikuti tanggal proses masing-masing; satu perkara dapat muncul di lebih dari satu sheet.";
  const named=[
    ["Ringkasan ETLE",summarySheet(summary,period,loaded)],
    ["Daftar Perkara",listSheet({...ctx,title:"DAFTAR PERKARA",note:"Daftar perkara berdasarkan kelompok Ringkasan ETLE pada periode yang dipilih.",headers:["No","No. Registrasi","TNKB","Tanggal Pelanggaran","Jenis Pelanggaran","Pertama Tercatat","Status ETLE","No. Blanko","Tanggal Blanko","Tgl. Sosialisasi","Tgl. Dihentikan","Status Konfirmasi"],rows:detailRecords,widths:[7,29,19,21,26,20,23,22,19,20,20,23]})],
    ["Pengiriman Surat",listSheet({...ctx,title:"PENGIRIMAN SURAT",note:common,headers:["No","Tanggal Cetak","No. Registrasi","TNKB","Jenis Pelanggaran","Resi JNE","Kurir","Status Pengiriman","Tanggal Diterima"],rows:shipping,widths:[7,19,29,18,26,25,16,25,20]})],
    ["Blanko Tilang",listSheet({...ctx,title:"BLANKO TILANG",note:common,headers:["No","Tanggal Terbit","No. Registrasi","TNKB","Jenis Pelanggaran","No. Blanko","Status Pembayaran","Status ETLE"],rows:blanko,widths:[7,21,29,18,26,23,25,25]})],
    ["Tersanggah",listSheet({...ctx,title:"TERSANGGAH",note:"Riwayat sanggahan tetap tercatat walaupun perkara kemudian menjadi Blanko atau Dihentikan.",headers:["No","Tanggal Sanggahan","No. Registrasi","TNKB","Jenis Pelanggaran","Alasan Sanggahan","Status Sekarang","Keterangan"],rows:disputes,widths:[7,21,29,18,26,48,23,43]})],
    ["Dihentikan",listSheet({...ctx,title:"DIHENTIKAN",note:common,headers:["No","Tanggal Dihentikan","No. Registrasi","TNKB","Jenis Pelanggaran","Alasan Dihentikan","Pernah Tersanggah"],rows:stoppedList,widths:[7,22,29,18,26,45,20]})],
    ["Persidangan",listSheet({...ctx,title:"PERSIDANGAN",note:"Tanggal sidang merupakan jadwal atau tanggal proses; bukan bukti sidang sudah selesai.",headers:["No","Tanggal Sidang","No. Registrasi","TNKB","No. Blanko","Status Sidang","Pengadilan"],rows:court,widths:[7,22,29,18,22,23,35]})]
  ];
  return xlsxFiles(named);
}
export function downloadEtleExcel(args){
  const month=args.month,filename="Laporan_ETLE_GSmart_"+(month||"Semua_Data")+".xlsx";
  const bytes=buildEtleExcel(args);
  const blob=new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const url=URL.createObjectURL(blob);
  try{
    const a=document.createElement("a");
    a.href=url;a.download=filename;a.style.display="none";
    document.body.appendChild(a);a.click();a.remove();
  }finally{setTimeout(()=>URL.revokeObjectURL(url),60000)}
  return filename;
}
