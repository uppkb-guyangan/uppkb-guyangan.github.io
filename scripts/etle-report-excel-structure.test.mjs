import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {buildEtleExcel} from "../gsmart-report-excel.mjs";

test("Excel workbook is a complete readable OOXML package (ZIP, XML, styles, relationships)",()=>{
  const sample={
    cases:[
      {case_id:"a",tnkb:"AG 0001 XD",no_registrasi:"R-001",jenis_pelanggaran:"DOKUMEN",
       first_seen_at:"2026-09-29T20:00:00Z",tanggal_pelanggaran:"2026-09-27T05:00:00Z",
       no_blanko:"B-12",tanggal_blanko:"2026-10-01",status_bayar:"TERBAYAR",status_etle:"BLANKO_TERBIT"},
      {case_id:"b",tnkb:"AG 0002 XD",no_registrasi:"R-002",jenis_pelanggaran:"DAYA ANGKUT",
       first_seen_at:"2026-10-02T00:00:00Z",tanggal_pelanggaran:"2026-10-01T00:00:00Z",status_etle:"TERSANGGAH"}
    ],
    shipping:[{case_id:"a",printed_date:"2026-10-01",tracking_number:"JNE-1"}],
    disputes:[{case_id:"b",confirmation_date:"2026-10-02T01:00:00Z",reason:"Mengajukan sanggahan"}],
    terminated:[],courts:[],histories:[]
  };
  const summary={ids:["a","b"],total:2,shipping:1,blanko:1,disputes:1,
    socialization:0,terminated:0,court:0,success:1,pending:1,
    types:{dokumen:1,dayaAngkut:1,dokumenDayaAngkut:0,lainnya:0,tidakDiketahui:0}};
  const bytes=buildEtleExcel({bundle:sample,summary,month:"2026-10",periodLabel:"Oktober 2026",
    classify:r=>r?.jenis_pelanggaran||null,includePayment:true,shippingRows:sample.shipping});
  const check=String.raw`
import sys, io, zipfile, xml.etree.ElementTree as ET
data=sys.stdin.buffer.read()
with zipfile.ZipFile(io.BytesIO(data)) as z:
    assert z.testzip() is None, "ZIP CRC mismatch"
    names=z.namelist()
    assert len(names)==12, "Expected OOXML root files plus 7 worksheets"
    assert len(names)==len(set(names)), "Duplicate ZIP entries"
    for name in names:
        if name.endswith((".xml",".rels")) or name=="[Content_Types].xml":
            ET.fromstring(z.read(name))
    ns={"m":"http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r":"http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "pr":"http://schemas.openxmlformats.org/package/2006/relationships"}
    wb=ET.fromstring(z.read("xl/workbook.xml"))
    sheets=wb.findall("m:sheets/m:sheet",ns)
    assert [s.attrib["name"] for s in sheets]==[
      "Ringkasan ETLE","Daftar Perkara","Pengiriman Surat","Blanko Tilang",
      "Tersanggah","Dihentikan","Persidangan"]
    relationships=ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    idmap={r.attrib["Id"]:r.attrib["Target"] for r in relationships}
    for i,sheet in enumerate(sheets,1):
        rid=sheet.attrib["{%s}id"%ns["r"]]
        assert idmap[rid]=="worksheets/sheet%d.xml"%i, "Sheet relationship mismatch"
    styles=ET.fromstring(z.read("xl/styles.xml"))
    cellXfs=styles.find("m:cellXfs",ns)
    assert cellXfs is not None and len(cellXfs)>=14
    contentTypes=ET.fromstring(z.read("[Content_Types].xml"))
    overrides={e.attrib.get("PartName") for e in contentTypes if "Override" in e.tag}
    assert "/xl/workbook.xml" in overrides
    for n in range(1,8):
        name="xl/worksheets/sheet%d.xml"%n
        assert "/"+name in overrides
        ws=ET.fromstring(z.read(name))
        assert ws.find("m:sheetData",ns) is not None
        assert ws.find("m:pageSetup",ns) is not None
        for c in ws.findall(".//m:sheetData/m:row/m:c",ns):
            style=int(c.attrib.get("s",0))
            assert style<len(cellXfs), "Invalid cell style index"
            assert c.attrib.get("t") != "s", "Shared strings table is absent"
            if c.find("m:f",ns) is not None:
                assert c.attrib.get("t") != "inlineStr", "Formula exported as string"
    summaryXml=ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    def cell(addr):
        return summaryXml.find(".//m:c[@r='%s']"%addr,ns)
    assert cell("A8").find("m:v",ns).text=="2"
    assert cell("C8").find("m:v",ns).text=="1"
    assert cell("G8").find("m:v",ns).text=="0.5"
    assert cell("D30").find("m:f",ns).text=="IFERROR(D28/A8,0)"
    assert wb.find("m:calcPr",ns).attrib["fullCalcOnLoad"]=="1"
print("OOXML_VALID: 7 sheets, CRC, XML, styles, relationships, numeric cells, formulas")
`;
  const out=spawnSync("python3",["-c",check],{input:Buffer.from(bytes),encoding:"utf8",maxBuffer:1024*1024});
  assert.equal(out.status,0,(out.stderr||"")+(out.stdout||""));
  assert.match(out.stdout,/OOXML_VALID/);
});
