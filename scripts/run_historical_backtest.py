#!/usr/bin/env python3
"""Compare archived Senate polls to independently published election returns."""
import csv,io,json,math,re,urllib.request
from collections import defaultdict
from datetime import date,timedelta
from pathlib import Path

POLL_URL="https://raw.githubusercontent.com/Jack-Whitcomb/All-US-Senate-polls-2006-2024/main/2006_to_2024_senate_polls_with_actuals.csv"
RESULT_URL="https://raw.githubusercontent.com/fivethirtyeight/election-results/main/election_results_senate.csv"
YEARS=(2010,2012,2014,2016,2018,2020,2022,2024)
METHODS=("equal","recency21","recency21_size","recency35_size")
ROOT=Path(__file__).resolve().parents[1]

def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"ElectionCommandCenter-Research/1.0"})
    with urllib.request.urlopen(req,timeout=60) as response: raw=response.read(10_000_001)
    if len(raw)>10_000_000:raise ValueError("Dataset exceeds safety limit")
    return list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))

def election_day(year):
    nov1=date(year,11,1)
    return nov1+timedelta(days=(0-nov1.weekday())%7+1)

def official_outcomes(rows):
    grouped=defaultdict(lambda:defaultdict(lambda:{"D":0.,"R":0.,"ranked":False,"other_won":False}))
    for row in rows:
        try:
            year=int(row["cycle"])
            if year not in YEARS or row["stage"]!="general" or row["special"]!="false":continue
            race=grouped[(year,row["state"].strip().lower())][row["race_id"]]
            if row["ranked_choice_round"] not in ("","1"):race["ranked"]=True
            if row["winner"]=="true" and row["ballot_party"] not in ("DEM","REP"):race["other_won"]=True
            if row["ballot_party"] in ("DEM","REP"):race["D" if row["ballot_party"]=="DEM" else "R"]+=float(row["votes"] or 0)
        except (ValueError,KeyError):continue
    result={}
    for key,races in grouped.items():
        if len(races)!=1:continue
        r=next(iter(races.values()))
        if r["D"]>0 and r["R"]>0 and not r["ranked"] and not r["other_won"]:
            result[key]=100*(r["D"]-r["R"])/(r["D"]+r["R"])
    return result

def summarize(rows):
    result={}
    for method in METHODS:
        errors=[r["error"] for r in rows if r["method"]==method]
        if errors:result[method]={"n":len(errors),"mae":round(sum(abs(e) for e in errors)/len(errors),3),"bias":round(sum(errors)/len(errors),3)}
    return result

def run(polls,official):
    groups=defaultdict(list)
    discrepancies={}
    for p in polls:
        try:
            key=(int(p["year"]),p["state"].strip().lower())
            if key not in official:continue
            d,r=float(p["dem_actual"]),float(p["rep_actual"])
            if d<=0 or r<=0:continue
            bundled=100*(d-r)/(d+r)
            if abs(bundled-official[key])>.2:
                discrepancies[key]={"year":key[0],"state":key[1],"difference":round(bundled-official[key],3)}
                continue
            groups[key].append(p)
        except (KeyError,ValueError,TypeError):continue
    evaluations=[]
    for (year,state),rows in sorted(groups.items()):
        cutoff=election_day(year)-timedelta(days=8)
        eligible=[]
        for p in rows:
            try:
                end=date.fromisoformat(p["end_date"].replace("/","-"))
                d,r=float(p["dem"]),float(p["rep"])
                if d<=0 or r<=0 or not 0<=(cutoff-end).days<=45:continue
                if re.search(r"\([DR]\)\*?",p["pollster"]):continue
                eligible.append((end,p,d,r))
            except (ValueError,KeyError,TypeError):continue
        latest={}
        for end,p,d,r in sorted(eligible,key=lambda x:x[0],reverse=True):
            latest.setdefault(p["pollster"].strip().casefold(),(end,p,d,r))
        if len(latest)<2:continue
        for method in METHODS:
            weighted=weight=0.
            for end,p,d,r in latest.values():
                age=(cutoff-end).days
                w=1 if method=="equal" else .5**(age/(35 if method=="recency35_size" else 21))
                if "size" in method:
                    try:n=float(p["sample_size"])
                    except (ValueError,TypeError):n=600
                    w*=math.sqrt(max(200,min(3000,n or 600))/600)
                weighted+=w*100*(d-r)/(d+r)
                weight+=w
            evaluations.append({"year":year,"state":state,"method":method,"error":weighted/weight-official[(year,state)]})
    return evaluations,list(discrepancies.values())

