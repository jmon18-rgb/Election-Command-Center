#!/usr/bin/env python3
"""Predeclared year-held-out partisan-bias stress test for Senate poll research.

Research-only, NOT a genuine historical ex-ante forecast or a 2026 model
calibration: the upstream retrospective poll compilation lacks independently
verified initial release dates and may have hindsight candidate selection.

We withhold *entire elections*, not merely individual races, when learning a
single national signed-bias correction. The two training election years receive
equal weight so races in the same election are not treated as independent
national-bias observations. Correction factors 0, 0.5, 1 are fixed in advance.
"""
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
INPUT=ROOT/"data/historical_senate_poll_backtest.json"
OUTPUT=ROOT/"data/senate_bias_year_holdout.json"
YEARS=(2020,2022,2024)
FACTORS={"uncorrected":0.0,"half_prior_bias":0.5,"full_prior_bias":1.0}

def verified_rows(source):
    if (not isinstance(source,dict) or source.get("schema_version")!="historical-poll-backtest-v1" or
        source.get("status")!="retrospective_poll_research_not_calibrated_forecast" or
        source.get("is_forecast") is not False or source.get("can_calibrate_2026_win_probabilities") is not False or
        source.get("poll_source_first_publication_dates_available") is not False or
        source.get("cutoff_days_before_election")!=7 or
        not isinstance(source.get("records"),list) or
        source.get("races_evaluated")!=len(source["records"])):
        raise ValueError("Historical Senate retrospective-source integrity gate failed")
    seen=set();by_year=defaultdict(list)
    for row in source["records"]:
        if (not isinstance(row,dict) or row.get("cycle") not in YEARS or
            type(row.get("pollster_count")) is not int or row["pollster_count"]<2 or
            row.get("cutoff_is_fieldwork_only") is not True):
            raise ValueError("Invalid historical Senate race contract")
        year=row["cycle"];state=row.get("state")
        if not isinstance(state,str) or len(state)!=2 or not state.isupper():
            raise ValueError("Invalid Senate state")
        key=(year,state)
        if key in seen:raise ValueError("Duplicate Senate cycle/race")
        seen.add(key)
        method=row.get("methods",{}).get("recency21")
        if not isinstance(method,dict):raise ValueError("Missing fixed recency21 comparison")
        e=method.get("error");poll=method.get("predicted_two_party_margin")
        actual=row.get("actual_two_party_margin")
        if (not all(type(x) in (float,int) and math.isfinite(x) and abs(x)<=100 for x in (e,poll,actual)) or
            abs((poll-actual)-e)>.015):
            raise ValueError("Poll-to-outcome error does not reconcile")
        cutoff=row.get("cutoff")
        field_ends=row.get("field_end_range")
        if (not isinstance(cutoff,str) or not isinstance(field_ends,list) or len(field_ends)!=2 or
            not all(isinstance(x,str) for x in field_ends) or
            field_ends[0]>field_ends[1] or field_ends[1]>cutoff):
            raise ValueError("Historical source has after-cutoff fieldwork")
        by_year[year].append((state,float(e)))
    if set(by_year)!=set(YEARS) or min(map(len,by_year.values()))<2:
        raise ValueError("Each independent election year must contain multiple races")
    # Source's own declared sample counts must match exactly. No synthetic rows.
    if any(source.get("by_year",{}).get(str(year),{}).get("eligible_races")!=len(by_year[year])
           for year in YEARS):
        raise ValueError("Source year/race totals do not reconcile")
    return by_year

def metrics(errors):
    n=len(errors)
    if not n:raise ValueError("Empty error group")
    return {"races":n,
            "mae_points":round(sum(abs(e) for e in errors)/n,3),
            "rmse_points":round(math.sqrt(sum(e*e for e in errors)/n),3),
            "signed_error_points":round(sum(errors)/n,3)}

