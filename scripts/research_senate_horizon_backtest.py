#!/usr/bin/env python3
"""Reproducible Senate poll-error versus election horizon study.

Uses publicly downloadable 2020, 2022 and 2024 historical RCP compilation
and MIT candidate returns. It is a FIELDWORK-CUTOFF proxy, *not* a verified
as-of publication-date backtest or a validation of the full 2026 model.
Never calibrate live election probabilities from this module automatically.
"""
import argparse
import csv
import datetime as dt
import io
import json
import math
import re
from collections import defaultdict
from pathlib import Path

import backtest_historical_senate_polls as baseline
import research_rcp_senate_backtest as archive

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/historical_senate_horizon_backtest.json"
HORIZONS=(60,45,30,20,14,10,7,3)
LOOKBACK=45
HALF_LIFE=21
YEAR_FOLDS=(2020,2022,2024)
# Keep 2018 out of the existing production-era research file. The independent
# 2018 extension calls the exact same fieldwork/firm snapshot helpers.
ELECTION_DATES={**baseline.ELECTIONS,2018:dt.date(2018,11,6)}
CANDIDATE_SIGMAS=(6.,7.5,8.5,10.,12.)
# A provisional shrinkage benchmark for out-of-sample research, never a
# 2026 adjustment or a selected best 2026 odds coefficient.
PRIOR_SIGMA=8.5
SHRINKAGE_TO_PRIOR=.5
MIN_INDEPENDENT_FIRMS=2
SOURCE_COLUMNS=archive.FIELDS
FALSE="false"

def r(value,n=3):
    return round(value,n)

def parse_all(texts,years=YEAR_FOLDS):
    """Parse source once without imposing a chosen horizon, preserve only
    fieldwork data with valid states, shares and election-year labels."""
    out=defaultdict(list)
    source_counts={}
    for year in years:
        value=texts.get(year)
        if not value:
            raise ValueError("Missing historical source cycle "+str(year))
        reader=csv.DictReader(io.StringIO(value))
        if not SOURCE_COLUMNS<=set(reader.fieldnames or []):
            raise ValueError("Historical Senate archive schema changed")
        total=0
        for index,row in enumerate(reader,1):
            total+=1
            if str(row.get("year","")).strip()!=str(year):
                raise ValueError("Historical source has incorrect election cycle")
            start=baseline.date_value(row.get("start_date"))
            end=baseline.date_value(row.get("end_date"))
            if start is None or end is None or start>end:
                continue
            state=baseline.NAME_TO_STATE.get(str(row.get("state") or "").strip().lower().replace("-"," "))
            if not state or state in baseline.RACE_EXCLUSIONS:
                continue
            firm=str(row.get("pollster") or "").strip()
            if not firm:
                continue
            try:
                dem=float(row.get("dem") or "")
                rep=float(row.get("rep") or "")
            except ValueError:
                continue
            if not all(math.isfinite(x) and 0<=x<=100 for x in (dem,rep)) or not 55<=dem+rep<=101:
                continue
            out[(year,state)].append({
                "firm":re.sub(r"\*+$","",firm).strip().casefold(),
                "field_start":start,"field_end":end,"margin":baseline.party_margin(dem,rep),
                "population_rank":{"lv":3,"rv":2,"a":1}.get(str(row.get("sample_type") or "").strip().lower(),0),
                "source_row_index":index,
            })
        if total<1 or total>5000:
            raise ValueError("Historical cycle archive outside expected size")
        source_counts[str(year)]=total
    return out,source_counts

def snapshot(observations,year,horizon,lookback=LOOKBACK):
    """Only fieldwork ENDING on or before cutoff can be used.
    Latest survey per firm and recency weighting fixed in advance."""
    cutoff=ELECTION_DATES[year]-dt.timedelta(days=horizon)
    lower=cutoff-dt.timedelta(days=lookback)
    firms={}
    for obs in observations:
        if not lower<=obs["field_end"]<=cutoff:
            continue
        firm=obs["firm"]
        key=(obs["field_end"],obs["population_rank"],obs["source_row_index"])
        if firm not in firms or key>firms[firm][0]:
            firms[firm]=(key,obs)
    selected=[v[1] for v in firms.values()]
    if len(selected)<MIN_INDEPENDENT_FIRMS:
        return None
    weights=[2**(-(cutoff-p["field_end"]).days/HALF_LIFE) for p in selected]
    avg=sum(v["margin"]*w for v,w in zip(selected,weights))/sum(weights)
    return {"margin":r(avg),"pollster_count":len(selected),
      "most_recent_field_end":max(v["field_end"] for v in selected).isoformat(),
      "earliest_field_end":min(v["field_end"] for v in selected).isoformat()}

