// Core ask flow: guards -> routing -> retrieval -> compose -> enforce.
// Pure except for injected store/composer: fully unit-testable.
import type { AskResponse, FactRow, FundListItem } from "@groww-mf-faq/shared";
import {
  REFUSAL_ADVICE, REFUSAL_RETURNS, REFUSAL_PII, REFUSAL_SCOPE,
  EDUCATION_URL, FACTSHEET_URL, HELP_URL,
} from "@groww-mf-faq/shared";
import { classifyGuard } from "../lib/guards.js";
import {
  LAST_UPDATED, SCORE_THRESHOLD,
  detectCuratedScheme, retrieveKeyword, applyCosine,
  buildDirIndex, findFund, isListingQuery, listFunds,
} from "../lib/retrieve.js";
import { composeExtractive } from "../lib/compose.js";
import { validateResponse } from "../lib/enforce.js";
import type { Store } from "../lib/db.js";

export interface Composer {
  /** Returns display wording or throws (timeout/quota/API error). */
  compose(question: string, facts: Array<{ answer: string; source_url: string }>): Promise<string>;
}

export const extractiveComposer: Composer = {
  async compose(_q, facts) {
    if (!facts.length) throw new Error("no-context");
    return composeExtractive({ answer: facts[0].answer } as FactRow);
  },
};

export interface AskDeps {
  store: Store;
  composer: Composer; // Gemini composer in prod, stub in tests
  maxFacts?: number;
}

function refusal(mode: "refusal", text: string, url: string, title: string, intent: string): { res: AskResponse; intent: string; topic: null; kind: string } {
  return {
    res: { answer: text, source: { title, url }, last_updated_from_sources: LAST_UPDATED, mode },
    intent, topic: null, kind: intent,
  };
}

export async function ask(query: string, vector: number[] | undefined, deps: AskDeps) {
  const q = (query || "").trim();
  if (!q) {
    return refusal("refusal", "Please ask a factual question, for example about expense ratio, exit load, minimum SIP, or lock-in.", EDUCATION_URL, "Groww AMC scheme list", "empty");
  }
  const guard = classifyGuard(q);
  if (guard === "pii") return refusal("refusal", REFUSAL_PII, HELP_URL, "Groww Help & Support", "refusal-pii");
  if (guard === "advice") return refusal("refusal", REFUSAL_ADVICE, EDUCATION_URL, "Groww AMC - official scheme pages", "refusal-advice");
  if (guard === "returns") return refusal("refusal", REFUSAL_RETURNS, FACTSHEET_URL, "Groww AMC - factsheet host", "refusal-returns");

  const [facts, dirRows] = await Promise.all([deps.store.getFacts(), deps.store.getDirectory()]);
  const dirIndex = buildDirIndex(dirRows);
  const forcedScheme = detectCuratedScheme(q);

  // Listing intent ("what HDFC funds exist") -> up to 8 official links.
  if (!forcedScheme && isListingQuery(q)) {
    const listing = listFunds(q, dirIndex, 8);
    if (listing) {
      const names = listing.shown.map((f) => f.name).join("; ");
      const list: FundListItem[] = listing.shown;
      return {
        res: {
          answer: `Matching funds on Groww (${listing.shown.length} of ${listing.total}): ${names}. Open a fund for its factsheet, NAV and charges.`,
          source: { title: "Groww Mutual Funds screener", url: "https://groww.in/mutual-funds/filter" },
          last_updated_from_sources: LAST_UPDATED, mode: "fact" as const, list,
        },
        intent: "listing", topic: null, kind: "directory",
      };
    }
  }

  // Named non-curated fund -> official page (never another fund's figures).
  if (!forcedScheme) {
    const hit = findFund(q, dirIndex);
    if (hit) {
      return {
        res: {
          answer: `I don't hold verified figures for ${hit.name} in this demo. See its official Groww page for factsheet, NAV, expense ratio and exit load.`,
          source: { title: `${hit.name} on Groww`, url: hit.url },
          last_updated_from_sources: LAST_UPDATED, mode: "directory" as const,
        },
        intent: "directory", topic: null, kind: "directory",
      };
    }
  }

  // Curated retrieval: keyword base, hybridized with cosine when a valid
  // client vector is supplied (server re-checks dims; cosine is dot of norms).
  let ranked = retrieveKeyword(q, facts);
  if (vector && vector.length === 384 && vector.every(Number.isFinite)) {
    const norm = Math.sqrt(vector.reduce((s, x) => s + x * x, 0));
    if (norm > 0.99 && norm < 1.01) {
      const vecById = await deps.store.getVectors();
      ranked = applyCosine(ranked, vector, vecById).map((r) => ({
        fact: r.fact, score: r.score, cosine: r.cosine,
      }));
    }
  }
  const best = ranked[0];
  if (!best || best.score < SCORE_THRESHOLD) {
    return refusal("refusal", REFUSAL_SCOPE, EDUCATION_URL, "Groww AMC - scheme list", "fallback");
  }

  const top = ranked.slice(0, deps.maxFacts ?? 3).map((r) => r.fact);
  const context = top.map((f) => ({ answer: f.answer, source_url: f.source_url }));
  const answer = await composeWithFallback(q, context, top[0], deps.composer);
  return {
    res: {
      answer,
      source: { title: top[0].source_title, url: top[0].source_url },
      last_updated_from_sources: top[0].verified_at || LAST_UPDATED,
      mode: "fact" as const,
    },
    intent: "fact", topic: top[0].topic, kind: "fact",
  };
}

async function composeWithFallback(
  question: string,
  context: Array<{ answer: string; source_url: string }>,
  top: FactRow,
  composer: Composer,
): Promise<string> {
  try {
    const text = await composer.compose(question, context);
    const v = validateResponse({ text, allowedUrls: context.map((c) => c.source_url) });
    if (v.ok) return text;
  } catch { /* fail-closed to extractive */ }
  return composeExtractive(top);
}
