#!/usr/bin/env python3
"""Pin real audited 2020 NC Senate county totals for historical comparison.

Only the original NCSBE ZIP with the observed SHA and exact Senate contest
is allowed. Unlike the prior discovery artifact this output is source-pinned,
but it NEVER estimates partial ballots, 2026 returns or national probabilities.
"""
import argparse
import hashlib
import json
from pathlib import Path

from audit_nc_2020_senate_official_zip import (
    SOURCE,CERTIFIED,inspect,fetch,
)
from run_nc_official_zip_historical_replay import load_verified_crosswalk

ORIGINAL_SHA="b388536c61930d03ed3b0fb8d1dae39a65665969f90eeb6578512de0d96c47c0"
SENATE_GROUP="1374"
SENATE_CONTEST="US SENATE"
PINNED_CROSSWALK_SHA="de3e129ef1eb3a1c950260eab3b712bf76823a000347099a327539cfd6ff0fd0"
CANDIDATES={"DEM":"Cal Cunningham","REP":"Thom Tillis"}

def build(audit,crosswalk_csv):
    if (not isinstance(audit,dict) or
        audit.get("schema")!="nc-2020-senate-zip-source-audit-v1" or
        audit.get("source_url")!=SOURCE or
        audit.get("archive_sha256_discovered")!=ORIGINAL_SHA or
        audit.get("contest_name_discovered")!=SENATE_CONTEST or
        audit.get("contest_group_id_discovered")!=SENATE_GROUP or
        audit.get("election_date")!="2020-11-03" or
        audit.get("county_count")!=100 or
        audit.get("certified_statewide_major_party_votes")!=CERTIFIED or
        audit.get("may_move_national_needle") is not False or
        not isinstance(audit.get("historical_counties"),list) or
        len(audit["historical_counties"])!=100):
        raise ValueError("Unpinned or incomplete official 2020 Senate archive")
    if hashlib.sha256(crosswalk_csv.encode()).hexdigest()!=PINNED_CROSSWALK_SHA:
        raise ValueError("Historical county-FIPS crosswalk fingerprint changed")
    crosswalk=load_verified_crosswalk(crosswalk_csv)
    expected_fips=set(crosswalk.values())
    seen=set()
    observed={"DEM":0,"REP":0}
    rows=[]
    for county in audit["historical_counties"]:
        fips=county.get("county_id")
        if fips not in expected_fips or fips in seen:
            raise ValueError("Duplicate or missing county FIPS")
        seen.add(fips)
        candidates=county.get("candidates")
        if not isinstance(candidates,list):
            raise ValueError("Missing official Senate candidates")
        majors={}
        for c in candidates:
            if not isinstance(c,dict):
                raise ValueError("Malformed official candidate")
            party=c.get("party")
            if party in CANDIDATES:
                if party in majors or c.get("name")!=CANDIDATES[party] or (
                    type(c.get("votes")) is not int or c["votes"]<0):
                    raise ValueError("Wrong official Senate candidate or duplicate party")
                majors[party]=c["votes"]
        if set(majors)!=set(CANDIDATES) or majors["DEM"]+majors["REP"]<=0:
            raise ValueError("No valid same-office county Senate vote pair")
        d,r=majors["DEM"],majors["REP"]
        observed["DEM"]+=d;observed["REP"]+=r
        rows.append({"county_fips":fips,"senate_2020_dem_votes":d,
          "senate_2020_rep_votes":r,
          "senate_2020_two_party_dem_margin_points":round(100*(d-r)/(d+r),3)})
    if seen!=expected_fips or observed!=CERTIFIED:
        raise ValueError("Pinned official 2020 Senate county statewide totals mismatched")
    return {"schema":"nc-2020-official-senate-county-baseline-v1",
      "status":"SHA_PINNED_HISTORICAL_SENATE_COUNTIES_NOT_2026_NEEDLE",
      "office":"Senate","election_date":"2020-11-03","state":"NC",
      "county_count":100,"source_url":SOURCE,
      "source_sha256":ORIGINAL_SHA,"contest_name":SENATE_CONTEST,
      "contest_group_id":SENATE_GROUP,
      "county_crosswalk_sha256":hashlib.sha256(crosswalk_csv.encode()).hexdigest(),
      "certified_statewide_major_party_votes":observed,
      "same_office_as_2026_senate":True,
      "same_candidates_as_2026_senate":False,
      "contains_official_2026_results":False,
      "ballots_remaining_forecast":None,
      "may_move_national_needle":False,
      "counties":sorted(rows,key=lambda x:x["county_fips"])}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--crosswalk",type=Path,default=Path("data/nc_2024_county_fips_reference.csv"))
    args=p.parse_args()
    crosswalk=args.crosswalk.read_text()
    original_zip=fetch()
    if hashlib.sha256(original_zip).hexdigest()!=ORIGINAL_SHA:
        raise ValueError("Pinned original 2020 NCSBE ZIP fingerprint changed")
    audit=inspect(original_zip,load_verified_crosswalk(crosswalk))
    baseline=build(audit,crosswalk)
    args.output.write_text(json.dumps(baseline,indent=2)+"\n")
    print(json.dumps({"status":baseline["status"],
       "source_sha256":baseline["source_sha256"],
       "counties":baseline["county_count"],
       "certified":baseline["certified_statewide_major_party_votes"],
       "may_move_national_needle":False},indent=2))

if __name__=="__main__":
    main()