def leave_one_year_out(evaluations):
    """Select parameters using only other cycles, then score held-out year.

    Each Senate race contributes one observation per method. Parameter selection
    uses training-cycle MAE only, with a fixed alphabetical tie-breaker.
    This is cross-validation, not a genuinely prospective forecast backtest.
    """
    by_method_year=defaultdict(list)
    for row in evaluations:
        by_method_year[(row["method"],row["year"])].append(row)
    years=sorted({row["year"] for row in evaluations})
    folds=[]
    for heldout in years:
        training=[r for r in evaluations if r["year"]!=heldout]
        test=[r for r in evaluations if r["year"]==heldout]
        training_years=sorted({r["year"] for r in training})
        if len(training_years)<2 or not test:continue
        methods=sorted({r["method"] for r in training})
        # Restrict training to race keys present for every candidate method.
        train_keys={m:{(r["year"],r["state"]) for r in training if r["method"]==m} for m in methods}
        common=set.intersection(*train_keys.values())
        if not common:continue
        train=[r for r in training if (r["year"],r["state"]) in common]
        train_scores={m:sum(abs(r["error"]) for r in train if r["method"]==m)/len(common) for m in methods}
        selected=min(methods,key=lambda m:(train_scores[m],m))
        test_keys={m:{(r["year"],r["state"]) for r in test if r["method"]==m} for m in methods}
        test_common=set.intersection(*test_keys.values())
        held=[r for r in test if (r["year"],r["state"]) in test_common]
        selected_errors=[r["error"] for r in held if r["method"]==selected]
        equal_errors=[r["error"] for r in held if r["method"]=="equal"]
        if not selected_errors or not equal_errors:continue
        folds.append({
            "held_out_year":heldout,"training_years":training_years,
            "training_races":len(common),"held_out_races":len(test_common),
            "selected_method":selected,
            "training_mae_by_method":{m:round(v,3) for m,v in train_scores.items()},
            "held_out_selected_mae":round(sum(map(abs,selected_errors))/len(selected_errors),3),
            "held_out_equal_mae":round(sum(map(abs,equal_errors))/len(equal_errors),3),
            "held_out_selected_bias":round(sum(selected_errors)/len(selected_errors),3),
            "held_out_equal_bias":round(sum(equal_errors)/len(equal_errors),3),
        })
    if not folds:return {"status":"insufficient_data","folds":[]}
    n=sum(f["held_out_races"] for f in folds)
    return {"status":"completed","protocol":"Leave-one-election-year-out, train on other available cycles, test on held-out cycle; equal weighting as baseline",
            "note":"Uses future cycles to train some folds, so it is not a forward-only test. No per-race predictions are used to select a model.",
            "folds":folds,
            "pooled_held_out_races":n,
            "pooled_selected_mae":round(sum(f["held_out_selected_mae"]*f["held_out_races"] for f in folds)/n,3),
            "pooled_equal_mae":round(sum(f["held_out_equal_mae"]*f["held_out_races"] for f in folds)/n,3)}

def forward_year_holdouts(evaluations):
    """Stricter chronological selection: only earlier cycles may train."""
    years=sorted({r["year"] for r in evaluations})
    folds=[]
    for heldout in years[1:]:
        training=[r for r in evaluations if r["year"]<heldout]
        test=[r for r in evaluations if r["year"]==heldout]
        methods=sorted({r["method"] for r in evaluations})
        train_keys={m:{(r["year"],r["state"]) for r in training if r["method"]==m} for m in methods}
        common=set.intersection(*train_keys.values())
        if not common:continue
        scores={m:sum(abs(r["error"]) for r in training if r["method"]==m and (r["year"],r["state"]) in common)/len(common) for m in methods}
        chosen=min(methods,key=lambda m:(scores[m],m))
        held={m:[r for r in test if r["method"]==m] for m in methods}
        if not held[chosen] or not held["equal"]:continue
        folds.append({"held_out_year":heldout,"training_years":[y for y in years if y<heldout],
            "selected_method":chosen,"training_races":len(common),"held_out_races":len(held[chosen]),
            "selected_mae":round(sum(abs(r["error"]) for r in held[chosen])/len(held[chosen]),3),
            "equal_mae":round(sum(abs(r["error"]) for r in held["equal"])/len(held["equal"]),3)})
    return {"status":"completed" if folds else "insufficient_data","folds":folds,
            "warning":"Early folds have limited training history; evaluate modern-era results separately."}

