#!/usr/bin/env python3
"""Release gate for the complete published polling-to-forecast bundle.

Uses invariant source lineage, not frozen pollster names or race counts.
Supports rolling live feeds and makes false-synchronized publications fail.
"""
from __future__ import annotations
import json
import math
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
OFFICES = ("senate", "house", "governor")
ACTIVE = {"single_poll", "multi_poll"}


def health(primary, model, odds, seats, wire=None):
    issues = []
    fail = lambda x: issues.append(x)
    src = primary.get("updated_at")
    built = model.get("generated_at")
    if primary.get("health", {}).get("status") != "ok":
        fail("Primary polling ingestion is incomplete")
    if not src or model.get("source_snapshot") != src:
        fail("Polling estimates do not match source snapshot")
    if odds.get("polling_source_snapshot") != src or odds.get("polling_source_generated_at") != built:
        fail("Standalone probability inputs do not match weighted polls")
    if seats.get("polling_source_snapshot") != built:
        fail("Seat inventory was built from another polling revision")
    if seats.get("house", {}).get("total_voting_seats") != 435:
        fail("House seat inventory is not 435")
    if seats.get("senate", {}).get("contested_total") != 35:
        fail("Senate race inventory is not 35")

    primary_races = {r.get("race_code"): r for r in primary.get("races", [])}
    if len(primary_races) != len(primary.get("races", [])):
        fail("Duplicate primary race IDs")
    odds_records = odds.get("records", [])
    prob = {(r.get("office"), r.get("race_code")): r for r in odds_records}
    if len(prob) != len(odds_records):
        fail("Duplicate office-specific probability records")
    included = {}
    for office in OFFICES:
        rows = [r for r in model.get("senate_all" if office == "senate" else office, [])
                if r.get("status") in ACTIVE]
        for row in rows:
            code = row.get("race_code")
            key = (office, code)
            original = primary_races.get(code)
            result = prob.get(key)
            if original is None or original.get("race_type") != office:
                fail(f"{code}: missing exact office source")
                continue
            if not result:
                fail(f"{code}: no corresponding probability")
                continue
            if (abs(float(result.get("dem_minus_rep", -1000)) -
                    float(row.get("dem_minus_rep", 1000))) > .011 or
                    result.get("latest_poll_end") != row.get("latest_poll_end")):
                fail(f"{code}: stale probability margin or fieldwork date")
            picks = row.get("pollsters", [])
            if len(picks) != row.get("contributing_pollsters"):
                fail(f"{code}: pollster contribution count mismatch")
            if row.get("independent_pollsters", 0) + row.get("partisan_pollsters", 0) != len(picks):
                fail(f"{code}: independent/sponsored firms mismatch")
            if len({str(p.get("name", "")).casefold() for p in picks}) != len(picks):
                fail(f"{code}: multiple questions from same firm counted twice")
            if not math.isclose(sum(float(p.get("weight_share", 0)) for p in picks), 100,
                                rel_tol=0, abs_tol=.2):
                fail(f"{code}: poll shares do not sum to 100%")
            for pick in picks:
                matches = [p for p in original.get("polls", [])
                           if p.get("poll_id") == pick.get("poll_id")
                           and p.get("pollster") == pick.get("name")
                           and p.get("field_end") == pick.get("field_end")
                           and p.get("dem_name") == row.get("dem_candidate")
                           and p.get("rep_name") == row.get("rep_candidate")]
                if len(matches) != 1:
                    fail(f"{code}: included source question not uniquely traceable")
                    continue
                p = matches[0]
                # New builds include the actual question/population/values,
                # which disambiguates LV and RV releases sharing one poll ID.
                for field, alias in (("question_id", "question_id"),
                                     ("sample_population", "sample_population"),
                                     ("dem", "dem"), ("rep", "rep")):
                    if alias in pick and pick[alias] != p.get(field):
                        fail(f"{code}: wrong {field} in included survey wave")
            included[key] = len(picks)
    if set(prob) != set(included):
        fail("Model rows and probability records disagree: " +
             str(sorted(set(prob) ^ set(included))[:8]))
    for office, category in (("senate", "senate"), ("house", "house")):
        expected = len([key for key in included if key[0] == office])
        if seats.get(category, {}).get("polled_with_qualifying_average") != expected:
            fail(f"{office}: seat inventory has an obsolete polling coverage count")
    if wire and not isinstance(wire.get("observations"), list):
        fail("Poll Wire source is not a list")
    if issues:
        raise ValueError("UNSAFE PUBLISH - " + "; ".join(issues[:25]))
    return {"status": "linked_source_bundle_healthy",
            "source_at": src, "model_at": built,
            "polled_races": {office: len([k for k in included if k[0] == office])
                             for office in OFFICES},
            "linked_firm_waves": sum(included.values()),
            "wire_observations": len((wire or {}).get("observations", []))}


def main():
    load = lambda name: json.loads((DATA / (name + ".json")).read_text(encoding="utf-8"))
    outcome = health(load("polls"), load("polling_estimates"),
                     load("race_probabilities"), load("seat_universe"),
                     load("pollresults_recent"))
    print(json.dumps(outcome, indent=2))


if __name__ == "__main__":
    main()
