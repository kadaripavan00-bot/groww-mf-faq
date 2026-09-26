"""Weekly source re-verification (CI cron).
Fetches each allowlisted source URL, hashes content, and reports drift
(new hash, unreachable, moved) so facts can be re-verified.
Run: python scripts/ingest/fetch_sources.py
Writes: scripts/ingest/last_fetch_report.json (git-ignored).
"""
import hashlib
import json
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) groww-mf-faq/1.0"}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read()


def main():
    sources = json.load(open("db/seeds/sources.json", encoding="utf-8"))
    report = []
    for s in sources:
        try:
            status, body = fetch(s["url"])
            digest = hashlib.sha256(body).hexdigest()[:16]
            report.append({"url": s["url"], "status": status, "sha": digest, "bytes": len(body)})
            print(f"OK {status} {s['url']}")
        except Exception as exc:  # noqa: BLE001
            report.append({"url": s["url"], "status": "fetch-failed", "error": str(exc)[:200]})
            print(f"FAIL {s['url']}: {exc}")
    with open("scripts/ingest/last_fetch_report.json", "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    failed = sum(1 for r in report if r["status"] != 200)
    print(f"done: {len(report) - failed}/{len(report)} reachable")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
