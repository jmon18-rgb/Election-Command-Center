#!/usr/bin/env python3
"""Compare exact House provider identity pins published on GitHub Pages.

Ignore timestamps and source-health wording; publication is required only
when the exact district->verified provider race ID mapping differs. NEVER
inspect candidate votes, calls, percent reporting or model probabilities.
"""
import argparse
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

def needs_publication(published, latest):
    reviewed = identities(latest)
    try:
        previous = identities(published, allow_unavailable=True)
    except ValueError:
        # Remote malformed/stale manifest must never be treated as approved.
        previous = None
    return previous != reviewed

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
