#!/usr/bin/env python3
"""Real NCSBE 2024 official ZIP -> Census county FIPS -> staged county votes.

Historical read-only end-to-end acceptance test. It does NOT publish 2026
ballots or promote the probability needle. Source ZIP hash was audited in
PR #213; 2024 presidential state totals are separately certified.
"""
import argparse
import csv
import hashlib
import io
import json
import urllib.request
import zipfile
from pathlib import Path

CROSSWALK_SOURCE = "https://www.lib.ncsu.edu/gis/countyfips"
CROSSWALK_FILE = Path("data/nc_2024_county_fips_reference.csv")
from join_nc_2024_county_fips import normalize as canonical_county
from nc_official_zip_staging_bridge import stage_zip

OFFICIAL_URL = "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2024_11_05/results_pct_20241105.zip"
OFFICIAL_SHA = "2fab44e9b12e03c0d88ef832c2e6dc8c569e2b020d64df06a8b551b62bbdb426"
EXPECTED_PRESIDENTIAL = {"DEM": 2_715_375, "REP": 2_898_423}


def load_verified_crosswalk(crosswalk_csv):
    reader = csv.DictReader(io.StringIO(crosswalk_csv))
    if set(reader.fieldnames or []) != {"statefp", "countyfp", "name"}:
        raise ValueError("Unrecognized pinned county crosswalk schema")
    names, ids = {}, set()
    for row in reader:
        key = canonical_county(row["name"])
        fips = row["statefp"] + row["countyfp"]
        if key in names or fips in ids or not fips.startswith("37"):
            raise ValueError("Duplicate or non-NC official crosswalk")
        names[key] = fips
        ids.add(fips)
    if len(names) != 100 or len(ids) != 100:
        raise ValueError("Not all official NC county mappings present")
    return names


def discover_unique_historical_presidential_identity(tsv):
    reader = csv.DictReader(io.StringIO(tsv), delimiter="\t")
    identities = set()
    for row in reader:
        name = (row.get("Contest Name") or "").strip()
        if (row.get("Election Date") or "") == "11/05/2024" and name.startswith("US PRESIDENT"):
            identities.add((name, (row.get("Contest Group ID") or "").strip()))
    if len(identities) != 1 or not all(identities.pop() if False else ()):
        # Failure here is intentional: a human must resolve multiple identities.
        if len(identities) != 1:
            raise ValueError("Historical presidential contest identity is ambiguous")
    name, group = next(iter(identities))
    if not group:
        raise ValueError("Historical presidential contest group is absent")
    return name, group


def fetch_bounded(url, cap):
    request = urllib.request.Request(url, headers={
        "User-Agent": "ElectionCommandCenter/1.0 historical-NC-replay"})
    with urllib.request.urlopen(request, timeout=60) as response:
        if response.status != 200:
            raise ValueError("Original source HTTP status not 200")
        data = response.read(cap + 1)
    if len(data) > cap:
        raise ValueError("Official source response too large")
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    payload = fetch_bounded(OFFICIAL_URL, 95_000_000)
    if hashlib.sha256(payload).hexdigest() != OFFICIAL_SHA:
        raise ValueError("Official archive fingerprint changed")
    reference = CROSSWALK_FILE.read_text(encoding="utf-8")
    crosswalk = load_verified_crosswalk(reference)
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        raw = archive.read("results_pct_20241105.txt").decode("utf-8-sig")
    contest_name, contest_group = discover_unique_historical_presidential_identity(raw)
    stage = stage_zip(payload, manifest={
        "election_date": "2024-11-05",
        "source_url": OFFICIAL_URL,
        "sha256": OFFICIAL_SHA,
        "contest_name": contest_name,
        "contest_group_id": contest_group,
    }, county_fips=crosswalk)
    if stage["county_count"] != 100:
        raise ValueError("Historical replay lacks one or more NC counties")
    observed = {"DEM": 0, "REP": 0}
    for county in stage["counties"]:
        for candidate in county["candidates"]:
            party = candidate["party"]
            if party in observed:
                observed[party] += candidate["votes"]
    if observed != EXPECTED_PRESIDENTIAL:
        raise ValueError("Official historical county totals disagree with certification")
    if stage["production"] or stage["may_move_national_needle"]:
        raise ValueError("Historical replay must never publish a live election result")
    stage["crosswalk_source_url"] = CROSSWALK_SOURCE
    stage["crosswalk_file"] = str(CROSSWALK_FILE)
    stage["crosswalk_sha256"] = hashlib.sha256(reference.encode()).hexdigest()
    stage["historical_certified_major_party_totals"] = observed
    args.output.write_text(json.dumps(stage, indent=2) + "\n")
    print(json.dumps({
        "status": stage["status"],
        "counties": stage["county_count"],
        "source_zip_sha": stage["source"]["archive_sha256"],
        "contest": contest_name,
        "contest_group_id": contest_group,
        "statewide_major_party_totals": observed,
        "may_move_national_needle": False,
    }, indent=2))


if __name__ == "__main__":
    main()
