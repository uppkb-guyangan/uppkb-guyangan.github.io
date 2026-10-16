import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const app = readFileSync(new URL("../app-v2.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("Payment source codes display human-readable labels without changing source values", () => {
  const match = app.match(/function paymentStatusLabel\(v\)\s*\{[\s\S]*?\n\}\nfunction paymentIsPaid\(v\)\s*\{[\s\S]*?\n\}/);
  assert.ok(match, "payment status helpers exist");
  const exports = {};
  runInNewContext(match[0] + "\nexports.paymentStatusLabel = paymentStatusLabel; exports.paymentIsPaid = paymentIsPaid;", { exports });
  assert.equal(exports.paymentStatusLabel("20"), "Belum Bayar");
  assert.equal(exports.paymentStatusLabel(20), "Belum Bayar");
  assert.equal(exports.paymentStatusLabel("21"), "Sudah Terbayar");
  assert.equal(exports.paymentStatusLabel("PAID"), "PAID", "known text statuses remain intact");
  assert.equal(exports.paymentIsPaid("20"), false);
  assert.equal(exports.paymentIsPaid("21"), true);
  assert.equal(exports.paymentIsPaid("PAID"), true);
  assert.equal(exports.paymentIsPaid("INQUIRY"), false);
  assert.equal(exports.paymentIsPaid("Belum Terbayar"), false);
});

test("Payment labels are applied in the blanko table and payment details", () => {
  assert.match(app, /if\(k==="status_bayar"\)return statusBadge\(paymentStatusLabel\(v\)\);/);
  assert.match(app, /t==="paymentStatus"\?paymentStatusLabel\(obj\[k\]\):obj\[k\]/);
  assert.match(app, /\["status_bayar","Status Bayar","paymentStatus"\]/);
  assert.match(app, /paymentIsPaid\(c\.status_bayar\)/, "GITA unpaid queries use numeric payment status semantics");
});

test("PWA cache key changes for payment status labels", () => {
  assert.match(html, /feature=payment-status1/);
});
