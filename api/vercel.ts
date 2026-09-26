// Minimal Vercel-compatible request/response typings (no extra dependency).
export interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}
export interface VercelResponse {
  status(code: number): VercelResponse;
  json(data: unknown): void;
}
