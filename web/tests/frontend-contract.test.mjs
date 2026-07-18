import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/classroom.html", import.meta.url), "utf8");
const script = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

test("primary demo controls have accessible labels and stable targets", () => {
  for (const id of ["lesson-text", "grade-subject", "sample-button", "analyze-button", "results", "export-button"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  assert.match(html, /role="group" aria-label="Analysis mode"/);
  assert.match(html, /aria-live="polite"/);
});

test("teacher decisions are persisted in the exported payload", () => {
  assert.match(script, /teacherDecisions/);
  assert.match(script, /teacher_decisions: teacherDecisions/);
  assert.match(script, /data-decision="accepted"/);
  assert.match(script, /data-decision="skipped"/);
});

test("frontend escapes model-controlled content before rendering", () => {
  assert.match(script, /const escapeHTML/);
  const interpolations = [...script.matchAll(/\$\{item\.(?:title|claim|intervention|evidence_quote)\}/g)];
  assert.equal(interpolations.length, 0, "found unescaped evidence-ledger interpolation");
});

test("responsive and reduced-motion fallbacks are present", () => {
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

