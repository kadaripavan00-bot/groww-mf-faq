import { describe, expect, it } from "vitest";
import {
  detectTopic, detectScheme, detectCuratedScheme, retrieveKeyword,
  applyCosine, findFund, buildDirIndex, isListingQuery, listFunds,
} from "../src/lib/retrieve.js";
import type { FactRow } from "@groww-mf-faq/shared";

const facts: FactRow[] = [
  { id: "liquid-expense", scheme_id: "groww-liquid", topic: "expense_ratio", question: "Q", answer: "Groww Liquid Fund Direct plan expense ratio was shown as 0.11%.", source_title: "T", source_url: "https://groww.in/mutual-funds/amc/groww-mutual-funds", is_popular: true, verified_at: "2026-09-22" },
  { id: "elss-lockin", scheme_id: "groww-elss", topic: "lock_in", question: "Q", answer: "Groww ELSS Tax Saver Fund has a statutory 3-year lock-in.", source_title: "T", source_url: "https://groww.in/mutual-funds/groww-elss-tax-saver-fund-direct-growth", is_popular: true, verified_at: "2026-09-22" },
];

describe("retrieve", () => {
  it("detects topics without substring traps", () => {
    expect(detectTopic("What is the riskometer of Groww Liquid Fund?")).toBe("riskometer");
    expect(detectTopic("Is there an exit load after 7 days?")).toBe("exit_load");
    expect(detectTopic("cheapest liquid fund")).toBe("expense_ratio");
    expect(detectTopic("where to complain")).toBe("platform");
  });
  it("prioritizes explicit Groww scheme mentions", () => {
    expect(detectCuratedScheme("What is the expense ratio of Groww Liquid Fund?")).toBe("groww-liquid");
    expect(detectCuratedScheme("HDFC Large Cap Fund exit load")).toBeNull();
  });
  it("ranks the right fact first", () => {
    const top = retrieveKeyword("What is the expense ratio of Groww Liquid Fund?", facts)[0];
    expect(top.fact.id).toBe("liquid-expense");
    expect(top.score).toBeGreaterThanOrEqual(6);
  });
  it("applyCosine re-ranks by cosine", () => {
    const base = retrieveKeyword("something vague", facts);
    const boosted = applyCosine(base, [1], new Map());
    expect(boosted).toHaveLength(2);
  });
  it("finds directory funds and listing queries", () => {
    const idx = buildDirIndex([
      { fund_name: "Parag Parikh Flexi Cap Fund", url: "https://groww.in/mutual-funds/parag-parikh-long-term-value-fund-direct-growth" },
      { fund_name: "HDFC Flexi Cap Fund", url: "https://groww.in/mutual-funds/hdfc-equity-fund-direct-growth" },
    ]);
    expect(findFund("What is the expense ratio of Parag Parikh Flexi Cap Fund?", idx)?.url).toContain("parag-parikh");
    expect(isListingQuery("what hdfc funds exist")).toBe(true);
    expect(isListingQuery("What is exit load?")).toBe(false);
    const listing = listFunds("what hdfc funds exist", idx, 8);
    expect(listing?.shown[0].name).toContain("HDFC");
  });
  it("detectScheme spots scheme aliases", () => {
    expect(detectScheme("ELSS lock-in?", ["groww-elss", "groww-liquid"])).toBe("groww-elss");
  });
});
