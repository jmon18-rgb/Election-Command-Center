#!/usr/bin/env python3
"""Experimental 2026 race odds from *published polling averages* and transparent
observed/assumed election-day errors. This is NOT the chamber forecast.

Actual recently observed Senate retrospective error is sourced from
data/historical_senate_poll_backtest.json (2020, 2022, 2024). The 2026
pollster universe is not an independent holdout, and candidate fundamentals,
unpolled contests and third-party outcomes are not modeled.
"""
import datetime as dt
import json
import math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
POLLS=ROOT/"data/polling_estimates.json"
HIST=ROOT/"data/historical_senate_poll_backtest.json"
DEST=ROOT/"data/race_probabilities.json"
BASE_ASSUMED={"senate":None,"house":7.5,"governor":7.0}

def validate(polls,historical):
    if not isinstance(polls,dict) or polls.get("is_election_forecast") is not False:
        raise ValueError("Not a validated descriptive 2026 poll average file")
    if not polls.get("generated_at") or not isinstance(polls.get("senate_all"),list):
        raise ValueError("Missing source times or Senate polling universe")
    if not historical or historical.get("status")!="retrospective_poll_research_not_calibrated_forecast":
        raise ValueError("Missing historical Senate race-outcome research source")
    if historical.get("races_evaluated")!=42 or historical.get("can_calibrate_2026_win_probabilities") is not False:
        raise ValueError("Historical source identity or research gate changed")
    rmse=historical.get("overall_recency21",{}).get("rmse")
    if type(rmse) not in (int,float) or not math.isfinite(rmse) or not 3.5<=rmse<=10:
        raise ValueError("Impossible or unverifiable historical Senate RMSE")
    return float(rmse)

def normal_cdf(x):
    return (1.0+math.erf(x/math.sqrt(2.0)))/2.0

def race_uncertainty(race,office,base):
    firms=race["contributing_pollsters"]
    ind=race.get("independent_pollsters",0)
    age=(race.get("poll_diagnostics") or {}).get("latest_poll_age_days")
    spread=(race.get("poll_diagnostics") or {}).get("pollster_spread_points")
    if type(firms) is not int or firms<1 or type(ind) is not int or ind<0 or ind>firms:
        raise ValueError("Invalid contributing/independent polling-firm data")
    if type(age) not in (float,int) or not math.isfinite(age) or age<0 or age>366:
        raise ValueError("Unknown last poll fieldwork age")
    # 2020/2022/2024 realized error already includes normal pollster variation.
    # Penalties are deliberately modest rather than giving deep-polled seats
    # false certainty as 2026 nears.
    factor=(1.0 if firms>=5 else 1.08 if firms>=3 else 1.18 if firms==2 else 1.35)
    if ind==0:
        factor*=1.12
    if age>21:
        factor*=1.12
    elif age>14:
        factor*=1.06
    if type(spread) in (int,float) and math.isfinite(spread) and spread>=7:
        factor*=1.09
    return round(base*factor,3),round(factor,3)

def build(polls,historical):
    senate_sigma=validate(polls,historical)
    columns={"senate":polls.get("senate_all",[]),
             "house":polls.get("house",[]),
             "governor":polls.get("governor",[])}
    seen=set()
    rows=[]
    counts={}
    for office,pool in columns.items():
        if not isinstance(pool,list):
            raise ValueError("Polling source office must be an array")
        counted=0
        for race in pool:
            if race.get("status") not in ("multi_poll","single_poll"):continue
            margin=race.get("dem_minus_rep")
            code=race.get("race_code")
            if type(margin) not in (int,float) or not math.isfinite(margin) or abs(margin)>100:
                raise ValueError("Qualifying race lacks a finite two-party margin")
            if not isinstance(code,str) or not code or (office,code) in seen:
                raise ValueError("Duplicate/missing 2026 race identity")
            seen.add((office,code))
            sigma,factor=race_uncertainty(race,office,
                senate_sigma if office=="senate" else BASE_ASSUMED[office])
            chance=100*normal_cdf(margin/sigma)
            low=100*normal_cdf(margin/(sigma*.75))
            high=100*normal_cdf(margin/(sigma*1.25))
            rows.append({
                "office":office,"race_code":code,
                "label":race.get("label") or race.get("state_name") or code,
                "dem_minus_rep":round(float(margin),3),
                "contributing_firms":race["contributing_pollsters"],
                "independent_firms":race["independent_pollsters"],
                "latest_poll_end":race.get("latest_poll_end"),
                "sigma_points":sigma,
                "uncertainty_multiplier":factor,
                "dem_beats_rep_pct":round(chance,2),
                "rep_beats_dem_pct":round(100-chance,2),
                "tight_error_dem_pct":round(low,2),
                "wide_error_dem_pct":round(high,2),
            })
            counted+=1
        counts[office]=counted
    if counts["senate"]<8 or counts["house"]<8 or counts["governor"]<8:
        raise ValueError("Not enough current model races for experimental forecast")
    return {
       "schema_version":"experimental-race-odds-v1",
       "status":"experimental_poll_margin_probability_not_chamber_forecast",
       "generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
       "polling_source_generated_at":polls["generated_at"],
       "polling_source_snapshot":polls.get("source_snapshot"),
       "historical_senate_elections":3,
       "historical_senate_races":historical["races_evaluated"],
       "senate_baseline_rmse_points":round(senate_sigma,3),
       "house_assumed_error_sigma_points":BASE_ASSUMED["house"],
       "governor_assumed_error_sigma_points":BASE_ASSUMED["governor"],
       "normal_error_model":True,"partisan_bias_correction_points":0,
       "probabilities_calibrated_on_2026_outcomes":False,
       "can_infer_chamber_control":False,
       "can_infer_blue_tsunami":False,
       "number_of_races_by_office":counts,
       "records":sorted(rows,key=lambda r:(r["office"],r["race_code"])),
       "limitations":[
         "A per-race experimental chance that the listed Democrat beats the listed Republican based on their published polling-margin average, not an independently backtested 2026 forecast.",
         "Senate sigma is the observed 2020/2022/2024 retrospective Senate polling-vs-final-result RMSE from 42 contests; the historical archive lacks original release timestamps.",
         "House and governor sigmas are explicit assumptions rather than historically estimated errors; uncertainty multipliers increase with sparse, sponsored-only, stale or divergent polling.",
         "This D-versus-R comparison ignores other contenders, caucus affiliations, redistricting, incumbent and candidate fundamentals, and correlated national errors.",
         "No past partisan-bias adjustment is imported; three historical years did not support a reliable year-transferable correction.",
         "These standalone race probabilities cannot be multiplied into Senate, House or four-endings probabilities."
       ]
    }

def main():
    polls=json.loads(POLLS.read_text(encoding="utf-8"))
    old=json.loads(HIST.read_text(encoding="utf-8"))
    report=build(polls,old)
    DEST.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("2026 experimental race odds",report["number_of_races_by_office"],
          "historical Senate RMSE",report["senate_baseline_rmse_points"])

if __name__=="__main__":
    main()
