#!/usr/bin/env python3
"""12-minute ACTUAL elapsed-time read-only Election Night upstream health audit.

Live HTTPS/CORS/schema and deployed-site reachability only. Never a browser
endurance test, November 2026 vote guarantee, professional call or model input.
No results or personal data are collected, cached, or redistributed.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone, timedelta
import re
import json
import os
from pathlib import Path
import time

from test_live_results_source import fetch as fetch_primary
from national_results_coverage_pulse import state_poll_closings, valid_candidates, _time
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


def validate_primary(doc, office, now=None):
    """Transport + integrity checkpoint, NOT nationwide vote coverage proof.

    The upstream HTTPS fetch checks CORS; this local review must still reject
    forged, premature or stale candidate totals even if the HTTP request
    succeeded. The source may legitimately publish pre-election empty feeds.
    """
    now = datetime.now(timezone.utc) if now is None else now
    if not isinstance(now, datetime) or now.tzinfo is None:
        raise ValueError("Source audit clock must include timezone")
    now = now.astimezone(timezone.utc)
    if (not isinstance(doc, dict) or doc.get("api") != 1 or
        doc.get("year") != 2026 or doc.get("office") != office or
        doc.get("source") not in (None, "", "state") or
        not isinstance(doc.get("races"), dict) or
        len(doc["races"]) > 550):
        raise ValueError("Not a bounded exact-office 2026 provider source")
    flags = ("live", "stale", "counting", "final")
    if any(type(doc.get(k)) is not bool for k in flags):
        raise ValueError("Missing or invalid primary source state flags")
    if doc["live"] and (doc["stale"] or doc["final"] or not doc["counting"]):
        raise ValueError("Contradictory primary live/counting source flags")
    if not isinstance(doc.get("counts"), dict) or (
        type(doc["counts"].get("races")) is not int or
        doc["counts"]["races"] != len(doc["races"])
    ):
        raise ValueError("Source race inventory does not reconcile")
    stamp = doc.get("as_of")
    at = _time(stamp) if stamp else None
    if at is not None and at > now + timedelta(minutes=15):
        raise ValueError("Future source-stamped provider office")
    patterns = {"House":r"[A-Z]{2}-\d{2}",
                "Senate":r"[A-Z]{2}(?:-special)?",
                "Governor":r"[A-Z]{2}"}
    if office not in patterns:
        raise ValueError("Unknown provider office")
    closes = state_poll_closings()
    positive = 0
    for seat,row in doc["races"].items():
        if (not isinstance(seat,str) or
            re.fullmatch(patterns[office], seat) is None or
            not isinstance(row,dict) or
            type(row.get("total")) is not int or row["total"] < 0 or
            row.get("called") is not False or row.get("winner")):
            raise ValueError("Invalid office/race identity, vote count or call")
        if not valid_candidates(row,row["total"]):
            raise ValueError("Invalid primary candidate-level vote arithmetic")
        count=row["total"]
        if count > 0:
            state=seat[:2]
            close=closes.get(state)
            if not close or not at or now < close or at < close:
                raise ValueError("Premature or unstamped 2026 positive vote record")
            if now-at > timedelta(hours=3):
                raise ValueError("Stale positive vote evidence")
            if doc["stale"] or not (doc["live"] or doc["final"]):
                raise ValueError("Positive result from inactive or stale provider")
            positive += 1
    return {"status":"source_contract_ok",
            "provider_reporting": bool(positive),
            "race_entries":len(doc["races"]),
            "reporting_contests":positive}


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
