#!/usr/bin/env python3
"""Generate descriptive JackStradamus polling averages for Senate, House,
governors and the national generic congressional ballot.

These are *polling aggregates*, not calibrated election-outcome forecasts.
Campaign-sponsored polls are included at half the weight of an otherwise
similar independent poll. The weight is fixed, symmetric and explicitly
a provisional assumption, not an empirical pollster-specific house effect.
"""
import json
import math
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/polls.json"
DEST = ROOT / "data/polling_estimates.json"
WINDOW = 45
HALF_LIFE = 21
PARTISAN_FACTOR = 0.5
STATES = {"ME":"Maine","OH":"Ohio","NC":"North Carolina","MI":"Michigan",
          "GA":"Georgia","NH":"New Hampshire","AK":"Alaska","IA":"Iowa",
          "TX":"Texas","NE":"Nebraska","KS":"Kansas","MN":"Minnesota"}
STATE_NAMES = {
"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California",
"CO":"Colorado","CT":"Connecticut","DE":"Delaware","FL":"Florida","GA":"Georgia",
"HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas",
"KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts",
"MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana",
"NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico",
"NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma",
"OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina",
"SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont",
"VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming"}
def numeric(p):
    return all(type(p.get(k)) in (int,float) and math.isfinite(p[k])
               for k in ("dem","rep","margin"))

def weighted(p, today):
    age = (today - date.fromisoformat(p["field_end"])).days
    return 0.5**(age / HALF_LIFE) * (PARTISAN_FACTOR if p.get("partisan_lean") else 1.0)

def estimate(race, today, generic=False):
    grouped=defaultdict(list)
    source=(race.get("latest",[]) if generic else race.get("polls",[]))
    for p in source:
        try:
            day=date.fromisoformat(p["field_end"])
            age=(today-day).days
            if not 0 <= age <= (30 if generic else WINDOW) or not numeric(p):
                continue
            if generic:
                key=("Generic Democratic","Generic Republican")
            else:
                dem=(p.get("dem_name") or "").strip()
                rep=(p.get("rep_name") or "").strip()
                if not dem or not rep or "generic" in (dem+" "+rep).lower():
                    continue
                key=(dem.casefold(),rep.casefold())
            if p.get("pollster"):
                grouped[key].append(p)
        except (ValueError,TypeError,KeyError):
            continue
    if not grouped:
        return {"status":"no_recent_qualifying_polls"}
    matchup,polls=max(grouped.items(),key=lambda kv:
        (len({p["pollster"].casefold() for p in kv[1]}),
         max(p["field_end"] for p in kv[1])))
    if generic:
        # Mirror the historical 14-day headline window when it has coverage.
        recent=[p for p in polls if (today-date.fromisoformat(p["field_end"])).days<=14]
        if len({p["pollster"].casefold() for p in recent})>=2:
            polls=recent
    latest={}
    for p in sorted(polls,key=lambda v:v["field_end"],reverse=True):
        latest.setdefault(p["pollster"].casefold(),p)
    chosen=list(latest.values())
    sw=sum(weighted(p,today) for p in chosen)
    dem=sum(weighted(p,today)*p["dem"] for p in chosen)/sw
    rep=sum(weighted(p,today)*p["rep"] for p in chosen)/sw
    margins=[p["dem"]-p["rep"] for p in chosen]
    m=sum(margins)/len(margins)
    spread=(sum((v-m)**2 for v in margins)/(len(margins)-1))**0.5 if len(margins)>1 else None
    age=min((today-date.fromisoformat(p["field_end"])).days for p in chosen)
    names=("Generic Democratic","Generic Republican") if generic else (chosen[0]["dem_name"],chosen[0]["rep_name"])
    return {
        "status":"multi_poll" if len(chosen)>=2 else "single_poll",
        "dem_candidate":names[0],"rep_candidate":names[1],
        "dem_pct":round(dem,2),"rep_pct":round(rep,2),
        "dem_minus_rep":round(dem-rep,2),
        "independent_pollsters":sum(not p.get("partisan_lean") for p in chosen),
        "contributing_pollsters":len(chosen),
        "partisan_pollsters":sum(bool(p.get("partisan_lean")) for p in chosen),
        "poll_diagnostics":{
            "poll_count":len(chosen),
            "pollster_spread_points":round(spread,2) if spread is not None else None,
            "observed_margin_min":round(min(margins),2),
            "observed_margin_max":round(max(margins),2),
            "latest_poll_age_days":age,
            "single_poll":len(chosen)==1,
            "thin_polling":len(chosen)<3,
            "stale_latest_poll":age>14,
            "high_poll_disagreement":spread is not None and spread>=6,
            "different_matchups_excluded":sum(len(v) for k,v in grouped.items() if k!=matchup),
            "interpretation":"Observed inter-poll spread, not a calibrated forecast error or evidence of intentional herding."
        },
        "latest_poll_end":max(p["field_end"] for p in chosen),
        "oldest_included_poll_end":min(p["field_end"] for p in chosen),
        "pollsters":[{
            "name":p["pollster"],"field_end":p["field_end"],
            "sample_size":p.get("sample_size"),
            "partisan_lean":p.get("partisan_lean") or "",
            "weight_share":round(100*weighted(p,today)/sw,3),
        } for p in chosen],
        "method":"One latest wave per firm for a consistent matchup, 21-day recency half-life, 0.5 sponsored-poll factor."
    }

