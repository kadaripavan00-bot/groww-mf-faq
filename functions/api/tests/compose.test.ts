import { describe, expect, it } from "vitest";
import { buildGroundedPrompt, enforceThreeSentences, composeExtractive } from "../src/lib/compose.js";
import { validateResponse } from "../src/lib/enforce.js";
import { isAllowlistedUrl } from "@groww-mf-faq/shared";

describe("compose + enforce", () => {
  it("grounds the prompt on context only", () => {
    const p = buildGroundedPrompt("Q?", [{ answer: "A.", source_url: "https://groww.in/help" }]);
    expect(p.system).toContain("ONLY");
    expect(p.user).toContain("https://groww.in/help");
  });
  it("caps sentences and keeps extractive verbatim", () => {
    expect(enforceThreeSentences("One. Two. Three. Four.")).toBe("One. Two. Three.");
    expect(composeExtractive({ answer: "Exact text here." } as never)).toBe("Exact text here.");
  });
  it("validator is fail-closed", () => {
    const urls = ["https://groww.in/help"];
    expect(validateResponse({ text: "Fine. Source: https://groww.in/help", allowedUrls: urls })).toEqual({ ok: true });
    expect(validateResponse({ text: "No link here.", allowedUrls: urls }).ok).toBe(false);
    expect(validateResponse({ text: "One. Two. Three. Four. Source: https://groww.in/help", allowedUrls: urls }).ok).toBe(false);
    expect(validateResponse({ text: "You should buy this. Source: https://groww.in/help", allowedUrls: urls }).ok).toBe(false);
  });
  it("allowlist rejects blogs", () => {
    expect(isAllowlistedUrl("https://groww.in/mutual-funds")).toBe(true);
    expect(isAllowlistedUrl("https://random-blog.com/post")).toBe(false);
  });
});