def correlated_error_diagnostics(evaluations):
    """Estimate common election-year error vs within-year race residuals.

    Correlation cannot be estimated reliably from four election-year clusters;
    these are descriptive variance components, not a calibrated covariance
    matrix or simulation-ready Senate-control forecast.
    """
    chosen=[r for r in evaluations if r["method"]=="recency21_size"]
    by_year=defaultdict(list)
    for row in chosen:by_year[row["year"]].append(row)
    years=sorted(by_year)
    if len(years)<3:return {"status":"insufficient_years","years":len(years)}
    means={y:sum(r["error"] for r in by_year[y])/len(by_year[y]) for y in years}
    overall=sum(r["error"] for r in chosen)/len(chosen)
    centered_year=[means[y]-sum(means.values())/len(means) for y in years]
    year_sd=(sum(v*v for v in centered_year)/(len(years)-1))**.5
    within=[r["error"]-means[r["year"]] for r in chosen]
    within_sd=(sum(x*x for x in within)/(len(within)-len(years)))**.5 if len(within)>len(years) else None
    # Equal-year weighting prevents years with more sampled races from
    # mechanically dominating the between-year variance estimate.
    return {"status":"descriptive_only","method":"recency21_size",
        "years":years,"n_races":len(chosen),
        "year_mean_errors":{str(y):round(means[y],3) for y in years},
        "overall_race_weighted_bias":round(overall,3),
        "between_year_mean_sd":round(year_sd,3),
        "within_year_residual_sd":round(within_sd,3) if within_sd is not None else None,
        "interpretation":"Between-year dispersion suggests shared national polling error; within-year dispersion captures remaining state-specific and measurement variation.",
        "warnings":["Four years are insufficient for stable national-error variance calibration.",
            "The year-level standard deviation includes changes in race composition and sampling noise.",
            "Do not convert these components into election-win probabilities without additional holdout validation.",
            "No region/state covariance matrix estimated; only one observation per race-year."]}

def historical_interval_coverage(evaluations):
    """Forward-only coverage of empirical polling margin error intervals."""
    def quantile(values, probability):
        values=sorted(values)
        position=(len(values)-1)*probability
        lower=int(position)
        upper=min(lower+1,len(values)-1)
        return values[lower]+(values[upper]-values[lower])*(position-lower)

    years=sorted({r["year"] for r in evaluations})
    folds=[]
    for year in years[1:]:
        training=[r for r in evaluations if r["year"]<year]
        testing=[r for r in evaluations if r["year"]==year]
        candidates=sorted({r["method"] for r in training})
        if not candidates:continue
        scores={method:sum(abs(r["error"]) for r in training if r["method"]==method)/
                sum(r["method"]==method for r in training) for method in candidates}
        selected=min(candidates,key=lambda method:(scores[method],method))
        past=[r["error"] for r in training if r["method"]==selected]
        future=[r["error"] for r in testing if r["method"]==selected]
        if len(past)<10 or not future:continue
        intervals={}
        for level in (80,90):
            alpha=(100-level)/200
            lo=quantile(past,alpha)
            hi=quantile(past,1-alpha)
            hits=sum(lo<=error<=hi for error in future)
            intervals[str(level)]={"lower":round(lo,3),"upper":round(hi,3),
                "covered":hits,"total":len(future),"coverage":round(hits/len(future),3)}
        folds.append({"held_out_year":year,"selected_method":selected,
            "training_races":len(past),"test_races":len(future),"intervals":intervals})
    total=sum(fold["test_races"] for fold in folds)
    pooled={}
    for level in ("80","90"):
        covered=sum(fold["intervals"][level]["covered"] for fold in folds)
        pooled[level]={"covered":covered,"total":total,
            "coverage":round(covered/total,3) if total else None}
    return {"status":"completed" if folds else "insufficient_data",
        "folds":folds,"pooled_coverage":pooled,
        "note":"Descriptive forward-tested margin-error coverage, not candidate victory probabilities. Observations within an election year are correlated."}


def main():
    official=official_outcomes(fetch(RESULT_URL))
    evaluations,discrepancies=run(fetch(POLL_URL),official)
    if not evaluations:raise RuntimeError("No matched historical races")
    result={"status":"independently_crosschecked_preliminary","source_polls":POLL_URL,"source_election_results":RESULT_URL,
        "method":"8 days before election; 45-day lookback; latest poll per pollster; at least two pollsters; D-R two-party normalized margin",
        "official_races_eligible":len(official),"matched_poll_races":len({(r["year"],r["state"]) for r in evaluations}),
        "n_evaluations":len(evaluations),"overall":summarize(evaluations),
        "by_year":{str(y):summarize([r for r in evaluations if r["year"]==y]) for y in YEARS},
        "bundled_result_discrepancies":discrepancies,
        "leave_one_year_out":leave_one_year_out(evaluations),
        "forward_year_holdouts":forward_year_holdouts(evaluations),
        "correlated_error_diagnostics":correlated_error_diagnostics(evaluations),
        "historical_interval_coverage":historical_interval_coverage(evaluations),
        "modern_era_2018_onward":summarize([r for r in evaluations if r["year"]>=2018]),
        "midterm_cycles":summarize([r for r in evaluations if r["year"]%4==2]),
        "presidential_cycles":summarize([r for r in evaluations if r["year"]%4==0]),
        "limitations":["Not an election forecast.","Excludes special, multiple-seat, ranked-choice and independent-winner races.","Coverage differs by year; candidate-name validation remains incomplete.","Partisan-sponsored poll exclusion relies on pollster-name labels."]}
    out=ROOT/"data"/"historical_verified.json"
    out.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print("Historical results:",result["matched_poll_races"],"races",result["overall"])

if __name__=="__main__":main()
