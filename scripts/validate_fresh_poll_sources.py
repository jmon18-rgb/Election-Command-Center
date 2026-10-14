#!/usr/bin/env python3
"""Validate newly fetched polls without freezing any pollster, party, or name.

This is intentionally separate from the full DOM fixture regression, which
must run once against checked-in data before calling external poll sources.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UTC = dt.timezone.utc
VALID_OFFICES = {"senate", "house", "governor"}


def parsed_time(raw, label):
    if not isinstance(raw, str):
        raise ValueError(f"Missing timestamp: {label}")
    try:
        out = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"Invalid timestamp in {label}: {raw!r}") from exc
    if out.tzinfo is None:
        raise ValueError(f"Naive timestamp in {label}: {raw!r}")
    return out.astimezone(UTC)


def assert_recent(raw, label, now, max_minutes=90):
    at = parsed_time(raw, label)
    elapsed = (now - at).total_seconds() / 60
    if elapsed < -10 or elapsed > max_minutes:
        raise ValueError(f"{label} is not current: {round(elapsed, 1)} min old")
    return at


def verify(primary, supplemental=None, estimates=None, *, now=None):
    now = now or dt.datetime.now(UTC)
    if not isinstance(primary, dict):
        raise ValueError("Primary polling data missing")
    updated = assert_recent(primary.get("updated_at"), "polls.json updated_at", now)
    health = primary.get("health") or {}
    assert_recent(health.get("last_attempt_at"), "polls.json health last attempt", now)
    sections = set(health.get("successful_sections") or [])
    if health.get("status") != "ok" or not {"races", "generic_ballot"}.issubset(sections):
        raise ValueError("Polling source refresh incomplete: " + repr(health.get("errors")))
    races = primary.get("races")
    if not isinstance(races, list) or len(races) < 40:
        raise ValueError("Primary source lost broad race coverage")
    seen_races, observed = set(), set()
    n_obs = 0
    for race in races:
        code = race.get("race_code")
        if not isinstance(code, str) or not re.fullmatch(
                r"[A-Z]{2}-(?:SEN|GOV|\d{1,2})", code):
            raise ValueError(f"Invalid race code: {code!r}")
        if code in seen_races:
            raise ValueError(f"Duplicate race: {code}")
        seen_races.add(code)
        if race.get("race_type") not in VALID_OFFICES:
            raise ValueError(f"Invalid office for {code}")
        polls = race.get("polls")
        if not isinstance(polls, list) or not polls:
            raise ValueError(f"No poll observations for {code}")
        for p in polls:
            if not isinstance(p.get("pollster"), str) or not p["pollster"].strip():
                raise ValueError(f"Missing pollster for {code}")
            try:
                date = dt.date.fromisoformat(p.get("field_end"))
            except (ValueError, TypeError):
                raise ValueError(f"Invalid poll field end for {code}") from None
            if date > now.date() or date.year != 2026:
                raise ValueError(f"Wrong-cycle poll date for {code}")
            if not isinstance(p.get("dem"), (float, int)) or not isinstance(
                p.get("rep"), (float, int)):
                raise ValueError(f"Unparseable candidate share for {code}")
            if not (0 <= p["dem"] <= 100 and 0 <= p["rep"] <= 100):
                raise ValueError(f"Out-of-range candidate share for {code}")
            key = (code, str(p.get("poll_id") or ""), p.get("field_end"),
                   p["pollster"], p.get("dem_name"), p.get("rep_name"),
                   p["dem"], p["rep"])
            if key in observed:
                raise ValueError(f"Duplicate exact poll: {code}")
            observed.add(key)
            n_obs += 1
    generic = (primary.get("generic_ballot") or {}).get("latest")
    if not isinstance(generic, list) or len(generic) < 2:
        raise ValueError("Primary source missing generic ballot surveys")
    details = {"polling_source_at": updated.isoformat(),
               "race_count": len(races), "poll_count": n_obs,
               "generic_observation_count": len(generic)}
    if supplemental is not None:
        polls = supplemental.get("observations")
        if not isinstance(polls, list) or len(polls) < 20:
            raise ValueError("Secondary poll index malformed")
        supplemental_at = parsed_time(supplemental.get("updated_at"),
                                      "supplemental updated_at")
        age = (now - supplemental_at).total_seconds()/60
        details["supplemental_count"] = len(polls)
        details["supplemental_age_minutes"] = round(age, 2)
        # Supplemental provider errors should not discard a successful
        # primary update, but stale source observations are clearly flagged.
        if age < -10 or age > 90:
            details["supplemental_status"] = "stale_warning"
        else:
            details["supplemental_status"] = "current"
    if estimates is not None:
        if estimates.get("source_snapshot") != primary.get("updated_at"):
            raise ValueError("Generated estimates derived from an OLD poll snapshot")
        generated = parsed_time(estimates.get("generated_at"),
                                "polling_estimates generated_at")
        if generated < updated:
            raise ValueError("Model estimates generated before source refreshed")
        if not isinstance(estimates.get("senate_all"), list):
            raise ValueError("Missing generated Senate polling summaries")
        details["generated_at"] = generated.isoformat()
    return details


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--generated", action="store_true")
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args(argv)
    files = args.root / "data"
    primary = json.loads((files / "polls.json").read_text(encoding="utf-8"))
    supplement = files / "pollresults_recent.json"
    supplemental = json.loads(supplement.read_text(encoding="utf-8")) if supplement.exists() else None
    estimates = json.loads((files / "polling_estimates.json").read_text(encoding="utf-8")) if args.generated else None
    details = verify(primary, supplemental, estimates)
    print("POLL SOURCE REFRESH VALIDATED:", json.dumps(details, sort_keys=True))
    if details.get("supplemental_status") == "stale_warning":
        print("WARNING: supplemental posting index is stale; primary polls may still update.",
              file=sys.stderr)


if __name__ == "__main__":
    main()
