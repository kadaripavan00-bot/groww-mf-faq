"""Build precomputed FAQ embeddings (MiniLM-L6-v2, 384-dim, L2-normalized).
Must match the browser twin (Xenova/all-MiniLM-L6-v2, mean pooling, normalize).
Run: python scripts/build_vectors.py   (from repo root; writes db/seeds/vectors.json)
"""
import json

from sentence_transformers import SentenceTransformer

MODEL = "all-MiniLM-L6-v2"

facts = json.load(open("db/seeds/facts.json", encoding="utf-8"))
texts = [f["question"] + " " + f["answer"] for f in facts]

model = SentenceTransformer(MODEL)
vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)

out = {
    "model": MODEL,
    "dim": int(vecs.shape[1]),
    "built": "2026-09-26",
    "faqs": [{"id": f["id"], "vec": [round(float(x), 5) for x in v]} for f, v in zip(facts, vecs)],
}
json.dump(out, open("db/seeds/vectors.json", "w", encoding="utf-8"))
print("WROTE db/seeds/vectors.json faqs=", len(out["faqs"]), "dim=", out["dim"])
