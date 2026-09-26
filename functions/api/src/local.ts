// Tiny local dev server: node --experimental-strip-types ./src/local.ts
// Serves /api/ask, /api/sources, /api/feedback on :8787 (Vite proxies /api).
import { createServer } from "node:http";
import askHandler from "../../../api/ask.js";
import sourcesHandler from "../../../api/sources.js";
import feedbackHandler from "../../../api/feedback.js";
import type { VercelRequest, VercelResponse } from "../../../api/vercel.js";

const PORT = Number(process.env.API_PORT || 8787);

function adapt(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>,
): (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void {
  return (req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      let body: unknown = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
      const vreq: VercelRequest = {
        method: req.method, headers: req.headers as Record<string, string | undefined>,
        socket: { remoteAddress: req.socket.remoteAddress }, body,
      };
      const vres: VercelResponse = {
        status(code: number) { res.statusCode = code; return vres; },
        json(data: unknown) {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(JSON.stringify(data));
        },
      };
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.end();
        return;
      }
      void handler(vreq, vres).catch(() => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "temporary failure" }));
      });
    });
  };
}

const routes: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<void>> = {
  "/api/ask": askHandler,
  "/api/sources": sourcesHandler,
  "/api/feedback": feedbackHandler,
};

createServer((req, res) => {
  const url = new URL(req.url || "/", "http://local");
  const handler = routes[url.pathname];
  if (!handler) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }
  adapt(handler)(req, res);
}).listen(PORT, () => console.log(`api dev server on http://localhost:${PORT}`));
