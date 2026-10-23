#!/usr/bin/env python3
"""Compare deployed 100-county web CSV to the independently replayed official ZIP.
Do not accept a matching statewide total with swapped/misattributed counties.
"""
import argparse
import csv
import io
import json
from pathlib import Path
from run_nc_official_zip_historical_replay import OFFICIAL_SHA, OFFICIAL_URL, EXPECTED_PRESIDENTIAL

HEADER="county_fips,president_2024_dem_votes,president_2024_rep_votes"

def audit(csv_content, verified_baseline):
    lines=csv_content.strip().splitlines()
    if len(lines)!=103 or OFFICIAL_SHA not in lines[0] or OFFICIAL_URL not in lines[1] or HEADER!=lines[2]:
        raise ValueError("Invalid published official-county CSV provenance or row count")
    reader=csv.DictReader(io.StringIO("\n".join(lines[2:])))
    rows={}
    for row in reader:
        if set(row)!=set(HEADER.split(",")) or len(row)!=3:
            raise ValueError("Bad county CSV schema")
        fips=row["county_fips"]
        if fips in rows:
            raise ValueError("Duplicate county FIPS")
        rows[fips]=(
            int(row["president_2024_dem_votes"]),
            int(row["president_2024_rep_votes"])
        )
    if (not isinstance(verified_baseline,dict) or
        verified_baseline.get("schema")!="nc-2024-presidential-county-baseline-v1" or
        verified_baseline.get("may_move_national_needle") is not False or
        verified_baseline.get("county_count")!=100 or
        verified_baseline.get("source",{}).get("sha256")!=OFFICIAL_SHA or
        verified_baseline.get("certified_presidential_2024")!=EXPECTED_PRESIDENTIAL or
        len(rows)!=100):
        raise ValueError("Missing exact official historical replay output")
    expected={
        x["county_fips"]:(
            x["president_2024_dem_votes"],
            x["president_2024_rep_votes"]
        ) for x in verified_baseline["counties"]
    }
    if len(expected)!=100 or rows!=expected:
        raise ValueError("Published historical county votes disagree with replayed official ZIP")
    return {"status":"WEB_COUNTY_BASELINE_MATCHES_AUDITED_2024_NCSBE_ZIP",
            "counties":len(rows),"dem":sum(x[0] for x in rows.values()),
            "rep":sum(x[1] for x in rows.values()),
            "may_move_national_needle":False}

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--published-csv",type=Path,required=True)
    p.add_argument("--replayed-baseline",type=Path,required=True)
    args=p.parse_args()
    print(json.dumps(audit(args.published_csv.read_text(),
                           json.loads(args.replayed_baseline.read_text())),indent=2))
