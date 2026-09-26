// Composition: Gemini drafts display wording from retrieved facts;
// extractive fallback keeps every guarantee when the LLM path is unavailable.
import type { FactRow } from "@groww-mf-faq/shared";

export interface GroundingFact { answer: string; source_url: string; }

export function buildGroundedPrompt(question: string, facts: GroundingFact[]): { system: string; user: string } {
  const ctx = facts
    .map((f, i) => `[${i + 1}] ${f.answer} (Source: ${f.source_url})`)
    .join("\n");
  return {
    system:
      "You are a facts-only mutual fund FAQ assistant. Answer using ONLY the provided context facts. " +
      "At most 3 sentences. End with exactly one line: Source: <one URL copied from the context>. " +
      "Never give investment advice, never compute or compare returns, never request or repeat personal data. " +
      "If the context is insufficient, output the fixed scope-fallback text verbatim.",
    user: `CONTEXT:\n${ctx}\n\nQUESTION: ${question}`,
  };
}

export function enforceThreeSentences(text: string): string {
  return text.split(/(?<=[.!?])\s+/).slice(0, 3).join(" ");
}

const GEMINI_MODEL = "gemini-2.0-flash";

export async function callGemini(question: string, facts: GroundingFact[], apiKey: string): Promise<string> {
  const prompt = buildGroundedPrompt(question, facts);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: prompt.system }] },
        contents: [{ parts: [{ text: prompt.user }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini-http-${res.status}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text.trim()) throw new Error("gemini-empty");
  return text.trim();
}

/** Verbatim extractive composition (stored/logged/evaluated result). */
export function composeExtractive(fact: FactRow): string {
  return enforceThreeSentences(fact.answer);
}
