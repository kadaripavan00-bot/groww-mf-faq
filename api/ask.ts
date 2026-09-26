import type { VercelRequest, VercelResponse } from "./vercel.js";
import { ask, extractiveComposer } from "../functions/api/src/core/ask.js";
import { geminiComposer } from "../functions/api/src/lib/gemini.js";
import { getStore } from "../functions/api/src/lib/db.js";

const RATE = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (RATE.get(ip) || []).filter((t) => now - t < 60_000);
  hits.push(now);
  RATE.set(ip, hits);
  return hits.length > 30;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress || "local";
  if (rateLimited(ip)) {
    res.status(429).json({ error: "Too many requests. Please retry in a minute." });
    return;
  }
  const body = (req.body || {}) as { query?: unknown; vector?: unknown };
  if (typeof body.query !== "string" || !body.query.trim() || body.query.length > 300) {
    res.status(400).json({ error: "query must be a non-empty string up to 300 chars" });
    return;
  }
  const vector = Array.isArray(body.vector) ? (body.vector as unknown[]) : undefined;
  const store = getStore();
  const composer = process.env.GEMINI_API_KEY ? geminiComposer() : extractiveComposer;
  try {
    const { res: out, intent, topic, kind } = await ask(body.query, vector as number[] | undefined, { store, composer });
    try {
      await store.logQuery(intent, topic, kind);
    } catch { /* analytics must never break answers */ }
    res.status(200).json(out);
  } catch {
    res.status(500).json({ error: "temporary failure, please retry" });
  }
}