def prob(margin,sigma):
    if not sigma>0:
        raise ValueError("Nonpositive prediction uncertainty")
    return max(1e-9,min(1-1e-9,.5*math.erfc(-margin/(sigma*math.sqrt(2)))))

def score(rows,sigma):
    if not rows:
        return None
    n=len(rows)
    errors=[x["poll_margin"]-x["actual_margin"] for x in rows]
    brier=0.
    logloss=0.
    correct=0
    coverage=0
    for x,error in zip(rows,errors):
        p=prob(x["poll_margin"],sigma)
        y=int(x["actual_margin"]>0)
        brier+=(p-y)**2
        logloss-=y*math.log(p)+(1-y)*math.log(1-p)
        coverage+=abs(error)<=1.64485362695*sigma
        correct+=(p>=.5)==bool(y)
    return {"races":n,"sigma_points":r(sigma),
       "rmse_points":r(math.sqrt(sum(e*e for e in errors)/n)),
       "signed_error_points":r(sum(errors)/n),
       "mae_points":r(sum(map(abs,errors))/n),
       "brier_score":r(brier/n,4),"log_loss":r(logloss/n,4),
       "nominal_90pct_interval_coverage_pct":r(100*coverage/n,1),
       "covered_races":coverage,"correct_winner_pct":r(100*correct/n,1)}

def score_variable(rows,sigmas):
    if len(rows)!=len(sigmas) or not rows:
        raise ValueError("Invalid heldout probability inputs")
    brier=logloss=coverage=0.
    for row,sigma in zip(rows,sigmas):
        p=prob(row["poll_margin"],sigma)
        y=int(row["actual_margin"]>0)
        error=row["poll_margin"]-row["actual_margin"]
        brier+=(p-y)**2
        logloss-=y*math.log(p)+(1-y)*math.log(1-p)
        coverage+=abs(error)<=1.64485362695*sigma
    n=len(rows)
    return {"races":n,"brier_score":r(brier/n,4),"log_loss":r(logloss/n,4),
      "nominal_90pct_interval_coverage_pct":r(100*coverage/n,1),
      "covered_races":coverage}

def leave_year_out(rows):
    """For each test cycle, calculate sigma ONLY from the OTHER TWO cycles.
    Each horizon is separately fit, but never tune live production parameters."""
    folds=[]
    scored=[]
    for heldout in YEAR_FOLDS:
        train=[x for x in rows if x["cycle"]!=heldout]
        test=[x for x in rows if x["cycle"]==heldout]
        if not train or not test:
            continue
        trained_error=sum((x["poll_margin"]-x["actual_margin"])**2 for x in train)/len(train)
        sigma=math.sqrt(SHRINKAGE_TO_PRIOR*PRIOR_SIGMA**2+
          (1-SHRINKAGE_TO_PRIOR)*trained_error)
        sigma=max(5.,min(15.,sigma))
        folds.append({"test_year":heldout,"training_years":[y for y in YEAR_FOLDS if y!=heldout],
          "training_races":len(train),"test_races":len(test),
          "heldout_sigma_points":r(sigma),"heldout_scores":score_variable(test,[sigma]*len(test))})
        scored.extend((x,sigma) for x in test)
    return {"by_test_year":folds,
     "combined":score_variable([x for x,_ in scored],[sigma for _,sigma in scored]) if scored else None,
     "heldout_races":len(scored)}

