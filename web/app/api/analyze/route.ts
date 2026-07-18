import { demoAnalysis } from "../../../lib/demo.ts";

type ResponseContent = { type?: string; text?: string };
type ResponseItem = { type?: string; agent?: { agent_name?: string }; phase?: string; content?: ResponseContent[] };
type ResponsesPayload = { model?: string; output?: ResponseItem[]; error?: { message?: string } };
type Finding = { evidence_quote?: string; verdict?: "verified" | "qualified" | "rejected"; [key: string]: unknown };
type Analysis = {
  meta: { model: string; mode: string; [key: string]: unknown };
  verified_findings?: Finding[];
  verification?: { proposed?: number; verified?: number; qualified?: number; rejected?: number };
  [key: string]: unknown;
};

const s = { type: "string" } as const;
const integer = (minimum = 0, maximum = 100) => ({ type: "integer", minimum, maximum });
const object = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const array = (items: unknown, minItems: number, maxItems: number) => ({ type: "array", items, minItems, maxItems });
const enumeration = (...values: string[]) => ({ type: "string", enum: values });

const schema = object({
  meta: object({ lesson_title: s, grade_subject: s, model: s, mode: enumeration("live"), summary: s }),
  scores: object({ clarity: integer(), engagement: integer(), accessibility: integer(), cognitive_load: integer() }),
  learner_agents: array(object({
    name: s, lens: s, avatar: s, confidence: integer(), status: enumeration("ready", "watch", "friction"),
    thought: s, friction: s, evidence: s, intervention: s,
  }), 4, 4),
  misconceptions: array(object({
    concept: s, likelihood: enumeration("high", "medium", "low"), why: s, signal: s, intervention: s,
  }), 3, 3),
  verified_findings: array(object({
    id: s, title: s, severity: enumeration("high", "medium", "low"), confidence: integer(),
    evidence_quote: s, evidence_location: s, learner_lenses: array(s, 1, 4), claim: s,
    skeptic_challenge: s, verdict: enumeration("verified", "qualified", "rejected"), verdict_reason: s, intervention: s,
  }), 3, 6),
  verification: object({ proposed: integer(0, 20), verified: integer(0, 20), qualified: integer(0, 20), rejected: integer(0, 20) }),
  lesson_revision: object({
    original_problem: s,
    revised_sequence: array(object({ step: s, time: s, teacher_move: s, learner_check: s }), 3, 5),
    universal_design: s,
  }),
  exit_ticket: array(object({ question: s, type: s, answer_look_for: s }), 3, 3),
  metrics: object({ students_reached: integer(0, 100), risks_found: integer(0, 100), changes_made: integer(0, 100) }),
});

const discoveryInstructions = `You are the parallel discovery stage for Classroom Mirror.

Evaluate four bounded learner lenses. The root agent directly evaluates conceptual clarity through a confident verbal-reasoner lens. Spawn exactly three subagents in parallel for: (1) a multilingual learner developing academic language, (2) an attention-variable learner who benefits from short feedback loops, and (3) an advanced pattern seeker who needs transfer and productive challenge.

Each agent must inspect only the supplied lesson and report at most two risks. Every risk needs the smallest exact quote that supports it, a one-sentence concern, and a one-sentence intervention. Do not diagnose disabilities, predict individual children, or make claims based on protected traits. These are design lenses, not real student profiles.

Return one compact JSON object with a lens_notes array. Each item must contain lens and risks. Each risk must contain evidence_quote, concern, and intervention. Return no prose outside JSON.`;

const synthesisInstructions = `You are Classroom Mirror's skeptical synthesis stage. Use the candidate findings as leads, but verify them against the supplied lesson yourself.

Create 4-6 proposed findings. For every finding, quote the smallest exact passage from the lesson and record its location. Articulate the strongest reasonable skeptical challenge, then classify the finding as verified, qualified, or rejected. Keep rejected findings in the verification counts but do not include them in verified_findings. Never invent a quote. If evidence is missing, reject the claim.

Produce four learner-lens summaries, exactly three plausible misconceptions, a scored lesson, a revised sequence, and three diagnostic exit-ticket items. Preserve the learning goal. Do not diagnose or predict real children. The verification counts must reconcile: proposed = verified + qualified + rejected. Keep every string concise: one sentence wherever possible and never more than two. Return only compact structured output without pretty-printing or extra whitespace.`;

function rootText(response: ResponsesPayload): string {
  const messages = (response.output || []).filter((item) => item.type === "message");
  const root = messages.find((item) => item.agent?.agent_name === "/root" && item.phase === "final_answer") || messages.at(-1);
  const text = (root?.content || []).filter((part) => part.type === "output_text").map((part) => part.text || "").join("");
  if (!text) throw new Error("GPT-5.6 returned no final analysis");
  return text;
}

