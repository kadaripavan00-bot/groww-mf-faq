// Fixed refusal texts + patterns shared by client pre-checks and server guards.
export const REFUSAL_ADVICE =
  "I provide facts only, no investment advice. For scheme details, see the official scheme page and read all scheme documents carefully.";
export const REFUSAL_RETURNS =
  "I do not compute or compare returns. See the official factsheet on the scheme page for NAV and disclosures.";
export const REFUSAL_PII =
  "Please remove personal details (PAN, Aadhaar, account/folio numbers, OTP, email, phone). I do not collect PII. You can re-ask without personal details.";
export const REFUSAL_SCOPE =
  "I can answer facts about Groww Large Cap, Multicap, ELSS Tax Saver, and Liquid funds: expense ratio, exit load, minimum SIP, lock-in, riskometer, benchmark, or statements. Please ask one of these.";
export const EDUCATION_URL = "https://groww.in/mutual-funds/amc/groww-mutual-funds";
export const FACTSHEET_URL = "https://groww.in/mutual-funds/amc/groww-mutual-funds";
export const HELP_URL = "https://groww.in/help";

export const DISCLAIMER =
  "Mutual fund investments are subject to market risks. Read all scheme related documents carefully. Facts-only. No investment advice.";

// Denylist phrases that must never appear in generated (LLM) output.
export const OUTPUT_DENYLIST = [
  "you should buy", "you should sell", "you should invest", "you should redeem",
  "i recommend", "my recommendation", "guaranteed return", "assured return",
  "xirr", "cagr of",
];
