import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";

const baseUrl = process.env.CLASSROOM_MIRROR_URL || "http://127.0.0.1:3001";
const shouldWrite = process.argv.includes("--write");
const allCases = JSON.parse(await readFile(new URL("../benchmarks/cases.json", import.meta.url), "utf8"));
const caseOption = process.argv.find((argument) => argument.startsWith("--case="));
const limitOption = process.argv.find((argument) => argument.startsWith("--limit="));
const caseId = caseOption?.slice("--case=".length);
const limit = limitOption ? Number(limitOption.slice("--limit=".length)) : undefined;

if (limitOption && (!Number.isInteger(limit) || limit < 1)) {
  throw new Error("--limit must be a positive integer, for example --limit=1");
}

let cases = caseId ? allCases.filter((testCase) => testCase.id === caseId) : allCases;
if (caseId && cases.length === 0) {
  throw new Error(`Unknown benchmark case: ${caseId}`);
}
if (limit) cases = cases.slice(0, limit);
if (shouldWrite && cases.length !== allCases.length) {
  throw new Error("Refusing to save a partial benchmark. Remove --limit/--case when using --write.");
}

const healthResponse = await fetch(`${baseUrl}/api/health`);
if (!healthResponse.ok) throw new Error(`Classroom Mirror is not reachable at ${baseUrl}`);
const health = await healthResponse.json();
if (!health.live_available) {
  throw new Error("Live GPT-5.6 mode is required for evaluation. Start the app with OPENAI_API_KEY configured.");
}

console.log(`Running ${cases.length}/${allCases.length} live benchmark cases against ${baseUrl}`);

const progressUrl = new URL("../results/eval-progress.json", import.meta.url);
let rows = [];
if (shouldWrite) {
  try {
    const progress = JSON.parse(await readFile(progressUrl, "utf8"));
    if (progress.model === health.model && Array.isArray(progress.rows)) {
      rows = progress.rows.filter((row) => cases.some((testCase) => testCase.id === row.id));
      if (rows.length) console.log(`Resuming with ${rows.length} completed cases from results/eval-progress.json`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

for (const testCase of cases) {
  const completed = rows.find((row) => row.id === testCase.id);
  if (completed) {
    console.log(`${testCase.id}: resumed · ${completed.detected}/${completed.planted} planted risks · ${completed.grounded_findings}/${completed.total_findings} exact quotes`);
    continue;
  }
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lesson_text: testCase.lesson, grade_subject: testCase.grade_subject, use_demo: false }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(`${testCase.id}: ${payload.error || response.status}`);

  const findings = payload.analysis.verified_findings || [];
  const corpus = findings.map((finding) => `${finding.title} ${finding.claim} ${finding.intervention}`).join(" ").toLowerCase();
  const grounded = findings.filter((finding) => testCase.lesson.includes(finding.evidence_quote));
  const risks = testCase.planted_risks.map((risk) => ({
    label: risk.label,
    detected: risk.must_include_any.some((term) => corpus.includes(term.toLowerCase())),
  }));
  rows.push({
    id: testCase.id,
    planted: risks.length,
    detected: risks.filter((risk) => risk.detected).length,
    grounded_findings: grounded.length,
    total_findings: findings.length,
    risks,
  });
  console.log(`${testCase.id}: ${rows.at(-1).detected}/${risks.length} planted risks · ${grounded.length}/${findings.length} exact quotes`);
  if (shouldWrite) {
    await mkdir(new URL("../results/", import.meta.url), { recursive: true });
    await writeFile(progressUrl, `${JSON.stringify({ model: health.model, rows }, null, 2)}\n`);
  }
}

const totals = rows.reduce((sum, row) => ({
  planted: sum.planted + row.planted,
  detected: sum.detected + row.detected,
  grounded: sum.grounded + row.grounded_findings,
  findings: sum.findings + row.total_findings,
}), { planted: 0, detected: 0, grounded: 0, findings: 0 });

const report = {
  generated_at: new Date().toISOString(),
  model: health.model,
  cases: rows.length,
  planted_risk_recall: totals.planted ? totals.detected / totals.planted : 0,
  exact_quote_rate: totals.findings ? totals.grounded / totals.findings : 0,
  totals,
  rows,
};

console.log(`\nPlanted-risk recall: ${(report.planted_risk_recall * 100).toFixed(1)}%`);
console.log(`Exact-quote grounding: ${(report.exact_quote_rate * 100).toFixed(1)}%`);
if (shouldWrite) {
  await mkdir(new URL("../results/", import.meta.url), { recursive: true });
  await writeFile(new URL("../results/eval-latest.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
  await unlink(progressUrl).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
  console.log("Saved results/eval-latest.json");
}
