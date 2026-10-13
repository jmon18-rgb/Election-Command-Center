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
import re
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/polls.json"
DEST = ROOT / "data/polling_estimates.json"
QUALITY_FILE = ROOT / "data/pollster_quality.json"
QUALITY_DATA = json.loads(QUALITY_FILE.read_text(encoding="utf-8"))
QUALITY = {k.casefold():v for k,v in QUALITY_DATA["entries"].items()}
EXCLUSIONS = {k.casefold():v for k,v in QUALITY_DATA.get("explicit_exclusions",{}).items()}
SILVER_STAGED = ROOT / "data/silver_ratings_staging.json"
SILVER = {}
SILVER_SOURCE = None
if SILVER_STAGED.exists():
    staging=json.loads(SILVER_STAGED.read_text(encoding="utf-8"))
    if staging.get("status")=="staged_not_used_in_live_model" and staging.get("matched_to_older_538_aliases",0)>=20:
        names=staging.get("entries",{})
        def normalized_name(n):
            return re.sub(r"[^a-z0-9]+"," ",str(n or "").casefold()).strip()
        for alias,target in staging.get("matches",{}).items():
            entry=names.get(normalized_name(target))
            if entry:SILVER[normalized_name(alias)]=entry
        for entry in names.values():
            SILVER.setdefault(normalized_name(entry.get("pollster")),entry)
        SILVER_SOURCE=staging.get("source_page")

def silver_quality_factor(p):
    item=SILVER.get(re.sub(r"[^a-z0-9]+"," ",p["pollster"].casefold()).strip())
    if not item:return 1.0,False
    try:
        pm=float(item["predictive_plus_minus_raw"])
        history=float(item.get("history_count_raw") or 0)
        if not math.isfinite(pm) or not math.isfinite(history):return 1.0,False
    except (TypeError,ValueError,KeyError):
        return 1.0,False
    shrink=min(1,max(0,history)/20)
    return max(.65,min(1.5,math.exp(-.12*pm*shrink))),True

SIZE_EXPONENT = 0.20
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

def quality_multiplier(p):
    rated=QUALITY.get(p["pollster"].casefold())
    if not rated:return 1.0
    # Sparse historic records shouldn't move a pollster's weight much.
    shrunk=2.0+(rated["rating"]-2.0)*min(1.0,rated["history_count"]/20.0)
    return 1.0+0.25*(shrunk-2.0)

def size_multiplier(p):
    n=p.get("sample_size")
    if not isinstance(n,(int,float)) or n<=0:return 1.0
    return (max(300,min(2500,n))/800.0)**SIZE_EXPONENT

def weighted(p, today):
    age=(today-date.fromisoformat(p["field_end"])).days
    return (0.5**(age/HALF_LIFE)
            *(PARTISAN_FACTOR if p.get("partisan_lean") else 1.0)
            *quality_multiplier(p)*size_multiplier(p))