def build(data):
    today=datetime.now(timezone.utc).date()
    races={r["race_code"]:r for r in data.get("races",[])}
    def build_office(kind):
        items=[]
        for code,race in races.items():
            if race.get("race_type")!=kind:
                continue
            row={
                "race_code":code,"state":race["state"],
                "state_name":STATE_NAMES.get(race["state"],race["state"]),
                "race_type":kind,
            }
            row["label"]=(row["state_name"]+" "+race["district"] if kind=="house"
                         else row["state_name"])
            row.update(estimate(race,today))
            row["poll_source_url"]=race.get("source_url")
            items.append(row)
        return sorted(items,key=lambda r:(r["state"],r["race_code"]))
    senate=build_office("senate")
    lookup={r["state"]:r for r in senate if r.get("race_code")==r["state"]+"-SEN"}
    states=[]
    for state,name in STATES.items():
        states.append(dict(lookup[state]) if state in lookup else {
            "state":state,"state_name":name,"race_code":state+"-SEN",
            "status":"no_recent_qualifying_polls"
        })
    generic=estimate(data.get("generic_ballot") or {},today,generic=True)
    generic["race_code"]="US-GENERIC"
    generic["state"]="US"
    generic["state_name"]="United States"
    generic["label"]="National generic congressional ballot"
    generic["race_type"]="generic"
    generic["poll_source_url"]=(data.get("generic_ballot") or {}).get("source_url")
    return {
        "generated_at":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
        "source_snapshot":data.get("updated_at"),
        "type":"descriptive_polling_estimates",
        "is_election_forecast":False,
        "method_version":"poll-mean-1.2",
        "window_days":WINDOW,"half_life_days":HALF_LIFE,
        "sponsored_poll_weight_factor":PARTISAN_FACTOR,
        "states":states,
        "senate_all":senate,
        "house":build_office("house"),
        "governor":build_office("governor"),
        "generic_ballot":generic,
        "limitations":[
            "Polling averages are not election-win probabilities or projected outcomes.",
            "0.5 sponsor factor is a declared sensitivity choice, not an empirically estimated house effect.",
            "The public feed limits polls per race; historical series remain incomplete.",
            "Candidates in different ballot matchups are not averaged together.",
            "Polling quality and candidate support errors are not yet calibrated for 2026."
        ]
    }

if __name__=="__main__":
    output=build(json.loads(SOURCE.read_text(encoding="utf-8")))
    DEST.write_text(json.dumps(output,indent=2)+"\n",encoding="utf-8")
    print("Built Senate",len(output["senate_all"]),"House",len(output["house"]),
          "Governor",len(output["governor"]),"generic",output["generic_ballot"]["status"])
