#!/usr/bin/env python3
"""Verified historical 100-county NC presidential baseline, descriptive ONLY.

Takes the output of the audited real 2024 NCSBE official precinct-ZIP replay.
Never upgrades 2024 presidential county votes into 2026 Senate forecasts.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

from run_nc_official_zip_historical_replay import (
    OFFICIAL_SHA, OFFICIAL_URL, EXPECTED_PRESIDENTIAL, CROSSWALK_SOURCE,
    load_verified_crosswalk,
)

def build(stage, crosswalk_csv):
    if not isinstance(stage,dict) or (
        stage.get("schema")!="nc-official-county-staging-v1" or
        stage.get("status")!="SOURCE_ATTRIBUTED_CANDIDATE_VOTES_STAGED_NOT_LIVE_CERTIFIED" or
        stage.get("production") is not False or
        stage.get("may_move_national_needle") is not False or
        stage.get("county_count")!=100 or not isinstance(stage.get("counties"),list) or
        len(stage["counties"])!=100):
        raise ValueError("Not an audited, complete historical source replay")
    src=stage.get("source",{})
    if (src.get("url")!=OFFICIAL_URL or src.get("archive_sha256")!=OFFICIAL_SHA or
        src.get("archive_member")!="results_pct_20241105.txt" or
        src.get("election_date")!="2024-11-05" or
        not str(src.get("contest_name","")).startswith("US PRESIDENT") or
        not str(src.get("contest_group_id","")).strip() or
        stage.get("crosswalk_source_url")!=CROSSWALK_SOURCE or
        stage.get("crosswalk_sha256")!=hashlib.sha256(crosswalk_csv.encode()).hexdigest() or
        stage.get("historical_certified_major_party_totals")!=EXPECTED_PRESIDENTIAL):
        raise ValueError("Historical ZIP, contest, crosswalk or certified statewide totals disagree")
    crosswalk=load_verified_crosswalk(crosswalk_csv)
    valid=set(crosswalk.values())
    seen=set()
    rows=[]
    statewide={"DEM":0,"REP":0}
    for county in stage["counties"]:
        if not isinstance(county,dict):
            raise ValueError("Invalid county row")
        fips=county.get("county_id")
        if not isinstance(fips,str) or fips not in valid or fips in seen:
            raise ValueError("Unknown or duplicate 2024 NC county identity")
        seen.add(fips)
        candidates=county.get("candidates")
        if not isinstance(candidates,list) or len(candidates)<2:
            raise ValueError("Incomplete historic candidate slate")
        major={}
        for row in candidates:
            if not isinstance(row,dict) or not isinstance(row.get("party"),str):
                raise ValueError("Invalid historical candidate")
            party=row["party"]
            if party not in ("DEM","REP"):
                continue
            if party in major:
                raise ValueError("Duplicate statewide party candidate in county")
            votes=row.get("votes")
            if type(votes) is not int or votes<0:
                raise ValueError("Invalid source vote count")
            major[party]=votes
        if set(major)!=set(statewide) or major["DEM"]+major["REP"]==0:
            raise ValueError("Missing major-party county vote count")
        for party in statewide:
            statewide[party]+=major[party]
        n=major["DEM"]+major["REP"]
        rows.append({
            "county_fips":fips,"president_2024_dem_votes":major["DEM"],
            "president_2024_rep_votes":major["REP"],
            "president_2024_two_party_dem_margin_points":
              round(100*(major["DEM"]-major["REP"])/n,3),
            "president_2024_two_party_votes":n,
        })
    if seen!=valid or statewide!=EXPECTED_PRESIDENTIAL:
        raise ValueError("Historical county sum does not match certified NC state total")
    return {
        "schema":"nc-2024-presidential-county-baseline-v1",
        "status":"VERIFIED_HISTORICAL_OTHER_OFFICE_NOT_LIVE_NEEDLE",
        "election_date":"2024-11-05",
        "office":"President","state":"NC","county_count":100,
        "source":{"url":OFFICIAL_URL,"sha256":OFFICIAL_SHA,
                  "crosswalk_source":CROSSWALK_SOURCE,
                  "crosswalk_sha256":stage["crosswalk_sha256"],
                  "contest_name":src["contest_name"],
                  "contest_group_id":src["contest_group_id"]},
        "certified_presidential_2024":statewide,
        "same_office_as_2026_senate":False,
        "same_office_as_2026_house":False,
        "historical_district_boundaries_claimed_comparable":False,
        "may_move_national_needle":False,
        "ballots_remaining_forecast":None,
        "counties":sorted(rows,key=lambda r:r["county_fips"]),
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--staging",type=Path,required=True)
    parser.add_argument("--crosswalk",type=Path,default=Path("data/nc_2024_county_fips_reference.csv"))
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    stage=json.loads(args.staging.read_text())
    result=build(stage,args.crosswalk.read_text())
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({"status":result["status"],"counties":result["county_count"],
                      "certified":result["certified_presidential_2024"],
                      "national_needle":result["may_move_national_needle"],
                      "output":str(args.output)}))

if __name__=="__main__":
    main()
