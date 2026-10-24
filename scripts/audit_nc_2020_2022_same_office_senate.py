#!/usr/bin/env python3
"""Same-office NC 2020→2022 full county Senate geographic variation.

TWO certified final elections: no chronological election night snapshots,
2026 source/turnout denominator, probability calibration or model promotion.
The 2020 county file is only accepted as an output of the SHA-pinned
official NCSBE ZIP importer (the Actions job fetches and checks that ZIP).
"""
import argparse
import json
import math
from pathlib import Path

from build_nc_2020_pinned_senate_county_baseline import (
    ORIGINAL_SHA, PINNED_CROSSWALK_SHA, SENATE_GROUP, SOURCE as SOURCE2020
)
from audit_nc_historical_uniform_swing import (
    extract, SHA2022, OFFICIAL2022
)

FINAL2020=(2_569_965,2_665_598)


def margin(d,r):
    return 100*(d-r)/(d+r)


def compare(baseline2020, csv2022):
    b=baseline2020
    if (not isinstance(b,dict) or
        b.get("schema")!="nc-2020-official-senate-county-baseline-v1" or
        b.get("status")!="SHA_PINNED_HISTORICAL_SENATE_COUNTIES_NOT_2026_NEEDLE" or
        b.get("election_date")!="2020-11-03" or
        b.get("state")!="NC" or b.get("office")!="Senate" or
        b.get("source_url")!=SOURCE2020 or
        b.get("source_sha256")!=ORIGINAL_SHA or
        b.get("county_crosswalk_sha256")!=PINNED_CROSSWALK_SHA or
        b.get("contest_group_id")!=SENATE_GROUP or
        b.get("contest_name")!="US SENATE" or
        b.get("certified_statewide_major_party_votes")!={"DEM":FINAL2020[0],"REP":FINAL2020[1]} or
        b.get("county_count")!=100 or
        b.get("same_office_as_2026_senate") is not True or
        b.get("same_candidates_as_2026_senate") is not False or
        b.get("contains_official_2026_results") is not False or
        b.get("may_move_national_needle") is not False or
        b.get("ballots_remaining_forecast") is not None or
        not isinstance(b.get("counties"),list) or
        len(b["counties"])!=100):
        raise ValueError("Unverified original NCSBE 2020 Senate county baseline")
    older={}
    sum_d=sum_r=0
    for row in b["counties"]:
        if not isinstance(row,dict):
            raise ValueError("Invalid 2020 county row")
        fips=row.get("county_fips")
        d=row.get("senate_2020_dem_votes")
        r=row.get("senate_2020_rep_votes")
        if (not isinstance(fips,str) or not fips.startswith("37") or
            len(fips)!=5 or not fips.isdigit() or fips in older or
            type(d) is not int or type(r) is not int or d<0 or r<0 or d+r<1):
            raise ValueError("Duplicated or invalid official 2020 county identity/votes")
        old_margin=row.get("senate_2020_two_party_dem_margin_points")
        if type(old_margin) not in (int,float) or abs(old_margin-margin(d,r))>0.002:
            raise ValueError("Historical county baseline margin disagreeing with votes")
        older[fips]=(d,r)
        sum_d+=d
        sum_r+=r
    if (sum_d,sum_r)!=FINAL2020:
        raise ValueError("2020 county totals do not match original certified statewide counts")
    newer=extract(csv2022,2022,SHA2022,OFFICIAL2022)
    if set(older)!=set(newer):
        raise ValueError("Two full Senate elections have mismatched county identities")
    delta=margin(*OFFICIAL2022)-margin(*FINAL2020)
    errors=[]
    for fips in sorted(older):
        nvote=sum(newer[fips])
        shift=margin(*newer[fips])-margin(*older[fips])
        errors.append({"fips":fips,"votes_2022":nvote,
                       "margin_shift_points":shift,
                       "uniform_shift_error_points":shift-delta,
                       "prior_2020_county_margin":margin(*older[fips])})
    weight=sum(x["votes_2022"] for x in errors)
    mae=sum(abs(x["uniform_shift_error_points"])*x["votes_2022"] for x in errors)/weight
    rmse=math.sqrt(sum(x["uniform_shift_error_points"]**2*x["votes_2022"] for x in errors)/weight)
    # Hold out 20-counties at a time in the full FINAL-election geographic
    # landscape, stratified by 2020 prior partisanship. This measures
    # heterogeneity, NOT publication time or an election-night forecast.
    prior_sorted=sorted(errors,key=lambda x:(x["prior_2020_county_margin"],x["fips"]))
    bands=[]
    for k in range(5):
        group=prior_sorted[20*k:20*(k+1)]
        w=sum(x["votes_2022"] for x in group)
        avg=sum(x["uniform_shift_error_points"]*x["votes_2022"] for x in group)/w
        bands.append({"prior_margin_quintile":k+1,"counties":len(group),
                      "certified_2022_vote_weight":w,
                      "average_uniform_shift_error_points":round(avg,4)})
    return {
        "schema":"nc-2020-2022-same-office-senate-county-error-v1",
        "historical_comparison":"2020_SENATE_TO_2022_SENATE_COMPLETE_FINAL_COUNTIES",
        "source_2020_zip_sha256":ORIGINAL_SHA,
        "source_2022_zip_sha256":SHA2022,
        "county_count":100,
        "statewide_two_party_margin_change_points":round(delta,4),
        "county_uniform_shift_weighted_mae_points":round(mae,4),
        "county_uniform_shift_weighted_rmse_points":round(rmse,4),
        "county_prior_partisanship_quintiles":bands,
        "both_elections_same_office":True,
        "same_candidates_or_turnout":False,
        "real_chronological_reporting_order_observed":False,
        "ballots_remaining_2026_verified":False,
        "probability_error_calibrated_for_2026":False,
        "may_move_national_needle":False,
        "methodology":"Official full 2020 and 2022 NC Senate county D-R margins, certified 2022 county-vote weights, statewide-uniform-shift error and prior-partisanship stratified descriptive residuals. NO reporting-clock replay.",
    }


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--senate-2020-json",type=Path,required=True)
    parser.add_argument("--senate-2022-csv",type=Path,
                        default=Path("data/nc_2022_senate_county_verified.csv"))
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    data=compare(json.loads(args.senate_2020_json.read_text()),
                 args.senate_2022_csv.read_text())
    args.output.write_text(json.dumps(data,indent=2)+"\n")
    print(json.dumps(data,indent=2))
