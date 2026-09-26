// Hybrid retrieval: deterministic rules -> full-text/keyword -> pgvector
// cosine (server-side, over client-supplied validated vector) -> directory.
import type { FactRow, DirectoryRow, Topic } from "@groww-mf-faq/shared";

export const LAST_UPDATED = "2026-09-26";
export const COSINE_WEIGHT = 12;
export const SCORE_THRESHOLD = 6;

const SCHEME_ALIASES: Record<string, string[]> = {
  "groww-large-cap": ["large cap", "large-cap", "largecap"],
  "groww-multicap": ["multicap", "multi cap", "multi-cap", "flexi", "flexi-cap", "flexicap", "value fund"],
  "groww-elss": ["elss", "tax saver", "tax-saver"],
  "groww-liquid": ["liquid", "overnight"],
};

const CURATED: Array<{ id: string; phrases: string[] }> = [
  { id: "groww-large-cap", phrases: ["groww large cap fund"] },
  { id: "groww-multicap", phrases: ["groww multicap fund", "groww multi cap fund"] },
  { id: "groww-elss", phrases: ["groww elss tax saver fund", "groww elss fund"] },
  { id: "groww-liquid", phrases: ["groww liquid fund"] },
];

export function normName(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const FUND_STOP = new Set(["what","is","the","of","for","on","a","an","tell","me","about","show","give","fund","funds","mutual","direct","growth","plan","and","in","to","how","does","do","expense","ratio","exit","load","minimum","sip","lock","nav","factsheet","fact","sheet"]);

const LIST_STOP = new Set([...FUND_STOP, "groww", "list","lists","listed","exist","exists","existing","available","there","all","any","schemes","scheme","names","name","which","with","that","those","are"]);

export function detectTopic(q: string): Topic | null {
  const s = q.toLowerCase();
  if (/sponsor|trustee|\bceo\b|chief executive|compliance officer|investor service|setup|founded|incorporat|registered office|head office|\baum\b|how many schemes|who (runs|heads|owns|manages)/.test(s)) return "amc";
  if (/commission|bse star|member code|\barn\b|sebi.*regist|kyc|scores|smart odr|complaint|complain|grievance|customer care|contact (us|groww)|demat.*(open|cost|charge)|switch.*(regular|direct)|regular.*direct|zero.*(charge|commission|fee)|transaction platform|trading member/.test(s)) return "platform";
  if (/expense|\bter\b|charge|fee|cost|cheap/.test(s)) return "expense_ratio";
  if (/exit\s*load|redemption.*(charge|fee)|redeem.*(charge|cost)/.test(s)) return "exit_load";
  if (/minimum\s*sip|min.*sip|sip.*minimum|sip.*start|lowest.*sip/.test(s)) return "minimum_sip";
  if (/lock|elss.*(period|duration)|3.year|three.year|withdraw.*elss/.test(s)) return "lock_in";
  if (/riskometer|risk.*(meter|level|rating)|how\s*risky/.test(s)) return "riskometer";
  if (/benchmark|index|nifty|tri/.test(s)) return "benchmark";
  if (/statement|capital.gain|cg\s*statement|account\s*statement|download|cas|report|tax.*(doc|statement)/.test(s)) return "statement";
  if (/factsheet|fact\s*sheet|sid|kim|nav\b/.test(s)) return "general";
  return null;
}

export function detectScheme(q: string, schemeIds: string[]): string | null {
  const s = q.toLowerCase();
  for (const id of schemeIds) {
    for (const a of SCHEME_ALIASES[id] || []) {
      if (s.includes(a)) return id;
    }
  }
  return null;
}

export function detectCuratedScheme(q: string): string | null {
  const nq = " " + normName(q) + " ";
  for (const c of CURATED) {
    if (c.phrases.some((p) => nq.includes(" " + p + " "))) return c.id;
  }
  if (nq.includes(" groww ")) {
    if (nq.includes("large cap") || nq.includes("largecap")) return "groww-large-cap";
    if (nq.includes("multicap") || nq.includes("multi cap") || nq.includes("flexi")) return "groww-multicap";
    if (nq.includes("elss") || nq.includes("tax saver")) return "groww-elss";
    if (nq.includes("liquid") || nq.includes("overnight")) return "groww-liquid";
  }
  return null;
}

export interface ScoredFact { fact: FactRow; score: number; cosine: number; }

export function scoreKeyword(fact: FactRow, schemeId: string | null, topic: Topic | null, tokens: string[]): number {
  let score = 0;
  if (topic && fact.topic === topic) score += 10;
  if (schemeId && fact.scheme_id === schemeId) score += 6;
  if (!schemeId && !fact.scheme_id) score += 2;
  const hay = (fact.answer + " " + fact.id).toLowerCase();
  for (const t of tokens) {
    if (t.length > 2 && hay.includes(t)) score += 1;
  }
  return score;
}

export function retrieveKeyword(query: string, facts: FactRow[]): ScoredFact[] {
  const q = query.trim();
  const topic = detectTopic(q);
  const schemeId = detectScheme(q, [...new Set(facts.flatMap((f) => (f.scheme_id ? [f.scheme_id] : [])))]);
  const tokens = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return facts
    .map((f) => ({ fact: f, score: scoreKeyword(f, schemeId, topic, tokens), cosine: 0 }))
    .sort((a, b) => b.score - a.score);
}

/** Hybrid re-rank: keyword score + COSINE_WEIGHT * cosine. Pure function (testable). */
export function applyCosine(
  ranked: ScoredFact[],
  queryVec: number[],
  vecById: Map<string, number[]>,
): ScoredFact[] {
  return ranked
    .map((r) => {
      const v = vecById.get(r.fact.id);
      const cos = v ? dot(queryVec, v) : 0;
      return { fact: r.fact, score: r.score + cos * COSINE_WEIGHT, cosine: cos };
    })
    .sort((a, b) => b.score - a.score);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i];
  return s;
}

