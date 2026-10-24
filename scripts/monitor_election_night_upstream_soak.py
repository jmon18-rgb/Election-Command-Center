#!/usr/bin/env python3
"""12-minute ACTUAL elapsed-time read-only Election Night upstream health audit.

Live HTTPS/CORS/schema and deployed-site reachability only. Never a browser
endurance test, November 2026 vote guarantee, professional call or model input.
No results or personal data are collected, cached, or redistributed.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import time

from test_live_results_source import fetch as fetch_primary
from check_election_night_pages_runtime import get_bytes, DEFAULT_SITE

OFFICES = ("House", "Senate", "Governor")
INDEX_MARKER = b"function enHousePinsReady()"


def probe_site(site=DEFAULT_SITE):
    if not site.endswith("/"):
        site += "/"
    body = get_bytes(site, "index.html", timeout=20)
    if len(body) < 100000 or INDEX_MARKER not in body:
        raise ValueError("Public dashboard did not serve the election-night browser entrypoint")
    return True


def validate_primary(doc, office):
    # The existing shared source preflight verifies the full CORS,
    # 2026 election-year, office, candidate and no-called-winner contract.
    # Recheck the invariants that must stay true when caller is stubbed.
    if not isinstance(doc, dict) or doc.get("api") != 1 or doc.get("year") != 2026:
        raise ValueError("Not an independently validated 2026 source")
    if doc.get("office") != office or not isinstance(doc.get("races"), dict):
        raise ValueError("Mismatched source office or missing race list")
    if not all(type(doc.get(k)) is bool for k in ("live", "stale", "counting", "final")):
        raise ValueError("Missing primary source status flags")
    if doc.get("counts", {}).get("races") != len(doc["races"]):
        raise ValueError("Source race inventory does not reconcile")
    for row in doc["races"].values():
        if (not isinstance(row, dict) or
            type(row.get("total")) is not int or row["total"] < 0 or
            row.get("called") is not False or row.get("winner")):
            raise ValueError("Unsafe provider result or winner-call field")
    # Pre-election valid empty/non-counting feeds are NOT live vote coverage.
    return {"status": "source_contract_ok", "provider_reporting": bool(
        doc["races"] and any(r["total"] > 0 for r in doc["races"].values())
        and doc["live"] and not doc["stale"]), "race_entries": len(doc["races"])}


def measure(fetch_source, check_site, clock, sleep, *,
            duration=720, interval=60, max_consecutive_failures=3):
    if not 60 <= duration <= 1800 or not 30 <= interval <= 300:
        raise ValueError("Unsupported real-clock rehearsal bounds")
    if duration // interval > 45:
        raise ValueError("Provider request cap exceeded")
    started = clock()
    deadlines = [started + step*interval for step in range(duration // interval + 1)]
    series = {office: {"success": 0, "failure": 0,
                       "max_consecutive_failures": 0, "current_streak": 0,
                       "recoveries": 0, "reported_positive_vote_samples": 0,
                       "last_error_type": None} for office in OFFICES}
    site = {"success": 0, "failure": 0, "last_error_type": None}
    elapsed_intervals = 0
    for index, target in enumerate(deadlines):
        wait = target - clock()
        if wait > 0:
            sleep(wait)
        if index == 0 or index == len(deadlines)-1:
            try:
                if check_site() is not True:
                    raise ValueError("Dashboard entrypoint could not be verified")
                site["success"] += 1
            except Exception as exc:
                site["failure"] += 1
                site["last_error_type"] = type(exc).__name__
        for office in OFFICES:
            row = series[office]
            try:
                observed = validate_primary(fetch_source(2026, office), office)
                row["success"] += 1
                if row["current_streak"]:
                    row["recoveries"] += 1
                row["current_streak"] = 0
                if observed["provider_reporting"]:
                    row["reported_positive_vote_samples"] += 1
            except Exception as exc:
                row["failure"] += 1
                row["current_streak"] += 1
                row["max_consecutive_failures"] = max(
                    row["max_consecutive_failures"], row["current_streak"])
                # Never publish a provider payload, URL token or voter data.
                row["last_error_type"] = type(exc).__name__
        elapsed_intervals += 1
    healthy = (site["failure"] == 0 and
        all(x["success"] >= max(1, elapsed_intervals-2) and
            x["max_consecutive_failures"] <= max_consecutive_failures
            for x in series.values()))
    return {
        "schema": "real-time-election-source-transport-rehearsal-v1",
        "status": "PASS_UPSTREAM_HEALTH_NO_VOTE_COVERAGE_CLAIM" if healthy else
                  "FAIL_UPSTREAM_AVAILABILITY_OR_DEPLOYMENT",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "actual_elapsed_seconds": round(clock()-started, 1),
        "scheduled_checkpoints": len(deadlines),
        "completed_checkpoints": elapsed_intervals,
        "primary_offices": series,
        "public_site": site,
        "pre_election_empty_feed_is_valid": True,
        "verified_2026_vote_coverage": False,
        "professional_race_calls_verified": False,
        "full_browser_endurance_test": False,
        "geographic_needle_calibration_test": False
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--duration-seconds", type=int, default=720)
    p.add_argument("--interval-seconds", type=int, default=60)
    p.add_argument("--site", default=os.environ.get("DASHBOARD_SITE_URL") or DEFAULT_SITE)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    def check_site():
        return probe_site(args.site)
    report = measure(fetch_primary, check_site, time.monotonic, time.sleep,
                     duration=args.duration_seconds, interval=args.interval_seconds)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as out:
            out.write("### Actual elapsed-time election source health check\n\n")
            out.write(f"- Status: {report['status']}\n")
            out.write(f"- Elapsed seconds: {report['actual_elapsed_seconds']}\n")
            out.write(f"- Completed checkpoints: {report['completed_checkpoints']}\n")
            for office, d in report["primary_offices"].items():
                out.write(f"- {office}: {d['success']} successful, {d['failure']} failed, "
                          f"longest outage {d['max_consecutive_failures']} checks\n")
            out.write("- This is HTTP endpoint monitoring, not a browser soak; "
                      "no 2026 votes or race calls verified.\n")
    if report["status"].startswith("FAIL_"):
        raise SystemExit("Repeated provider or Pages outages detected; see health artifact")


if __name__ == "__main__":
    main()
