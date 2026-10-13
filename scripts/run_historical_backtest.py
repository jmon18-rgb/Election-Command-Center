#!/usr/bin/env python3
"""Compare archived Senate polls to independently published election returns."""
import csv,io,json,math,re,urllib.request
from collections import defaultdict
from datetime import date,timedelta
from pathlib import Path

POLL_URL="https://raw.githubusercontent.com/Jack-Whitcomb/All-US-Senate-polls-2006-2024/main/2006_to_2024_senate_polls_with_actuals.csv"
RESULT_URL="https://raw.githubusercontent.com/fivethirtyeight/election-results/main/election_results_senate.csv"
YEARS=(2018,2020,2022,2024)
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
                if re.search(r"\\([DR]\\)\\*?",p["pollster"]):continue
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
        "limitations":["Not an election forecast.","Excludes special, multiple-seat, ranked-choice and independent-winner races.","Coverage differs by year; no candidate-name validation or holdout model selection.","Partisan-sponsored poll exclusion relies on pollster-name labels."]}
    out=ROOT/"data"/"historical_verified.json"
    out.write_text(json.dumps(result,indent=2)+"\\n",encoding="utf-8")
    print("Historical results:",result["matched_poll_races"],"races",result["overall"])

if __name__=="__main__":main()
