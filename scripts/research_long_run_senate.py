#!/usr/bin/env python3
"""Ten-cycle Senate polling error diagnostic with STRICT chronological training.

2026 forecast is not changed. This uses a retrospectively assembled third-party
polling compilation; it lacks first-publication dates, so this is NOT a genuine
ex-ante prediction or calibrated election probability model.

The study retains only derived aggregate polling errors; no survey CSV is
republished. MIT/MEDSL vote returns originate from a CC0 historical dataset.
"""
import csv
import datetime as dt
import hashlib
import io
import json
import math
import re
import urllib.request
from collections import defaultdict
from pathlib import Path

import stage_senate_history as medsl
import backtest_historical_senate_polls as legacy

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"data/senate_long_run_walk_forward.json"
SOURCE="https://github.com/Jack-Whitcomb/All-US-Senate-polls-2006-2024"
RAW="https://raw.githubusercontent.com/Jack-Whitcomb/All-US-Senate-polls-2006-2024/main/"
YEARS=tuple(range(2006,2025,2))
ELECTION_DATES={
  2006:dt.date(2006,11,7),2008:dt.date(2008,11,4),
  2010:dt.date(2010,11,2),2012:dt.date(2012,11,6),
  2014:dt.date(2014,11,4),2016:dt.date(2016,11,8),
  2018:dt.date(2018,11,6),2020:dt.date(2020,11,3),
  2022:dt.date(2022,11,8),2024:dt.date(2024,11,5)}
POLL_FIELDS={"pollster","start_date","end_date","year","state","dem","rep"}
CUTOFF_DAYS=7
LOOKBACK_DAYS=45
HALF_LIFE=21
MIN_FIRMS=2
MIN_TRAIN_YEARS=3
METHODS={"none":0.0,"half_prior_bias":0.5,"full_prior_bias":1.0}

def fetch_polls(opener=urllib.request.urlopen):
    texts={};checksums={}
    for year in YEARS:
        url=RAW+str(year)+"_senate_polls.csv"
        req=urllib.request.Request(url,headers={"User-Agent":"BlueWavesHistoricalResearch/1.0"})
        with opener(req,timeout=45) as response:
            payload=response.read(2_500_001)
        if not 200<len(payload)<=2_500_000:
            raise ValueError(f"Historical polling download corrupted or incomplete in {year}")
        text=payload.decode("utf-8-sig")
        if not text.startswith("pollster,start_date,end_date,"):
            raise ValueError(f"Historical polling CSV schema replaced in {year}")
        checksums[str(year)]=hashlib.sha256(payload).hexdigest()
        texts[year]=text
    return texts,checksums

def extract_outcomes(original_mit):
    if not isinstance(original_mit,dict) or original_mit.get("status")!="historical_senate_results_research_only" or (
      original_mit.get("years")!=list(YEARS) or original_mit.get("is_election_forecast") is not False or
      original_mit.get("source_doi")!="doi:10.7910/DVN/PEJ5QU"):
        raise ValueError("Wrong MIT/MEDSL Senate voting record coverage")
    records=original_mit.get("contest_records",[])
    if len(records)!=original_mit.get("contest_count") or len(records)<300:
        raise ValueError("Missing Senate outcome records in source")
    keyed=defaultdict(list)
    for row in records:
        year,state=row["election_year"],row["state"]
        if year not in YEARS or state not in medsl.STATE_CODES:
            raise ValueError("Malformed MIT historic race key")
        keyed[(year,state)].append(row)
    filtered={};audit={"contested_state_years":len(keyed),"ambiguous_regular_special":0,
                         "missing_major_party":0,"large_third_party_share":0}
    for key,items in keyed.items():
        if len(items)!=1:
            audit["ambiguous_regular_special"]+=1
            continue
        row=items[0]
        d,r,o=row["recorded_dem_votes"],row["recorded_rep_votes"],row["recorded_other_votes"]
        if not all(type(x) is int and x>=0 for x in (d,r,o)) or d+r+o!=row["recorded_total_candidate_votes"]:
            raise ValueError("Historic candidate totals failed to reconcile")
        if row["missing_major_party_vote"] or not d or not r:
            audit["missing_major_party"]+=1;continue
        if o/(d+r+o)>.20:
            audit["large_third_party_share"]+=1;continue
        # Alaska uses divergent rank-choice/top-four ballots in the later cycles.
        if key[1]=="AK":continue
        filtered[key]=100*(d-r)/(d+r)
    return filtered,audit

