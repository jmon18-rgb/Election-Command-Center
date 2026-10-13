#!/usr/bin/env python3
"""Record real published race-odds snapshots with identical candidate identity.

No earlier odds are reconstructed from polling charts or backdated estimates.
The published odds source must match the current polling source timestamp.
"""
import datetime as dt
import json
import math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ODDS=ROOT/"data/race_probabilities.json"
POLLS=ROOT/"data/polling_estimates.json"
DEST=ROOT/"data/race_probability_history.json"

def parse_time(value):
    try:
        when=dt.datetime.fromisoformat(value.replace("Z","+00:00"))
        if when.tzinfo is None:raise ValueError("Timezone required")
        return when
    except (AttributeError,TypeError,ValueError) as e:
        raise ValueError("Invalid model snapshot timestamp") from e

def build(odds,polls,old=None):
    if (odds.get("schema_version")!="experimental-race-odds-v1" or
        odds.get("can_infer_chamber_control") is not False or
        odds.get("polling_source_generated_at")!=polls.get("generated_at")):
        raise ValueError("Race probability source drift; cannot record history")
    stamp=odds["polling_source_generated_at"]
    newest=parse_time(stamp)
    source={}
    for office,key in (("senate","senate_all"),("house","house"),("governor","governor")):
        for row in polls.get(key,[]):
            if row.get("status") in ("multi_poll","single_poll"):
                source[(office,row["race_code"])]=row
    entries=[]
    for r in odds.get("records",[]):
        match=source.get((r.get("office"),r.get("race_code")))
        if (not match or abs(match["dem_minus_rep"]-r["dem_minus_rep"])>.015 or
            match["latest_poll_end"]!=r["latest_poll_end"] or
            match["contributing_pollsters"]!=r["contributing_firms"] or
            not isinstance(match.get("dem_candidate"),str) or
            not isinstance(match.get("rep_candidate"),str) or
            not match["dem_candidate"] or not match["rep_candidate"] or
            not math.isfinite(r["dem_beats_rep_pct"]) or
            not 0<=r["dem_beats_rep_pct"]<=100):
            raise ValueError("Poll or candidate identity diverged from odds source")
        entries.append({
            "office":r["office"],"race_code":r["race_code"],
            "dem_candidate":match["dem_candidate"],
            "rep_candidate":match["rep_candidate"],
            "dem_minus_rep":r["dem_minus_rep"],
            "dem_beats_rep_pct":r["dem_beats_rep_pct"],
            "sigma_points":r["sigma_points"],
            "contributing_firms":r["contributing_firms"],
            "latest_poll_end":r["latest_poll_end"]
        })
    if len(entries)!=len(source) or len(entries)<30:
        raise ValueError("Source coverage mismatch: historical odds not publishable")
    snapshots={}
    for prev in ((old or {}).get("snapshots",[])):
        if not isinstance(prev,dict) or prev.get("method_version")!="experimental-race-odds-v1":
            continue
        time=prev.get("source_at")
        if not isinstance(time,str) or not isinstance(prev.get("races"),list):
            continue
        try:
            delta=newest-parse_time(time)
            if not dt.timedelta(0)<=delta<=dt.timedelta(days=30):continue
        except ValueError:continue
        snapshots[time]=prev
    snapshots[stamp]={
        "source_at":stamp,"method_version":"experimental-race-odds-v1",
        "polling_source_snapshot":odds.get("polling_source_snapshot"),
        "races":entries
    }
    ordered=[snapshots[k] for k in sorted(snapshots)][-90:]
    return {
        "schema_version":"observed-race-odds-history-v1",
        "status":"genuine_model_runs_only",
        "latest_source_at":stamp,
        "generated_at":odds["generated_at"],
        "can_infer_chamber_control":False,
        "snapshots":ordered,
        "description":"Source-timestamped published race odds; no backfilled hypothetical history."
    }

def main():
    odds=json.loads(ODDS.read_text())
    polls=json.loads(POLLS.read_text())
    try:previous=json.loads(DEST.read_text())
    except (OSError,ValueError):previous={}
    report=build(odds,polls,previous)
    DEST.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("Recorded observed race odds",len(report["snapshots"]),"snapshots at",report["latest_source_at"])

if __name__=="__main__":main()
