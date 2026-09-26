-- 001_init.sql — initial schema for groww-mf-faq (Neon Postgres).
-- Run in the Neon console SQL editor or: psql $DATABASE_URL -f db/migrations/001_init.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS schemes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amc TEXT NOT NULL,
  scheme_page_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sources (
  id SERIAL PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  scheme_id TEXT NULL REFERENCES schemes(id),
  last_fetched_at TIMESTAMPTZ,
  last_verified_at DATE,
  fetch_status TEXT NOT NULL DEFAULT 'pending',
  content_hash TEXT,
  CONSTRAINT sources_url_allowlist CHECK (
    url LIKE 'https://groww.in/%'
    OR url LIKE 'https://www.amfiindia.com/%'
    OR url LIKE 'https://www.sebi.gov.in%'
    OR url LIKE 'https://scores.sebi.gov.in%'
    OR url LIKE 'https://smartodr.in/%'
  )
);

CREATE TABLE IF NOT EXISTS facts (
  id TEXT PRIMARY KEY,
  scheme_id TEXT NULL REFERENCES schemes(id),
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  verified_at DATE NOT NULL,
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  embedding VECTOR(384)
);
CREATE INDEX IF NOT EXISTS facts_topic_scheme_idx ON facts(topic, scheme_id);
CREATE INDEX IF NOT EXISTS facts_qa_trgm_idx ON facts USING gin ((question || ' ' || answer) gin_trgm_ops);

CREATE TABLE IF NOT EXISTS fact_versions (
  id SERIAL PRIMARY KEY,
  fact_id TEXT NOT NULL REFERENCES facts(id),
  answer TEXT NOT NULL,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_reason TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS fund_directory (
  fund_name TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  last_seen_at DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS fund_directory_name_trgm_idx ON fund_directory USING gin (fund_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  fact_id TEXT NULL REFERENCES facts(id),
  helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS query_stats (
  id SERIAL PRIMARY KEY,
  intent TEXT NOT NULL,
  topic TEXT NULL,
  result_kind TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