def estimate(race, today, generic=False):
    grouped=defaultdict(list)
    source=(race.get("latest",[]) if generic else race.get("polls",[]))
    for p in source:
        try:
            day=date.fromisoformat(p["field_end"])
            age=(today-day).days
            if not 0 <= age <= (30 if generic else WINDOW) or not numeric(p) or (p.get("pollster") or "").casefold() in EXCLUSIONS:
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
    weights=[weighted(p,today) for p in chosen]
    sw=sum(weights)
    dem=sum(w*p["dem"] for p,w in zip(chosen,weights))/sw
    rep=sum(w*p["rep"] for p,w in zip(chosen,weights))/sw
    margins=[p["dem"]-p["rep"] for p in chosen]
    # Effective number of independent firms after weighting; this is NOT
    # sample size or forecast confidence. A single huge weight drives it toward 1.
    effective_firms=sw*sw/sum(w*w for w in weights)
    independent=[(p,w) for p,w in zip(chosen,weights) if not p.get("partisan_lean")]
    independent_mean=(sum((p["dem"]-p["rep"])*w for p,w in independent)/
                      sum(w for _,w in independent)) if independent else None
    alternatives={"equal_firms":sum(margins)/len(margins)}
    if independent_mean is not None:
        alternatives["independent_only"]=independent_mean
    alternatives["faster_recency_14d"]=(
        sum((p["dem"]-p["rep"])*w*2**(-max(0,(today-date.fromisoformat(p["field_end"])).days)*(1/14-1/HALF_LIFE))
            for p,w in zip(chosen,weights))/
        sum(w*2**(-max(0,(today-date.fromisoformat(p["field_end"])).days)*(1/14-1/HALF_LIFE))
            for p,w in zip(chosen,weights)))
    # Diagnostic sensitivity to defensible weighting choices, never uncertainty.
    # Research comparison only: same polls and 0.5 sponsorship, with source-
    # attributed Silver Bulletin 2026 predictive plus-minus replacing 538 grades.
    silver_alt=None
    if SILVER_SOURCE:
        alt=[weighted(p,today)/quality_multiplier(p)*silver_quality_factor(p)[0] for p in chosen]
        alt_total=sum(alt)
        alt_dem=sum(w*p["dem"] for p,w in zip(chosen,alt))/alt_total
        alt_rep=sum(w*p["rep"] for p,w in zip(chosen,alt))/alt_total
        alt_margin=alt_dem-alt_rep
        silver_alt={
            "dem_minus_rep":round(alt_margin,2),
            "dem_pct":round(alt_dem,2),
            "rep_pct":round(alt_rep,2),
            "difference_from_live":round(alt_margin-(dem-rep),2),
            "rated_pollster_count":sum(silver_quality_factor(p)[1] for p in chosen),
            "source_url":SILVER_SOURCE,
            "status":"experimental_not_used_for_headline",
            "method":"Jan 2026 predictive plus-minus with capped exponential multiplier; same eligibility, recency, sample and 0.5 sponsorship; NOT an outcome forecast."
        }
    model_sensitivity={
        "effective_firms":round(effective_firms,2),
        "largest_firm_weight_pct":round(100*max(weights)/sw,1),
        "independent_only_margin":round(independent_mean,2) if independent_mean is not None else None,
        "equal_firms_margin":round(alternatives["equal_firms"],2),
        "faster_recency_margin":round(alternatives["faster_recency_14d"],2),
        "alternative_margin_min":round(min(alternatives.values()),2),
        "alternative_margin_max":round(max(alternatives.values()),2),
        "interpretation":"Alternative polling-weight choices; NOT an election forecast interval or a statistical confidence interval."
    }
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
            "model_sensitivity":model_sensitivity,
            "silver_2026_comparison":silver_alt,
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
            "quality_rating":(QUALITY.get(p["pollster"].casefold()) or {}).get("rating"),
            "quality_multiplier":round(quality_multiplier(p),3),
            "sample_multiplier":round(size_multiplier(p),3),
        } for p in chosen],
        "method":"Latest wave per firm; 21d recency, capped sample-size factor, 538 historical pollster quality and 0.5 sponsored-poll factor."
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
        "method_version":"poll-mean-1.4",
        "window_days":WINDOW,"half_life_days":HALF_LIFE,
        "sponsored_poll_weight_factor":PARTISAN_FACTOR,
        "pollster_quality_source":QUALITY_DATA["source_url"],
        "pollster_quality_version":QUALITY_DATA["source_repo_sha"],
        "silver_2026_comparison_source":SILVER_SOURCE,
        "silver_2026_comparison_status":"experimental_not_used_for_headline" if SILVER_SOURCE else "unavailable",
        "sample_size_weight_exponent":SIZE_EXPONENT,
        "excluded_pollsters":list(QUALITY_DATA.get("explicit_exclusions",{})),
        "states":states,
        "senate_all":senate,
        "house":build_office("house"),
        "governor":build_office("governor"),
        "generic_ballot":generic,
        "limitations":[
            "Polling averages are not election-win probabilities or projected outcomes.",
            "0.5 sponsor factor is a declared sensitivity choice, not an empirically estimated house effect.",
            "Historical 538 ratings predate the current cycle and are matched to current pollsters with explicit aliases.",
            "Unrated firms receive neutral quality weight; sample-size importance is a capped provisional exponent.",
            "The public feed retains up to 60 surveys per race over 65 days; historical series remain incomplete.",
            "Candidates in different ballot matchups are not averaged together.",
            "Polling quality and candidate support errors are not yet calibrated for 2026."
        ]
    }

