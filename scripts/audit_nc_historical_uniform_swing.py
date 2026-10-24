#!/usr/bin/env python3
"""Historical NC uniform-swing assumption audit, with NO 2026 forecast output.

2022 Senate and 2024 presidential full county official vote records are
different offices and contests. Their historical geographic differences are
a descriptive failure-mode check, NOT a calibrated 2026 error model or a
measurement of precinct reporting order.
"""
import argparse
import csv
import io
import json
import math
from pathlib import Path

SHA2022="2024bf67243ef173f54e625c3bace4c8b6f80947fa7d67df26796c2c85d3e9f1"
SHA2024="2fab44e9b12e03c0d88ef832c2e6dc8c569e2b020d64df06a8b551b62bbdb426"
OFFICIAL2022=(1784049,1905786)
OFFICIAL2024=(2715375,2898423)


def extract(raw, year, digest, totals):
    if not isinstance(raw,str) or len(raw)>20000:
        raise ValueError("No bounded historical source")
    lines=raw.strip().splitlines()
    expected=("county_fips,senate_2022_dem_votes,senate_2022_rep_votes" if year==2022 else
              "county_fips,president_2024_dem_votes,president_2024_rep_votes")
    if len(lines)!=103 or digest not in lines[0] or lines[2]!=expected:
        raise ValueError("Historical source digest/schema missing")
    if year==2022:
        if "group 1378" not in lines[1] or "OFFICIAL DEM 1784049 REP 1905786" not in lines[1]:
            raise ValueError("Wrong historical NC 2022 Senate contest")
    else:
        if "contest group 1393" not in lines[1] or "CERTIFIED statewide DEM 2715375 REP 2898423" not in lines[1]:
            raise ValueError("Wrong historical NC 2024 presidential contest")
    parsed={}
    for line in lines[3:]:
        pieces=line.split(",")
        if len(pieces)!=3:
            raise ValueError("Invalid historical county record")
        fips,ds,rs=pieces
        if len(fips)!=5 or not fips.startswith("37") or not fips.isdigit() or fips in parsed:
            raise ValueError("Invalid/duplicated NC county FIPS")
        if not ds.isdigit() or not rs.isdigit() or (len(ds)>10 or len(rs)>10):
            raise ValueError("Noninteger county vote count")
        d,r=int(ds),int(rs)
        if d+r==0:raise ValueError("Zero county votes in full historical return")
        parsed[fips]=(d,r)
    if len(parsed)!=100 or (sum(x[0] for x in parsed.values()),
        sum(x[1] for x in parsed.values()))!=totals:
        raise ValueError("Full 100-county historical certified totals mismatch")
    return parsed


def margin(d,r):
    return 100*(d-r)/(d+r)



def reporting_selection_sensitivity(older, newer):
    """Stress all-county geographic selection; never invent reporting order.

    Since the original election-night publication sequence is unavailable,
    explore intentionally non-chronological *county orderings*. All snapshots
    here are final certified historical county totals, not live precinct data.
    """
    if len(older)!=100 or set(older)!=set(newer):
        raise ValueError("Selection test needs identical complete NC counties")
    weights={fips:sum(newer[fips]) for fips in older}
    total=sum(weights.values())
    shifts={fips:margin(*newer[fips])-margin(*older[fips])
            for fips in older}
    full=sum(weights[f]*shifts[f] for f in older)/total
    prior_margin={fips:margin(*older[fips]) for fips in older}
    orderings={
        "largest_counties_first":sorted(older,key=lambda f:(-weights[f],f)),
        "democratic_baseline_counties_first":sorted(
            older,key=lambda f:(-prior_margin[f],f)),
        "republican_baseline_counties_first":sorted(
            older,key=lambda f:(prior_margin[f],f)),
        "largest_positive_change_first_HINDSIGHT_STRESS":sorted(
            older,key=lambda f:(-shifts[f],f)),
        "largest_negative_change_first_HINDSIGHT_STRESS":sorted(
            older,key=lambda f:(shifts[f],f)),
    }
    thresholds=(.10,.25,.50,.75,.90)
    trials=[]
    for order_name,order in orderings.items():
        if len(order)!=100 or len(set(order))!=100:
            raise ValueError("Repeated county in selection scenario")
        for target in thresholds:
            selected=[]
            count=0
            for fips in order:
                selected.append(fips)
                count+=weights[fips]
                if count/total>=target:
                    break
            subset=sum(weights[f]*shifts[f] for f in selected)/count
            trials.append({
                "selection_order":order_name,
                "selection_target_fraction":target,
                "actual_final_ballot_fraction":round(count/total,4),
                "selected_complete_counties":len(selected),
                "selected_county_shift_points":round(subset,4),
                "all_county_weighted_shift_points":round(full,4),
                "selection_error_points":round(subset-full,4),
                "posthoc_information_used":"HINDSIGHT" in order_name,
                "original_reporting_order_observed":False,
            })
    return {
        "method":"COUNTY_COHORT_SELECTION_NOT_CHRONOLOGICAL_REPLAY",
        "target_fractions":list(thresholds),
        "county_orderings":list(orderings),
        "stress_cases":trials,
        "max_absolute_selection_error_points":round(
            max(abs(x["selection_error_points"]) for x in trials),4),
        "total_verified_final_two_party_votes_2024":total,
        "original_reporting_order_observed":False,
        "valid_uncertainty_calibration":False,
        "may_move_national_needle":False,
    }


