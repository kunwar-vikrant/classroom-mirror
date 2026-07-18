import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const publicRoot = join(webRoot, "public");
const port = Number(process.env.PORT || 3001);

function loadEnv(text) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

try {
  loadEnv(await readFile(join(webRoot, ".env.local"), "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const { POST } = await import("../app/api/analyze/route.ts");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const publicFiles = new Map([
  ["/", "classroom.html"],
  ["/classroom.html", "classroom.html"],
  ["/app.js", "app.js"],
  ["/styles.css", "styles.css"],
  ["/favicon.svg", "favicon.svg"],
  ["/og.png", "og.png"],
]);

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || `localhost:${port}`}`);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return sendJson(response, 200, {
        ok: true,
        live_available: Boolean(process.env.OPENAI_API_KEY),
        model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
        runtime: "node-local",
      });
    }

    if (request.method === "POST" && url.pathname === "/api/analyze") {
      const body = await readBody(request);
      const routeResponse = await POST(new Request(url, {
        method: "POST",
        headers: { "Content-Type": request.headers["content-type"] || "application/json" },
        body,
      }));
      const responseBody = Buffer.from(await routeResponse.arrayBuffer());
      response.writeHead(routeResponse.status, {
        "Content-Type": routeResponse.headers.get("content-type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      return response.end(responseBody);
    }

    if (request.method === "GET" && publicFiles.has(url.pathname)) {
      const file = join(publicRoot, publicFiles.get(url.pathname));
      const body = await readFile(file);
      response.writeHead(200, {
        "Content-Type": contentTypes[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      return response.end(body);
    }

    sendJson(response, 404, { ok: false, error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : "Local server error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Classroom Mirror local server: http://localhost:${port}`);
  console.log(`Live GPT-5.6: ${process.env.OPENAI_API_KEY ? "configured" : "not configured (demo mode still works)"}`);
});
