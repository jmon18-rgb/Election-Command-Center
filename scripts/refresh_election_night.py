#!/usr/bin/env python3
"""Validate and cache the public Open America election feed on GitHub Pages.

The elections endpoint does not currently provide CORS for third-party browser
fetches. GitHub Actions requests it server-side and publishes same-origin JSON.
This project reports state-derived unofficial votes, NEVER its own race calls.
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data"
BASE = "https://openamerica.io/elections/results.json"
OFFICES = ("House", "Senate", "Governor")
KEYS = {
    "House": re.compile(r"^[A-Z]{2}-\\d{2}$"),
    "Senate": re.compile(r"^[A-Z]{2}(?:-special)?$"),
    "Governor": re.compile(r"^[A-Z]{2}$"),
}
NOW = lambda: dt.datetime.now(dt.timezone.utc)

def path_for(year, office):
    return OUT / f"election_results_{year}_{office.lower()}.json"

def changes_path():
    return OUT / "election_night_changes.json"

def url_for(year, office):
    return f"{BASE}?year={year}&office={office}"

def validate(doc, year, office, now=None):
    if not isinstance(doc, dict) or doc.get("api") != 1 or doc.get("year") != year or doc.get("office") != office:
        raise ValueError("Unexpected election results provider version/year/office")
    if doc.get("source") not in ("state", ""):
        raise ValueError("Unrecognized state-results origin")
    for k in ("live", "stale", "counting", "final"):
        if type(doc.get(k)) is not bool:
            raise ValueError("Invalid results freshness flag: " + k)
    if doc["live"] and (doc["stale"] or not doc["counting"] or doc["final"]):
        raise ValueError("Contradictory live/stale/final provider flags")
    if not isinstance(doc.get("races"), dict) or len(doc["races"]) > 550:
        raise ValueError("Invalid race collection")
    counts = doc.get("counts")
    if not isinstance(counts, dict) or type(counts.get("races")) is not int:
        raise ValueError("Missing provider race count")
    if counts["races"] != len(doc["races"]):
        raise ValueError("Provider race count mismatch")
    if doc.get("as_of"):
        value = dt.datetime.fromisoformat(doc["as_of"].replace("Z", "+00:00"))
        if value.tzinfo is None:
            raise ValueError("Unzoned provider timestamp")
        if value > (now or NOW()) + dt.timedelta(minutes=15):
            raise ValueError("Source update timestamp is in the future")
    if year == 2026 and (now or NOW()).date() < dt.date(2026, 11, 3) and any(r.get("total", 0) for r in doc["races"].values()):
        raise ValueError("2026 pre-election count data cannot be published")
    for key, race in doc["races"].items():
        if not KEYS[office].fullmatch(key):
            raise ValueError("Wrong office key: " + str(key))
        if not isinstance(race, dict) or type(race.get("total")) is not int or race["total"] < 0:
            raise ValueError("Invalid vote total for " + key)
        if race.get("called") is not False or race.get("winner", ""):
            raise ValueError("This display does not import external calls: " + key)
        precincts = race.get("pct_in")
        if precincts is not None and (type(precincts) not in (int, float) or not 0 <= precincts <= 100):
            raise ValueError("Invalid precinct percentage")
        candidates = race.get("cands")
        if not isinstance(candidates, list) or len(candidates) > 60:
            raise ValueError("Invalid candidate list: " + key)
        votes = 0
        for c in candidates:
            if not isinstance(c, dict) or not isinstance(c.get("n"), str) or not c["n"].strip():
                raise ValueError("Invalid candidate identity: " + key)
            if type(c.get("v")) is not int or c["v"] < 0:
                raise ValueError("Invalid candidate vote count: " + key)
            if not isinstance(c.get("p"), str) or len(c["p"]) > 4:
                raise ValueError("Invalid candidate party: " + key)
            votes += c["v"]
        if votes > race["total"]:
            raise ValueError("Candidate votes exceed total: " + key)
        if race["total"] and not candidates:
            raise ValueError("Vote count has no named candidates: " + key)
    if not doc["races"] and doc["counting"]:
        raise ValueError("Cannot be counting with zero races")
    return True

def fetch(year, office):
    url = url_for(year, office)
    req = urllib.request.Request(url, headers={
        "User-Agent": "ElectionCommandCenter/1.0 (public research dashboard)",
        "Accept": "application/json",
        "Accept-Encoding": "identity",
    })
    with urllib.request.urlopen(req, timeout=35) as response:
        if response.status != 200:
            raise ValueError("Provider returned unexpected HTTP status")
        raw = response.read(5_000_000)
        if len(raw) == 5_000_000:
            raise ValueError("Provider response exceeds size limit")
    return json.loads(raw.decode("utf-8"))

def read_existing(path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))

def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def collect_changes(previous, current, at, office):
    """Vote movements are observations, not certified returns or fraud flags."""
    if not previous or previous.get("year") != 2026:
        return []
    out = []
    for race_key, race in current["races"].items():
        before = (previous.get("races") or {}).get(race_key)
        total = race["total"]
        old = before.get("total", 0) if isinstance(before, dict) else 0
        if total == old:
            continue
        direction = "revision" if total < old else "new_reporting"
        out.append({
            "at": at,
            "office": office,
            "race_key": race_key,
            "previous_total": old,
            "current_total": total,
            "vote_change": total - old,
            "kind": direction,
            "provider_source_updated_at": current.get("as_of"),
        })
    return sorted(out, key=lambda x: abs(x["vote_change"]), reverse=True)[:40]

def refresh(year, office, now=None, fetcher=fetch):
    now = now or NOW()
    data = fetcher(year, office)
    validate(data, year, office, now)
    old = read_existing(path_for(year, office))
    doc = {**data, "schema_version": "election-night-cache-v1",
           "provider_url": url_for(year, office), "fetched_at": now.isoformat()}
    if year == 2026:
        existing = read_existing(changes_path()) or {"schema_version": "election-night-changes-v1", "events": []}
        fresh = collect_changes(old, doc, now.isoformat(), office)
        # Keep correction history in observed order, de-duplicate across runs.
        seen = set()
        events = []
        for entry in fresh + existing.get("events", []):
            ident = (entry.get("office"), entry.get("race_key"), entry.get("previous_total"), entry.get("current_total"))
            if ident not in seen:
                seen.add(ident)
                events.append(entry)
        write_json(changes_path(), {"schema_version": "election-night-changes-v1",
                                    "updated_at": now.isoformat(), "events": events[:120]})
    write_json(path_for(year, office), doc)
    print(year, office, len(doc["races"]), "races", "source", doc.get("as_of"),
          "provider-live", doc["live"], "cached", now.isoformat())
    return doc

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-only", action="store_true")
    parser.add_argument("--live-only", action="store_true")
    args = parser.parse_args()
    now = NOW()
    if args.archive_only and args.live_only:
        parser.error("Choose one mode")
    if not args.live_only:
        for office in OFFICES:
            dest = path_for(2024, office)
            if not dest.exists():
                refresh(2024, office, now)
    if not args.archive_only and dt.date(2026, 11, 3) <= now.date() <= dt.date(2026, 11, 11):
        for office in OFFICES:
            refresh(2026, office, now)
    elif not args.archive_only:
        print("Not inside 2026 election-night collection window; no 2026 votes fetched.")

if __name__ == "__main__":
    main()
