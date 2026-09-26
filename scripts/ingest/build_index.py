"""Rebuild the retrieval index inputs from seeds (weekly cron companion).
Regenerates vectors + seed SQL + FAQ bundle so re-verified facts flow
everywhere from one source of truth. Requires sentence-transformers.
Run: python scripts/ingest/build_index.py
"""
import subprocess
import sys

STEPS = [
    [sys.executable, "scripts/build_vectors.py"],
    [sys.executable, "scripts/build_seed_sql.py"],
    [sys.executable, "scripts/build_faq_bundle.py"],
]
for step in STEPS:
    print("+", " ".join(step))
    subprocess.run(step, check=True)
print("index rebuilt")
