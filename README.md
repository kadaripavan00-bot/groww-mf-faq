# Groww MF FAQ Assistant (facts-only RAG)

Facts-only Q&A about Groww Mutual Fund schemes. Every answer carries one
official source link. No advice, no returns computed, no PII stored.

Live: https://groww-mf-faq-omega.vercel.app
Repo: https://github.com/kadaripavan00-bot/groww-mf-faq

## Scope
- AMC: Groww Mutual Fund. Schemes: Large Cap, Multicap, ELSS Tax Saver, Liquid.
- Corpus: 20 public pages (Groww / AMFI / SEBI) + 3,328-fund directory + 35 FAQs.

## Setup
```bash
npm install
npm test            # unit tests (vitest)
npm run typecheck
python scripts/eval/run_eval.py   # golden Q&A + link reachability
npm run dev:api      # API on :8787 (local JSON seeds; set DATABASE_URL for Neon)
npm run dev:web      # web app on :5173 (proxies /api)
```

## Environment (all optional; app degrades gracefully)
| Var | Purpose | Without it |
|---|---|---|
| `DATABASE_URL` | Neon Postgres backend (run `db/migrations/001_init.sql` + `db/seeds/seed.sql` there first) | local JSON seeds |
| `GEMINI_API_KEY` | Gemini Flash display wording (validator-gated) | verbatim extractive answers |

## Refreshing data
```bash
python scripts/ingest/fetch_sources.py  # re-verify the 20 sources
python scripts/crawl_funds.py           # refresh fund directory
python scripts/build_vectors.py && python scripts/build_seed_sql.py && python scripts/build_faq_bundle.py
```

## Mobile (Android/iOS, $0)
```bash
cd apps/web && npm run build && npx cap sync
# open android/ in Android Studio (free) for APK; iOS needs Xcode (Mac)
```

## Known limits
- Figures (TER, exit load, AUM) change; answers carry verified dates.
- Out-of-scope funds get link-only answers, never figures.
- Free-tier quotas (Gemini) degrade to extractive answers, never errors.
- Query embedding (~25MB Transformers.js download) is lazy, per-question, with keyword fallback.
