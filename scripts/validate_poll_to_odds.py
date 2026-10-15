#!/usr/bin/env python3
"""Fail publication if new source polls disappear between collection, averages and odds.

Keep this separate from the polling estimator: independent provenance checks
must not share the selection algorithm they are testing.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OFFICES = {"senate": "senate_all", "house": "house", "governor": "governor"}
MODEL_WINDOW_DAYS = 45


def eligible_model_rows(model):
    rows = {}
    for office, field in OFFICES.items():
        for race in model.get(field, []):
            if race.get("status") not in {"single_poll", "multi_poll"}:
                continue
            key = (office, race["race_code"])
            if key in rows:
                raise ValueError(f"Duplicate model race {key}")
            rows[key] = race
    return rows


def check(primary, model, odds, supplemental=None, *, today=None):
    """Check every modeled poll, every probability, and newest indexed firm waves.

    Repeated same-day questions from one firm are ambiguous by construction:
    they must not be forced into an average or counted multiple times.
    """
    today = today or date.today()
    if model.get("source_snapshot") != primary.get("updated_at"):
        raise ValueError("Polling average was generated from an outdated primary snapshot")
    if odds.get("polling_source_generated_at") != model.get("generated_at") or (
        odds.get("polling_source_snapshot") != primary.get("updated_at")
    ):
        raise ValueError("Race odds were generated from an outdated polling snapshot")

    source = {race["race_code"]: race for race in primary.get("races", [])}
    modeled = eligible_model_rows(model)
    probabilities = {}
    for p in odds.get("records", []):
        key = (p.get("office"), p.get("race_code"))
        if key in probabilities:
            raise ValueError(f"Duplicate probability: {key}")
        probabilities[key] = p
    if set(modeled) != set(probabilities):
        raise ValueError(
            f"Modeled races and odds differ: "
            f"missing odds {sorted(set(modeled) - set(probabilities))[:6]}; "
            f"stale odds {sorted(set(probabilities) - set(modeled))[:6]}"
        )

    referenced = 0
    for key, race in modeled.items():
        raw = source.get(race["race_code"], {}).get("polls", [])
        for poll in race.get("pollsters", []):
            matching = [
                p for p in raw
                if p.get("poll_id") == poll.get("poll_id")
                and p.get("pollster") == poll.get("name")
                and p.get("field_end") == poll.get("field_end")
                and p.get("dem_name") == race.get("dem_candidate")
                and p.get("rep_name") == race.get("rep_candidate")
            ]
            if len(matching) != 1:
                raise ValueError(f"{key}: weighted survey not traceable to one source: {poll}")
            referenced += 1
        p = probabilities[key]
        if (abs(float(p["dem_minus_rep"]) - race["dem_minus_rep"]) > .011
            or p.get("latest_poll_end") != race.get("latest_poll_end")
            or p.get("contributing_firms") != race.get("contributing_pollsters")
            or p.get("independent_firms") != race.get("independent_pollsters")):
            raise ValueError(f"{key}: probability does not match current weighted polling")

    newest_indexed = 0
    ambiguous_waves = 0
    for p in (supplemental or {}).get("observations", []):
        key = (p.get("race_type"), p.get("race_code"))
        race = modeled.get(key)
        if not race or (p.get("dem_name"), p.get("rep_name")) != (
            race.get("dem_candidate"), race.get("rep_candidate")
        ):
            continue
        if str(p.get("pollster", "")).casefold() in {
            str(x).casefold() for x in model.get("excluded_pollsters", [])
        }:
            continue
        try:
            age = (today - date.fromisoformat(p["field_end"])).days
        except (ValueError, KeyError, TypeError):
            continue
        if not 0 <= age <= MODEL_WINDOW_DAYS:
            continue
        raw = source.get(p["race_code"], {}).get("polls", [])
        exact = [
            item for item in raw
            if item.get("poll_id") == p.get("poll_id")
            and item.get("pollster") == p.get("pollster")
            and item.get("field_end") == p.get("field_end")
            and item.get("dem_name") == p.get("dem_name")
            and item.get("rep_name") == p.get("rep_name")
            and item.get("dem") == p.get("dem")
            and item.get("rep") == p.get("rep")
        ]
        if not exact:
            # The separate ingestion validator decides whether this study
            # qualifies for the primary model at all.
            continue
        waves = [
            item for item in raw
            if str(item.get("pollster", "")).casefold() == str(p.get("pollster", "")).casefold()
            and item.get("dem_name") == p.get("dem_name")
            and item.get("rep_name") == p.get("rep_name")
            and item.get("field_end") >= p["field_end"]
        ]
        if any(item.get("field_end") > p["field_end"] for item in waves):
            continue  # An older poll from the same firm is intentionally superseded.
        unique_ids = {item.get("poll_id") for item in waves}
        if len(unique_ids) != 1:
            ambiguous_waves += 1
            continue  # Same-day alternative studies cannot both be weighted.
        newest_indexed += 1
        if not any(
            item.get("poll_id") == p.get("poll_id")
            and item.get("field_end") == p["field_end"]
            and item.get("name") == p["pollster"]
            for item in race.get("pollsters", [])
        ):
            raise ValueError(
                f"New source poll in primary but NOT in weighted average/odds: "
                f"{p['race_code']} / {p['pollster']} / {p['poll_id']}"
            )
    if len(modeled) < 30 or referenced < 30:
        raise ValueError("Missing broad source/model coverage")
    return {"modeled_races": len(modeled), "linked_firm_waves": referenced,
            "linked_probability_records": len(probabilities),
            "verified_newest_indexed_waves": newest_indexed,
            "ambiguous_same_day_questions": ambiguous_waves}


def main():
    source = ROOT / "data"
    def load(filename):
        return json.loads((source / filename).read_text(encoding="utf-8"))
    primary = load("polls.json")
    model = load("polling_estimates.json")
    odds = load("race_probabilities.json")
    supplement = load("pollresults_recent.json")
    print("POLL TO FORECAST LINKAGE VERIFIED:", json.dumps(
        check(primary, model, odds, supplement), sort_keys=True))


if __name__ == "__main__":
    main()
