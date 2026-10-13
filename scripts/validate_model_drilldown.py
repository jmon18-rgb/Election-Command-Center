#!/usr/bin/env python3
"""Reconcile all JackStradamus estimates with exactly their selected source polls.
A sponsored poll gets the published fixed, symmetric sponsor adjustment.
"""
import json, math
from datetime import date
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/"data/polls.json").read_text(encoding="utf-8"))
model=json.loads((ROOT/"data/polling_estimates.json").read_text(encoding="utf-8"))
assert model["is_election_forecast"] is False
half_life=model["half_life_days"]
partisan=model.get("sponsored_poll_weight_factor", 0.0)
asof=date.fromisoformat(model["generated_at"][:10])
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
        assert poll["pollster"].casefold() not in used,f"{code}: duplicate firm"
        used.add(poll["pollster"].casefold())
        age=(asof-date.fromisoformat(poll["field_end"])).days
        assert 0<=age<=(30 if is_generic else model["window_days"]),f"{code}: poll too old"
        weight=0.5**(age/half_life)*(partisan if poll.get("partisan_lean") else 1.)
        total_weight+=weight
        weighted_dem+=weight*poll["dem"]
        weighted_rep+=weight*poll["rep"]
    assert total_weight>0
    dm=weighted_dem/total_weight
    rp=weighted_rep/total_weight
    assert abs(dm-state["dem_pct"])<0.011,(code,dm,state["dem_pct"])
    assert abs(rp-state["rep_pct"])<0.011,(code,rp,state["rep_pct"])
    assert abs((dm-rp)-state["dem_minus_rep"])<0.021,code
    checked+=1
assert checked>0
print(f"Validated {checked} race/generic polling averages, including sponsored-survey weights.")
