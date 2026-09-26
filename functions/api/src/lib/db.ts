// Data layer: Neon Postgres when DATABASE_URL is set, else local JSON seeds.
// Same interface either way, so the prototype runs anywhere for $0.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FactRow, DirectoryRow } from "@groww-mf-faq/shared";

export interface SourceRow {
  id: number;
  url: string;
  title: string;
  kind: string;
  last_verified_at: string | null;
}

export interface Store {
  mode: "neon" | "local";
  getFacts(): Promise<FactRow[]>;
  getVectors(): Promise<Map<string, number[]>>;
  getDirectory(): Promise<DirectoryRow[]>;
  getSources(): Promise<SourceRow[]>;
  vectorSearch(queryVec: number[], limit: number): Promise<Array<{ id: string; cosine: number }>>;
  logQuery(intent: string, topic: string | null, resultKind: string): Promise<void>;
  saveFeedback(factId: string | null, helpful: boolean): Promise<void>;
}

const here = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(here, "..", "..", "..", "..", "db", "seeds");

function readSeed(name: string): unknown {
  return JSON.parse(readFileSync(join(SEED_DIR, name), "utf-8"));
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i];
  return s;
}

class LocalStore implements Store {
  mode = "local" as const;
  private facts: FactRow[] | null = null;
  private vecs: Map<string, number[]> | null = null;
  private dir: DirectoryRow[] | null = null;

  private load() {
    if (!this.facts) {
      const raw = readSeed("facts.json") as Array<Record<string, unknown>>;
      const srcTitle: Record<string, string> = {};
      try {
        const sources = readSeed("sources.json") as Array<{ url: string; title: string }>;
        for (const s of sources) srcTitle[s.url] = s.title;
      } catch { /* sources optional for fallback */ }
      this.facts = raw.map((f) => ({
        id: String(f.id),
        scheme_id: (f.scheme_id as string) ?? null,
        topic: f.topic as FactRow["topic"],
        question: String(f.question),
        answer: String(f.answer),
        source_title: srcTitle[String(f.source_url)] || "Official source",
        source_url: String(f.source_url),
        is_popular: Boolean(f.is_popular),
        verified_at: String(f.verified_at),
      }));
    }
    if (!this.vecs) {
      this.vecs = new Map();
      try {
        const v = readSeed("vectors.json") as { faqs: Array<{ id: string; vec: number[] }> };
        for (const e of v.faqs) this.vecs!.set(e.id, e.vec);
      } catch { /* vectors optional */ }
    }
    if (!this.dir) {
      try {
        const d = readSeed("fund_directory.json") as Array<{ fund_name: string; url: string }>;
        this.dir = d;
      } catch {
        this.dir = [];
      }
    }
  }

  async getFacts(): Promise<FactRow[]> { this.load(); return this.facts!; }
  async getVectors(): Promise<Map<string, number[]>> { this.load(); return this.vecs!; }
  async getDirectory(): Promise<DirectoryRow[]> { this.load(); return this.dir!; }
  async getSources(): Promise<SourceRow[]> {
    const sources = readSeed("sources.json") as Array<{ url: string; title: string; kind: string }>;
    return sources.map((s, i) => ({ id: i + 1, url: s.url, title: s.title, kind: s.kind, last_verified_at: null }));
  }
  async vectorSearch(queryVec: number[], limit: number) {
    this.load();
    return [...this.vecs!.entries()]
      .map(([id, v]) => ({ id, cosine: dot(queryVec, v) }))
      .sort((a, b) => b.cosine - a.cosine)
      .slice(0, limit);
  }
  async logQuery(): Promise<void> { /* local mode: no persistence */ }
  async saveFeedback(): Promise<void> { /* local mode: no persistence */ }
}

class NeonStore implements Store {
  mode = "neon" as const;
  private sql: unknown = null;
  private async client() {
    if (!this.sql) {
      const { neon } = await import("@neondatabase/serverless");
      this.sql = neon(process.env.DATABASE_URL!);
    }
    return this.sql as <T>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  }
  async getFacts(): Promise<FactRow[]> {
    const sql = await this.client();
    const rows = await sql<Array<Record<string, unknown>>>`
      SELECT f.id, f.scheme_id, f.topic, f.question, f.answer,
             s.title AS source_title, s.url AS source_url,
             f.is_popular, f.verified_at::text AS verified_at
      FROM facts f JOIN sources s ON s.id = f.source_id ORDER BY f.id`;
    return rows.map((r) => ({
      id: String(r.id), scheme_id: (r.scheme_id as string) ?? null,
      topic: r.topic as FactRow["topic"], question: String(r.question),
      answer: String(r.answer), source_title: String(r.source_title),
      source_url: String(r.source_url), is_popular: Boolean(r.is_popular),
      verified_at: String(r.verified_at),
    }));
  }
  async getVectors(): Promise<Map<string, number[]>> {
    const sql = await this.client();
    const rows = await sql<Array<{ id: string; embedding: string }>>`
      SELECT id, embedding::text AS embedding FROM facts WHERE embedding IS NOT NULL`;
    const m = new Map<string, number[]>();
    for (const r of rows) {
      const nums = r.embedding.replace(/[\[\]]/g, "").split(",").map(Number);
      if (nums.length === 384 && nums.every(Number.isFinite)) m.set(r.id, nums);
    }
    return m;
  }
  async getDirectory(): Promise<DirectoryRow[]> {
    const sql = await this.client();
    return sql<DirectoryRow[]>`SELECT fund_name, url FROM fund_directory ORDER BY fund_name`;
  }
  async getSources(): Promise<SourceRow[]> {
    const sql = await this.client();
    return sql<SourceRow[]>`SELECT id, url, title, kind, last_verified_at::text AS last_verified_at FROM sources ORDER BY id`;
  }
  async vectorSearch(queryVec: number[], limit: number) {
    const sql = await this.client();
    const lit = `[${queryVec.join(",")}]`;
    const rows = await sql<Array<{ id: string; cosine: number }>>`
      SELECT id, 1 - (embedding <=> ${lit}::vector) AS cosine
      FROM facts WHERE embedding IS NOT NULL ORDER BY embedding <=> ${lit}::vector LIMIT ${limit}`;
    return rows;
  }
  async logQuery(intent: string, topic: string | null, resultKind: string): Promise<void> {
    const sql = await this.client();
    await sql`INSERT INTO query_stats (intent, topic, result_kind) VALUES (${intent}, ${topic}, ${resultKind})`;
  }
  async saveFeedback(factId: string | null, helpful: boolean): Promise<void> {
    const sql = await this.client();
    await sql`INSERT INTO feedback (fact_id, helpful) VALUES (${factId}, ${helpful})`;
  }
}

let store: Store | null = null;

/** Neon when DATABASE_URL is set (needs a Neon project + migrations applied);
 *  otherwise the local JSON seeds. Set NEON_DISABLED=1 in tests if needed. */
export function getStore(): Store {
  if (!store) {
    store = process.env.DATABASE_URL ? new NeonStore() : new LocalStore();
  }
  return store;
}

/** Test hook: is a real Neon backend configured? */
export function usesNeon(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function dataDirExists(): boolean {
  return existsSync(SEED_DIR);
}
