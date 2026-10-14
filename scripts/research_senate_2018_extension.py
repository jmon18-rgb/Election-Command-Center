#!/usr/bin/env python3
"""Reproducible 2018 Senate polling-horizon extension (research only).

Uses the EXACT survey screening, last-firm selection and 21-day half-life of
research_senate_horizon_backtest.py, without adding 2018 to the live 2026
candidate model or replacing the previously staged 2020/2022/2024 artifact.

Source files are privately fetched at execution; third-party poll CSV content
must never be committed to this public repository (license unspecified).
Poll fieldwork end dates ARE NOT historical publication timestamps.
"""
import argparse
import datetime as dt
import hashlib
import json
import urllib.request
from collections import defaultdict
from pathlib import Path

import research_senate_horizon_backtest as study

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"data/historical_senate_2018_extension.json"
OUT=ROOT/"data/historical_senate_2018_horizon_backtest.json"
POLL_SOURCE="https://github.com/Jack-Whitcomb/All-US-Senate-polls-2006-2024"
POLL_URL="https://raw.githubusercontent.com/Jack-Whitcomb/All-US-Senate-polls-2006-2024/main/2018_senate_polls.csv"
POLL_BLOB_SHA="9326214be51d03f4e5adeceb4d1f68eff653651f"
YEAR=2018

def source_digest(raw):
    return hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest()

def download(opener=urllib.request.urlopen):
    req=urllib.request.Request(POLL_URL,headers={"User-Agent":"JackStradamus/2018-history-research"})
    with opener(req,timeout=45) as handle:
        raw=handle.read(250001)
    if not 3000<len(raw)<=250000 or source_digest(raw)!=POLL_BLOB_SHA:
        raise ValueError("2018 public poll CSV changed/failed source hash pin")
    return raw.decode("utf-8-sig"),hashlib.sha256(raw).hexdigest()

def eligible_results(doc):
    if (doc.get("schema_version")!="2018-senate-outcomes-research-v1"
      or doc.get("status")!="MIT_DERIVED_RESEARCH_ONLY_NOT_PRODUCTION"
      or doc.get("is_election_forecast") is not False
      or doc.get("year")!=2018 or doc.get("contest_count")!=35
      or doc.get("unique_states")!=33
      or doc.get("source_mirror_blob_sha")!="0c01b92e4db92a19b2c6d7e208e384536e401353"):
        raise ValueError("2018 MIT research outcomes provenance mismatch")
    races=doc.get("contest_records")
    if not isinstance(races,list) or len(races)!=35:
        raise ValueError("2018 Senate race universe incomplete")
    by_state=defaultdict(list)
    raceids=set()
    for row in races:
        state=row.get("state")
        if not isinstance(state,str) or len(state)!=2 or not state.isupper():
            raise ValueError("2018 MIT state code invalid")
        if row.get("election_year")!=2018 or row.get("election_type") not in ("regular","special"):
            raise ValueError("2018 outcome mixed with another election")
        id= "2018-"+state+"-SEN-"+row["election_type"]
        if row.get("historical_race_id")!=id or id in raceids:
            raise ValueError("Duplicate or mismatched historical race identifier")
        raceids.add(id)
        dem,rep,other,total=(row.get(k) for k in
          ("recorded_dem_votes","recorded_rep_votes","recorded_other_votes","recorded_total_candidate_votes"))
        if any(type(x) is not int or x<0 for x in (dem,rep,other,total)) or total<10000:
            raise ValueError("Invalid historical vote tallies")
        if dem+rep+other!=total or row.get("recorded_two_party_vote_total")!=dem+rep:
            raise ValueError("Historical vote tallies do not sum")
        if row.get("missing_major_party_vote") is not (dem==0 or rep==0):
            raise ValueError("Incorrect third-party ballot provenance")
        by_state[state].append(row)
    if len(by_state)!=33:
        raise ValueError("2018 Senate outcome states incomplete")
    if set(x for x,items in by_state.items() if len(items)>1)!={"MN","MS"}:
        raise ValueError("Unexpected 2018 double-election states")
    result={}
    for state,items in by_state.items():
        if len(items)!=1:
            continue # No MN or MS polls can be joined to ambiguous regular/special results.
        row=items[0]
        dem,rep=row["recorded_dem_votes"],row["recorded_rep_votes"]
        if dem==0 or rep==0 or row["recorded_other_votes"]/row["recorded_total_candidate_votes"]>.20:
            continue # CA D-v-D and VT/ME independent races cannot be treated as D/R.
        result[state]={"actual_margin":study.baseline.party_margin(dem,rep),
          "historical_race_id":row["historical_race_id"]}
    if len(result)<20:
        raise ValueError("2018 eligible Senate results unexpectedly incomplete")
    return result

