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
from datetime import datetime, timezone, timedelta
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
GAP_AWARE_LIMIT = 16  # Ceiling for manual and synthetic runs; provider cap enforced.
HOURLY_DISCOVERY_LIMIT = 8  # Hourly low-pressure mode to clear untested sources.
COVERAGE_PATH = Path(__file__).resolve().parents[1] / "data" / "election_night_source_coverage.json"
# Editorial urgency for source discovery, not a race-rating or odds adjustment.
GAP_PRIORITY = (
    "NH-01", "NH-02", "ME-01", "ME-02", "NE-02", "NV-03",
    "NV-04", "NY-04", "NY-17", "NY-19", "NY-22", "WI-03",
    "WI-01", "WI-07", "NJ-07", "OR-05", "CA-13", "CA-22",
    "CA-41", "CA-45", "CA-47", "CA-49", "OH-01", "OH-09",
    "OH-13", "AK-00", "ND-00", "SD-00", "WY-00",
)
PROBE_STATUSES = frozenset((
    "INDEXED_EXACT_RACE", "NOT_INDEXED", "AMBIGUOUS_RACE",
    "AMBIGUOUS_OR_TRUNCATED", "INVALID_DETAIL", "SOURCE_UNAVAILABLE_OR_INVALID",
    "TEMPORARY_UPSTREAM_FAILURE", "NOT_CHECKED_UPSTREAM_PAUSED",
))
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