def audit(csv2022,csv2024):
    older=extract(csv2022,2022,SHA2022,OFFICIAL2022)
    newer=extract(csv2024,2024,SHA2024,OFFICIAL2024)
    if set(older)!=set(newer):
        raise ValueError("Historical county geography not identical")
    # Even a near-zero STATE change can conceal substantial county movement.
    delta=margin(*OFFICIAL2024)-margin(*OFFICIAL2022)
    errors=[]
    for fips in sorted(older):
        weight=sum(newer[fips])
        actual=margin(*newer[fips])
        predicted=margin(*older[fips])+delta
        errors.append((fips,actual-predicted,weight))
    total=sum(w for _,_,w in errors)
    wae=sum(abs(e)*w for _,e,w in errors)/total
    wrmse=math.sqrt(sum(e*e*w for _,e,w in errors)/total)
    abs_errors=sorted(abs(e) for _,e,_ in errors)
    by_size=sorted(errors,key=lambda x:x[2],reverse=True)
    # Historical county-selection stress: the 10 largest 2024 counties are
    # not necessarily representative of all 100 counties.
    top=by_size[:10]
    top_average=sum(e*w for _,e,w in top)/sum(w for _,_,w in top)
    return {
        "schema":"nc-historical-county-uniform-shift-audit-v1",
        "comparison":"FULL_2022_NC_SENATE_TO_FULL_2024_NC_PRESIDENT",
        "source_2022_sha256":SHA2022,"source_2024_sha256":SHA2024,
        "matched_counties":100,
        "statewide_margin_difference_points":round(delta,4),
        "county_uniform_shift_weighted_mae_points":round(wae,4),
        "county_uniform_shift_weighted_rmse_points":round(wrmse,4),
        "county_absolute_residual_p95_points":round(abs_errors[94],4),
        "ten_largest_county_selection_residual_points":round(top_average,4),
        "hypothetical_whole_county_reporting_selection":
            reporting_selection_sensitivity(older,newer),
        "historical_sampling_order_observed":False,
        "same_office_comparison":False,
        "represents_2026_county_reporting_bias":False,
        "valid_2026_ballots_remaining_denominator":False,
        "valid_2026_probability_error_calibration":False,
        "may_move_national_needle":False,
        "interpretation":"Full 2022 Senate vs full 2024 presidential county deviations reject universal uniform-swing assumptions; cannot estimate 2026 late ballots or probabilistic residual uncertainty.",
    }


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--senate-2022",type=Path,default=Path("data/nc_2022_senate_county_verified.csv"))
    p.add_argument("--president-2024",type=Path,default=Path("data/nc_2024_presidential_county_verified.csv"))
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    result=audit(args.senate_2022.read_text(),args.president_2024.read_text())
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))


if __name__=="__main__":
    main()
