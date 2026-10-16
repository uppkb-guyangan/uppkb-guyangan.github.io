import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app-v2.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles-v2.css", import.meta.url), "utf8");

test("Timeline Perkara exposes search, sort, and an empty-history state", () => {
  assert.match(app, /function timelineSection\(rows\)/);
  assert.match(app, /id="timelineSearch"/);
  assert.match(app, /id="timelineSort"/);
  assert.match(app, /data-timeline-event/);
  assert.match(app, /Belum ada riwayat perkara yang tersedia/);
});

test("Timeline controls filter events and sort by event time without writing data", () => {
  const start = app.indexOf("function bindTimelineControls()");
  const end = app.indexOf("\n}", start) + 2;
  assert.ok(start >= 0 && end > start);
  const fn = app.slice(start, end);
  assert.match(fn, /addEventListener\("input"/);
  assert.match(fn, /Date\.parse/);
  assert.match(fn, /appendChild/);
  assert.doesNotMatch(fn, /fetch\(|\.insert\(|\.update\(|\.delete\(/);
});

test("Smart Reporting quality checks compare category totals and flag missing dates", () => {
  assert.match(app, /function reportQualityHtml\(p\)/);
  assert.match(app, /categoryTotal===total/);
  assert.match(app, /unknownViolationDate/);
  assert.match(app, /reportQualityHtml\(p\)/);
});

test("Existing report copy, print/PDF, and Excel export remain connected", () => {
  assert.match(app, /id="copyReport"/);
  assert.match(app, /id="printReport"/);
  assert.match(app, /id="exportExcel"/);
  assert.match(app, /downloadEtleExcel/);
});

test("PWA script cache is versioned without removing the prior version marker", () => {
  assert.match(html, /app-v2\.js\?v=20261015-etlehub-roles1&feature=timeline-report1/);
});

test("Timeline and report quality styles include a mobile layout", () => {
  assert.match(css, /\.timeline-toolbar/);
  assert.match(css, /\.report-quality-grid/);
  assert.match(css, /@media\(max-width:760px\)/);
});
