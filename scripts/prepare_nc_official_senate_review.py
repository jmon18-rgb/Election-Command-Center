#!/usr/bin/env python3
"""Human-only NC 2026 US Senate ZIP identity review; NEVER emit vote totals."""
import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

from discover_nc_2026_official_zip import (
    CANDIDATE_ZIP, CATALOG_URL, ELECTION, FILTER_URL, MAX_ZIP,
    MEMBER, REQUIRED, get_bounded, inspect_archive, select_source,
)
from run_nc_official_zip_historical_replay import load_verified_crosswalk

START = dt.datetime(2026, 11, 4, 0, 30, tzinfo=dt.timezone.utc)
END = dt.datetime(2026, 11, 6, 6, tzinfo=dt.timezone.utc)
SOURCE = "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip"
assert SOURCE == CANDIDATE_ZIP

def senate_name(value):
    value = re.sub(r"[^A-Z ]", "", value.upper())
    value = " ".join(value.split())
    return value in ("US SENATE", "UNITED STATES SENATE")

def review(payload, fips, now):
    if (not isinstance(now, dt.datetime) or now.tzinfo is None or
            not START <= now.astimezone(dt.timezone.utc) <= END):
        raise ValueError("NC human-review source ZIP cannot be inspected before polls close")
    if not isinstance(fips, dict) or len(fips) < 1:
        raise ValueError("Independent county names and FIPS crosswalk missing")
    inspected = inspect_archive(payload)
    contest = {}
    county_names = set()
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        with archive.open(MEMBER) as member:
            reader = csv.DictReader(io.TextIOWrapper(member, encoding="utf-8-sig"), delimiter="\t")
            if not reader.fieldnames or not REQUIRED.issubset(reader.fieldnames):
                raise ValueError("Unexpected exact 2026 NC source header")
            for row in reader:
                if row.get("Election Date") != ELECTION:
                    raise ValueError("Mixed or wrong election date inside official ZIP")
                if None in row or any(value is None for value in row.values()):
                    raise ValueError("Malformed NC official TSV row")
                county = str(row["County"]).strip().upper()
                if county not in fips:
                    raise ValueError("Unknown source county; manual crosswalk verification required")
                county_names.add(county)
                name = str(row["Contest Name"]).strip()
                if not senate_name(name):
                    continue
                group = str(row["Contest Group ID"]).strip()
                candidate = str(row["Choice"]).strip()
                party = str(row["Choice Party"]).strip()
                if (not group or len(group) > 100 or not candidate or len(candidate) > 300 or
                        not party or len(party) > 100):
                    raise ValueError("Invalid Senate contest/candidate identities")
                key = (group, name)
                entry = contest.setdefault(key, {"counties": set(), "candidates": set(),
                                                 "contest_types": set()})
                entry["counties"].add(fips[county])
                entry["candidates"].add((candidate, party))
                entry["contest_types"].add(str(row["Contest Type"]).strip())
    rows = [{
        "contest_group_id": key[0],
        "contest_name": key[1],
        "contest_types_to_verify": sorted(value["contest_types"]),
        "county_fips_observed": sorted(value["counties"]),
        "county_count_observed": len(value["counties"]),
        "candidate_choice_party_pairs": [
            {"choice": cand, "party_as_published": party}
            for cand, party in sorted(value["candidates"])
        ],
    } for key, value in sorted(contest.items())]
    return {
        "schema": "nc-2026-senate-source-identity-human-review-v1",
        "election_date": "2026-11-03",
        "checked_at": now.astimezone(dt.timezone.utc).isoformat(),
        "publisher": "North Carolina State Board of Elections",
        "original_source_url": SOURCE,
        "original_zip_sha256": hashlib.sha256(payload).hexdigest(),
        "source_zip_member": MEMBER,
        "all_source_counties_observed": len(county_names),
        "status": "IDENTITY_REVIEW_REQUIRED" if len(rows) == 1 else
                  ("MULTIPLE_SENATE_CONTEST_IDENTITIES_REQUIRE_REVIEW" if rows
                   else "NO_SENATE_CONTEST_IDENTIFIED"),
        "senate_contest_identity_candidates": rows,
        "automatically_approved": False,
        "candidate_vote_totals_exported": False,
        "reporting_percent_or_ballots_exported": False,
        "real_2026_votes_published_to_site": False,
        "may_move_national_needle": False,
        "evidence_scope": inspected["status"],
        "human_approval_next": "Review exact county, party, contest IDs and actual post-close source; approve separately before publication",
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--county-fips", type=Path,
                        default=Path("data/nc_2024_county_fips_reference.csv"))
    args = parser.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    if not START <= now <= END:
        raise SystemExit("Official 2026 NC Senate approval evidence is post-poll only")
    catalog = json.loads(get_bounded(CATALOG_URL, 300_000)[0])
    filtered = json.loads(get_bounded(FILTER_URL, 300_000)[0])
    selection = select_source(catalog, filtered)
    if selection.get("eligible") is not True:
        raise SystemExit("No verified 2026 official ZIP catalog selection: "+
                         str(selection.get("reason")))
    payload = get_bounded(CANDIDATE_ZIP, MAX_ZIP)[0]
    crosswalk = load_verified_crosswalk(args.county_fips.read_text())
    artifact = review(payload, crosswalk, now)
    args.output.write_text(json.dumps(artifact, indent=2) + "\n")
    print(json.dumps(artifact, indent=2), flush=True)

if __name__ == "__main__":
    main()
