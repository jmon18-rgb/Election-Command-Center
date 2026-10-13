#!/usr/bin/env python3
"""Research-only Senate election-vs-poll comparison, no win probabilities.

Source: FiveThirtyEight's historical Senate polling CSV (CC BY 4.0).
Outcome: MIT Election Data and Science Lab's 2020/22/24 Senate returns (CC0).
No 2026 data, later-published surveys, post-hoc party reassignments, or
uncertified race forecasts are inserted. This is NOT historical model
calibration of JackStradamus, whose current 2026 coefficients differ.
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

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/historical_senate_poll_backtest.json"
MIT=ROOT/"data/senate_history_2020_2022_2024.json"
SOURCE="https://projects.fivethirtyeight.com/polls-page/data/senate_polls_historical.csv"
ATTRIBUTION="https://github.com/fivethirtyeight/data/blob/master/polls/README.md"
ELECTIONS={2020:dt.date(2020,11,3),2022:dt.date(2022,11,8),2024:dt.date(2024,11,5)}
CUTOFF_DAYS=7
LOOKBACK_DAYS=45
STATE_NAMES={
"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado",
"CT":"Connecticut","DE":"Delaware","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho",
"IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana",
"ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota",
"MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada",
"NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York",
"NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon",
"PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota",
"TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia",
"WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming"
}
NAME_TO_STATE={v.casefold():k for k,v in STATE_NAMES.items()}
NAME_TO_STATE.update({k.casefold():k for k in STATE_NAMES})
REQUIRED={"cycle","state","pollster","poll_id","question_id","end_date",
          "created_at","election_date","stage","candidate_party","pct"}
RACE_EXCLUSIONS={"AK"} # 2020+ Alaska ranked-choice/current atypical: conservative eligibility gate

def date_value(text):
    value=str(text or "").strip()
    if not value:
        return None
    # Important: date-only comparison, not a claim of original publication time.
    for fmt in ("%Y-%m-%d","%m/%d/%y","%m/%d/%Y","%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S","%m/%d/%y %H:%M","%m/%d/%Y %H:%M"):
        try:
            return dt.datetime.strptime(value[:19] if fmt.startswith("%Y-%m-%dT") else value,fmt).date()
        except ValueError:
            pass
    try:
        return dt.datetime.fromisoformat(value.replace("Z","+00:00")).date()
    except ValueError:
        return None

def party_of(s):
    val=re.sub(r"[^A-Z]","",str(s or "").upper())
    if val in ("D","DEM","DEMOCRAT","DEMOCRATIC"):return "D"
    if val in ("R","REP","REPUBLICAN","GOP"):return "R"
    return "OTHER"

def party_margin(d,r):
    return 100*(d-r)/(d+r) if d+r>0 else None

def download_csv(opener=urllib.request.urlopen):
    req=urllib.request.Request(SOURCE,headers={
      "User-Agent":"InSearchOfBlueWaves/1.0 historical research",
      "Accept":"text/csv","Accept-Encoding":"identity"
    })
    with opener(req,timeout=55) as response:
        content=response.read(95_000_001)
    if len(content)>95_000_000 or len(content)<1000:
        raise ValueError("FiveThirtyEight CSV source outside download limits")
    return content.decode("utf-8-sig"),hashlib.sha256(content).hexdigest()

def normalized_poll_question(row):
    year_str=str(row.get("cycle") or "").strip()
    if year_str not in {str(x) for x in ELECTIONS}:
        return None
    year=int(year_str)
    state=NAME_TO_STATE.get(str(row.get("state") or "").strip().casefold())
    if not state or state in RACE_EXCLUSIONS:return None
    if (row.get("stage") or "").strip().lower() not in ("general","gen"):return None
    cutoff=ELECTIONS[year]-dt.timedelta(days=CUTOFF_DAYS)
    end=date_value(row.get("end_date"))
    created=date_value(row.get("created_at"))
    election=date_value(row.get("election_date"))
    if not end or not created or election!=ELECTIONS[year] or not (
            cutoff-dt.timedelta(days=LOOKBACK_DAYS)<=end<=cutoff and created<=cutoff):
        return None
    if not str(row.get("pollster") or "").strip():return None
    try:share=float(row.get("pct") or "")
    except ValueError:return None
    if not math.isfinite(share) or not 0<=share<=100:return None
    if party_of(row.get("candidate_party")) not in ("D","R"):return None
    poll_id=str(row.get("poll_id") or "").strip()
    question_id=str(row.get("question_id") or "").strip()
    if not poll_id or not question_id:return None
    return {
        "year":year,"state":state,"poll_id":poll_id,"question_id":question_id,
        "population":str(row.get("population") or "").strip().lower(),
        "pollster":str(row["pollster"]).strip(),"field_end":end,
        "posted_at":created,"party":party_of(row["candidate_party"]),"share":share,
        "candidate":str(row.get("candidate_name") or row.get("answer") or "").strip(),
        "sample_size":row.get("sample_size"),
    }

def parse_polls(csv_text):
    reader=csv.DictReader(io.StringIO(csv_text))
    fields=set(reader.fieldnames or [])
    if not REQUIRED<=fields:
        raise ValueError("FiveThirtyEight Senate source schema changed: "+str(sorted(REQUIRED-fields)))
    group=defaultdict(list)
    included_rows=0
    for row in reader:
        q=normalized_poll_question(row)
        if not q:continue
        group[(q["year"],q["state"],q["poll_id"],q["question_id"],q["population"])].append(q)
        included_rows+=1
    by_state=defaultdict(list)
    for (year,state,poll_id,question_id,population),members in group.items():
        by_party=defaultdict(list)
        for m in members:by_party[m["party"]].append(m)
        if len(by_party["D"])!=1 or len(by_party["R"])!=1:
            # Multiple D or R candidate identities means a nonstandard question;
            # do not sum/join unrelated matchups.
            continue
        a,b=by_party["D"][0],by_party["R"][0]
        if a["pollster"]!=b["pollster"] or a["field_end"]!=b["field_end"]:
            continue
        if a["share"]+b["share"]<55 or a["share"]+b["share"]>101:
            continue
        margin=party_margin(a["share"],b["share"])
        if margin is None:continue
        pop_rank={"lv":3,"rv":2,"a":1}.get(population,0)
        by_state[(year,state)].append({
            "poll_id":poll_id,"question_id":question_id,"pollster":a["pollster"],
            "firm_key":a["pollster"].casefold().strip(),"field_end":a["field_end"],
            "posted_at":a["posted_at"],"margin":margin,"population":population,
            "population_rank":pop_rank,"sample_size":a["sample_size"]
        })
    return by_state,{"candidate_rows_eligible":included_rows,
        "ballot_questions_with_both_parties":sum(map(len,by_state.values()))}

def load_outcomes(doc):
    if doc.get("status")!="historical_senate_results_research_only" or doc.get("is_election_forecast") is not False or not isinstance(doc.get("contest_records"),list):
        raise ValueError("MIT Senate historical outcomes missing/invalid")
    collisions=defaultdict(list)
    for row in doc["contest_records"]:
        year=row["election_year"]
        if year not in ELECTIONS:continue
        collisions[(year,row["state"])].append(row)
    valid={}
    for key,items in collisions.items():
        # No ambiguous regular + special elections joined by state alone.
        if len(items)!=1:continue
        row=items[0]
        if row.get("missing_major_party_vote") or row.get("recorded_dem_votes",0)<=0 or row.get("recorded_rep_votes",0)<=0:continue
        d,r=row["recorded_dem_votes"],row["recorded_rep_votes"]
        if d+r!=row["recorded_two_party_vote_total"]:continue
        if row.get("recorded_other_votes",0)/row["recorded_total_candidate_votes"]>.20:continue
        valid[key]={"actual_margin":party_margin(d,r),
                    "actual_dem_votes":d,"actual_rep_votes":r,
                    "historical_race_id":row["historical_race_id"],
                    "other_vote_share_pct":round(100*row.get("recorded_other_votes",0)/row["recorded_total_candidate_votes"],2)}
    return valid

def per_year_metrics(rows,method):
    values=[r["methods"][method]["error"] for r in rows]
    if not values:return None
    return {"races":len(values),"mae":round(sum(map(abs,values))/len(values),3),
            "signed_bias":round(sum(values)/len(values),3),
            "rmse":round(math.sqrt(sum(x*x for x in values)/len(values)),3)}

def build(csv_text,mit_doc,digest="fixture"):
    polls,coverage=parse_polls(csv_text)
    actual=load_outcomes(mit_doc)
    rows=[]
    excluded_insufficient=0
    for (year,state),outcome in sorted(actual.items()):
        candidates=polls.get((year,state),[])
        # Most recent candidate-pair response from each firm, with LV > RV tie-break.
        byfirm={}
        for poll in candidates:
            k=poll["firm_key"]
            if k not in byfirm or (
                poll["field_end"],poll["population_rank"],poll["posted_at"],poll["poll_id"])>(
                byfirm[k]["field_end"],byfirm[k]["population_rank"],byfirm[k]["posted_at"],byfirm[k]["poll_id"]):
                byfirm[k]=poll
        kept=list(byfirm.values())
        if len(kept)<2:
            excluded_insufficient+=1
            continue
        predictions={}
        for name,half_life in (("equal_firm",None),("recency14",14),("recency21",21),("recency35",35)):
            weighted,total=0.,0.
            for p in kept:
                age=(ELECTIONS[year]-dt.timedelta(days=CUTOFF_DAYS)-p["field_end"]).days
                weight=1. if half_life is None else 2**(-age/half_life)
                total+=weight
                weighted+=p["margin"]*weight
            pred=weighted/total
            predictions[name]={"predicted_two_party_margin":round(pred,3),
                "error":round(pred-outcome["actual_margin"],3)}
        rows.append({
          "cycle":year,"state":state,"label":STATE_NAMES[state]+" · Senate",
          "historical_race_id":outcome["historical_race_id"],
          "actual_two_party_margin":round(outcome["actual_margin"],3),
          "other_vote_share_pct":outcome["other_vote_share_pct"],
          "pollster_count":len(kept),
          "field_end_range":[min(x["field_end"] for x in kept).isoformat(),max(x["field_end"] for x in kept).isoformat()],
          "cutoff":(ELECTIONS[year]-dt.timedelta(days=CUTOFF_DAYS)).isoformat(),
          "methods":predictions
        })
    by_year={}
    for year in ELECTIONS:
        yr=[x for x in rows if x["cycle"]==year]
        by_year[str(year)]={"eligible_races":len(yr),
            "benchmarks":{method:per_year_metrics(yr,method) for method in ("equal_firm","recency14","recency21","recency35")}}
    all_errors=[x["methods"]["recency21"]["error"] for x in rows]
    return {
      "schema_version":"historical-poll-backtest-v1",
      "status":"research_only_not_a_calibrated_2026_forecast",
      "generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
      "poll_source":SOURCE,"poll_source_attribution":ATTRIBUTION,
      "poll_source_license":"CC BY 4.0 (FiveThirtyEight)",
      "poll_source_sha256":digest,
      "outcomes_source":mit_doc["source_url"],"outcomes_source_license":mit_doc["source_license"],
      "cutoff_days_before_election":CUTOFF_DAYS,"poll_lookback_days":LOOKBACK_DAYS,
      "poll_observation_coverage":coverage,
      "outcome_eligible_races":len(actual),"excluded_insufficient_pollsters":excluded_insufficient,
      "races_evaluated":len(rows),
      "by_year":by_year,
      "overall_recency21":per_year_metrics(rows,"recency21"),
      "records":rows,
      "is_forecast":False,"can_calibrate_2026_win_probabilities":False,
      "limitations":[
       "Only a descriptive poll-only, two-party margin benchmark. NOT a historical backtest of the deployed JackStradamus algorithm.",
       "Pollsters selected using only end dates and source-index creation dates no later than seven days before each election.",
       "Excludes states with two Senate contests in one year until regular/special polling questions can be matched to the ballot unambiguously.",
       "Excludes races with missing D/R candidate votes or >20% third-party/independent vote, and Alaska's nonstandard ranked-choice context.",
       "One latest observation per named pollster; historical house effects, 2026 quality grades and current election outcomes are never used.",
       "Correlation, sampling error and time-dependent forecasting error cannot be calibrated from three retrospective years.",
       "Source first-indexed dates are NOT proven original poll release timestamps; no real-time research-time knowledge is implied."
      ]
    }

def main():
    text,digest=download_csv()
    mit=json.loads(MIT.read_text(encoding="utf-8"))
    doc=build(text,mit,digest)
    if doc["races_evaluated"]<10 or len([y for y,s in doc["by_year"].items() if s["eligible_races"]>=3])<2:
        raise ValueError("Not enough retrospective races/cycles to publish even a preliminary benchmark: "+str(doc["by_year"]))
    OUT.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Historical Senate poll-only backtest",doc["races_evaluated"],"contests",doc["by_year"])

if __name__=="__main__":main()
