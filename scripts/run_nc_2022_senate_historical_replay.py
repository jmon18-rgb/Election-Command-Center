#!/usr/bin/env python3
"""Reconcile official 2022 NC Senate county votes; never live 2026 results.

The initial discovery run prints the S3 archive SHA and exact contest identity
but DOES NOT certify a source pin or publish model-ready baselines. To become a
verified comparison, the observed SHA must be independently reviewed and
hard-pinned in a later commit, then replayed against this evidence.
"""
import argparse
import csv
import hashlib
import io
import json
import urllib.request
import zipfile
from pathlib import Path

from nc_official_zip_staging_bridge import stage_zip
from run_nc_official_zip_historical_replay import (
    CROSSWALK_FILE, CROSSWALK_SOURCE, load_verified_crosswalk,
)

OFFICIAL_URL = "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2022_11_08/results_pct_20221108.zip"
MEMBER = "results_pct_20221108.txt"
OFFICIAL_DATE = "2022-11-08"
# Independently cross-check against Nov 8, 2022 NCSBE official statewide
# results dashboard: https://er.ncsbe.gov/?election_dt=11%2F08%2F2022
OFFICIAL_SENATE_TOTALS = {"DEM": 1_784_049, "REP": 1_905_786}
# Must be reviewed against the publicly observed archive before activation.
PINNED_SHA256 = None


def inspect_original(payload, fips, pinned_sha=None):
    if not isinstance(payload, bytes) or not 0 < len(payload) <= 95_000_000:
        raise ValueError("Missing or oversized real official 2022 ZIP")
    actual = hashlib.sha256(payload).hexdigest()
    if pinned_sha is not None and actual != pinned_sha:
        raise ValueError("Actual 2022 ZIP differs from independently reviewed SHA")
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        members = archive.infolist()
        if len(members) != 1 or members[0].filename != MEMBER or (
            members[0].file_size > 150_000_000 or members[0].is_dir()
        ):
            raise ValueError("Unexpected original official 2022 ZIP members")
        raw = archive.read(MEMBER).decode("utf-8-sig")
    possible=set()
    reader=csv.DictReader(io.StringIO(raw), delimiter="\t")
    for row in reader:
        name=(row.get("Contest Name") or "").strip()
        if (row.get("Election Date")=="11/08/2022" and
            name.startswith("US SENATE") and
            (row.get("Contest Group ID") or "").strip()):
            possible.add((name, row["Contest Group ID"].strip()))
    if len(possible)!=1:
        raise ValueError("Original 2022 US Senate group ID is missing or ambiguous")
    name,group=next(iter(possible))
    staged=stage_zip(payload,manifest={
        "election_date":OFFICIAL_DATE,"source_url":OFFICIAL_URL,
        "sha256":actual,"contest_name":name,"contest_group_id":group,
    },county_fips=fips)
    if staged["county_count"]!=100:
        raise ValueError("2022 Senate ZIP is missing one or more NC counties")
    major={"DEM":0,"REP":0}
    for county in staged["counties"]:
        found=set()
        for cand in county["candidates"]:
            party=cand["party"]
            if party in major:
                if party in found:
                    raise ValueError("Duplicate major party candidate in county")
                found.add(party);major[party]+=cand["votes"]
        if found!=set(major):
            raise ValueError("2022 Senate county major candidate votes missing")
    if major!=OFFICIAL_SENATE_TOTALS:
        raise ValueError("Original NCSBE 2022 US Senate totals disagree with official dashboard")
    if staged["production"] or staged["may_move_national_needle"]:
        raise ValueError("Historical ZIP cannot promote a live model")
    crosswalk=Path(CROSSWALK_FILE).read_bytes()
    return {
        "schema":"nc-official-2022-senate-replay-v1",
        "status":("PINNED_2022_SENATE_100_COUNTIES" if pinned_sha else
                  "ORIGINAL_S3_2022_SENATE_ARCHIVE_DISCOVERY_ONLY_UNPINNED"),
        "election_date":OFFICIAL_DATE,"office":"Senate","state":"NC",
        "original_url":OFFICIAL_URL,"observed_archive_sha256":actual,
        "contest_name":name,"contest_group_id":group,
        "crosswalk_source":CROSSWALK_SOURCE,
        "crosswalk_sha256":hashlib.sha256(crosswalk).hexdigest(),
        "candidate_major_totals":major,"counties":staged["counties"],
        "county_count":100,"same_office_as_2026_nc_senate":True,
        "automated_2026_forecast_eligible":False,
        "may_move_national_needle":False,
        "pinned_archive_verified":pinned_sha is not None,
    }


def main():
    arg=argparse.ArgumentParser()
    arg.add_argument("--discover",action="store_true")
    arg.add_argument("--output",required=True,type=Path)
    args=arg.parse_args()
    if not args.discover and PINNED_SHA256 is None:
        raise ValueError("No independently reviewed 2022 ZIP SHA pinned yet")
    fips=load_verified_crosswalk(CROSSWALK_FILE.read_text())
    req=urllib.request.Request(OFFICIAL_URL,headers={
        "User-Agent":"ElectionCommandCenter/1.0 NC2022SenateHistoricalAudit",
    })
    with urllib.request.urlopen(req,timeout=50) as response:
        if response.status!=200:
            raise ValueError("NCSBE official 2022 ZIP returned non-200")
        data=response.read(95_000_001)
    result=inspect_original(data,fips,None if args.discover else PINNED_SHA256)
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({
        "status":result["status"],
        "observed_archive_sha256":result["observed_archive_sha256"],
        "contest_name":result["contest_name"],
        "contest_group_id":result["contest_group_id"],
        "counties":result["county_count"],
        "official_major_party_votes":result["candidate_major_totals"],
        "independent_SHA_pin_active":result["pinned_archive_verified"],
        "may_move_national_needle":False,
    },indent=2))


if __name__=="__main__":
    main()