async function callOpenAI(apiKey: string, requestBody: string, multiAgent: boolean): Promise<ResponsesPayload> {
  const maxAttempts = 4;
  let upstream: Response | undefined;
  let transportError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    upstream = undefined;
    try {
      upstream = await fetch(process.env.OPENAI_API_URL || "https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(multiAgent ? { "OpenAI-Beta": "responses_multi_agent=v1" } : {}),
        },
        body: requestBody,
      });
    } catch (error) {
      transportError = error;
    }
    if (upstream?.ok || (upstream && upstream.status < 500) || attempt === maxAttempts - 1) break;
    await new Promise((resolve) => setTimeout(resolve, 750 * (2 ** attempt)));
  }
  if (!upstream) {
    const detail = transportError instanceof Error ? transportError.message : "request did not start";
    throw new Error(`OpenAI API transport failed after ${maxAttempts} attempts: ${detail}`);
  }
  const response = await upstream.json() as ResponsesPayload;
  if (!upstream.ok) {
    const requestId = upstream.headers.get("x-request-id");
    const reference = requestId ? `; OpenAI request ID: ${requestId}` : "";
    throw new Error(`${response?.error?.message || `OpenAI API error ${upstream.status}`}${reference}`);
  }
  return response;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { lesson_text?: string; grade_subject?: string; use_demo?: boolean };
    const lesson = String(body.lesson_text || "").trim();
    const grade = String(body.grade_subject || "").trim();
    if (lesson.length < 80) return Response.json({ ok: false, error: "Add at least 80 characters of lesson detail." }, { status: 400 });

    if (body.use_demo !== false) {
      const personalized = structuredClone(demoAnalysis);
      if (grade) personalized.meta.grade_subject = grade.slice(0, 80);
      return Response.json({ ok: true, analysis: personalized });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ ok: false, error: "OPENAI_API_KEY is not configured." }, { status: 503 });
    const model = process.env.OPENAI_MODEL || "gpt-5.6-sol";
    const lessonInput = `Grade and subject: ${grade || "Not specified"}\n\n<lesson_plan>\n${lesson.slice(0, 50000)}\n</lesson_plan>`;
    const discoveryResponse = await callOpenAI(apiKey, JSON.stringify({
      model, instructions: discoveryInstructions,
      input: `Return a compact JSON object for the lesson below.\n\n${lessonInput}`,
      reasoning: { effort: "low", context: "current_turn" },
      multi_agent: { enabled: true, max_concurrent_subagents: 3 },
      text: { format: { type: "json_object" }, verbosity: "low" },
      max_output_tokens: 2500, store: false, safety_identifier: "classroom-mirror-site",
    }), true);
    const candidateJson = rootText(discoveryResponse);
    JSON.parse(candidateJson);

    const synthesisRequest = JSON.stringify({
      model, instructions: synthesisInstructions,
      input: `${lessonInput}\n\n<candidate_findings>\n${candidateJson}\n</candidate_findings>`,
      reasoning: { effort: "low", context: "current_turn" },
      text: { format: { type: "json_schema", name: "classroom_mirror_analysis", strict: true, schema }, verbosity: "low" },
      max_output_tokens: 9000, store: false, safety_identifier: "classroom-mirror-site",
    });
    let synthesisResponse: ResponsesPayload | undefined;
    let analysis: Analysis | undefined;
    let parseError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      synthesisResponse = await callOpenAI(apiKey, synthesisRequest, false);
      try {
        analysis = JSON.parse(rootText(synthesisResponse)) as Analysis;
        break;
      } catch (error) {
        parseError = error;
      }
    }
    if (!analysis || !synthesisResponse) {
      const detail = parseError instanceof Error ? parseError.message : "invalid structured output";
      throw new Error(`GPT-5.6 returned incomplete structured output twice: ${detail}`);
    }
    const proposedFindings = Array.isArray(analysis.verified_findings) ? analysis.verified_findings : [];
    const groundedFindings = proposedFindings.filter((finding) =>
      typeof finding.evidence_quote === "string" && finding.evidence_quote.length > 0 && lesson.includes(finding.evidence_quote)
    );
    const rejectedForGrounding = proposedFindings.length - groundedFindings.length;
    if (groundedFindings.length === 0) throw new Error("GPT-5.6 returned no findings with exact evidence from the lesson.");
    analysis.verified_findings = groundedFindings;
    analysis.verification = {
      proposed: groundedFindings.length + Number(analysis.verification?.rejected || 0) + rejectedForGrounding,
      verified: groundedFindings.filter((finding) => finding.verdict === "verified").length,
      qualified: groundedFindings.filter((finding) => finding.verdict === "qualified").length,
      rejected: Number(analysis.verification?.rejected || 0) + rejectedForGrounding,
    };
    analysis.meta.model = synthesisResponse.model || model;
    analysis.meta.mode = "live";
    return Response.json({ ok: true, analysis });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Analysis failed" }, { status: 502 });
  }
}
