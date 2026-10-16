#!/usr/bin/env python3
"""CORS/identity-only source discovery for 2026 House races outside the 22-state primary.
No vote relay, scraping of official sites, guessed missing data, or live odds.
An unindexed race remains unknown. See GitHub Actions source-preflight summary.
"""
from __future__ import annotations
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://civicapi.org/api/v2"
ORIGIN = "https://jmon18-rgb.github.io"
DAY = "2026-11-03"
# Six high-value outside-primary House districts; not a census of all 435.
DISTRICTS = ("NH-01", "ME-02", "NV-03", "NE-02", "NY-17", "WI-03")


def matches(district: str, row: dict) -> bool:
    if not isinstance(row, dict) or not re.fullmatch(r"[A-Z]{2}-\d{2}", district):
        return False
    state, number = district.split("-")
    day = row.get("election_date")
    return (
        row.get("country") == "US"
        and row.get("province") == state
        and row.get("municipality") is None
        and row.get("district") == district
        and row.get("type") == "House of Representatives"
        and row.get("election_type") == "General"
        and isinstance(day, str)
        and bool(re.fullmatch(r"2026-11-03(?:T[0-9:.+-]+Z?)?", day))
        and type(row.get("id")) is int
        and row["id"] > 0
        and bool(re.search(r"\bUS House\s+" + str(int(number)) + r"\b",
                           str(row.get("election_name") or ""), flags=re.I))
        and not re.search(r"primary|runoff", str(row.get("election_name") or ""), re.I)
    )


def detail_matches(row: dict, detail: dict) -> bool:
    if not isinstance(detail, dict) or detail.get("id", row["id"]) != row["id"]:
        return False
    for k in ("country", "province", "district", "election_date", "election_name"):
        if detail.get(k) != row.get(k):
            return False
    if detail.get("election_type") != row["type"]:
        return False
    candidates = detail.get("candidates")
    if not isinstance(candidates, list) or not 1 <= len(candidates) <= 60:
        return False
    return all(isinstance(c, dict) and isinstance(c.get("name"), str)
               and c["name"].strip() and
               isinstance(c.get("party"), str) and c["party"].strip()
               and type(c.get("votes")) is int and c["votes"] >= 0
               and type(c.get("winner")) is bool for c in candidates)


def fetch(path: str, params: dict | None = None) -> dict:
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={
        "Origin": ORIGIN,
        "Accept": "application/json",
        "User-Agent": "BlueWavesElectionNightHouseProbe/1.0",
    })
    with urllib.request.urlopen(request, timeout=16) as response:
        if response.status != 200 or response.headers.get(
                "Access-Control-Allow-Origin") not in ("*", ORIGIN):
            raise ValueError("No verified direct-browser CORS contract")
        if "json" not in response.headers.get("Content-Type", "").lower():
            raise ValueError("Non-JSON civicAPI response")
        raw = response.read(350001)
        if len(raw) > 350000:
            raise ValueError("Unbounded provider body")
    return json.loads(raw)


def probe(district: str, request=fetch) -> dict:
    state, number = district.split("-")
    try:
        result = request("/race/search", {
            "country": "US", "province": state,
            "startDate": DAY, "endDate": DAY,
            "query": f"US House {int(number)}", "limit": "20",
        })
        rows = result.get("races")
        if not isinstance(rows, list) or len(rows) > 20 or result.get("count", 0) > 20:
            return {"district": district, "status": "AMBIGUOUS_OR_TRUNCATED"}
        found = [r for r in rows if matches(district, r)]
        if not found:
            return {"district": district, "status": "NOT_INDEXED"}
        if len(found) != 1:
            return {"district": district, "status": "AMBIGUOUS_RACE"}
        race = found[0]
        detail = request(f"/race/{race['id']}", {"light": ""})
        if not detail_matches(race, detail):
            return {"district": district, "status": "INVALID_DETAIL"}
        return {
            "district": district, "status": "INDEXED_EXACT_RACE",
            "race_id": race["id"],
            "candidate_count": len(detail["candidates"]),
            "reported_votes": sum(c["votes"] for c in detail["candidates"]),
        }
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, TypeError,
            json.JSONDecodeError) as error:
        return {"district": district, "status": "SOURCE_UNAVAILABLE_OR_INVALID",
                "reason": type(error).__name__}


def main():
    results = []
    for index, district in enumerate(DISTRICTS):
        results.append(probe(district))
        if index + 1 < len(DISTRICTS):
            time.sleep(0.25)
    print(json.dumps({
        "status": "DISCOVERY_PROBE_NOT_NATIONAL_AVAILABILITY",
        "indexed_exact": sum(x["status"] == "INDEXED_EXACT_RACE" for x in results),
        "sampled_districts": len(DISTRICTS),
        "results": results,
    }, indent=2))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write("\n### Sampled supplemental 2026 House discovery (not national coverage)\n\n")
            f.write("| District | Result | Exact race ID |\n|---|---|---|\n")
            for item in results:
                f.write(f"| {item['district']} | {item['status']} | {item.get('race_id', '—')} |\n")
            f.write("\nA missing listing or provider outage is **unknown**, not zero votes, "
                    "not an inferred winner, and not proof of national reach.\n")


if __name__ == "__main__":
    main()
