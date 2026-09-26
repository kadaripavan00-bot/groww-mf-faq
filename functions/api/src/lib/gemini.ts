// Gemini composer: hosted LLM display wording (Section 8 of architecture).
// Used only when GEMINI_API_KEY is set; otherwise the extractive composer.
import { callGemini } from "../lib/compose.js";
import type { Composer } from "../core/ask.js";

export function geminiComposer(): Composer {
  const key = process.env.GEMINI_API_KEY || "";
  return {
    async compose(question, facts) {
      if (!key) throw new Error("no-gemini-key");
      return callGemini(question, facts, key);
    },
  };
}
