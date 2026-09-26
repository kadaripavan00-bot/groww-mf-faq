import type { VercelRequest, VercelResponse } from "./vercel.js";
import { getStore } from "../functions/api/src/lib/db.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const store = getStore();
  const sources = await store.getSources();
  res.status(200).json(sources);
}