def build(source,source_sha256=None):
    by_year=verified_rows(source)
    trials={}
    all_errors={method:[] for method in FACTORS}
    for holdout in YEARS:
        train_years=[y for y in YEARS if y!=holdout]
        assert len(train_years)==2 and holdout not in train_years
        # Each election year has one vote in this national common-error mean,
        # regardless of the number of states included in the survey archive.
        train_cycle_means={str(y):sum(e for _,e in by_year[y])/len(by_year[y])
                           for y in train_years}
        prior_bias=sum(train_cycle_means.values())/len(train_cycle_means)
        scores={}
        samples=[e for _,e in by_year[holdout]]
        for method,factor in FACTORS.items():
            corrected=[e-factor*prior_bias for e in samples]
            all_errors[method].extend(corrected)
            scores[method]=metrics(corrected)
            scores[method]["shift_applied_points"]=round(factor*prior_bias,3)
        trials[str(holdout)]={
            "test_cycle":holdout,
            "training_cycles":train_years,
            "training_cycle_signed_errors":{k:round(v,3) for k,v in train_cycle_means.items()},
            "fixed_training_bias_points":round(prior_bias,3),
            "test_races":len(samples),
            "methods":scores,
            "full_prior_bias_mae_improvement_points":round(
                scores["uncorrected"]["mae_points"]-scores["full_prior_bias"]["mae_points"],3),
            "half_prior_bias_mae_improvement_points":round(
                scores["uncorrected"]["mae_points"]-scores["half_prior_bias"]["mae_points"],3)
        }
    pooled={k:metrics(v) for k,v in all_errors.items()}
    for k in ("half_prior_bias","full_prior_bias"):
        pooled[k]["mae_improvement_vs_uncorrected_points"]=round(
            pooled["uncorrected"]["mae_points"]-pooled[k]["mae_points"],3)
        pooled[k]["improved_heldout_cycles"]=sum(
            trials[str(year)][k+"_mae_improvement_points"]>0 for year in YEARS)
    return {
      "schema_version":"senate-bias-holdout-v1",
      "status":"retrospective_leave_election_year_out_research_only",
      "source_poll_study_sha256":source_sha256,
      "source_poll_study_generated_at":source.get("generated_at"),
      "source_race_count":source["races_evaluated"],
      "years":list(YEARS),
      "test_design":"one entire election year held out; equal-weight training-year signed errors",
      "training_and_test_years_never_overlap":True,
      "correction_factors_fixed_in_advance":FACTORS,
      "scoring_units":"two-party Democratic-minus-Republican margin percentage points",
      "by_test_year":trials,
      "all_heldout_races":pooled,
      "is_forecast":False,
      "is_as_of_leakage_free":False,
      "is_statistically_calibrated_for_2026":False,
      "permitted_to_change_live_2026_polling_model":False,
      "limitations":[
        "Only 2020, 2022 and 2024 were evaluated; two independent training election cycles per test are far too few to estimate reliable national polling bias.",
        "The retrospective third-party polling compilation lacks verified original release timestamps; fieldwork-only cutoff is not a real historical as-of knowledge cutoff.",
        "Surviving nominees and included survey questions were curated retrospectively; candidate-selection hindsight remains possible.",
        "The historical poll-only recency21 mean is NOT identical to live JackStradamus pollster-grade, sample-size or sponsorship weighting.",
        "Senate races within an election cycle share national errors and are not 42 independent national-bias observations.",
        "Test-method comparisons are not a green light to tune coefficients on this same three-election dataset; no 2026 correction has been enabled."
      ]
    }

def main():
    raw=INPUT.read_bytes()
    report=build(json.loads(raw),hashlib.sha256(raw).hexdigest())
    if report["source_race_count"]<30 or any(v["test_races"]<8 for v in report["by_test_year"].values()):
        raise ValueError("Historical race count too low for even this exploratory study")
    OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"study":"year-held-out Senate national bias diagnostic",
      "cycles":report["years"],"records":report["source_race_count"],
      "pooled":report["all_heldout_races"],
      "cycles":{y:{"trained_bias":v["fixed_training_bias_points"],
                   "uncorrected_mae":v["methods"]["uncorrected"]["mae_points"],
                   "half_mae":v["methods"]["half_prior_bias"]["mae_points"],
                   "full_mae":v["methods"]["full_prior_bias"]["mae_points"]}
                for y,v in report["by_test_year"].items()}},indent=2))

if __name__=="__main__":main()
