#!/usr/bin/env python3
"""Compare exact House provider identity pins published on GitHub Pages.

Ignore timestamps and source-health wording; publication is required only
when the exact district->verified provider race ID mapping differs. NEVER
inspect candidate votes, calls, percent reporting or model probabilities.
"""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re

def identities(document, *, allow_unavailable=False):
    if allow_unavailable and (document is None or document == {}):
        return None
    if not isinstance(document, dict) or document.get("schema_version") != "1.0" or (
            document.get("election") != "2026-11-03") or (
            document.get("status") != "VERIFIED_HOUSE_IDENTITIES_NOT_LIVE_RESULTS"):
        raise ValueError("Untrusted provider-identity pin inventory")
    pins = document.get("races")
    if not isinstance(pins, list) or len(pins) > 219:
        raise ValueError("Wrong bounded House identity list")
    found = {}
    ids = set()
    for entry in pins:
        if not isinstance(entry, dict):
            raise ValueError("Invalid House provider pin")
        district = entry.get("district")
        race = entry.get("race_id")
        if not isinstance(district, str) or re.fullmatch(r"[A-Z]{2}-\d{2}",district) is None or (
                type(race) is not int or race <= 0 or district in found or race in ids):
            raise ValueError("Duplicated or unverified provider race IDs")
        found[district] = race
        ids.add(race)
    return found

def needs_publication(published, latest, *, now=None):
    reviewed = identities(latest)
    try:
        previous = identities(published, allow_unavailable=True)
    except ValueError:
        # Remote malformed/stale manifest must never be treated as approved.
        previous = None
    if previous != reviewed:
        return True
    # The actual browser's source-ID adapter refuses manifests >48h old.
    # Avoid rebuilding Pages on every hourly timestamp update, but publish
    # an unchanged ID mapping before the 48h hard-expiry gate.
    moment = now or datetime.now(timezone.utc)
    if moment.tzinfo is None:
        raise ValueError("Clock must be timezone-aware")
    try:
        remote_at = datetime.fromisoformat(published["generated_at"].replace("Z", "+00:00"))
        current_at = datetime.fromisoformat(latest["generated_at"].replace("Z", "+00:00"))
        if remote_at.tzinfo is None or current_at.tzinfo is None:
            return True
        remote_at = remote_at.astimezone(timezone.utc)
        current_at = current_at.astimezone(timezone.utc)
    except (TypeError, KeyError, ValueError, AttributeError):
        return True
    moment = moment.astimezone(timezone.utc)
    return (remote_at > moment + timedelta(minutes=15) or
            (moment - remote_at > timedelta(hours=30) and
             current_at > remote_at + timedelta(minutes=1)))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--remote", type=Path, required=True)
    parser.add_argument("--local", type=Path, required=True)
    parser.add_argument("--output-env", type=Path, required=True)
    args = parser.parse_args()
    local = json.loads(args.local.read_text())
    try:
        remote = json.loads(args.remote.read_text()) if args.remote.is_file() else None
    except (ValueError, OSError):
        remote = None
    changed = needs_publication(remote, local)
    with args.output_env.open("a") as output:
        output.write("pins_need_pages_build="+str(changed).lower()+"\n")
    print(json.dumps({
        "status": "PAGES_PIN_REBUILD_REQUIRED" if changed else "PAGES_PROVIDER_IDS_IN_SYNC",
        "verified_house_pin_count": len(identities(local)),
        "live_vote_counts_examined": False,
        "race_calls_inferred": False
    }))

if __name__ == "__main__":
    main()
