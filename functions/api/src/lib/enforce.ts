// Fail-closed response validator (V-1..V-3). Any violation -> extractive fallback.
import { OUTPUT_DENYLIST } from "@groww-mf-faq/shared";

function countSentences(text: string): number {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0).length;
}

export interface ValidationInput {
  text: string;
  allowedUrls: string[];
}

export function validateResponse(input: ValidationInput): { ok: true } | { ok: false; rule: string } {
  const distinct = new Set(input.allowedUrls.filter((u) => input.text.includes(u)));
  if (distinct.size !== 1) return { ok: false, rule: "V-1-citation" };
  if (countSentences(input.text) > 3) return { ok: false, rule: "V-2-length" };
  const low = input.text.toLowerCase();
  if (OUTPUT_DENYLIST.some((p) => low.includes(p))) return { ok: false, rule: "V-3-denylist" };
  return { ok: true };
}