export interface DirHit { name: string; url: string; }

export function buildDirIndex(rows: DirectoryRow[]): Array<{ name: string; url: string; nf: string; tokens: string[] }> {
  return rows.map((r) => ({
    name: r.fund_name,
    url: r.url,
    nf: normName(r.fund_name),
    tokens: normName(r.fund_name).split(" ").filter((t) => t.length > 2 && !FUND_STOP.has(t)),
  }));
}

export function findFund(query: string, index: Array<{ name: string; url: string; nf: string; tokens: string[] }>): DirHit | null {
  const nq = " " + normName(query) + " ";
  let strong: { name: string; url: string; nf: string } | null = null;
  for (const f of index) {
    if (nq.includes(" " + f.nf + " ")) {
      if (!strong || f.nf.length > strong.nf.length) strong = f;
    }
  }
  if (strong) return { name: strong.name, url: strong.url };
  const qt = new Set(normName(query).split(" ").filter((t) => t.length > 2 && !FUND_STOP.has(t)));
  if (!qt.size) return null;
  let best: { name: string; url: string } | null = null;
  let bestScore = 0;
  for (const f of index) {
    if (!f.tokens.length) continue;
    let hit = 0;
    for (const t of f.tokens) if (qt.has(t)) hit++;
    const need = f.tokens.length <= 2 ? f.tokens.length : Math.max(2, Math.ceil(f.tokens.length * 0.75));
    if (hit >= need && (hit > bestScore || (hit === bestScore && best && f.name.length < best.name.length))) {
      bestScore = hit;
      best = f;
    }
  }
  return best ? { name: best.name, url: best.url } : null;
}

export function isListingQuery(q: string): boolean {
  const s = q.toLowerCase();
  return /\blist\b|\bshow\b|\bexist\b|which funds|what funds|funds (available|exist|are there)|all .{0,20}funds/.test(s)
    // Bare "<AMC/category> funds" ("hdfc funds", "liquid funds", "SBI schemes"):
    // listFunds decides; "groww" alone is stopped so curated questions win.
    || /\bfunds\b|\bschemes?\b/.test(s);
}

export function listFunds(
  query: string,
  index: Array<{ name: string; url: string; nf: string }>,
  cap = 8,
): { total: number; shown: DirHit[] } | null {
  const qt = normName(query).split(" ").filter((t) => t.length > 1 && !LIST_STOP.has(t));
  if (!qt.length) return null;
  const hits = index.filter((f) => {
    const words = f.nf.split(" ");
    return qt.every((t) => words.includes(t));
  });
  if (!hits.length) return null;
  hits.sort((a, b) => a.name.length - b.name.length || (a.name < b.name ? -1 : 1));
  return { total: hits.length, shown: hits.slice(0, cap).map((f) => ({ name: f.name, url: f.url })) };
}
