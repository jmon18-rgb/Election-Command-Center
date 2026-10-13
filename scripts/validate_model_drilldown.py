#!/usr/bin/env python3
"""Reconcile all JackStradamus estimates with exactly their selected source polls.
A sponsored poll gets the published fixed, symmetric sponsor adjustment.
"""
import json, math, re
from datetime import date
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/"data/polls.json").read_text(encoding="utf-8"))
model=json.loads((ROOT/"data/polling_estimates.json").read_text(encoding="utf-8"))
assert model["is_election_forecast"] is False
half_life=model["half_life_days"]
partisan=model.get("sponsored_poll_weight_factor", 0.0)
asof=date.fromisoformat(model["generated_at"][:10])
quality_data=json.loads((ROOT/"data/pollster_quality.json").read_text(encoding="utf-8"))
quality={k.casefold():v for k,v in quality_data["entries"].items()}
exclusions={k.casefold() for k in quality_data["explicit_exclusions"]}
SILVER={}
STAGED=ROOT/"data/silver_ratings_staging.json"
def norm_silver(n):
    return re.sub(r"[^a-z0-9]+"," ",str(n or "").casefold()).strip()
if STAGED.exists():
    staged=json.loads(STAGED.read_text(encoding="utf-8"))
    if staged.get("status")=="staged_not_used_in_live_model":
        entries=staged.get("entries",{})
        for alias,name in staged.get("matches",{}).items():
            obj=entries.get(norm_silver(name))
            if obj:SILVER[norm_silver(alias)]=obj
        for item in entries.values():
            SILVER.setdefault(norm_silver(item.get("pollster")),item)
def silver_multiplier(p):
    entry=SILVER.get(norm_silver(p["pollster"]))
    if entry is None:return 1.,False
    try:
        pm=float(entry["predictive_plus_minus_raw"])
        n=float(entry.get("history_count_raw") or 0)
    except (TypeError,ValueError,KeyError):return 1.,False
    if not math.isfinite(pm) or not math.isfinite(n):return 1.,False
    return max(.65,min(1.5,math.exp(-.12*pm*min(1,max(0,n)/20)))),True
def older_quality_factor(p):
    rating=quality.get(p["pollster"].casefold())
    if not rating:return 1.
    return 1+.25*((2+(rating["rating"]-2)*min(1,rating["history_count"]/20))-2)
def additional_weight(p):
    rating=quality.get(p["pollster"].casefold())
    if rating:
        shrunk=2+(rating["rating"]-2)*min(1.0,rating["history_count"]/20.0)
        q=1+0.25*(shrunk-2)
    else:q=1.
    n=p.get("sample_size")
    size=(max(300,min(2500,n))/800)**model.get("sample_size_weight_exponent",0.2) if isinstance(n,(int,float)) and n>0 else 1.
    return q*size
races={r["race_code"]:r for r in data["races"]}
all_rows=(model.get("senate_all",model["states"])+model.get("house",[])+
          model.get("governor",[])+[model.get("generic_ballot",{})])
