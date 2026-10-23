#!/usr/bin/env python3
"""Build source-attributed 2026 NC county candidate votes from a reviewed ZIP.

Only after external approval of an exact original-source archive fingerprint.
No ballots_processed, percent reporting, source update time or probabilities
can be derived from votes recorded for candidates in a single contest.
No publishing action is performed by this script.
"""
import argparse
import datetime as dt
import hashlib
import json
import re
import urllib.request
from pathlib import Path

from nc_official_zip_staging_bridge import stage_zip
from run_nc_official_zip_historical_replay import load_verified_crosswalk

SOURCE = ("https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/"
          "2026_11_03/results_pct_20261103.zip")
ELIGIBLE = {"Senate": "NC-SEN", "Governor": "NC-GOV"}


def validate_review(review):
    if not isinstance(review, dict) or review.get("mode") != "nc-candidate-only" or (
        review.get("reviewed") is not True or
        review.get("verified_source_url") != SOURCE or
        not re.fullmatch(r"[0-9a-f]{64}", review.get("verified_archive_sha256", "")) or
        review.get("office") not in ("Senate", "House", "Governor") or
        not re.fullmatch(r"NC-(?:SEN|GOV|\d{2})", review.get("race_key", "")) or
        not isinstance(review.get("contest_name"), str) or
        not review["contest_name"].strip() or
        not isinstance(review.get("contest_group_id"), str) or
        not review["contest_group_id"].strip()
    ):
        raise ValueError("Exact NCSBE source review/identity not approved")
    if review["office"] in ELIGIBLE and review["race_key"] != ELIGIBLE[review["office"]]:
        raise ValueError("Incorrect statewide office/race identity")
    if review["office"] == "House" and not re.fullmatch(
            r"NC-\d{2}", review["race_key"]):
        raise ValueError("House district identity missing")
    return review


def build(payload, review, county_fips, *, checked_at):
    review = validate_review(review)
    observed = dt.datetime.fromisoformat(checked_at.replace("Z", "+00:00"))
    if observed.tzinfo is None or observed.utcoffset() != dt.timedelta(0) or (
        observed < dt.datetime(2026, 11, 3, 5, tzinfo=dt.timezone.utc)
    ):
        raise ValueError("Archive retrieval time is outside 2026 election window")
    stage = stage_zip(payload, manifest={
        "election_date": "2026-11-03",
        "source_url": SOURCE,
        "sha256": review["verified_archive_sha256"],
        "contest_name": review["contest_name"],
        "contest_group_id": review["contest_group_id"],
    }, county_fips=county_fips)
    counties = []
    for county in stage["counties"]:
        candidates = county["candidates"]
        if len(candidates) < 2 or len(candidates) > 30:
            raise ValueError("Missing or unexpected candidate set")
        votes = sum(c["votes"] for c in candidates)
        if votes < 0 or votes > 20_000_000:
            raise ValueError("Invalid source candidate totals")
        if votes == 0:
            continue  # A zero-filled county is NOT evidence that it reported.
        counties.append(county)
    if not counties:
        raise ValueError("No observed positive county candidate counts")
    return {
        "schema": "nc-official-candidate-votes-v1",
        "election_date": "2026-11-03",
        "state": "NC",
        "office": review["office"],
        "race_key": review["race_key"],
        "source": {
            "url": SOURCE,
            "sha256": stage["source"]["archive_sha256"],
            "archive_member": "results_pct_20261103.txt",
            "contest_name": review["contest_name"],
            "contest_group_id": review["contest_group_id"],
        },
        "archive_checked_at": observed.isoformat().replace("+00:00", "Z"),
        "ballots_reported": None,
        "reporting_fraction": None,
        "may_move_national_needle": False,
        "counties": counties,
    }


def fetch_zip():
    request = urllib.request.Request(SOURCE, headers={
        "User-Agent": "ElectionCommandCenter/1.0 reviewed-candidate-vote-archive"})
    with urllib.request.urlopen(request, timeout=40) as response:
        if response.status != 200:
            raise ValueError("NCSBE source HTTP status is not 200")
        data = response.read(95_000_001)
    if len(data) > 95_000_000:
        raise ValueError("NCSBE ZIP exceeds cap")
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--approved-review", type=Path, required=True)
    parser.add_argument("--pinned-fips", type=Path, default=Path(
        "data/nc_2024_county_fips_reference.csv"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    review = validate_review(json.loads(args.approved_review.read_text()))
    fips = load_verified_crosswalk(args.pinned_fips.read_text())
    data = fetch_zip()
    now = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    exported = build(data, review, fips, checked_at=now)
    args.output.write_text(json.dumps(exported, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "REVIEWED_OFFICIAL_UNOFFICIAL_CANDIDATE_VOTES",
                      "source_sha256": hashlib.sha256(data).hexdigest(),
                      "counties_with_positive_candidate_votes": len(exported["counties"]),
                      "no_ballot_denominator": True,
                      "no_national_needle": True,
                      "output": str(args.output)}))


if __name__ == "__main__":
    main()
