"""Crawl Groww's alphabetical MF fund-list pages -> fund_directory seed JSON.
Run: python scripts/crawl_funds.py   (writes db/seeds/fund_directory.json)
Public Groww pages only. Polite 1s delay between requests.
"""
import html as htmlmod
import json
import re
import time
import urllib.request

BASE = "https://groww.in"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) groww-mf-faq/1.0"}
FUND_RE = re.compile(r'<a[^>]+href="(/mutual-funds/[^"]+)"[^>]*>([^<]+)</a>', re.I)
PAGE_RE = re.compile(r"/mutual-funds/fund-list/([a-z]+|others)/(\d+)")
SKIP_SLUGS = {"filter", "compare", "amc", "category", "start-sip", "track",
              "fund-list", "debt-funds"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def extract_funds(pg):
    out = []
    for path, text in FUND_RE.findall(pg):
        text = htmlmod.unescape(re.sub(r"\s+", " ", text)).strip()
        prev = None
        while text != prev:  # fully unescape double-escaped entities
            prev, text = text, htmlmod.unescape(text)
        if not text or len(text) < 4:
            continue
        seg = path.strip("/").split("/")
        if len(seg) != 2 or seg[0] != "mutual-funds":
            continue
        if seg[1] in SKIP_SLUGS:
            continue
        if not re.search(r"fund|etf|fof|plan|yojna|nifty|sensex|index|bond|gilt|liquid", text, re.I):
            continue
        out.append((text, BASE + path))
    return out


letters = [chr(c) for c in range(ord("a"), ord("z") + 1)] + ["others"]
seen = {}
for letter in letters:
    url = f"{BASE}/mutual-funds/fund-list/{letter}"
    try:
        html = get(url)
    except Exception as exc:  # noqa: BLE001
        print(f"[{letter}] list failed: {exc}")
        continue
    pages = {1}
    for _, p in PAGE_RE.findall(html):
        pages.add(int(p))
    for p in sorted(pages):
        try:
            pg = get(url if p == 1 else f"{url}/{p}")
            time.sleep(1)
        except Exception as exc:  # noqa: BLE001
            print(f"[{letter}/{p}] failed: {exc}")
            continue
        for name, link in extract_funds(pg):
            seen[link] = name
    print(f"[{letter}] pages={len(pages)} total-so-far={len(seen)}", flush=True)

index = [{"fund_name": n, "url": u} for u, n in sorted(seen.items(), key=lambda kv: kv[1].lower())]
with open("db/seeds/fund_directory.json", "w", encoding="utf-8") as f:
    json.dump(index, f, ensure_ascii=False)
print("WROTE db/seeds/fund_directory.json count=", len(index))