def process_polls(year_texts):
    """No unknown election date, invalid chronology or after-cutoff fieldwork."""
    grouped=defaultdict(list);audit={"raw_source_rows":{},"window_eligible_rows":{},
           "invalid_date_rows":{},"invalid_party_share_rows":{}}
    for year in YEARS:
        content=year_texts.get(year)
        if not content:raise ValueError("Missing historical survey cycle "+str(year))
        reader=csv.DictReader(io.StringIO(content))
        if not POLL_FIELDS<=set(reader.fieldnames or []):
            raise ValueError("Historic Senate poll source columns unexpectedly changed")
        raw=0;count=0;date_errors=0;vote_errors=0
        for idx,row in enumerate(reader,1):
            raw+=1
            if str(row.get("year","")).strip()!=str(year):
                raise ValueError("Historical Senate poll cycle does not match filename")
            begin=legacy.date_value(row.get("start_date"))
            end=legacy.date_value(row.get("end_date"))
            if not begin or not end or begin>end:
                date_errors+=1;continue
            cutoff=ELECTION_DATES[year]-dt.timedelta(days=CUTOFF_DAYS)
            if not cutoff-dt.timedelta(days=LOOKBACK_DAYS)<=end<=cutoff:continue
            state=legacy.NAME_TO_STATE.get(str(row.get("state") or "").lower().strip().replace("-"," "))
            if not state or state=="AK":continue
            try:
                d=float(row.get("dem") or "")
                r=float(row.get("rep") or "")
            except (ValueError,TypeError):
                vote_errors+=1;continue
            if not math.isfinite(d) or not math.isfinite(r) or d<0 or r<0 or d>100 or r>100 or not 55<=d+r<=101:
                vote_errors+=1;continue
            pollster=str(row.get("pollster") or "").strip()
            if not pollster:continue
            pop=str(row.get("sample_type") or "").strip().upper()
            grouped[(year,state)].append({
                "firm_key":re.sub(r"\*+$","",pollster).strip().casefold(),
                "end_date":end,"population_rank":{"LV":3,"RV":2,"A":1}.get(pop,0),
                "source_row_number":idx,
                "margin":100*(d-r)/(d+r)})
            count+=1
        if not 1<=raw<=5000:
            raise ValueError("Historic poll file has no records")
        audit["raw_source_rows"][str(year)]=raw
        audit["window_eligible_rows"][str(year)]=count
        audit["invalid_date_rows"][str(year)]=date_errors
        audit["invalid_party_share_rows"][str(year)]=vote_errors
    return grouped,audit

def summary(errors):
    if not errors:return None
    n=len(errors)
    return {"races":n,"mae_points":round(sum(abs(e) for e in errors)/n,3),
       "rmse_points":round(math.sqrt(sum(e**2 for e in errors)/n),3),
       "signed_error_points":round(sum(errors)/n,3)}

