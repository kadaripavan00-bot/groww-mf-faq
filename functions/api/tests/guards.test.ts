import { describe, expect, it } from "vitest";
import { containsPII, isAdvice, isReturns, classifyGuard } from "../src/lib/guards.js";

describe("guards", () => {
  it("blocks PAN, Aadhaar-like numbers, phones, emails, OTPs", () => {
    expect(containsPII("My PAN is ABCDE1234F")).toBe(true);
    expect(containsPII("aadhaar 1234 5678 9012")).toBe(true);
    expect(containsPII("call me on 9876543210")).toBe(true);
    expect(containsPII("mail me at a@b.com")).toBe(true);
    expect(containsPII("my folio number 12345")).toBe(true);
    expect(containsPII("OTP 482913 please")).toBe(true);
  });
  it("does not block ordinary factual queries", () => {
    expect(containsPII("How to get a consolidated account statement from AMFI?")).toBe(false);
    expect(containsPII("What is the ELSS lock-in period?")).toBe(false);
    expect(containsPII("How to download capital-gains statement on Groww?")).toBe(false);
  });
  it("detects advice and returns intents", () => {
    expect(isAdvice("Should I buy Groww Large Cap Fund?")).toBe(true);
    expect(isAdvice("Which fund is best for me?")).toBe(true);
    expect(isAdvice("What is the expense ratio?")).toBe(false);
    expect(isReturns("Compare returns of liquid vs multicap")).toBe(true);
    expect(isReturns("What is XIRR?")).toBe(true);
    expect(isReturns("What is exit load?")).toBe(false);
  });
  it("classifies with PII first", () => {
    expect(classifyGuard("ABCDE1234F should I buy?")).toBe("pii");
  });
});
