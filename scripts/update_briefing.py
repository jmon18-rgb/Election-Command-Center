#!/usr/bin/env python3
"""Build a sourced, timestamped election-news digest from public RSS.
Headlines are leads for further reading, NOT verified factual findings.
Uses Python standard library only. Runs on GitHub Actions.
"""
import datetime as dt
import email.utils
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "briefing.json"
NOW = dt.datetime.now(dt.timezone.utc)
MAX_AGE_DAYS = 8
QUERIES = {
    "updates": [
        "2026 midterm election senate house polling new poll",
        "2026 midterms house senate race election forecast",
        "2026 midterm election battleground poll survey",
    ],
    "security": [
        "2026 election voter registration lawsuit court order",
        "2026 election voter roll removal SAVE database",
        "2026 election polling place security threats voting access ICE",
    ],
}
MAX_ITEMS = {"updates": 9, "security": 8}
USER_AGENT = "ElectionCommandCenter/0.3 (+https://github.com/jmon18-rgb/Election-Command-Center) Mozilla/5.0"
BAD_WORDS = ("opinion:", "horoscope", "sports betting")

def read_existing():
    try:
        obj = json.loads(OUTPUT.read_text(encoding="utf-8"))
        return obj if isinstance(obj, dict) else {}
    except (OSError, ValueError):
        return {}

def clean(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()

def rss_search(query):
    q = urllib.parse.urlencode({"q": query + " when:7d", "hl": "en-US", "gl": "US", "ceid": "US:en"})
    url = "https://news.google.com/rss/search?" + q
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml"})
    with urllib.request.urlopen(req, timeout=25) as response:
        content = response.read(2_000_000)
    root = ET.fromstring(content)
    items = []
    for item in root.findall("./channel/item"):
        title = clean(item.findtext("title"))
        link = clean(item.findtext("link"))
        pub = clean(item.findtext("pubDate"))
        source = clean(item.findtext("source"))
        if not title or not link.startswith("https://") or any(x in title.lower() for x in BAD_WORDS):
            continue
        try:
            published = email.utils.parsedate_to_datetime(pub).astimezone(dt.timezone.utc)
        except (TypeError, ValueError, OverflowError):
            continue
        age = (NOW - published).total_seconds()
        if age < -3600 or age > MAX_AGE_DAYS * 86400:
            continue
        items.append({"title": title, "url": link, "source": source or "News report",
                      "published_at": published.isoformat().replace("+00:00", "Z"),
                      "status": "reported_not_independently_verified"})
    return items

def main():
    existing = read_existing()
    out = dict(existing)
    out.setdefault("updated_at", None)
    success_count = 0
    errors = []
    for section, queries in QUERIES.items():
        collected = []
        for query in queries:
            try:
                collected.extend(rss_search(query))
                success_count += 1
            except Exception as exc:
                errors.append(f"{section}: {type(exc).__name__}: {exc}")
        if collected:
            seen = set()
            unique = []
            for item in sorted(collected, key=lambda x: x["published_at"], reverse=True):
                # Remove exact and near-duplicate headlines.
                key = re.sub(r"[^a-z0-9]+", "", item["title"].lower().split(" - ")[0])
                if key in seen:
                    continue
                seen.add(key)
                unique.append(item)
                if len(unique) >= MAX_ITEMS[section]:
                    break
            out[section] = unique
        else:
            out.setdefault(section, [])
    out["pipeline"] = {
        "last_attempt_at": NOW.isoformat().replace("+00:00", "Z"),
        "successful_queries": success_count,
        "total_queries": sum(map(len, QUERIES.values())),
        "kind": "automated_news_headlines_not_verified_facts",
        "status": "ok" if success_count else "degraded_upstream_news_unavailable",
        "errors": errors[:8],
    }
    if success_count:
        out["updated_at"] = NOW.isoformat().replace("+00:00", "Z")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Fetched {success_count} queries; updates={len(out.get('updates', []))}; security={len(out.get('security', []))}")
    for err in errors:
        print(err, file=sys.stderr)
    # News is optional to the polling/model/results pipeline. A temporary
    # upstream RSS 503 must NOT block publication of freshly validated odds.
    # Preserve the prior news timestamp so the UI can disclose stale data.
    # A cold start with no cached headlines is still rejected by the
    # published-dashboard smoke test; it is never called fresh.
    if not success_count:
        print("DEGRADED NEWS SOURCE: no queries succeeded; cached headlines retained; "
              "news updated_at unchanged; polling/model pipeline may proceed.",
              file=sys.stderr)

if __name__ == "__main__":
    main()
