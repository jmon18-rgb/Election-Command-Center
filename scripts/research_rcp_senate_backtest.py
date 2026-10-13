#!/usr/bin/env python3
"""Retrospective Senate poll error research from a public RCP compilation.

The source is a third-party compilation, with no specified reuse license.
Republish derived summary/error figures only, not raw poll observations.
It lacks release timestamps and is curated using eventual candidates, so this
study is NOT a leakage-free election-day forecast or calibrated 2026 odds.
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

import backtest_historical_senate_polls as baseline

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/historical_senate_poll_backtest.json"
SOURCE="https://github.com/Jack-Whitcomb/All-US-Senate-polls-2006-2024"
RAW="https://raw.githubusercontent.com/Jack-Whitcomb/All-US-Senate-polls-2006-2024/main/"
FIELDS={"pollster","start_date","end_date","rep","dem","year","state"}
YEARS=(2020,2022,2024)
CUTOFF_DAYS=7
WINDOW_DAYS=45

def download(opener=urllib.request.urlopen):
    texts={};digests={}
    for year in YEARS:
        req=urllib.request.Request(RAW+str(year)+"_senate_polls.csv",
             headers={"User-Agent":"BlueWavesResearch/1.0 retrospective analysis"})
        with opener(req,timeout=45) as r:
            raw=r.read(2_500_001)
        if not 200<len(raw)<=2_500_000:
            raise ValueError("Incomplete historical polling compilation for "+str(year))
        text=raw.decode("utf-8-sig")
        if not text.startswith("pollster,start_date,end_date,"):
            raise ValueError("Unexpected historical polling compilation schema")
        texts[year]=text
        digests[str(year)]=hashlib.sha256(raw).hexdigest()
    return texts,digests

def parse(text_by_year):
    polls=defaultdict(list)
    audit={"raw_records":{},"eligible_records":{},"invalid_or_inverted_dates":{},
           "missing_or_invalid_ballot_shares":{}}
    for year in YEARS:
        text=text_by_year.get(year)
        if not text:raise ValueError("Missing retrospective source year: "+str(year))
        reader=csv.DictReader(io.StringIO(text))
        if not FIELDS<=set(reader.fieldnames or []):
            raise ValueError("Historical RCP compilation changed expected columns")
        counter=0;invalid_date=0;invalid_share=0
        for idx,row in enumerate(reader,1):
            counter+=1
            if str(row.get("year","")).strip()!=str(year):
                raise ValueError("RCP compilation election-year mismatch")
            start=baseline.date_value(row.get("start_date"))
            end=baseline.date_value(row.get("end_date"))
            if not start or not end or start>end:
                invalid_date+=1
                continue
            cutoff=baseline.ELECTIONS[year]-dt.timedelta(days=CUTOFF_DAYS)
            if not cutoff-dt.timedelta(days=WINDOW_DAYS)<=end<=cutoff:
                continue
            state=baseline.NAME_TO_STATE.get(str(row.get("state") or "").strip().lower().replace("-"," "))
            if not state or state in baseline.RACE_EXCLUSIONS:continue
            try:
                d,r=float(row.get("dem") or ""),float(row.get("rep") or "")
            except ValueError:
                invalid_share+=1;continue
            if not all(math.isfinite(x) and 0<=x<=100 for x in (d,r)) or not 55<=d+r<=101:
                invalid_share+=1;continue
            firm=str(row.get("pollster") or "").strip()
            if not firm:continue
            pop=str(row.get("sample_type") or "").strip().lower()
            polls[(year,state)].append({
                "poll_id":str(year)+"-"+state+"-"+str(idx),
                "question_id":str(year)+"-"+state+"-"+str(idx),
                "pollster":firm,
                "firm_key":re.sub(r"\*+$","",firm).strip().casefold(),
                "field_end":end,
                "posted_at":end, # placeholder for sorting only; NOT a posting date
                "margin":baseline.party_margin(d,r),
                "population":pop,
                "population_rank":{"lv":3,"rv":2,"a":1}.get(pop,0),
                "sample_size":row.get("sample_size"),
            })
        audit["raw_records"][str(year)]=counter
        audit["eligible_records"][str(year)]=sum(len(v) for (y,state),v in polls.items() if y==year)
        audit["invalid_or_inverted_dates"][str(year)]=invalid_date
        audit["missing_or_invalid_ballot_shares"][str(year)]=invalid_share
        if not 80<=counter<=5000:raise ValueError("Unrealistic historical poll-row count")
    return polls,audit

def build(texts,mit_doc,digests=None):
    poll_by_race,source_audit=parse(texts)
    outcomes=baseline.load_outcomes(mit_doc)
    rows=[];underpolled=0
    for (year,state),actual in sorted(outcomes.items()):
        latest={}
        for p in poll_by_race.get((year,state),[]):
            firm=p["firm_key"]
            ordering=(p["field_end"],p["population_rank"],p["poll_id"])
            if firm not in latest or ordering>(
                latest[firm]["field_end"],latest[firm]["population_rank"],latest[firm]["poll_id"]):
                latest[firm]=p
        observations=list(latest.values())
        if len(observations)<2:
            underpolled+=1;continue
        outputs={}
        cutoff=baseline.ELECTIONS[year]-dt.timedelta(days=CUTOFF_DAYS)
        for method,half_life in [("equal_firm",None),("recency14",14),
                                 ("recency21",21),("recency35",35)]:
            total=0.;weighted=0.
            for p in observations:
                age=(cutoff-p["field_end"]).days
                weight=1.0 if half_life is None else 2**(-age/half_life)
                total+=weight;weighted+=weight*p["margin"]
            margin=weighted/total
            outputs[method]={
                "predicted_two_party_margin":round(margin,3),
                "error":round(margin-actual["actual_margin"],3)
            }
        rows.append({
            "cycle":year,"state":state,
            "label":baseline.STATE_NAMES[state]+" · Senate",
            "historical_race_id":actual["historical_race_id"],
            "actual_two_party_margin":round(actual["actual_margin"],3),
            "other_vote_share_pct":actual["other_vote_share_pct"],
            "pollster_count":len(observations),
            "field_end_range":[min(p["field_end"] for p in observations).isoformat(),
                               max(p["field_end"] for p in observations).isoformat()],
            "cutoff":cutoff.isoformat(),
            "cutoff_is_fieldwork_only":True,
            "methods":outputs,
        })
    by_year={}
    for year in YEARS:
        samples=[r for r in rows if r["cycle"]==year]
        by_year[str(year)]={
            "eligible_races":len(samples),
            "benchmarks":{method:baseline.per_year_metrics(samples,method)
                 for method in ("equal_firm","recency14","recency21","recency35")}
        }
    return {
        "schema_version":"historical-poll-backtest-v1",
        "status":"retrospective_poll_research_not_calibrated_forecast",
        "generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
        "poll_source":SOURCE,
        "poll_source_attribution":SOURCE,
        "poll_source_license":"No explicit license in public compilation; only derived metrics retained",
        "poll_source_sha256":digests or {},
        "poll_source_first_publication_dates_available":False,
        "source_dataset":"Third-party compilation of RealClearPolling Senate polls, curated retrospectively",
        "outcomes_source":mit_doc["source_url"],
        "outcomes_source_license":mit_doc["source_license"],
        "cutoff_days_before_election":CUTOFF_DAYS,
        "poll_lookback_days":WINDOW_DAYS,
        "poll_observation_coverage":source_audit,
        "outcome_eligible_races":len(outcomes),
        "excluded_insufficient_pollsters":underpolled,
        "races_evaluated":len(rows),
        "by_year":by_year,
        "overall_recency21":baseline.per_year_metrics(rows,"recency21"),
        "records":rows,
        "is_forecast":False,
        "can_calibrate_2026_win_probabilities":False,
        "limitations":[
            "NOT a historical backtest of the deployed JackStradamus model; this is a simple retrospective poll-only error benchmark.",
            "Original source polls have no verified initial publication dates. End-fieldwork cutoffs alone cannot establish what was publicly known at each cutoff.",
            "The compilation selects eventual general-election candidates retrospectively; selection hindsight cannot be ruled out.",
            "States with two same-year Senate elections are excluded until questions are correctly matched to regular/special seats.",
            "Third-party candidacies with >20% of actual recorded vote and elections missing one major party are excluded.",
            "A latest poll per named firm is retained; 2026 pollster-quality ratings, future results and election forecasts are not used.",
            "Only two-party margins from recorded candidate vote totals are compared; respondent population/method differences and selection bias remain.",
            "No correlated forecast-error calibration, chamber control probabilities, or 2026 win odds are licensed by this descriptive three-cycle study."
        ]
    }

def main():
    texts,digests=download()
    outcomes=json.loads((ROOT/"data/senate_history_2020_2022_2024.json").read_text(encoding="utf-8"))
    doc=build(texts,outcomes,digests)
    supported=sum(item["eligible_races"]>=3 for item in doc["by_year"].values())
    if doc["races_evaluated"]<12 or supported<2:
        raise ValueError("Not enough historical Senate races for publication: "+str(doc["by_year"]))
    OUT.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Retrospective Senate poll research",doc["races_evaluated"],"races; year coverage",doc["by_year"])

if __name__=="__main__":main()
