"""Build the static FAQ bundle for the web app's browse sections.
Run: python scripts/build_faq_bundle.py   (writes apps/web/public/faqs.json)
"""
import json

facts = json.load(open("db/seeds/facts.json", encoding="utf-8"))
sources = {s["url"]: s["title"] for s in json.load(open("db/seeds/sources.json", encoding="utf-8"))}
try:
    funds = len(json.load(open("db/seeds/fund_directory.json", encoding="utf-8")))
except FileNotFoundError:
    funds = 0

bundle = {
    "meta": {"faqs": len(facts), "funds_indexed": funds},
    "faqs": [
        {
            "question": f["question"],
            "answer": f["answer"],
            "source_title": sources.get(f["source_url"], "Official source"),
            "source_url": f["source_url"],
            "is_popular": bool(f["is_popular"]),
        }
        for f in facts
    ],
}
with open("apps/web/public/faqs.json", "w", encoding="utf-8") as fh:
    json.dump(bundle, fh, ensure_ascii=False)
print(f"WROTE apps/web/public/faqs.json faqs={len(facts)} funds_indexed={funds}")
