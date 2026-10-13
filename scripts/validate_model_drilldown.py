#!/usr/bin/env python3
"""Reconcile the JackStradamus race drilldown with the published polling model.

The visible included-poll table must reproduce the model's rounded averages
from the exact source snapshot. No excluded or partisan-sponsored survey may
accidentally influence the listed polling average.
"""
import json
import math
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
polls = json.loads((ROOT / "data/polls.json").read_text(encoding="utf-8"))
model = json.loads((ROOT / "data/polling_estimates.json").read_text(encoding="utf-8"))
assert model.get("is_election_forecast") is False
half_life = model["half_life_days"]
as_of = date.fromisoformat(model["generated_at"][:10])
races = {r["race_code"]: r for r in polls["races"] if r["race_type"] == "senate"}
checked = 0
for state in model["states"]:
    if state.get("status") not in {"multi_poll", "single_poll"}:
        continue
    key = state["state"] + "-SEN"
    assert key in races, f"Missing source race: {key}"
    source = races[key]["polls"]
    selections = state["pollsters"]
    assert len(selections) == state["independent_pollsters"], key
    used_firms = set()
    total_weight = weighted_dem = weighted_rep = 0.0
    for selection in selections:
        matches = [p for p in source if
            p["pollster"].casefold() == selection["name"].casefold()
            and p["field_end"] == selection["field_end"]
            and p["dem_name"] == state["dem_candidate"]
            and p["rep_name"] == state["rep_candidate"]
            and not p.get("partisan_lean")]
        assert len(matches) == 1, f"{key}: selected poll not uniquely found: {selection}"
        poll = matches[0]
        firm = poll["pollster"].casefold()
        assert firm not in used_firms, f"{key}: multiple selected waves from {firm}"
        used_firms.add(firm)
        age = (as_of - date.fromisoformat(poll["field_end"])).days
        assert 0 <= age <= model["window_days"], f"{key}: out-of-window poll"
        weight = math.pow(0.5, age / half_life)
        total_weight += weight
        weighted_dem += weight * poll["dem"]
        weighted_rep += weight * poll["rep"]
    assert total_weight > 0
    expected_dem = weighted_dem / total_weight
    expected_rep = weighted_rep / total_weight
    assert abs(expected_dem - state["dem_pct"]) < 0.011, f"{key}: Dem average mismatch"
    assert abs(expected_rep - state["rep_pct"]) < 0.011, f"{key}: Rep average mismatch"
    assert abs((expected_dem - expected_rep) - state["dem_minus_rep"]) < 0.021, f"{key}: margin mismatch"
    checked += 1
assert checked > 0, "No Senate polling estimates to validate"
print(f"Validated {checked} state averages against their eligible source polls.")