def build(texts,outcomes,digests=None):
    polls,source_counts=parse_all(texts)
    results=baseline.load_outcomes(outcomes)
    if not results:
        raise ValueError("No eligible MIT recorded Senate election outcomes")
    horizon_rows={}
    summary=[]
    for horizon in HORIZONS:
        records=[]
        for (year,state),actual in sorted(results.items()):
            sample=snapshot(polls.get((year,state),[]),year,horizon)
            if not sample:
                continue
            records.append({
              "cycle":year,"state":state,"historical_race_id":actual["historical_race_id"],
              "cutoff":(baseline.ELECTIONS[year]-dt.timedelta(days=horizon)).isoformat(),
              "actual_margin":r(actual["actual_margin"]),
              "poll_margin":sample["margin"],
              "pollster_count":sample["pollster_count"],
              "earliest_field_end":sample["earliest_field_end"],
              "latest_field_end":sample["most_recent_field_end"],
              "days_before_election":horizon,
              "fieldwork_only_not_verified_published":True
            })
        horizon_rows[str(horizon)]=records
        by_year={str(y):{"races":len([x for x in records if x["cycle"]==y]),
          "observed_error":score([x for x in records if x["cycle"]==y],7.5)}
          for y in YEAR_FOLDS}
        sigma_scores={str(s).rstrip("0").rstrip("."):score(records,s) for s in CANDIDATE_SIGMAS}
        summary.append({"days_before_election":horizon,
          "race_snapshots":len(records),
          "unique_election_cycles":sum(bool(v["races"]) for v in by_year.values()),
          "by_year":by_year,
          "error_at_7_5pt_sigma":score(records,7.5),
          "candidate_sigma_scores":sigma_scores,
          "leave_one_election_year_out":leave_year_out(records)})
    seven={x["historical_race_id"]:x for x in horizon_rows["7"]}
    same_panel=[]
    for horizon in HORIZONS:
        overlap=[x for x in horizon_rows[str(horizon)] if x["historical_race_id"] in seven]
        same_panel.append({"days_before_election":horizon,
          "matched_races_with_seven_day_cohort":len(overlap),
          "scores_at_7_5pt_sigma":score(overlap,7.5)})
    # This is a research panel. Repeated contest snapshots across horizons
    # are correlated: NEVER claim independent sample count = sum snapshots.
    return {
      "schema_version":"senate-horizon-fieldwork-research-v1",
      "status":"RETROSPECTIVE_FIELDWORK_PROXY_NOT_AS_OF_VALIDATED",
      "generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
      "poll_source":archive.SOURCE,
      "poll_source_license":"Third-party compilation; no explicit license; only derived metrics are republished",
      "poll_source_sha256":digests or {},
      "raw_source_rows_by_year":source_counts,
      "outcomes_source":outcomes["source_url"],
      "outcomes_source_license":outcomes["source_license"],
      "election_cycles":list(YEAR_FOLDS),
      "cutoffs_days_before_election":list(HORIZONS),
      "poll_lookback_days":LOOKBACK,"recency_half_life_days":HALF_LIFE,
      "latest_survey_per_firm":True,
      "min_independent_firms":MIN_INDEPENDENT_FIRMS,
      "fieldwork_cutoff_enforced":True,
      "first_publication_dates_available":False,
      "eventual_general_election_candidates_used_by_source":True,
      "winning_probability_scoring_is_poll_only":True,
      "full_2026_candidate_fundamentals_model_backtested":False,
      "may_automatically_change_live_2026_sigma":False,
      "may_calibrate_2026_probabilities":False,
      "selection_warning":"Some Senate races lack two distinct pollsters at early horizons. All-available samples vary by cutoff; seven-day matched panel is an additional diagnostic.",
      "time_dependency_warning":"These are fieldwork end-date cutoffs, NOT authenticated public release dates. Polls may not have been public by the historical cutoff.",
      "horizon_results":summary,
      "seven_day_cohort_overlap":same_panel,
      "records":horizon_rows,
      "limitations":[
        "No verified first-publication timestamps; not a strict historical as-of production replay.",
        "Archive retrospectively selects eventual general-election candidates, so identity hindsight may remain.",
        "Poll-only error benchmarking, not the full 2026 House/Senate correlated forecast.",
        "Only 2020, 2022, 2024 election cycles. Same-year polling errors are correlated.",
        "Sparse early-horizon contests are missing not assigned artificial zero-margin polling forecasts.",
        "Distinct horizons for the same race are repeated, non-independent observations.",
        "Historical third-party vote shares, unusual ballots and overlapping Senate special elections are excluded by outcome gates.",
        "Do not choose a sigma by minimum in-sample Brier score and immediately ship it to 2026."
      ]
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--no-write",action="store_true",
     help="Validate and summarize using source, without modifying checked-in artifact")
    args=parser.parse_args()
    texts,digests=archive.download()
    outcomes=json.loads((ROOT/"data/senate_history_2020_2022_2024.json").read_text())
    report=build(texts,outcomes,digests)
    assert report["status"]=="RETROSPECTIVE_FIELDWORK_PROXY_NOT_AS_OF_VALIDATED"
    assert len(report["horizon_results"])==len(HORIZONS)
    assert all(h["race_snapshots"]>=0 for h in report["horizon_results"])
    if not args.no_write:
        OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Senate fieldwork-only time-horizon research",[
      {"day":h["days_before_election"],"n":h["race_snapshots"],
       "rmse":h["error_at_7_5pt_sigma"]["rmse_points"] if h["error_at_7_5pt_sigma"] else None}
      for h in report["horizon_results"]])

if __name__=="__main__":
    main()
