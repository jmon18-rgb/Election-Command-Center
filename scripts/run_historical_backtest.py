#!/usr/bin/env python3
"""Fetch independent archived polls and published election returns, then backtest.

Source data: FiveThirtyEight public polling archive and election-results repo.
No 2026 polls or future outcomes are used. Result coverage is reported explicitly.
"""
import csv, io, json, urllib.request
from collections import defaultdict
from pathlib import Path
from backtest_historical_senate import poll_records, evaluate, report

BASE="https://raw.githubusercontent.com/fivethirtyeight/election-results/main/election_results_senate.csv"
POLL_URLS=[
 "https://projects.fivethirtyeight.com/polls-page/data/senate_polls_historical.csv",
 "https://projects.fivethirtyeight.com/polls-page/data/senate_polls.csv",
]
OUT=Path(__file__).resolve().parents[1]/"data"/"historical_backtest.json"
def fetch(url):
    request=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (ElectionCommandCenter research)"})
    with urllib.request.urlopen(request,timeout=90) as response:
        data=response.read(35_000_001)
    if len(data)>35_000_000:raise ValueError("File too large: "+url)
    rows=list(csv.DictReader(io.StringIO(data.decode("utf-8-sig"))))
    if not rows:raise ValueError("Empty CSV: "+url)
    return rows

def outcomes(rows):
    grouped=defaultdict(lambda:defaultdict(float))
    races=defaultdict(set)
    for r in rows:
        try:
            year=int(r.get("cycle") or 0)
            if year not in (2016,2018,2020,2022,2024):continue
            if (r.get("stage") or "").lower()!="general":continue
            if (r.get("ranked_choice_round") or "").strip() not in ("","1"):continue
            party=(r.get("ballot_party") or "").upper()
            if party not in ("DEM","REP"):continue
            state=(r.get("state") or "").strip().lower()
            votes=float(r.get("votes") or 0)
            if votes<=0 or not state:continue
            key=(year,state)
            races[key].add(r.get("race_id"))
            grouped[key][party]+=votes
        except (TypeError,ValueError):continue
    results={}
    for key,totals in grouped.items():
        if len(races[key])!=1 or not totals["DEM"] or not totals["REP"]:continue
        results[key]=100*(totals["DEM"]-totals["REP"])/(totals["DEM"]+totals["REP"])
    return results

def main():
    results=outcomes(fetch(BASE))
    if not results:raise ValueError("No matched published election results")
    polls=[]
    failures=[]
    for url in POLL_URLS:
        try:polls+=fetch(url)
        except Exception as e:failures.append(str(e))
    if not polls:raise ValueError("All polling feeds failed: "+"; ".join(failures))
    records=poll_records(polls)
    predictions=evaluate(records,results)
    if not predictions:raise ValueError("No matched races: inspect polling and election-results schema")
    result=report(predictions,{year for year,_ in results})
    result["poll_source_urls"]=POLL_URLS
    result["results_source_url"]=BASE
    result["data_source_warnings"]=failures
    result["official_outcome_races_available"]=len(results)
    result["poll_races_available"]=len(records)
    OUT.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print("Historical backtest:",len(predictions),"comparisons",len(records),"polling races",len(results),"outcome races")

if __name__=="__main__":main()
