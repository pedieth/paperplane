// PaperPlane dev server - runs the Worker handler on this VM with no
// Cloudflare account needed. Same code path as the deployed Worker.
//
// Usage:
//   PORT=8787 BRIDGE_SECRET=dev-bridge-secret-change-me node dev-server.mjs
// Then: curl http://127.0.0.1:8787/health

import http from "node:http";
import { createApp } from "./worker/src/index.js";

const PORT = Number(process.env.PORT || 8787);
const env = {
  BRIDGE_SECRET: process.env.BRIDGE_SECRET || "dev-bridge-secret-change-me",
};

const app = createApp(env);

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const url = `http://127.0.0.1:${PORT}${req.url}`;
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
    });
    const response = await app.fetch(request);
    const text = await response.text();
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    if (!headers["content-type"]) headers["content-type"] = "application/json";
    res.writeHead(response.status, headers);
    res.end(text);
  } catch (err) {
    console.error("[paperplane-dev]", err);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "dev-server-error" }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[paperplane-dev] PaperPlane API on http://127.0.0.1:${PORT}`);
  console.log("[paperplane-dev] GET /health to check it");
});
