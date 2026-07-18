import { readFile } from "node:fs/promises";
import { POST } from "../app/api/analyze/route.ts";

function loadEnv(text) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] ??= value;
  }
}

await loadEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (String(args[0]).includes("api.openai.com")) {
    console.log(`Provider status: ${response.status}`);
    console.log(`Provider request ID: ${response.headers.get("x-request-id") || "not returned"}`);
  }
  return response;
};

const lesson = `Why do seasons change?

Learning goal: Students will explain how Earth's tilted axis changes the sunlight a hemisphere receives during the year.

Warm-up (5 min): Students write why they think summer is warmer than winter, then share two ideas aloud.

Demonstration (7 min): Darken the room. Place a flashlight in the center and move a tilted globe around it. Ask students to watch how the bright spot changes. During the demonstration, define axis, tilt, direct light, and indirect light. After completing the full orbit, ask: “Why is it warmer in summer?”

Partner task (10 min): Give pairs a diagram of Earth at four positions around the Sun. Students label each position spring, summer, fall, or winter, then write one sentence explaining their labels.

Independent check (5 min): Explain why Earth’s tilt causes seasons.`;

try {
  const response = await POST(new Request("http://classroom.test/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lesson_text: lesson, grade_subject: "Grade 6 · Earth science", use_demo: false }),
  }));
  const body = await response.json();
  console.log(`Application status: ${response.status}`);
  if (!response.ok) {
    console.log(`Application error: ${body.error || "unknown"}`);
    process.exitCode = 1;
  } else {
    console.log(`Analysis mode: ${body.analysis.meta.mode}`);
    console.log(`Grounded findings: ${body.analysis.verified_findings.length}`);
    console.log(`Verification counts: ${JSON.stringify(body.analysis.verification)}`);
  }
} finally {
  globalThis.fetch = originalFetch;
}

