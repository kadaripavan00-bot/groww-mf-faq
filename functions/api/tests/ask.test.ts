import { describe, expect, it } from "vitest";
import { ask, extractiveComposer, type Composer } from "../src/core/ask.js";
import { getStore } from "../src/lib/db.js";
import type { Store } from "../src/lib/db.js";

if (process.env.DATABASE_URL) delete process.env.DATABASE_URL;
const store: Store = getStore(); // local JSON seeds (no DATABASE_URL in tests)

const fakeGemini: Composer = {
  async compose(q, facts) {
    return `${q} -- grounded. Source: ${facts[0].source_url}`;
  },
};
const throwing: Composer = {
  async compose() { throw new Error("quota"); },
};

describe("ask flow", () => {
  it("answers a curated fact with one citation", async () => {
    const { res } = await ask("What is the expense ratio of Groww Liquid Fund?", undefined, { store, composer: extractiveComposer });
    expect(res.mode).toBe("fact");
    expect(res.answer).toContain("Groww Liquid Fund");
    expect(res.source.url).toMatch(/^https:\/\//);
  });
  it("refuses advice, returns, and PII without calling the composer", async () => {
    let calls = 0;
    const counting: Composer = { async compose(...a) { calls++; return fakeGemini.compose(...a); } };
    for (const q of ["Should I buy X?", "Compare returns A vs B", "My PAN is ABCDE1234F"]) {
      const { res } = await ask(q, undefined, { store, composer: counting });
      expect(res.mode).toBe("refusal");
    }
    expect(calls).toBe(0);
  });
  it("routes named non-curated funds to their official page", async () => {
    const { res } = await ask("What is the expense ratio of Parag Parikh Flexi Cap Fund?", undefined, { store, composer: extractiveComposer });
    expect(res.mode).toBe("directory");
    expect(res.source.url).toContain("parag-parikh");
  });
  it("answers bare '<AMC/category> funds' with a listing", async () => {
    for (const q of ["hdfc funds", "liquid funds", "SBI schemes", "HDFC", "Parag Parikh", "gold"]) {
      const { res } = await ask(q, undefined, { store, composer: extractiveComposer });
      const list = "list" in res && res.list ? res.list : [];
      expect(list.length).toBeGreaterThanOrEqual(2);
    }
    for (const q of ["ELSS", "tax saver", "liquid", "large cap", "What is the riskometer level of these Groww funds?"]) {
      const { res } = await ask(q, undefined, { store, composer: extractiveComposer });
      expect("list" in res && res.list ? res.list.length : 0).toBe(0);
    }
  });
  it("answers listing queries with official links", async () => {
    const { res } = await ask("what hdfc funds exist", undefined, { store, composer: extractiveComposer });
    const list = "list" in res && res.list ? res.list : [];
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list.every((f) => f.url.startsWith("https://groww.in/mutual-funds/"))).toBe(true);
  });
  it("uses the composer when available, falls back when it throws", async () => {
    const ok = await ask("ELSS lock-in period?", undefined, { store, composer: fakeGemini });
    expect(ok.res.answer).toContain("Source:");
    const fb = await ask("ELSS lock-in period?", undefined, { store, composer: throwing });
    expect(fb.res.answer).toContain("3-year lock-in");
  });
  it("hybrid vector input re-ranks (uses real seed vectors)", async () => {
    const vecs = await store.getVectors();
    const facts = await store.getFacts();
    const target = facts.find((f) => f.id === "elss-lockin")!;
    const qv = vecs.get("elss-lockin")!;
    const { res } = await ask("completely unrelated words xyzzy", qv, { store, composer: extractiveComposer });
    expect(res.answer).toContain("3-year lock-in");
  });
});