checked=0
for state in all_rows:
    if state.get("status") not in {"single_poll","multi_poll"}:continue
    code=state.get("race_code") or state.get("state","")+"-SEN"
    is_generic=code=="US-GENERIC"
    if is_generic:
        source=(data.get("generic_ballot") or {}).get("latest",[])
    else:
        assert code in races, f"Missing source race {code}"
        source=races[code]["polls"]
    selections=state["pollsters"]
    assert len(selections)==state.get("contributing_pollsters",len(selections)),code
    if "independent_pollsters" in state and "partisan_pollsters" in state:
        assert (state["independent_pollsters"]+state["partisan_pollsters"]==
                len(selections)),code
    used=set()
    total_weight=weighted_dem=weighted_rep=0.
    for pick in selections:
        matching=[
            p for p in source if
            p["pollster"].casefold()==pick["name"].casefold() and
            p["field_end"]==pick["field_end"] and
            (is_generic or (p["dem_name"]==state["dem_candidate"] and
                            p["rep_name"]==state["rep_candidate"]))
        ]
        assert len(matching)==1,f"{code}: selected poll not unique: {pick}"
        poll=matching[0]
        assert poll["pollster"].casefold() not in exclusions,f"{code}: explicitly excluded pollster selected"
        assert poll["pollster"].casefold() not in used,f"{code}: duplicate firm"
        used.add(poll["pollster"].casefold())
        age=(asof-date.fromisoformat(poll["field_end"])).days
        assert 0<=age<=(30 if is_generic else model["window_days"]),f"{code}: poll too old"
        weight=0.5**(age/half_life)*(partisan if poll.get("partisan_lean") else 1.)*additional_weight(poll)
        total_weight+=weight
        weighted_dem+=weight*poll["dem"]
        weighted_rep+=weight*poll["rep"]
    assert total_weight>0
    for pick in selections:
        p=next(x for x in source if x["pollster"].casefold()==pick["name"].casefold()
               and x["field_end"]==pick["field_end"]
               and (is_generic or (x["dem_name"]==state["dem_candidate"] and x["rep_name"]==state["rep_candidate"])))
        age=(asof-date.fromisoformat(p["field_end"])).days
        weight=0.5**(age/half_life)*(partisan if p.get("partisan_lean") else 1.)*additional_weight(p)
        assert abs(pick["weight_share"]-100*weight/total_weight)<0.015,f"{code} displayed influence mismatch"
    sensitivity=(state.get("poll_diagnostics") or {}).get("model_sensitivity")
    if sensitivity:
        selected=[]
        for pick in selections:
            poll=next(p for p in source if p["pollster"].casefold()==pick["name"].casefold()
                      and p["field_end"]==pick["field_end"]
                      and (is_generic or (p["dem_name"]==state["dem_candidate"] and
                                          p["rep_name"]==state["rep_candidate"])))
            days=(asof-date.fromisoformat(poll["field_end"])).days
            weight=0.5**(days/half_life)*(partisan if poll.get("partisan_lean") else 1)*additional_weight(poll)
            selected.append((poll,weight,days))
        effective=total_weight**2/sum(w*w for _,w,_ in selected)
        assert abs(effective-sensitivity["effective_firms"])<=0.011,code
        assert abs(100*max(w for _,w,_ in selected)/total_weight-
                   sensitivity["largest_firm_weight_pct"])<=0.051,code
        equal=sum(p["dem"]-p["rep"] for p,_,_ in selected)/len(selected)
        assert abs(equal-sensitivity["equal_firms_margin"])<=0.011,code
        independent=[(p,w) for p,w,_ in selected if not p.get("partisan_lean")]
        if independent:
            indep=sum(w*(p["dem"]-p["rep"]) for p,w in independent)/sum(w for _,w in independent)
            assert abs(indep-sensitivity["independent_only_margin"])<=0.011,code
        else:
            assert sensitivity["independent_only_margin"] is None,code
        assert sensitivity["alternative_margin_min"]<=sensitivity["alternative_margin_max"],code
    silver=(state.get("poll_diagnostics") or {}).get("silver_2026_comparison")
    if silver:
        assert silver["status"]=="experimental_not_used_for_headline",code
        assert SILVER,"Silver comparison published without checked source data"
        silver_total=silver_dem=silver_rep=0.
        matched=0
        for pick in selections:
            poll=next(p for p in source if p["pollster"].casefold()==pick["name"].casefold()
                      and p["field_end"]==pick["field_end"]
                      and (is_generic or (p["dem_name"]==state["dem_candidate"] and
                                          p["rep_name"]==state["rep_candidate"])))
            days=(asof-date.fromisoformat(poll["field_end"])).days
            old_weight=.5**(days/half_life)*(partisan if poll.get("partisan_lean") else 1.)*additional_weight(poll)
            quality,is_matched=silver_multiplier(poll)
            matched+=int(is_matched)
            w=old_weight/older_quality_factor(poll)*quality
            silver_total+=w
            silver_dem+=w*poll["dem"]
            silver_rep+=w*poll["rep"]
        alternative=silver_dem/silver_total-silver_rep/silver_total
        assert abs(alternative-silver["dem_minus_rep"])<0.011,code
        assert abs(silver_dem/silver_total-silver["dem_pct"])<0.011,code
        assert abs(silver_rep/silver_total-silver["rep_pct"])<0.011,code
        assert matched==silver["rated_pollster_count"],code
    dm=weighted_dem/total_weight
    rp=weighted_rep/total_weight
    assert abs(dm-state["dem_pct"])<0.011,(code,dm,state["dem_pct"])
    assert abs(rp-state["rep_pct"])<0.011,(code,rp,state["rep_pct"])
    assert abs((dm-rp)-state["dem_minus_rep"])<0.021,code
    checked+=1
assert checked>0
print(f"Validated {checked} race/generic averages, quality, sample and sponsored-poll influence.")