def build(csv_text,outcomes,poll_sha256=None):
    actual=eligible_results(outcomes)
    polls,counts=study.parse_all({YEAR:csv_text},years=(YEAR,))
    records={}
    horizons=[]
    for horizon in study.HORIZONS:
        rows=[]
        for state,truth in sorted(actual.items()):
            aggregate=study.snapshot(polls.get((YEAR,state),[]),YEAR,horizon)
            if aggregate is None:
                continue
            rows.append({
              "cycle":YEAR,"state":state,
              "historical_race_id":truth["historical_race_id"],
              "cutoff":(study.ELECTION_DATES[YEAR]-dt.timedelta(days=horizon)).isoformat(),
              "actual_margin":study.r(truth["actual_margin"]),
              "poll_margin":aggregate["margin"],
              "pollster_count":aggregate["pollster_count"],
              "earliest_field_end":aggregate["earliest_field_end"],
              "latest_field_end":aggregate["most_recent_field_end"],
              "days_before_election":horizon,
              "fieldwork_only_not_verified_published":True
            })
        records[str(horizon)]=rows
        horizons.append({"days_before_election":horizon,
          "eligible_race_snapshots":len(rows),
          "score_6_5pt_sigma":study.score(rows,6.5),
          "score_7_5pt_sigma":study.score(rows,7.5)})
    return {
      "schema_version":"senate-2018-horizon-fieldwork-research-v1",
      "status":"RETROSPECTIVE_FIELDWORK_PROXY_RESEARCH_NO_2026_AUTO_TUNING",
      "cycle":YEAR,"poll_source":POLL_SOURCE,
      "poll_source_license":"Third-party historical compilation with no explicit license; derived research results only",
      "poll_source_blob_sha":POLL_BLOB_SHA,
      "poll_source_sha256":poll_sha256,
      "source_poll_rows":counts[str(YEAR)],
      "outcomes_source":outcomes["source_url"],
      "outcomes_source_mirror_blob_sha":outcomes["source_mirror_blob_sha"],
      "outcomes_source_license":outcomes["source_license"],
      "outcomes_unverified_mirror_warning":True,
      "mit_outcome_race_total":outcomes["contest_count"],
      "eligible_unambiguous_two_party_outcomes":len(actual),
      "ambiguous_multiple_contests_excluded":["MN","MS"],
      "independent_firms_required":study.MIN_INDEPENDENT_FIRMS,
      "lookback_days":study.LOOKBACK,
      "recency_half_life_days":study.HALF_LIFE,
      "horizons":horizons,"records":records,
      "poll_release_dates_verified":False,
      "full_candidate_model_historical_replay_validated":False,
      "can_calibrate_live_2026_model":False,
      "may_change_production_candidate_priors":False,
      "limitations":[
       "2018 independent public poll compilation has no observed first-publication timestamps",
       "2018 survey archive is retrospectively restricted to eventual election nominees",
       "Double Senate elections in MN and MS are excluded rather than falsely paired",
       "Independent/multi-D candidate races including ME, VT, and CA are ineligible",
       "Statewide MIT result rows were recovered from a third-party mirror, not verified byte-for-byte with its canonical MIT release",
       "The 2018 survey cohort is not a full candidate/fundamentals historical forecast replay",
       "Only four cycles (2018, 2020, 2022, 2024) remain insufficient for precise common-error calibration"]
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--verify",action="store_true",help="Compare regenerated data with checked-in records; never modify")
    parser.add_argument("--no-write",action="store_true",help="Recompute and show summary without modifying files")
    args=parser.parse_args()
    raw,digest=download()
    doc=json.loads(SOURCE.read_text())
    built=build(raw,doc)
    # Git blob SHA is our immutable fetch integrity guard; no separate
    # SHA-256 field is required in the checked-in source artifact.
    if (len(built["records"]["20"])<15 or len(built["records"]["7"])<15 or
       built["source_poll_rows"]<200):
        raise ValueError("2018 cohort too small or source record count unexpected")
    if args.verify:
        saved=json.loads(OUT.read_text())
        if saved!=built:
            raise ValueError("Committed 2018 research differs from regenerated hash-pinned source")
    elif not args.no_write:
        OUT.write_text(json.dumps(built,ensure_ascii=False,indent=2)+"\n")
    print("2018 Senate fieldwork research",{
      "records_20_day":len(built["records"]["20"]),
      "records_7_day":len(built["records"]["7"]),
      "rmse_20":built["horizons"][3]["score_6_5pt_sigma"]["rmse_points"],
      "verified_poll_blob":POLL_BLOB_SHA
    })

if __name__=="__main__":
    main()
