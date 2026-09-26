// Client-side query embedding (Transformers.js MiniLM-L6-v2, ~25MB one-time).
// Bit-compatible with ingest vectors (mean pooling, L2-normalized).
// Failure/deferral is normal: the server falls back to keyword retrieval.
let pipePromise: Promise<unknown> | null = null;

async function getPipe(): Promise<{
  (text: string, opts: { pooling: string; normalize: boolean }): Promise<{ data: ArrayLike<number> }>;
}> {
  if (!pipePromise) {
    pipePromise = (async () => {
      // @ts-ignore - CDN module has no local types; failure falls back to keyword retrieval.
      const mod = (await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2/+esm")) as {
        pipeline: (
          task: string,
          model: string,
        ) => Promise<
          (text: string, opts: { pooling: string; normalize: boolean }) => Promise<{ data: ArrayLike<number> }>
        >;
      };
      return mod.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    })();
  }
  return pipePromise as Promise<
    (text: string, opts: { pooling: string; normalize: boolean }) => Promise<{ data: ArrayLike<number> }>
  >;
}

export async function embedQuery(query: string, timeoutMs = 25000): Promise<number[] | null> {
  try {
    const pipe = await Promise.race([
      getPipe(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("vec-timeout")), timeoutMs)),
    ]);
    const out = await pipe(query, { pooling: "mean", normalize: true });
    return Array.from(out.data);
  } catch {
    return null;
  }
}
