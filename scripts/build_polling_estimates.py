#!/usr/bin/env python3
"""Publish defensible descriptive 2026 Senate polling estimates.

This is NOT an election-outcome model. No win probabilities or forecasted
winners are produced. Filters and weights are fixed before observing results.
"""
import json, math
from datetime import date, datetime, timezone
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"data"/"polls.json"
DEST=ROOT/"data"/"polling_estimates.json"
WINDOW=45
HALF_LIFE=21
STATES={"ME":"Maine","OH":"Ohio","NC":"North Carolina","MI":"Michigan","GA":"Georgia","NH":"New Hampshire","AK":"Alaska","IA":"Iowa","TX":"Texas","NE":"Nebraska","KS":"Kansas","MN":"Minnesota"}

def estimate(race, today):
    grouped=defaultdict(list)
    for p in race.get("polls",[]):
        try:
            day=date.fromisoformat(p["field_end"])
            age=(today-day).days
            if not 0<=age<=WINDOW or p.get("partisan_lean"):
                continue
            dem,rep=p.get("dem_name","").strip(),p.get("rep_name","").strip()
            if not dem or not rep or "generic" in (dem+" "+rep).lower():
                continue
            if not all(isinstance(p.get(k),(int,float)) and math.isfinite(p[k]) for k in ("dem","rep","margin")):
                continue
            grouped[(dem.casefold(),rep.casefold())].append(p)
        except (ValueError,TypeError,KeyError):
            continue
    if not grouped:
        return {"status":"no_recent_qualifying_polls"}
    # Select the most frequently sampled named-candidate matchup, not an
    # average of incompatible ballot tests.
    matchup,polls=max(grouped.items(),key=lambda kv:(len({p["pollster"].casefold() for p in kv[1]}),max(p["field_end"] for p in kv[1])))
    latest_by_firm={}
    for p in sorted(polls,key=lambda p:p["field_end"],reverse=True):
        latest_by_firm.setdefault(p["pollster"].casefold(),p)
    chosen=list(latest_by_firm.values())
    sw=sd=sr=0.
    for p in chosen:
        age=(today-date.fromisoformat(p["field_end"])).days
        n=p.get("sample_size") or 600
        w=math.pow(.5,age/HALF_LIFE)*math.sqrt(max(200,min(3000,n))/600)
        sw+=w
        sd+=w*p["dem"]
        sr+=w*p["rep"]
    dem,rep=sd/sw,sr/sw
    return {
        "status":"multi_poll" if len(chosen)>=2 else "single_poll",
        "dem_candidate":chosen[0]["dem_name"],"rep_candidate":chosen[0]["rep_name"],
        "dem_pct":round(dem,2),"rep_pct":round(rep,2),
        "dem_minus_rep":round(dem-rep,2),
        "independent_pollsters":len(chosen),
        "latest_poll_end":max(p["field_end"] for p in chosen),
        "oldest_included_poll_end":min(p["field_end"] for p in chosen),
        "pollsters":[{"name":p["pollster"],"field_end":p["field_end"],"sample_size":p.get("sample_size")} for p in chosen],
        "method":"One latest wave per pollster for most-covered named matchup; 21-day exponential half-life; sqrt(n) weights; partisan-sponsored polls excluded",
    }

def build(data):
    today=datetime.now(timezone.utc).date()
    races={r["state"]:r for r in data.get("races",[]) if r.get("race_type")=="senate"}
    rows=[]
    for state,name in STATES.items():
        row={"state":state,"state_name":name}
        row.update(estimate(races[state],today) if state in races else {"status":"no_recent_qualifying_polls"})
        rows.append(row)
    return {
        "generated_at":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
        "source_snapshot":data.get("updated_at"),
        "type":"descriptive_polling_estimates",
        "is_election_forecast":False,
        "method_version":"poll-mean-1.0",
        "window_days":WINDOW,
        "half_life_days":HALF_LIFE,
        "states":rows,
        "limitations":["Not an election prediction or calibrated probability.","Unmeasured pollster house effects and correlated errors remain.","Averages exclude sponsored polls but lack independent pollster-quality ratings.","Candidate matchups are not combined.","Historical election backtesting required before claiming election-outcome accuracy."]
    }

if __name__=="__main__":
    output=build(json.loads(SOURCE.read_text(encoding="utf-8")))
    DEST.write_text(json.dumps(output,indent=2)+"\n",encoding="utf-8")
    print(f"Built {len(output['states'])} Senate state summaries")
