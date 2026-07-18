import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cases = JSON.parse(await readFile(new URL("../benchmarks/cases.json", import.meta.url), "utf8"));

test("benchmark contains at least six distinct lesson cases", () => {
  assert.ok(cases.length >= 6);
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
});

test("every expected risk has an exact planted evidence marker", () => {
  for (const item of cases) {
    assert.ok(item.lesson.length >= 80, `${item.id} lesson is too short`);
    assert.ok(item.planted_risks.length >= 2, `${item.id} needs two risks`);
    for (const risk of item.planted_risks) {
      assert.ok(item.lesson.includes(risk.evidence_marker), `${item.id}: missing marker ${risk.evidence_marker}`);
      assert.ok(risk.must_include_any.length >= 2, `${item.id}: weak scoring vocabulary`);
    }
  }
});