def _utc(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError("Coverage history timestamp missing")
    try:
        checked = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("Malformed coverage history timestamp") from error
    if checked.tzinfo is None:
        raise ValueError("Coverage history requires UTC-aware timestamps")
    return checked.astimezone(timezone.utc)


def gap_aware_window(now: datetime, history: dict, *,
                     inventory: tuple[str, ...] | None = None,
                     limit: int = GAP_AWARE_LIMIT,
                     window_hours: int = 4) -> dict:
    """Spend at most 16 requests on unobserved gaps, then oldest due rechecks.

    Production uses eight per hour to limit load while accelerating the backlog.

    No fixed anchor tax. Every previously indexed race is eligible again after
    72h; NOT_INDEXED after 24h; transient/invalid after 4h. Source outages are
    handled by run_batch, not treated as proof of an absent race.
    """
    if now.tzinfo is None or not 1 <= limit <= GAP_AWARE_LIMIT or \
       window_hours not in (1, 4):
        raise ValueError("Invalid time or source request cap")
    now = now.astimezone(timezone.utc)
    seats = inventory if inventory is not None else uncovered_house_universe()
    if len(seats) != 219 or len(set(seats)) != 219 or not set(DISTRICTS).issubset(seats):
        raise ValueError("Expected 219 uncovered 2026 House districts")
    if not set(GAP_PRIORITY).issubset(seats) or len(set(GAP_PRIORITY)) != len(GAP_PRIORITY):
        raise ValueError("Editorial discovery priority contains an invalid seat")
    if not isinstance(history, dict) or history.get("schema_version") != "1.0" or \
       history.get("status") != "SOURCE_IDENTITY_AUDIT_NOT_LIVE_RESULTS_COVERAGE" or \
       history.get("election") != DAY:
        raise ValueError("Missing trusted 506-race source ledger")
    generated = _utc(history.get("generated_at"))
    if generated > now + timedelta(minutes=15):
        raise ValueError("Future-dated House coverage history")
    rows = history.get("races")
    if not isinstance(rows, list) or len(rows) != 506:
        raise ValueError("Incomplete 506-race source history")
    ids = [r.get("id") if isinstance(r, dict) else None for r in rows]
    if len(set(ids)) != 506:
        raise ValueError("Duplicate source identities")
    by_id = {r["id"]: r for r in rows}
    if set("House|" + code for code in seats) - by_id.keys():
        raise ValueError("Source history omits uncovered House identities")
    priority = {code: index for index, code in enumerate(GAP_PRIORITY)}
    candidates, fresh = [], 0
    unobserved, due = 0, 0
    for code in seats:
        row = by_id["House|" + code]
        if row.get("office") != "House" or row.get("key") != code or \
           row.get("state") != code[:2] or row.get("provider_scope") != "outside primary":
            raise ValueError("Source history House identity changed")
        last = row.get("last_probe")
        # A paused/unattempted check contains no observation of civicAPI.
        if not last or last.get("status") == "NOT_CHECKED_UPSTREAM_PAUSED":
            candidates.append((0, datetime.min.replace(tzinfo=timezone.utc),
                               priority.get(code, 1000), code))
            unobserved += 1
            continue
        if not isinstance(last, dict) or last.get("status") not in PROBE_STATUSES:
            raise ValueError("Malformed previous provider probe")
        last_at = _utc(last.get("checked_window_utc"))
        if last_at > now + timedelta(minutes=15):
            raise ValueError("Future provider probe in trusted history")
        age = {"INDEXED_EXACT_RACE": timedelta(hours=72),
               "NOT_INDEXED": timedelta(hours=24)}.get(
                   last["status"], timedelta(hours=4))
        eligible_at = last_at + age
        if eligible_at > now:
            fresh += 1
            continue
        candidates.append((1, eligible_at, priority.get(code, 1000), code))
        due += 1
    candidates.sort()
    chosen = tuple(record[3] for record in candidates[:limit])
    checked = sum(by_id["House|" + code].get("last_probe") is not None and
                  by_id["House|" + code]["last_probe"].get("status") !=
                  "NOT_CHECKED_UPSTREAM_PAUSED" for code in chosen)
    return {
        "window_utc": datetime.fromtimestamp(
            int(now.timestamp() // (window_hours * 3600)) * window_hours * 3600,
            tz=timezone.utc).isoformat(),
        "discovery_strategy": "GAP_FIRST_PREVIOUS_LEDGER",
        "primary_states": len(PRIMARY_STATES),
        "uncovered_house_districts": len(seats),
        "anchor_count": 0,
        "rotating_count": len(chosen),
        "windows_per_rotation": (len(seats) + limit - 1) // limit,
        "never_checked_eligible": unobserved,
        "recheck_eligible": due,
        "fresh_deferred": fresh,
        "scheduled_rechecks": checked,
        "request_cap": limit,
        "districts": chosen,
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
            r"\bUS House\b" if number == "00"
            else r"\bUS House\s+" + str(int(number)) + r"\b",
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


def probe(district: str, request=fetch, *, indexed_candidate: dict | None = None) -> dict:
    state, number = district.split("-")
    # 'US House 0' does not name the at-large ballot. Exact state/district,
    # election date, stage and source-detail checks still gate every match.
    search_query = "US House" if number == "00" else f"US House {int(number)}"
    try:
        if indexed_candidate is None:
            result = request("/race/search", {
                "country": "US", "province": state,
                "startDate": DAY, "endDate": DAY,
                "query": search_query, "limit": "20",
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
        else:
            # Batch search is merely a lookup optimization. Every accepted
            # identity is independently checked against its detailed record.
            if not matches(district, indexed_candidate):
                return {"district": district, "status": "INVALID_DETAIL"}
            race = indexed_candidate
        detail = request(f"/race/{race['id']}", {"light": ""})
        if not detail_matches(race, detail):
            return {"district": district, "status": "INVALID_DETAIL"}
        return {
            "district": district, "status": "INDEXED_EXACT_RACE",
            "race_id": race["id"],
            "candidate_count": len(detail["candidates"]),
            "reported_votes": sum(c["votes"] for c in detail["candidates"]),
        }
    except urllib.error.HTTPError as error:
        # A shared 429/502/503/504 means this provider should not receive
        # another 15 requests in the same scheduled discovery run.
        if error.code in (429, 502, 503, 504):
            return {"district": district, "status": "TEMPORARY_UPSTREAM_FAILURE",
                    "reason": f"HTTP_{error.code}"}
        return {"district": district, "status": "SOURCE_UNAVAILABLE_OR_INVALID",
                "reason": f"HTTP_{error.code}"}
    except (urllib.error.URLError, TimeoutError) as error:
        return {"district": district, "status": "TEMPORARY_UPSTREAM_FAILURE",
                "reason": type(error).__name__}
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        return {"district": district, "status": "SOURCE_UNAVAILABLE_OR_INVALID",
                "reason": type(error).__name__}


def run_batch(plan: dict, request=fetch, *, delay: float = 0.2,
              stats: dict | None = None) -> list[dict]:
    """Verify exact details; amortize safe, complete state-level source searches.

    Only attempt one broad query for >=3 queued seats in the same state.
    If the broad result count is unknown, truncated, ambiguous or unsupported,
    revert to the existing exact-district query. A 429/5xx stops all further
    provider calls. Never synthesize source IDs from district numbering.
    """
    if delay < 0:
        raise ValueError("Delay must be nonnegative")
    seats = tuple(plan["districts"])
    if len(seats) > GAP_AWARE_LIMIT or len(seats) != len(set(seats)):
        raise ValueError("Unbounded or duplicate House source worklist")
    grouped = {}
    for district in seats:
        grouped.setdefault(district[:2], []).append(district)
    counters = {"state_searches": 0, "exact_district_searches": 0,
                "detail_requests": 0, "state_batch_identity_hits": 0,
                "state_batch_rejected_or_incomplete": 0}
    def counted(path, params):
        if path == "/race/search":
            if params.get("query") == "US House" and len(grouped.get(params.get("province"), [])) >= 3:
                counters["state_searches"] += 1
            else:
                counters["exact_district_searches"] += 1
        elif path.startswith("/race/"):
            counters["detail_requests"] += 1
        return request(path, params)

    batch_cache = {}
    attempted_states = set()
    results = []
    paused = False
    for index, district in enumerate(seats):
        if paused:
            results.append({"district": district,
                            "status": "NOT_CHECKED_UPSTREAM_PAUSED"})
            continue
        state = district[:2]
        if state not in attempted_states:
            attempted_states.add(state)
            if len(grouped[state]) >= 3:
                try:
                    broad = counted("/race/search", {
                        "country": "US", "province": state,
                        "startDate": DAY, "endDate": DAY,
                        "query": "US House", "limit": "100",
                    })
                    rows = broad.get("races") if isinstance(broad, dict) else None
                    total = broad.get("count") if isinstance(broad, dict) else None
                    # No acceptance of partial/unknown cardinality result sets:
                    # missing duplicate rows could make a search appear unique.
                    if (isinstance(rows, list) and type(total) is int
                            and 0 < len(rows) <= 100 and total == len(rows)):
                        for key in grouped[state]:
                            exact = [row for row in rows if matches(key, row)]
                            if len(exact) == 1:
                                batch_cache[key] = exact[0]
                    else:
                        counters["state_batch_rejected_or_incomplete"] += 1
                except urllib.error.HTTPError as error:
                    if error.code in (429, 502, 503, 504):
                        results.append({"district": district,
                                        "status": "TEMPORARY_UPSTREAM_FAILURE",
                                        "reason": f"HTTP_{error.code}"})
                        paused = True
                        continue
                    counters["state_batch_rejected_or_incomplete"] += 1
                except (urllib.error.URLError, TimeoutError) as error:
                    results.append({"district": district,
                                    "status": "TEMPORARY_UPSTREAM_FAILURE",
                                    "reason": type(error).__name__})
                    paused = True
                    continue
                except (KeyError, ValueError, TypeError, json.JSONDecodeError):
                    counters["state_batch_rejected_or_incomplete"] += 1
        candidate = batch_cache.get(district)
        if candidate is not None:
            counters["state_batch_identity_hits"] += 1
        row = probe(district, counted, indexed_candidate=candidate)
        results.append(row)
        paused = row["status"] == "TEMPORARY_UPSTREAM_FAILURE"
        if not paused and delay and index + 1 < len(seats):
            time.sleep(delay)
    if stats is not None:
        stats.update(counters)
        stats["total_http_requests"] = (counters["state_searches"] +
                                         counters["exact_district_searches"] +
                                         counters["detail_requests"])
    return results

def build_report(plan: dict, results: list[dict], *,
                 request_stats: dict | None = None) -> dict:
    if len(results) != len(plan["districts"]) or [r.get("district") for r in results] != list(plan["districts"]):
        raise ValueError("Coverage report missing or reordering sampled seats")
    statuses = sorted({x["status"] for x in results})
    skipped = sum(x["status"] == "NOT_CHECKED_UPSTREAM_PAUSED" for x in results)
    attempted = len(results) - skipped
    return {
        "status": "ROTATING_HOUSE_SOURCE_DISCOVERY_NOT_NATIONAL_AVAILABILITY",
        "window_utc": plan["window_utc"],
        "discovery_strategy": plan.get("discovery_strategy", "FIXED_ANCHORS_ROTATION"),
        "request_cap": plan.get("request_cap", len(results)),
        "never_checked_eligible": plan.get("never_checked_eligible"),
        "recheck_eligible": plan.get("recheck_eligible"),
        "fresh_deferred": plan.get("fresh_deferred"),
        "scheduled_rechecks": plan.get("scheduled_rechecks"),
        "primary_states": plan["primary_states"],
        "uncovered_house_districts": plan["uncovered_house_districts"],
        "anchor_count": plan["anchor_count"],
        "rotating_count": plan["rotating_count"],
        "windows_per_rotation_if_every_run_succeeds": plan["windows_per_rotation"],
        "planned_districts": len(results),
        "sampled_districts": attempted,
        "not_checked_upstream_paused": skipped,
        "upstream_paused": skipped > 0 or any(x["status"] == "TEMPORARY_UPSTREAM_FAILURE" for x in results),
        "indexed_exact": sum(x["status"] == "INDEXED_EXACT_RACE" for x in results),
        "request_stats": dict(request_stats) if request_stats is not None else None,
        "status_counts": {st: sum(x["status"] == st for x in results) for st in statuses},
        "results": results,
    }


def main():
    # Follow the ledger rather than paying six repeated anchor searches every
    # four hours. Fail closed if the 506-race inventory is corrupted or absent.
    history = json.loads(COVERAGE_PATH.read_text(encoding="utf-8"))
    plan = gap_aware_window(datetime.now(timezone.utc), history,
                            limit=HOURLY_DISCOVERY_LIMIT, window_hours=1)
    stats = {}
    results = run_batch(plan, stats=stats)
    report = build_report(plan, results, request_stats=stats)
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
                    f"{plan['discovery_strategy']} · capped at "
                    f"{plan['request_cap']} provider races among "
                    f"{plan['uncovered_house_districts']} uncovered slots.\n\n")
            f.write(f"Never-observed eligible: {plan['never_checked_eligible']}; "
                    f"due rechecks: {plan['recheck_eligible']}; "
                    f"not yet due: {plan['fresh_deferred']}.\n\n")
            f.write(f"Provider HTTP requests: {stats['total_http_requests']}; "
                    f"complete state searches: {stats['state_searches']}; "
                    f"district search requests saved: {stats['state_batch_identity_hits']}; "
                    f"incomplete state searches: {stats['state_batch_rejected_or_incomplete']}.\\n\\n")
            f.write(f"Attempted {report['sampled_districts']}/{report['planned_districts']}; "
                    f"upstream paused: {report['upstream_paused']}; "
                    f"skipped: {report['not_checked_upstream_paused']}. "
                    "Never classify skipped races as unindexed.\n\n")
            f.write("| District | Result | Exact race ID |\n|---|---|---|\n")
            for item in results:
                f.write(f"| {item['district']} | {item['status']} | {item.get('race_id', '—')} |\n")
            f.write("\nA missing listing or provider outage is **unknown**, not zero votes, "
                    "not an inferred winner, and not proof of national reach. "
                    "Rotating coverage assumes scheduled runs complete.\n")
    # Persist the artifact and step summary first, then flag an interrupted
    # discovery as unhealthy. The workflow uses continue-on-error only so
    # diagnostic artifacts are uploaded before its final fail-closed gate.
    if report["upstream_paused"]:
        raise SystemExit("House source gap audit interrupted by upstream failure; "
                         "untested districts remain unknown (see saved JSON)")


if __name__ == "__main__":
    main()
