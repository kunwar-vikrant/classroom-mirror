export async function GET() {
  return Response.json({
    ok: true,
    live_available: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
  });
}

