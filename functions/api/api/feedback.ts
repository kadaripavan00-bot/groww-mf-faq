import type { VercelRequest, VercelResponse } from "./vercel.js";
import { getStore } from "../src/lib/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const body = (req.body || {}) as { fact_id?: unknown; helpful?: unknown };
  const factId = typeof body.fact_id === "string" && body.fact_id.length <= 64 ? body.fact_id : null;
  const helpful = body.helpful === true;
  try {
    await getStore().saveFeedback(factId, helpful);
  } catch { /* never break the UI */ }
  res.status(200).json({ ok: true });
}