HISTORY=ROOT/"data/model_history.json"

def write_history(snapshot):
    """Bounded chronological polling evidence snapshots for change detection.

    Compare only identical candidate matchups; descriptive shifts are NOT vote
    projections and never imply completed election results.
    """
    try:
        archive=json.loads(HISTORY.read_text(encoding="utf-8"))
        history=archive.get("snapshots",[]) if isinstance(archive,dict) else []
    except (OSError,ValueError,TypeError):
        history=[]
    observed=[]
    for office in ("senate_all","house","governor"):
        for r in snapshot.get(office,[]):
            if r.get("status") not in ("single_poll","multi_poll"):continue
            if not isinstance(r.get("dem_minus_rep"),(int,float)):continue
            observed.append({
                "race_code":r["race_code"],"race_type":r["race_type"],
                "state":r["state"],"state_name":r["state_name"],
                "dem_candidate":r.get("dem_candidate"),"rep_candidate":r.get("rep_candidate"),
                "dem_minus_rep":r["dem_minus_rep"],
                "contributing_pollsters":r.get("contributing_pollsters",0),
                "latest_poll_end":r.get("latest_poll_end"),
                "status":r["status"]
            })
    generic=snapshot.get("generic_ballot",{})
    if isinstance(generic.get("dem_minus_rep"),(int,float)):
        observed.append({"race_code":"US-GENERIC","race_type":"generic",
                         "dem_minus_rep":generic["dem_minus_rep"],
                         "contributing_pollsters":generic.get("contributing_pollsters",0),
                         "latest_poll_end":generic.get("latest_poll_end")})
    new={"at":snapshot["generated_at"],"method_version":snapshot["method_version"],
         "source_snapshot":snapshot.get("source_snapshot"),"races":observed}
    # Store the latest observation in each UTC 12-hour block. This preserves
    # real daily movement without publishing 4-MB redundant refresh archives.
    def block_key(item):
        instant=datetime.fromisoformat(item["at"].replace("Z","+00:00"))
        return (instant.date().isoformat(),instant.hour//12)
    if history and block_key(history[-1])==block_key(new):
        history[-1]=new
    else:
        history.append(new)
    # Keep up to 30 days of half-day snapshots (plus a safety cap).
    cutoff=datetime.now(timezone.utc).timestamp()-30*86400
    kept=[]
    for row in history:
        try:
            stamp=datetime.fromisoformat(row["at"].replace("Z","+00:00")).timestamp()
            if stamp>=cutoff:kept.append(row)
        except (ValueError,KeyError,TypeError):
            continue
    kept=kept[-70:]
    HISTORY.write_text(json.dumps({
      "generated_at":snapshot["generated_at"],
      "schema_version":"1.0",
      "description":"Observed poll-average snapshots; no forecasts or win probabilities.",
      "snapshots":kept
    },separators=(",",":"))+"\n",encoding="utf-8")

if __name__=="__main__":
    output=build(json.loads(SOURCE.read_text(encoding="utf-8")))
    DEST.write_text(json.dumps(output,indent=2)+"\n",encoding="utf-8")
    write_history(output)
    print("Built Senate",len(output["senate_all"]),"House",len(output["house"]),
          "Governor",len(output["governor"]),"generic",output["generic_ballot"]["status"])
