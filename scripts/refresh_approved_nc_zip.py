#!/usr/bin/env python3
"""Refresh an operator-approved NCSBE county candidate snapshot during Election Night.

Only a human-reviewed initial official archive/contest identity can enable
this job. Subsequent ZIP revisions are allowed only if separately opted in;
source stays the exact original NCSBE URL, and observed county candidate votes
must not regress. Output NEVER contains a ballot denominator or probabilities.
"""
import argparse
import copy
import datetime as dt
import hashlib
import json
from pathlib import Path

from build_nc_official_candidate_votes_2026 import (
    SOURCE, build, fetch_zip, validate_review,
)
from run_nc_official_zip_historical_replay import load_verified_crosswalk
from nc_official_zip_observation_journal import append as append_observation

OUTPUT_PATH = "./data/nc_candidate_votes_2026.json"
JOURNAL_PATH = "./data/nc_senate_zip_observations_2026.json"
# NCSBE closes polls at 7:30 PM ET, November 3 (EST on this date).
# NEVER accept or fetch an official 2026 ZIP for publication before then.
POLL_CLOSE = dt.datetime(2026, 11, 4, 0, 30, tzinfo=dt.timezone.utc)
START = POLL_CLOSE
END = dt.datetime(2026, 11, 6, 6, tzinfo=dt.timezone.utc)


def parse_time(raw):
    try:
        parsed = dt.datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Invalid retrieval timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != dt.timedelta(0):
        raise ValueError("Timestamp must be UTC with an offset")
    return parsed


def check_previous(previous, pinned_sha):
    if previous is None:
        return
    if (not isinstance(previous, dict) or
        previous.get("schema") != "nc-official-candidate-votes-v1" or
        previous.get("election_date") != "2026-11-03" or
        previous.get("source", {}).get("url") != SOURCE or
        previous.get("source", {}).get("sha256") != pinned_sha or
        previous.get("ballots_reported", "not-null") is not None or
        previous.get("reporting_fraction", "not-null") is not None or
        previous.get("may_move_national_needle") is not False):
        raise ValueError("Previous reviewed county snapshot not trustworthy")


def refuse_vote_regressions(previous, replacement):
    if previous is None:
        return
    new_counties = {c["county_id"]: c for c in replacement["counties"]}
    for old in previous["counties"]:
        fresh = new_counties.get(old["county_id"])
        if not fresh:
            raise ValueError("Previously observed county missing in newer ZIP")
        fresh_votes = {
            (c["name"].strip().casefold(), c["party"].strip().casefold()): c["votes"]
            for c in fresh["candidates"]
        }
        for cand in old["candidates"]:
            identity = (cand["name"].strip().casefold(), cand["party"].strip().casefold())
            if fresh_votes.get(identity, -1) < cand["votes"]:
                raise ValueError("Official source candidate vote regression needs manual review")


def refresh(config, previous, payload, fips, now):
    if not isinstance(config, dict) or config.get("schema") != "county-desk-config-v1":
        raise ValueError("Invalid county results desk config")
    if config.get("enabled") is not True:
        return {"status": "DISABLED", "config": config, "snapshot": None}
    observed = parse_time(now)
    if not POLL_CLOSE <= observed <= END:
        raise ValueError("Official NC candidate votes cannot publish before polls close or after 2026 window")
    if config.get("snapshot_path") != OUTPUT_PATH or not isinstance(config.get("expected"), dict):
        raise ValueError("Unapproved source or output configuration")
    review = validate_review(config["expected"])
    pinned_sha = review["verified_archive_sha256"]
    check_previous(previous, pinned_sha)
    sha = hashlib.sha256(payload).hexdigest()
    if sha != pinned_sha and (
        previous is None or review.get("allow_verified_revisions") is not True
    ):
        raise ValueError("New official ZIP fingerprint requires source approval")
    if previous is not None and sha == pinned_sha:
        prior_seen = parse_time(previous.get("archive_checked_at"))
        if dt.timedelta(0) <= observed-prior_seen < dt.timedelta(minutes=60):
            return {"status": "UNCHANGED", "config": config, "snapshot": previous}
    revised_review = {**review, "verified_archive_sha256": sha}
    replacement = build(payload, revised_review, fips,
                        checked_at=observed.isoformat().replace("+00:00", "Z"))
    if previous and (
        previous.get("race_key") != replacement["race_key"] or
        previous.get("office") != replacement["office"] or
        previous.get("source", {}).get("contest_group_id") != replacement["source"]["contest_group_id"] or
        previous.get("source", {}).get("contest_name") != replacement["source"]["contest_name"]
    ):
        raise ValueError("Published contest identity has changed")
    refuse_vote_regressions(previous, replacement)
    updated = copy.deepcopy(config)
    updated["expected"]["verified_archive_sha256"] = sha
    return {"status": "UPDATED", "config": updated, "snapshot": replacement}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--config", type=Path, default=Path(
        "data/nc_county_results_desk_config.json"))
    p.add_argument("--county-fips", type=Path, default=Path(
        "data/nc_2024_county_fips_reference.csv"))
    args = p.parse_args()
    original = json.loads(args.config.read_text(encoding="utf-8"))
    if original.get("enabled") is not True:
        print(json.dumps({"status": "DISABLED", "source_read": False}))
        return
    if original.get("snapshot_path") != OUTPUT_PATH:
        raise ValueError("Source approval must pin the configured output path")
    if not START <= dt.datetime.now(dt.timezone.utc) <= END:
        print(json.dumps({"status": "INACTIVE_ELECTION_WINDOW", "source_read": False}))
        return
    out_path = Path(OUTPUT_PATH.removeprefix("./"))
    previous = json.loads(out_path.read_text()) if out_path.is_file() else None
    fips = load_verified_crosswalk(args.county_fips.read_text())
    # Download only after verifying that the source has been operator-enabled.
    data = fetch_zip()
    now = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    result = refresh(original, previous, data, fips, now)
    if result["status"] == "UPDATED":
        # Prepare the complete chronology BEFORE writing any files. Only the
        # exact approved NC Senate source may add replay data; it does not
        # turn ZIP retrieval time into a state-reported precinct timestamp.
        journal_path = Path(JOURNAL_PATH.removeprefix("./"))
        updated_journal = None
        if result["snapshot"]["race_key"] == "NC-SEN":
            previous_journal = (json.loads(journal_path.read_text(encoding="utf-8"))
                                if journal_path.is_file() else None)
            updated_journal = append_observation(
                previous_journal, previous, result["snapshot"])["journal"]
        # GitHub Actions commits all three JSON files in one Git commit. A
        # broken audit/history validation fails the run without publication.
        out_path.write_text(json.dumps(result["snapshot"], indent=2) + "\n")
        args.config.write_text(json.dumps(result["config"], indent=2) + "\n")
        if updated_journal is not None:
            journal_path.write_text(json.dumps(updated_journal, indent=2) + "\n")
    print(json.dumps({"status": result["status"],
                      "source_sha256": hashlib.sha256(data).hexdigest(),
                      "pushed_to_git": False,
                      "ballot_denominators_inferred": False,
                      "may_move_national_needle": False}))


if __name__ == "__main__":
    main()
