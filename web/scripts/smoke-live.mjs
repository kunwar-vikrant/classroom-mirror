import { readFile } from "node:fs/promises";

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
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-5.6-sol";
if (!apiKey) throw new Error("OPENAI_API_KEY is missing from web/.env.local");

const multiAgent = process.argv.includes("--multi-agent");
const payload = multiAgent
  ? {
      model,
      input: "Use two subagents to independently check whether 2 + 2 equals 4, then answer with only: ok",
      multi_agent: { enabled: true, max_concurrent_subagents: 2 },
      max_output_tokens: 800,
      store: false,
    }
  : { model, input: "Reply with only: ok", max_output_tokens: 100, store: false };

const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(multiAgent ? { "OpenAI-Beta": "responses_multi_agent=v1" } : {}),
  },
  body: JSON.stringify(payload),
});
const body = await response.json();
const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "not returned";
console.log(`Mode: ${multiAgent ? "multi-agent" : "minimal"}`);
console.log(`Status: ${response.status}`);
console.log(`Request ID: ${requestId}`);
if (!response.ok) {
  console.log(`Error type: ${body?.error?.type || "unknown"}`);
  console.log(`Error code: ${body?.error?.code || "unknown"}`);
  console.log(`Message: ${body?.error?.message || "No provider message"}`);
  process.exitCode = 1;
} else {
  const text = (body.output || []).flatMap((item) => item.content || []).filter((part) => part.type === "output_text").map((part) => part.text).join("");
  console.log(`Model: ${body.model}`);
  console.log(`Output: ${text || "completed without root text"}`);
}
