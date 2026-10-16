#!/usr/bin/env python3
"""Persistent source-identity coverage ledger for the 2026 state election desk.

NEVER a live-results feed, race call, availability guarantee, or poll forecast.
Only bounded probe evidence may validate an exact supplemental House identity.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone, timedelta
import json
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PRIMARY_STATES = frozenset(
    "AR AZ CO CT FL GA IA ID IN LA MI MN NC PA RI SC TX UT VA VT WA WV".split()
)
BATCH_RE = re.compile(
    r"'(Senate|Governor)\|([A-Z]{2}(?:-special)?)':"
    r"\{state:'([A-Z]{2})',name:'([^']+)',office:'(Senate|Governor)',id:(\d+)\}"
)
GOV_RE = re.compile(r"const GOVERNOR_STATES=Object\.freeze\((\[[^\n]+\])\)")
PROBE_STATUSES = frozenset((
    "INDEXED_EXACT_RACE", "NOT_INDEXED", "AMBIGUOUS_RACE",
    "AMBIGUOUS_OR_TRUNCATED", "INVALID_DETAIL", "SOURCE_UNAVAILABLE_OR_INVALID",
    "TEMPORARY_UPSTREAM_FAILURE", "NOT_CHECKED_UPSTREAM_PAUSED",
))
OUT = ROOT / "data" / "election_night_source_coverage.json"


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError("Missing ISO timestamp")
    t = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if t.tzinfo is None:
        raise ValueError("Timestamp must be timezone aware")
    return t.astimezone(timezone.utc)


def inventory(source, governor_js):
    house = source["house"]["by_state"]
    assert len(house) == 50 and sum(house.values()) == 435
    assert len(PRIMARY_STATES) == 22 and PRIMARY_STATES.issubset(house)
    found = GOV_RE.search(governor_js)
    if not found:
        raise ValueError("Canonical governor roster was not found")
    governors = json.loads(found.group(1))
    if len(governors) != 36 or len(set(governors)) != 36:
        raise ValueError("Invalid 36-state governor roster")
    senate = source["senate"]["contested_seats"]
    if len(senate) != 35:
        raise ValueError("Expected 35 Senate contests")
    seats = []
    for state, count in sorted(house.items()):
        if not re.fullmatch("[A-Z]{2}", state) or type(count) is not int or not 1 <= count <= 60:
            raise ValueError("Bad House universe")
        for n in range(1, count + 1):
            seats.append(("House", state + "-" + ("00" if count == 1 else f"{n:02d}")))
    for s in senate:
        state, kind = s["state"], s["election_kind"]
        key = state + ("-special" if kind == "special" else "")
        if s["race_code"] != state + "-SEN":
            raise ValueError("Senate model seat identity changed")
        seats.append(("Senate", key))
    for state in governors:
        seats.append(("Governor", state))
    ids = [office + "|" + key for office, key in seats]
    if len(ids) != 506 or len(set(ids)) != 506:
        raise ValueError("506 race identities must be unique")
    return seats


def pinned_sources(js, valid_ids):
    pinned = {}
    matches = list(BATCH_RE.finditer(js))
    if len(matches) < 30:
        raise ValueError("Statewide pinned source registry missing or truncated")
    for m in matches:
        office, key, state, name, office_again, number = m.groups()
        identity = office + "|" + key
        if (identity not in valid_ids or identity in pinned or office != office_again
                or key[:2] != state or int(number) <= 0):
            raise ValueError("Invalid or duplicated pinned source: " + identity)
        pinned[identity] = {"provider": "civicAPI", "race_id": int(number),
                            "registry": "scripts/civicapi_state_batch.js"}
    return pinned


def nh_support(senate_js, governor_js):
    if "item?.office==='Senate'&&item?.key==='NH'" not in senate_js:
        raise ValueError("NH Senate scoped adapter contract missing")
    if "item?.office==='Governor'&&item?.key==='NH'" not in governor_js:
        raise ValueError("NH governor scoped adapter contract missing")
    return frozenset(("Senate|NH", "Governor|NH"))


def observed_house(probe, valid_ids):
    if probe is None:
        return {}
    if probe.get("status") != "ROTATING_HOUSE_SOURCE_DISCOVERY_NOT_NATIONAL_AVAILABILITY":
        raise ValueError("Wrong probe schema")
    window = timestamp(probe["window_utc"]).isoformat()
    rows = probe.get("results")
    if not isinstance(rows, list) or len(rows) > 26:
        raise ValueError("Invalid bounded House probe length")
    if probe.get("planned_districts", len(rows)) != len(rows):
        raise ValueError("Incomplete probe: missing planned rows")
    result = {}
    for row in rows:
        key = row.get("district") if isinstance(row, dict) else None
        identity = "House|" + str(key)
        status = row.get("status") if isinstance(row, dict) else None
        if (identity not in valid_ids or key[:2] in PRIMARY_STATES or identity in result
                or status not in PROBE_STATUSES):
            raise ValueError("Untrusted House probe identity/status")
        race_id = row.get("race_id")
        if status == "INDEXED_EXACT_RACE":
            if type(race_id) is not int or race_id <= 0:
                raise ValueError("Exact source must have positive race id")
        elif race_id is not None:
            raise ValueError("Unverified race cannot carry an accepted race id")
        result[identity] = {
            "status": status, "checked_window_utc": window,
            "race_id": race_id if status == "INDEXED_EXACT_RACE" else None,
            "reason": row.get("reason") if status in (
                "SOURCE_UNAVAILABLE_OR_INVALID", "TEMPORARY_UPSTREAM_FAILURE"
            ) else None,
        }
    return result


def build(universe, reconciliation_js, batch_js, nh_senate_js, nh_governor_js,
          probe=None, previous=None, *, now=None, checks=None):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("Now must include timezone")
    now = now.astimezone(timezone.utc)
    seats = inventory(universe, reconciliation_js)
    ids = {office + "|" + key for office, key in seats}
    pins = pinned_sources(batch_js, ids)
    nh = nh_support(nh_senate_js, nh_governor_js)
    probes = observed_house(probe, ids)
    prior = {}
    if previous:
        if previous.get("schema_version") != "1.0":
            raise ValueError("Unsupported previous ledger")
        prior = {row["id"]: row for row in previous["races"]}
        if len(prior) != len(previous["races"]) or set(prior) != ids:
            raise ValueError("Existing ledger missing or duplicating race identities")
    checks = checks or {"primary": "not_checked", "secondary": "not_checked",
                        "house_probe": "not_checked"}
    if set(checks) != {"primary", "secondary", "house_probe"} or any(
            status not in ("success", "failure", "not_checked", "skipped")
            for status in checks.values()):
        raise ValueError("Unknown preflight outcome")
    races = []
    for office, key in seats:
        identity = office + "|" + key
        state = key[:2]
        primary = state in PRIMARY_STATES
        pin = pins.get(identity)
        source = ("PRIMARY_PROVIDER_STATE_SCOPE" if primary else
                  "PINNED_PREVIOUSLY_VERIFIED_ID" if pin else
                  "SCOPED_ADAPTER_NO_PINNED_ID" if identity in nh else
                  "NO_CURATED_PROVIDER_ID")
        last = prior.get(identity, {}).get("last_probe")
        new = probes.get(identity)
        # An upstream-paused slot was never checked: preserve any previous
        # actual observation, not a fabricated later negative source verdict.
        if new and (new["status"] != "NOT_CHECKED_UPSTREAM_PAUSED" or not last) and (
                not last or timestamp(new["checked_window_utc"]) >=
                timestamp(last["checked_window_utc"])):
            last = new
        # Last probe is historical evidence, not a guarantee the provider
        # remains indexed or reachable now, much less has reported votes.
        recent = bool(last and timestamp(last["checked_window_utc"]) <= now and
                      now - timestamp(last["checked_window_utc"]) <= timedelta(hours=24))
        active_evidence = (last["status"] if recent else "NOT_RECENTLY_CHECKED") if last else "NEVER_CHECKED"
        # A source identity that passed exact metadata+detail checks remains
        # a lookup hint for up to ten days, independently of the 24h health
        # freshness signal. It is still NOT evidence of live votes or calls.
        exact_usable = bool(last and last["status"] == "INDEXED_EXACT_RACE" and
                            timestamp(last["checked_window_utc"]) <= now and
                            now - timestamp(last["checked_window_utc"]) <= timedelta(days=10))
        if primary:
            gap = "PRIMARY_SCOPE_NOT_LIVE_VERIFIED"
        elif pin:
            gap = "PINNED_ID_NOT_LIVE_VERIFIED"
        elif identity in nh:
            gap = "SCOPED_ADAPTER_NOT_LIVE_VERIFIED"
        elif exact_usable:
            gap = "RECENT_EXACT_PROBE_NOT_LIVE_VERIFIED"
        else:
            gap = "UNRESOLVED_SOURCE_GAP"
        races.append({
            "id": identity, "office": office, "key": key, "state": state,
            "provider_scope": "Open America 22-state scope" if primary else "outside primary",
            "source_identity_status": source,
            "pinned_civicapi_id": pin["race_id"] if pin else None,
            "source_registry": pin["registry"] if pin else
                ("scoped NH adapter" if identity in nh else None),
            "last_probe": last, "recent_probe_status": active_evidence,
            "verified_identity_hint_usable": exact_usable if office == "House" else False,
            "preflight_scope": "primary_contract" if primary else
                "supplemental_contract" if pin or identity in nh else
                "sampled_house_probe" if new else "not_checked",
            "latest_preflight_outcome": checks["primary"] if primary else
                checks["secondary"] if pin or identity in nh else
                checks["house_probe"] if new else "not_checked",
            "gap_status": gap,
            "live_votes_verified_by_audit": False,
            "professional_winner_call_verified_by_audit": False,
        })
    summary = {}
    for office in ("House", "Senate", "Governor"):
        rows = [row for row in races if row["office"] == office]
        summary[office.lower()] = {
            "total": len(rows),
            "primary_scope": sum(r["source_identity_status"] == "PRIMARY_PROVIDER_STATE_SCOPE" for r in rows),
            "pinned_secondary": sum(r["source_identity_status"] == "PINNED_PREVIOUSLY_VERIFIED_ID" for r in rows
                                    if r["provider_scope"] == "outside primary"),
            "scoped_secondary": sum(r["source_identity_status"] == "SCOPED_ADAPTER_NO_PINNED_ID" for r in rows
                                    if r["provider_scope"] == "outside primary"),
            "recent_exact_probes": sum(r["recent_probe_status"] == "INDEXED_EXACT_RACE" for r in rows),
            "unresolved_source_gaps": sum(r["gap_status"] == "UNRESOLVED_SOURCE_GAP" for r in rows),
        }
    # The headline 186/219 style figure is not 'races unavailable'. Most
    # rows are simply unattempted; spell that distinction out exhaustively.
    house_gaps = [r for r in races if r["office"] == "House" and
                  r["gap_status"] == "UNRESOLVED_SOURCE_GAP"]
    def house_count(predicate):
        return sum(predicate(r) for r in house_gaps)
    breakdown = {
        "never_checked": house_count(lambda r: r["last_probe"] is None),
        "skipped_due_to_upstream_pause": house_count(lambda r:
            r["last_probe"] is not None and
            r["last_probe"]["status"] == "NOT_CHECKED_UPSTREAM_PAUSED"),
        "checked_not_indexed": house_count(lambda r:
            r["last_probe"] is not None and r["last_probe"]["status"] == "NOT_INDEXED"),
        "temporary_upstream_failure": house_count(lambda r:
            r["last_probe"] is not None and
            r["last_probe"]["status"] == "TEMPORARY_UPSTREAM_FAILURE"),
        "invalid_or_ambiguous": house_count(lambda r:
            r["last_probe"] is not None and r["last_probe"]["status"] in (
                "AMBIGUOUS_RACE", "AMBIGUOUS_OR_TRUNCATED", "INVALID_DETAIL",
                "SOURCE_UNAVAILABLE_OR_INVALID")),
        "expired_exact_identity": house_count(lambda r:
            r["last_probe"] is not None and
            r["last_probe"]["status"] == "INDEXED_EXACT_RACE"),
    }
    if sum(breakdown.values()) != summary["house"]["unresolved_source_gaps"]:
        raise ValueError("House source backlog triage does not reconcile")
    summary["house"]["unresolved_breakdown"] = breakdown
    summary["house"]["verified_usable_id_hints"] = sum(
        r["verified_identity_hint_usable"] for r in races if r["office"] == "House")
    assert [summary[k]["total"] for k in ("house", "senate", "governor")] == [435, 35, 36]
    return {
        "schema_version": "1.0", "generated_at": now.isoformat(),
        "status": "SOURCE_IDENTITY_AUDIT_NOT_LIVE_RESULTS_COVERAGE",
        "election": "2026-11-03", "preflight_checks": checks,
        "summary": summary,
        "methodology": {
            "primary_scope": "State present in documented Open America 22-state list; no per-race 2026 reporting assertion",
            "pinned_secondary": "Previously source-matched civicAPI race id in curated adapter; not a live health check",
            "scoped_secondary": "Exact NH office adapter without immutable pinned source race id",
            "house_probe": "Rotating sampled exact 2026 district discovery; 24-hour 'recent' does not guarantee Election Night data",
            "missing": "Unprobed, unindexed, interrupted or invalid is unknown, never zero votes",
            "verified_identity_hint": "Ten-day exact search+detail discovery; independent of 24-hour last-probe freshness and NOT verified live returns",
            "calls": "No licensed professional call provider or verified control attribution in this ledger",
        },
        "races": races,
    }


def house_pins(report, *, max_age_days=10):
    """Identity-only shortcut; live browser revalidates every detailed result."""
    when = timestamp(report["generated_at"])
    pins = []
    for row in report["races"]:
        if row["office"] != "House" or row["provider_scope"] != "outside primary":
            continue
        last = row["last_probe"]
        if not last or last["status"] != "INDEXED_EXACT_RACE":
            continue
        checked = timestamp(last["checked_window_utc"])
        if checked > when or when - checked > timedelta(days=max_age_days):
            continue
        if type(last["race_id"]) is not int or last["race_id"] <= 0:
            raise ValueError("Invalid exact House source identity")
        pins.append({"district": row["key"], "race_id": last["race_id"],
                     "checked_window_utc": last["checked_window_utc"]})
    if len(pins) > 219 or len({x["race_id"] for x in pins}) != len(pins):
        raise ValueError("Conflicting or duplicate source race IDs")
    return {"schema_version": "1.0",
            "status": "VERIFIED_HOUSE_IDENTITIES_NOT_LIVE_RESULTS",
            "election": "2026-11-03", "generated_at": when.isoformat(),
            "races": pins}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--probe", type=Path)
    parser.add_argument("--output", type=Path, default=OUT)
    parser.add_argument("--pins-output", type=Path,
                        default=ROOT / "data/election_night_house_pins.json")
    parser.add_argument("--primary-check", default="not_checked")
    parser.add_argument("--secondary-check", default="not_checked")
    parser.add_argument("--house-check", default="not_checked")
    args = parser.parse_args()
    prior = json.loads(args.output.read_text()) if args.output.exists() else None
    probe = json.loads(args.probe.read_text()) if args.probe and args.probe.exists() else None
    report = build(
        json.loads((ROOT / "data/seat_universe.json").read_text()),
        (ROOT / "scripts/election_night_reconciliation.js").read_text(),
        (ROOT / "scripts/civicapi_state_batch.js").read_text(),
        (ROOT / "scripts/civicapi_nh_adapter.js").read_text(),
        (ROOT / "scripts/civicapi_nh_governor_adapter.js").read_text(),
        probe=probe, previous=prior,
        checks={"primary": args.primary_check, "secondary": args.secondary_check,
                "house_probe": args.house_check}
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    pins = house_pins(report)
    args.pins_output.parent.mkdir(parents=True, exist_ok=True)
    args.pins_output.write_text(json.dumps(pins, indent=2, sort_keys=True) + "\n")
    print("Source identity audit:", json.dumps(report["summary"], sort_keys=True))
    print("House identity lookup hints:", len(pins["races"]),
          "(NOT confirmed live returns)")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as handle:
            handle.write("\n### Persistent 506-race source identity ledger (NOT live coverage)\n\n")
            handle.write("| Office | Primary state-scope | Pinned secondary | Scoped adapter | Unresolved gaps |\n")
            handle.write("|---|---:|---:|---:|---:|\n")
            for office, row in report["summary"].items():
                handle.write(f"| {office.title()} | {row['primary_scope']} | "
                             f"{row['pinned_secondary']} | {row['scoped_secondary']} | "
                             f"{row['unresolved_source_gaps']} |\n")
            b = report["summary"]["house"]["unresolved_breakdown"]
            handle.write("\n#### Why are some House source identities unresolved?\n\n")
            handle.write("| Cause | Districts |\n|---|---:|\n")
            for key, count in b.items():
                handle.write(f"| {key.replace('_', ' ').title()} | {count} |\n")
            handle.write(f"| **Total unresolved** | **{sum(b.values())}** |\n")
            handle.write("\n**Never checked and paused are not confirmed unavailable.** "
                         "Source identity only; no live returns, forecasts or professional calls.\n")


if __name__ == "__main__":
    main()
