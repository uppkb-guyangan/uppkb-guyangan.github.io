import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const app = readFileSync(new URL("../app-v2.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("Disputed cases table includes TNKB before violation ID", () => {
  assert.match(app, /disputes:\[\["__dispute_tnkb","TNKB"\],\["violation_id","Violation ID"\]/);
  assert.match(app, /if\(k==="__dispute_tnkb"\)return '<b>'\+esc\(disputeTnkb\(row\)\)\+'<\/b>';/);
});

test("TNKB resolves by case_id first and by violation_id when case_id is absent or unmatched", () => {
  const start = app.indexOf("function disputeTnkb(row)");
  const end = app.indexOf("\n}", start) + 2;
  assert.ok(start >= 0 && end > start, "disputeTnkb helper exists");
  const helper = app.slice(start, end);
  const state = {
    bundle: {
      cases: [
        { case_id: "case-1", violation_id: "83383", tnkb: "S 1234 AB" },
        { case_id: "case-2", violation_id: "100567", tnkb: "AG 9876 CD" }
      ]
    }
  };
  const demo = { cases: [] };
  const norm = value => String(value ?? "").trim().toLowerCase();
  const exports = {};
  runInNewContext(helper + "\nexports.disputeTnkb = disputeTnkb;", { state, demo, norm, exports });
  assert.equal(exports.disputeTnkb({ case_id: "case-1", violation_id: "100567" }), "S 1234 AB", "case_id takes priority when records conflict");
  assert.equal(exports.disputeTnkb({ violation_id: 100567 }), "AG 9876 CD");
  assert.equal(exports.disputeTnkb({ case_id: "missing", violation_id: "83383" }), "S 1234 AB");
  assert.equal(exports.disputeTnkb({ violation_id: "missing" }), "-");
});

test("Dispute TNKB column refreshes the PWA app cache key", () => {
  assert.match(html, /feature=dispute-tnkb1/);
});
