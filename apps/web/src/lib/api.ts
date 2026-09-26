// API client: same-origin /api (Vite proxies to :8787 in dev).
import type { AskRequest, AskResponse, SourceLink } from "@groww-mf-faq/shared";

export async function postAsk(query: string, vector?: number[]): Promise<AskResponse> {
  const body: AskRequest = vector ? { query, vector } : { query };
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ask-http-${res.status}`);
  return (await res.json()) as AskResponse;
}

export async function getSources(): Promise<SourceLink[]> {
  const res = await fetch("/api/sources");
  if (!res.ok) throw new Error(`sources-http-${res.status}`);
  return (await res.json()) as SourceLink[];
}

export async function postFeedback(factId: string | null, helpful: boolean): Promise<void> {
  try {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fact_id: factId, helpful }),
    });
  } catch { /* never break the UI */ }
}