def build(poll_texts,mit_doc,source_digests=None):
    actual,outcome_audit=extract_outcomes(mit_doc)
    polls,source_audit=process_polls(poll_texts)
    errors_by_year=defaultdict(list)
    by_year={}
    for year in YEARS:
        cutoff=ELECTION_DATES[year]-dt.timedelta(days=CUTOFF_DAYS)
        by_state=[]
        for (cycle,state),actual_margin in sorted(actual.items()):
            if cycle!=year:continue
            candidates=polls.get((year,state),[])
            firms={}
            for p in candidates:
                key=p["firm_key"]
                order=(p["end_date"],p["population_rank"],p["source_row_number"])
                if key not in firms or order>(
                    firms[key]["end_date"],firms[key]["population_rank"],firms[key]["source_row_number"]):
                    firms[key]=p
            latest=list(firms.values())
            if len(latest)<MIN_FIRMS:continue
            total=0.;weighted=0.
            for p in latest:
                age=(cutoff-p["end_date"]).days
                weight=2**(-age/HALF_LIFE)
                weighted+=p["margin"]*weight;total+=weight
            error=weighted/total-actual_margin
            errors_by_year[year].append(error)
            by_state.append({"state":state,"pollster_count":len(latest),"error_points":round(error,3)})
        by_year[str(year)]={
            "races":len(errors_by_year[year]),
            "observed_poll_error":summary(errors_by_year[year]),
            "overestimated_dem_races":sum(e>.05 for e in errors_by_year[year]),
            "overestimated_rep_races":sum(e<-.05 for e in errors_by_year[year]),
            "race_errors":sorted(by_state,key=lambda r:abs(r["error_points"]),reverse=True)[:6]
        }
    if any(len(errors_by_year[y])<2 for y in YEARS):
        raise ValueError("Historical polls too sparse for one or more election cycles")
    holdouts={}
    all_scores={k:[] for k in METHODS}
    for i,year in enumerate(YEARS):
        prior=YEARS[:i]
        if len(prior)<MIN_TRAIN_YEARS:continue
        # All previous cycles, equal election-year weight. Never future data.
        prior_signed=[sum(errors_by_year[y])/len(errors_by_year[y]) for y in prior]
        trained_bias=sum(prior_signed)/len(prior_signed)
        methods={}
        for name,mult in METHODS.items():
            err=[e-mult*trained_bias for e in errors_by_year[year]]
            all_scores[name].extend(err)
            methods[name]=summary(err)
            methods[name]["correction_points"]=round(mult*trained_bias,3)
        holdouts[str(year)]={
            "test_cycle":year,"training_cycles":list(prior),
            "learned_past_bias_points":round(trained_bias,3),
            "races":len(errors_by_year[year]),
            "methods":methods
        }
    totals={name:summary(errors) for name,errors in all_scores.items()}
    for name in ("half_prior_bias","full_prior_bias"):
        totals[name]["mae_improvement_vs_none_points"]=round(
            totals["none"]["mae_points"]-totals[name]["mae_points"],3)
        totals[name]["improved_test_cycles"]=sum(
          v["methods"][name]["mae_points"]<v["methods"]["none"]["mae_points"]
          for v in holdouts.values())
    overall=[e for year in YEARS for e in errors_by_year[year]]
    return {
        "schema_version":"senate-long-run-walk-forward-v1",
        "status":"research_only_retrospective_chronological_diagnostic",
        "generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
        "poll_source":SOURCE,
        "poll_source_license":"No explicit license found in public compilation; derived statistics only",
        "poll_file_sha256":source_digests or {},
        "mit_source_doi":mit_doc["source_doi"],
        "mit_source_sha256":mit_doc.get("source_file_sha256"),
        "source_publication_timestamps_verified":False,
        "years":list(YEARS),"history_cycles":len(YEARS),
        "evaluated_test_cycles":len(holdouts),
        "cutoff_days":CUTOFF_DAYS,"lookback_days":LOOKBACK_DAYS,
        "correction_rules":METHODS,"minimum_prior_election_cycles":MIN_TRAIN_YEARS,
        "source_audit":source_audit,"outcome_audit":outcome_audit,
        "total_race_observations":len(overall),
        "by_year":by_year,
        "holdout_by_year":holdouts,
        "pooled_walk_forward":totals,
        "is_forecast":False,"is_as_of_leakage_free":False,
        "can_justify_2026_bias_correction":False,
        "can_calibrate_2026_chamber_probabilities":False,
        "limitations":[
          "Strictly earlier election outcomes train each holdout; no later cycle enters training. Yet poll source compilation was built retrospectively.",
          "Survey initial-publication dates and real-time candidate-matchup snapshots are unavailable; end-fieldwork cutoffs cannot rule out hindsight selection.",
          "Ten election cycles do not provide ten independent, identically distributed polling-error samples: turnout, political conditions and source coverage change.",
          "Only polled Senate races with at least two different firms and recorded D/R votes enter; states with concurrent special contests are excluded.",
          "The historical 21-day recency-only mean does not reproduce live JackStradamus source-quality, sponsorship and size weights.",
          "National signed-bias adjustments are fixed zero/half/full rules; none may update live 2026 Senate or congressional probabilities."
        ]
    }

def main():
    mit_text,file_id,digest=medsl.download()
    mit=medsl.parse_source(mit_text,source_file_id=file_id,sha256=digest,years=YEARS)
    texts,hashes=fetch_polls()
    doc=build(texts,mit,hashes)
    if (doc["history_cycles"]!=10 or doc["evaluated_test_cycles"]!=7 or
       doc["total_race_observations"]<65 or
       any(doc["source_audit"]["raw_source_rows"][str(y)]<80 for y in YEARS)):
       raise ValueError("Extended historical source coverage insufficient")
    DEST.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("TEN CYCLE SENATE POLLING AUDIT",
       json.dumps({"cycles":doc["history_cycles"],"historical_races":doc["total_race_observations"],
       "test_cycles":doc["evaluated_test_cycles"],"pooled":doc["pooled_walk_forward"],
       "per_year":{y:v["observed_poll_error"] for y,v in doc["by_year"].items()}},indent=2))

if __name__=="__main__":
    main()
