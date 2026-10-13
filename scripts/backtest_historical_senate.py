#!/usr/bin/env python3
"""Historical Senate polling backtest against independently supplied certified results.

Historical polling: FiveThirtyEight archived Senate polling tables.
Official outcomes: a separately verified CSV with year,state,dem_votes,rep_votes.
Never substitute forecast estimates or polls for official election outcomes.
No candidate-specific win probabilities are inferred.
"""
import argparse, csv, io, json, math, urllib.request
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

POLL_URL="https://projects.fivethirtyeight.com/polls-page/data/senate_polls_historical.csv"
REQUIRED=("year","state","dem_votes","rep_votes")
WINDOWS=(14,30,45)
HALF_LIVES=(14,21,35)
POPULATIONS=("lv","rv","a")
def download(url):
    req=urllib.request.Request(url,headers={"User-Agent":"ElectionCommandCenter-HistoricalBacktest/1.0"})
    with urllib.request.urlopen(req,timeout=60) as r:
        raw=r.read(30_000_000)
    if len(raw)>=30_000_000: raise ValueError("Historical polling download exceeds safety cap")
    return list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))

def normalize_state(s):
    return (s or "").strip().lower()

def load_results(path):
    with open(path,newline="",encoding="utf-8-sig") as f:
        reader=csv.DictReader(f)
        if not set(REQUIRED).issubset(reader.fieldnames or []):
            raise ValueError("Official result CSV needs year,state,dem_votes,rep_votes")
        out={}
        for row in reader:
            year=int(row["year"]);state=normalize_state(row["state"])
            dv=float(row["dem_votes"]);rv=float(row["rep_votes"])
            if dv<0 or rv<0 or dv+rv<=0:raise ValueError("Invalid votes in official results")
            key=(year,state)
            if key in out:raise ValueError("Duplicate official result "+str(key))
            out[key]=100*(dv-rv)/(dv+rv)
    return out

def parse_date(s):
    for fmt in ("%m/%d/%y","%m/%d/%Y","%Y-%m-%d"):
        try:
            from datetime import datetime
            return datetime.strptime(s.strip(),fmt).date()
        except (ValueError,AttributeError):pass
    return None

def poll_records(rows):
    # 538 Senate data are candidate-level: group by poll_id/question_id.
    by_question=defaultdict(dict)
    for r in rows:
        try:
            year=int(r.get("cycle") or r.get("election_date","")[-4:])
            if year not in (2016,2018,2020,2022,2024):continue
            if (r.get("stage") or "").lower() not in ("","general"):continue
            if str(r.get("internal") or "0").lower() in ("1","true"):continue
            if r.get("partisan"):continue
            party=(r.get("candidate_party") or "").upper()
            if party not in ("DEM","REP"):continue
            end=parse_date(r.get("end_date",""))
            if not end:continue
            state=normalize_state(r.get("state"))
            if not state:continue
            pid=r.get("poll_id");qid=r.get("question_id")
            if not pid or not qid:continue
            pct=float(r["pct"])
            if not 0<=pct<=100:continue
            key=(year,state,pid,qid)
            group=by_question[key]
            group[party]=(pct,end,r.get("pollster") or "",r.get("sample_size"),r.get("population") or "")
        except (ValueError,KeyError,TypeError):continue
    grouped=defaultdict(list)
    for (year,state,pid,qid),g in by_question.items():
        if "DEM" not in g or "REP" not in g:continue
        dem,rep=g["DEM"],g["REP"]
        if dem[1]!=rep[1] or not dem[2]:continue
        # Two-party normalization matches official D/R two-party result.
        if dem[0]+rep[0]<60:continue
        margin=100*(dem[0]-rep[0])/(dem[0]+rep[0])
        try:n=float(dem[3]) if dem[3] else 600
        except ValueError:n=600
        grouped[(year,state)].append({"date":dem[1],"firm":dem[2].casefold(),"margin":margin,"n":n,"population":dem[4].lower()})
    return grouped

def estimate(polls,asof,window,half_life,method):
    subset=[p for p in polls if timedelta(0)<=asof-p["date"]<=timedelta(days=window)]
    subset.sort(key=lambda p:p["date"],reverse=True)
    latest={}
    for p in subset:latest.setdefault(p["firm"],p)
    if len(latest)<2:return None
    total=weighted=0
    for p in latest.values():
        age=(asof-p["date"]).days
        weight=1 if method=="equal" else .5**(age/half_life)
        if method=="recency_size":weight*=math.sqrt(max(200,min(3000,p["n"]))/600)
        total+=weight;weighted+=weight*p["margin"]
    return weighted/total

def evaluate(polls,results):
    predictions=[]
    for (year,state),actual in results.items():
        election=date(year,11,1)
        # Election Day is the Tuesday after the first Monday in November.
        election+=timedelta(days=(0-election.weekday())%7+1)
        cutoff=election-timedelta(days=1)
        for days_out in (7,21,42):
            asof=cutoff-timedelta(days=days_out)
            for window in WINDOWS:
                for half_life in HALF_LIVES:
                    for method in ("equal","recency","recency_size"):
                        pred=estimate(polls.get((year,state),[]),asof,window,half_life,method)
                        if pred is not None:predictions.append({"year":year,"state":state,"days_before_election":days_out+1,"window":window,"half_life":half_life,"method":method,"error":round(pred-actual,5)})
    return predictions

def report(rows,years):
    summaries=[]
    for method in ("equal","recency","recency_size"):
        for window in WINDOWS:
            for half_life in HALF_LIVES:
                selected=[r for r in rows if r["method"]==method and r["window"]==window and r["half_life"]==half_life and r["days_before_election"]==8]
                for label,sub in (("all",selected),("midterm",[r for r in selected if r["year"]%4==2]),("presidential",[r for r in selected if r["year"]%4==0])):
                    if len(sub)<3:continue
                    errs=[r["error"] for r in sub]
                    summaries.append({"method":method,"window":window,"half_life":half_life,"cycle":label,"n_races":len(errs),"mae":round(sum(map(abs,errs))/len(errs),3),"rmse":round(math.sqrt(sum(e*e for e in errs)/len(errs)),3),"mean_error":round(sum(errs)/len(errs),3)})
    return {"status":"historical_election_result_backtest","years_with_certified_outcomes":sorted(years),"evaluations":len(rows),"comparisons":summaries,"limitations":["Two-party polling margins compared with two-party official returns.","At least two independent pollsters required.","Historical CSV coverage may vary by cycle.","Multiple model configurations are diagnostic; do not select by in-sample minimum error.","Historical testing does not establish calibrated 2026 election probabilities."]}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--official-results",required=True,help="Verified CSV year,state,dem_votes,rep_votes")
    ap.add_argument("--poll-csv",help="Cached 538 historical Senate polling CSV (optional)")
    ap.add_argument("--output",default="data/historical_backtest.json")
    args=ap.parse_args()
    results=load_results(args.official_results)
    if not results:raise ValueError("No certified results provided")
    if args.poll_csv:
        with open(args.poll_csv,newline="",encoding="utf-8-sig") as f:polls=list(csv.DictReader(f))
    else:polls=download(POLL_URL)
    records=poll_records(polls)
    evaluations=evaluate(records,results)
    if not evaluations:raise ValueError("No matched polls and official outcomes; inspect coverage and state names")
    output=report(evaluations,{year for year,_ in results})
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(output,indent=2)+"\n",encoding="utf-8")
    print("Compared",len(evaluations),"poll averages against",len(results),"certified results; see",args.output)

if __name__=="__main__":main()
