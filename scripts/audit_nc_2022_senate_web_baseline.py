#!/usr/bin/env python3
"""Reconcile website historical NC Senate baseline county by county with the
SHA-pinned original 2022 NCSBE precinct ZIP; no prediction or live results.
"""
import argparse
import csv
import io
import json
from pathlib import Path
from run_nc_2022_senate_historical_replay import (
    OFFICIAL_SENATE_TOTALS, OFFICIAL_URL, PINNED_SHA256,
)

HEADER="county_fips,senate_2022_dem_votes,senate_2022_rep_votes"
GROUP="1378"
CROSSWALK_SHA="de3e129ef1eb3a1c950260eab3b712bf76823a000347099a327539cfd6ff0fd0"

def verify(csv_text, official_replay):
    lines=csv_text.strip().splitlines()
    if (PINNED_SHA256 is None or len(lines)!=103 or
        PINNED_SHA256 not in lines[0] or
        OFFICIAL_URL not in lines[1] or
        "group "+GROUP not in lines[1] or
        "crosswalk SHA256 "+CROSSWALK_SHA not in lines[1] or
        lines[2]!=HEADER):
        raise ValueError("2022 Senate CSV source fingerprint or header rejected")
    reader=csv.DictReader(io.StringIO("\n".join(lines[2:])))
    observed={}
    for row in reader:
        if set(row)!=set(HEADER.split(",")):
            raise ValueError("Unexpected 2022 county CSV columns")
        fips=row["county_fips"]
        if (len(fips)!=5 or not fips.startswith("37") or
            not fips.isdigit() or fips in observed):
            raise ValueError("Bad or duplicate 2022 NC county FIPS")
        d=int(row["senate_2022_dem_votes"])
        r=int(row["senate_2022_rep_votes"])
        if d<0 or r<0 or d+r<=0:
            raise ValueError("Invalid 2022 Senate major-party votes")
        observed[fips]=(d,r)
    if (not isinstance(official_replay,dict) or
        official_replay.get("schema")!="nc-official-2022-senate-replay-v1" or
        official_replay.get("status")!="PINNED_2022_SENATE_100_COUNTIES" or
        official_replay.get("pinned_archive_verified") is not True or
        official_replay.get("observed_archive_sha256")!=PINNED_SHA256 or
        official_replay.get("contest_group_id")!=GROUP or
        official_replay.get("original_url")!=OFFICIAL_URL or
        official_replay.get("crosswalk_sha256")!=CROSSWALK_SHA or
        official_replay.get("candidate_major_totals")!=OFFICIAL_SENATE_TOTALS or
        official_replay.get("county_count")!=100 or
        official_replay.get("may_move_national_needle") is not False or
        len(official_replay.get("counties",[]))!=100):
        raise ValueError("Official 2022 Senate source replay not independently pinned")
    truth={}
    for county in official_replay["counties"]:
        fips=county["county_id"]
        parties={}
        for person in county["candidates"]:
            party=person["party"]
            if party in ("DEM","REP"):
                if party in parties:
                    raise ValueError("Duplicate official party candidate")
                parties[party]=person["votes"]
        if fips in truth or set(parties)!={"DEM","REP"}:
            raise ValueError("Incomplete official Senate county")
        truth[fips]=(parties["DEM"],parties["REP"])
    if len(truth)!=100 or observed!=truth:
        raise ValueError("Published county D/R votes disagree with pinned official 2022 ZIP")
    result={"status":"ALL_100_2022_SENATE_COUNTIES_MATCH_PINNED_ORIGINAL_ZIP",
        "counties":100,"major_party_votes":OFFICIAL_SENATE_TOTALS,
        "historical_only":True,"may_move_national_needle":False}
    return result

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--published-csv",type=Path,required=True)
    p.add_argument("--replay",type=Path,required=True)
    args=p.parse_args()
    print(json.dumps(verify(args.published_csv.read_text(),
        json.loads(args.replay.read_text())),indent=2))
if __name__=="__main__":
    main()
