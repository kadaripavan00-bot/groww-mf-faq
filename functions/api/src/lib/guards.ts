// Guardrails: PII block, advice refusal, returns refusal. Run before retrieval.
const PII_PATTERNS: RegExp[] = [
  /[A-Z]{5}[0-9]{4}[A-Z]/,
  /\b\d{4}\s?\d{4}\s?\d{4}\b/,
  /\bfolio\b[^.?!]{0,40}\d/i,
  /\b(my|your)\b[^.?!]{0,30}\b(account|folio)\s*(number|no\.?|num|id|details|balance)/i,
  /\b(account|folio)\s*(number|no\.?|num|id)\s*[:#]?\s*[\w-]+/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(\+91[\s-]?)?[6-9]\d{9}/,
  /\b\d{4,8}\b.*\botp\b/i,
  /\botp\b.*\b\d{4,8}\b/i,
];

const ADVICE_PATTERNS: RegExp[] = [
  /should\s+i\s+(buy|sell|invest|redeem|switch|hold)/i,
  /\b(buy|sell|switch|redeem|hold)\b.*\?/i,
  /which.*(better|best|choose|pick|recommend)/i,
  /(recommend|suggest|advise|advice|opinion|worth\s+(buying|investing))/i,
  /portfolio.*(review|rebalance|allocate)/i,
];

const RETURNS_PATTERNS: RegExp[] = [
  /\b(return|performance|cagr|xirr|nav.*growth|which.*gives.*more)\b/i,
  /compare.*return/i,
  /how\s+much.*(earn|profit|gain)/i,
];

export type GuardHit = "pii" | "advice" | "returns" | null;

export function containsPII(q: string): boolean {
  return PII_PATTERNS.some((re) => re.test(q));
}
export function isAdvice(q: string): boolean {
  return ADVICE_PATTERNS.some((re) => re.test(q));
}
export function isReturns(q: string): boolean {
  return RETURNS_PATTERNS.some((re) => re.test(q));
}
export function classifyGuard(q: string): GuardHit {
  if (containsPII(q)) return "pii";
  if (isAdvice(q)) return "advice";
  if (isReturns(q)) return "returns";
  return null;
}
