import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/analyze/route.ts";
import { demoAnalysis } from "../lib/demo.ts";

const lesson = `Why do seasons change?\n\nLearning goal: Students will explain how Earth's tilted axis changes the sunlight a hemisphere receives during the year.\n\nDemonstration (7 min): Darken the room. Place a flashlight in the center and move a tilted globe around it. Ask students to watch how the bright spot changes. During the demonstration, define axis, tilt, direct light, and indirect light. After completing the full orbit, ask: “Why is it warmer in summer?”`;

function request(body) {
  return new Request("http://classroom.test/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("rejects lessons that lack enough evidence", async () => {
  const response = await POST(request({ lesson_text: "Too short", use_demo: true }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /80 characters/);
});

test("demo mode returns the full judge-facing contract without a key", async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const response = await POST(request({ lesson_text: lesson, grade_subject: "Grade 6 · Science", use_demo: true }));
  if (oldKey) process.env.OPENAI_API_KEY = oldKey;
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.analysis.meta.mode, "demo");
  assert.equal(body.analysis.verified_findings.length, 4);
  assert.deepEqual(Object.keys(body.analysis.verification).sort(), ["proposed", "qualified", "rejected", "verified"]);
  assert.equal(body.analysis.exit_ticket.length, 3);
});

test("live mode fails clearly when the API key is absent", async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const response = await POST(request({ lesson_text: lesson, use_demo: false }));
  if (oldKey) process.env.OPENAI_API_KEY = oldKey;
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /OPENAI_API_KEY/);
});

test("live mode separates multi-agent discovery from strict synthesis", async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key-never-sent";
  const captured = [];
  globalThis.fetch = async (_url, init) => {
    captured.push({ headers: init.headers, body: JSON.parse(init.body) });
    const analysis = structuredClone(demoAnalysis);
    analysis.meta.mode = "live";
    analysis.verified_findings = analysis.verified_findings.slice(0, 1);
    analysis.verified_findings[0].evidence_quote = "Place a flashlight in the center and move a tilted globe around it.";
    analysis.verification = { proposed: 3, verified: 0, qualified: 1, rejected: 2 };
    return Response.json({
      model: "gpt-5.6-sol",
      output: [{ type: "message", agent: { agent_name: "/root" }, phase: "final_answer", content: [{ type: "output_text", text: JSON.stringify(analysis) }] }],
    });
  };
  try {
    const response = await POST(request({ lesson_text: lesson, grade_subject: "Grade 6 · Science", use_demo: false }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.analysis.meta.mode, "live");
    assert.equal(body.analysis.verified_findings.length, 1);
    assert.equal(captured.length, 2);
    assert.equal(captured[0].body.model, "gpt-5.6-sol");
    assert.deepEqual(captured[0].body.multi_agent, { enabled: true, max_concurrent_subagents: 3 });
    assert.equal(captured[0].body.text.format.type, "json_object");
    assert.equal(captured[0].headers["OpenAI-Beta"], "responses_multi_agent=v1");
    assert.equal(captured[1].body.text.format.type, "json_schema");
    assert.equal(captured[1].body.text.format.strict, true);
    assert.equal(captured[1].headers["OpenAI-Beta"], undefined);
    assert.match(captured[1].headers.Authorization, /^Bearer test-key/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey) process.env.OPENAI_API_KEY = oldKey; else delete process.env.OPENAI_API_KEY;
  }
});

test("drops hallucinated evidence quotes before returning an analysis", async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    const analysis = structuredClone(demoAnalysis);
    analysis.meta.mode = "live";
    analysis.verified_findings = [
      { ...analysis.verified_findings[0], evidence_quote: "Place a flashlight in the center and move a tilted globe around it." },
      { ...analysis.verified_findings[1], evidence_quote: "This sentence does not exist in the lesson." },
    ];
    analysis.verification = { proposed: 3, verified: 1, qualified: 1, rejected: 1 };
    return Response.json({ model: "gpt-5.6-sol", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(analysis) }] }] });
  };
  try {
    const response = await POST(request({ lesson_text: lesson, use_demo: false }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.analysis.verified_findings.length, 1);
    assert.equal(body.analysis.verification.rejected, 2);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey) process.env.OPENAI_API_KEY = oldKey; else delete process.env.OPENAI_API_KEY;
  }
});

test("retries one transient provider failure before returning success", async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return Response.json({ error: { message: "internal error" } }, { status: 500 });
    const analysis = structuredClone(demoAnalysis);
    analysis.meta.mode = "live";
    analysis.verified_findings = [{ ...analysis.verified_findings[0], evidence_quote: "Place a flashlight in the center and move a tilted globe around it." }];
    analysis.verification = { proposed: 1, verified: 0, qualified: 1, rejected: 0 };
    return Response.json({ model: "gpt-5.6-sol", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(analysis) }] }] });
  };
  try {
    const response = await POST(request({ lesson_text: lesson, use_demo: false }));
    assert.equal(response.status, 200);
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey) process.env.OPENAI_API_KEY = oldKey; else delete process.env.OPENAI_API_KEY;
  }
});
