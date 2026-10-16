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
from datetime import datetime, timezone
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://civicapi.org/api/v2"
ORIGIN = "https://jmon18-rgb.github.io"
DAY = "2026-11-03"
# Six high-value outside-primary House districts; not a census of all 435.
DISTRICTS = ("NH-01", "ME-02", "NV-03", "NE-02", "NY-17", "WI-03")
# Open America's 22 documented 2026 source states. All other House
# districts are deliberately supplemental, never primary-fallback by guess.
PRIMARY_STATES = frozenset(
    "AR AZ CO CT FL GA IA ID IN LA MI MN NC PA RI SC TX UT VA VT WA WV".split()
)
ROTATING_PER_RUN = 10
INVENTORY_PATH = Path(__file__).resolve().parents[1] / "data" / "seat_universe.json"


def uncovered_house_universe(path: Path = INVENTORY_PATH) -> tuple[str, ...]:
    """2026 apportionment slots, not a claim of redistricted boundaries/results."""
    record = json.loads(path.read_text(encoding="utf-8"))
    house = record.get("house", {})
    counts = house.get("by_state", {})
    if (len(counts) != 50 or len(PRIMARY_STATES) != 22 or
            house.get("total_voting_seats") != 435 or
            any(not re.fullmatch(r"[A-Z]{2}", st) or
                type(count) is not int or not 1 <= count <= 60
                for st, count in counts.items()) or
            sum(counts.values()) != 435 or not PRIMARY_STATES.issubset(counts)):
        raise ValueError("435-seat 2026 House provider inventory mismatch")
    seats = []
    for state, count in sorted(counts.items()):
        if state in PRIMARY_STATES:
            continue
        seats.extend(
            f"{state}-{('00' if count == 1 else str(i).zfill(2))}"
            for i in range(1, count + 1)
        )
    if len(seats) != len(set(seats)) or not set(DISTRICTS).issubset(seats):
        raise ValueError("Supplemental inventory duplicated or missing anchor seats")
    return tuple(seats)


def sampling_window(now: datetime | None = None, *,
                    inventory: tuple[str, ...] | None = None,
                    rotation: int = ROTATING_PER_RUN) -> dict:
    """Rotate 10 unanchored districts each 4-hour slot; 6 anchors remain stable.

    Consecutive completed slots cover every unanchored district once per
    ceil(N / rotation) windows; skipped/delayed CI runs cannot be assumed.
    """
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        raise ValueError("Sampling window requires timezone-aware UTC date")
    seats = inventory if inventory is not None else uncovered_house_universe()
    if (not 1 <= rotation <= 20 or not seats or
            len(set(seats)) != len(seats) or not set(DISTRICTS).issubset(seats)):
        raise ValueError("Invalid anchored rotating inventory")
    extras = tuple(x for x in seats if x not in DISTRICTS)
    slot = int(current.timestamp() // (4 * 3600))
    picks = tuple(extras[(slot * rotation + i) % len(extras)]
                  for i in range(min(rotation, len(extras)))) if extras else ()
    return {
        "window_utc": datetime.fromtimestamp(slot * 4 * 3600,
                                             tz=timezone.utc).isoformat(),
        "primary_states": len(PRIMARY_STATES),
        "uncovered_house_districts": len(seats),
        "anchor_count": len(DISTRICTS),
        "rotating_count": len(picks),
        "windows_per_rotation": (len(extras) + rotation - 1) // rotation,
        "districts": DISTRICTS + picks,
    }


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
        and bool(re.search(
            r"\\bUS House\\b" if number == "00"
            else r"\\bUS House\\s+" + str(int(number)) + r"\\b",
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
    with urllib.request.urlopen(request, timeout=10) as response:
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
    plan = sampling_window()
    results = []
    for index, district in enumerate(plan["districts"]):
        results.append(probe(district))
        if index + 1 < len(plan["districts"]):
            time.sleep(0.2)
    statuses = sorted(set(x["status"] for x in results))
    report = {
        "status": "ROTATING_HOUSE_SOURCE_DISCOVERY_NOT_NATIONAL_AVAILABILITY",
        "window_utc": plan["window_utc"],
        "primary_states": plan["primary_states"],
        "uncovered_house_districts": plan["uncovered_house_districts"],
        "anchor_count": plan["anchor_count"],
        "rotating_count": plan["rotating_count"],
        "windows_per_rotation_if_every_run_succeeds": plan["windows_per_rotation"],
        "sampled_districts": len(results),
        "indexed_exact": sum(x["status"] == "INDEXED_EXACT_RACE" for x in results),
        "status_counts": {st: sum(x["status"] == st for x in results) for st in statuses},
        "results": results,
    }
    print(json.dumps(report, indent=2))
    out = os.environ.get("ELECTION_HOUSE_PROBE_OUTPUT")
    if out:
        Path(out).write_text(json.dumps(report, indent=2) + "\n",
                             encoding="utf-8")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write("\n### Rotating supplemental 2026 House discovery (not full coverage)\n\n")
            f.write(f"Sampling window: {plan['window_utc']} · "
                    f"{plan['anchor_count']} anchor and "
                    f"{plan['rotating_count']} rotating of "
                    f"{plan['uncovered_house_districts']} uncovered slots.\n\n")
            f.write("| District | Result | Exact race ID |\n|---|---|---|\n")
            for item in results:
                f.write(f"| {item['district']} | {item['status']} | {item.get('race_id', '—')} |\n")
            f.write("\nA missing listing or provider outage is **unknown**, not zero votes, "
                    "not an inferred winner, and not proof of national reach. "
                    "Rotating coverage assumes scheduled runs complete.\n")


if __name__ == "__main__":
    main()
