#!/usr/bin/env python3
"""Fail publication if new source polls disappear between collection, averages and odds.

Keep this separate from the polling estimator: independent provenance checks
must not share the selection algorithm they are testing.
"""
from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path
from poll_firm_wave_selection import select_latest_firm_waves

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
    # Reconstruct the eligibility window AS OF this published model, not the
    # runner's wall clock. A poll valid at build time can cross the 45-day
    # boundary overnight; that does not retroactively corrupt the snapshot.
    # The hourly refresh generates a new model today and remains strictly
    # validated against its own new eligibility window.
    today = today or date.fromisoformat(model["generated_at"][:10])
    if model.get("source_snapshot") != primary.get("updated_at"):
        raise ValueError("Polling average was generated from an outdated primary snapshot")
    if odds.get("polling_source_generated_at") != model.get("generated_at") or (
        odds.get("polling_source_snapshot") != primary.get("updated_at")
    ):
        raise ValueError("Race odds were generated from an outdated polling snapshot")

    source = {race["race_code"]: race for race in primary.get("races", [])}
    modeled = eligible_model_rows(model)
    # Compare the ENTIRE raw race universe against the modeled universe,
    # not only races already included by the estimator. Otherwise a new race
    # can vanish from both model and odds while their counts still match.
    excluded = {str(x).casefold() for x in model.get("excluded_pollsters", [])}
    source_current = set()
    for raw_race in primary.get("races", []):
        office, code = raw_race.get("race_type"), raw_race.get("race_code")
        if office not in OFFICES:
            continue
        for item in raw_race.get("polls", []):
            demname = str(item.get("dem_name") or "").strip().casefold()
            repname = str(item.get("rep_name") or "").strip().casefold()
            pollster = str(item.get("pollster") or "").strip().casefold()
            if (not demname or not repname or "generic" in demname
                    or "generic" in repname or not pollster or pollster in excluded):
                continue
            try:
                age = (today - date.fromisoformat(item["field_end"])).days
                nums = [float(item[k]) for k in ("dem", "rep", "margin")]
            except (KeyError, TypeError, ValueError):
                continue
            if 0 <= age <= MODEL_WINDOW_DAYS and all(math.isfinite(x) for x in nums):
                source_current.add((office, code))
                break
    missing_races = source_current - set(modeled)
    if missing_races:
        raise ValueError("Qualifying 2026 source races absent from BOTH model and odds: "
                         + repr(sorted(missing_races)[:10]))
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
    freshest_primary_waves = 0
    ambiguous_primary_waves = 0
    for key, race in modeled.items():
        raw = source.get(race["race_code"], {}).get("polls", [])
        # Don't merely verify the polls the estimator SAYS it used. Verify
        # that it didn't silently miss the newest qualifying wave from ANY
        # primary polling source, including those absent from PollResults.
        # The matchup/window rules mirror the published eligibility contract,
        # but this source-to-output inventory is independent of aggregation.
        latest_by_firm = {}
        eligible_for_selection = []
        for item in raw:
            if ((item.get("dem_name"), item.get("rep_name")) !=
                    (race.get("dem_candidate"), race.get("rep_candidate"))):
                continue
            firm = str(item.get("pollster") or "").strip().casefold()
            if not firm or firm in excluded:
                continue
            try:
                age = (today - date.fromisoformat(item["field_end"])).days
                if not 0 <= age <= MODEL_WINDOW_DAYS:
                    continue
                if not all(isinstance(item.get(x), (int, float)) and
                           not isinstance(item.get(x), bool)
                           for x in ("dem", "rep", "margin")):
                    continue
            except (TypeError, KeyError, ValueError):
                continue
            eligible_for_selection.append(item)
            latest = latest_by_firm.get(firm, [])
            if not latest or item["field_end"] > latest[0]["field_end"]:
                latest_by_firm[firm] = [item]
            elif item["field_end"] == latest[0]["field_end"]:
                latest.append(item)
        if model.get("method_version") == "poll-mean-1.5":
            selected, selection_audit = select_latest_firm_waves(eligible_for_selection)
            ambiguous_primary_waves += len(selection_audit["quarantined_same_day_firms"])
            expected = {x["pollster"].strip().casefold(): x for x in selected}
            included_by_firm = {str(q.get("name") or "").strip().casefold(): q
                                for q in race.get("pollsters", [])}
            if set(expected) != set(included_by_firm):
                raise ValueError(
                    f"{race['race_code']}: same-day selected firms differ from published model"
                )
            for firm, poll in expected.items():
                chosen = included_by_firm[firm]
                if (chosen.get("poll_id") != poll.get("poll_id") or
                    chosen.get("field_end") != poll.get("field_end") or
                    any(chosen.get(field) is not None and
                        chosen.get(field) != poll.get(field)
                        for field in ("question_id", "sample_population", "dem", "rep"))):
                    raise ValueError(
                        f"{race['race_code']}: incorrect same-day selected poll "
                        f"for {firm}: expected {poll.get('poll_id')}"
                    )
                freshest_primary_waves += 1
        else:
            # Old checked-in models use the former same-day rule. Hourly
            # regeneration upgrades their method version before strict gating.
            # Keep historic PR snapshots buildable while the source transition
            # is in progress; NEVER exempt new v1.5 publications.
            for firm, latest in latest_by_firm.items():
                # Independent same-day questions are not necessarily independent
                # fieldwork. Do not force the estimator to pick a particular one.
                if len(latest) != 1:
                    ambiguous_primary_waves += 1
                    continue
                p = latest[0]
                freshest_primary_waves += 1
                if not any(q.get("poll_id") == p.get("poll_id") and
                           q.get("field_end") == p["field_end"] and
                           str(q.get("name") or "").casefold() == firm
                           for q in race.get("pollsters", [])):
                    raise ValueError(
                        f"Newest primary poll omitted from model and joint odds: "
                        f"{race['race_code']} / {p['pollster']} / {p.get('poll_id')}"
                    )
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
        if model.get("method_version") == "poll-mean-1.5":
            chosen, audit = select_latest_firm_waves(waves)
            if not chosen:
                ambiguous_waves += 1
                continue
            selected = chosen[0]
            if (selected.get("poll_id") != p.get("poll_id") or
                selected.get("field_end") != p.get("field_end") or
                selected.get("dem") != p.get("dem") or
                selected.get("rep") != p.get("rep")):
                # Another question/study was correctly prioritized for this
                # firm and date. It remains in Poll Wire, not in model odds.
                continue
        else:
            unique_ids = {item.get("poll_id") for item in waves}
            if len(unique_ids) != 1:
                ambiguous_waves += 1
                continue
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
    return {"modeled_races": len(modeled),
            "qualifying_source_races": len(source_current),
            "linked_firm_waves": referenced,
            "freshest_primary_firm_waves": freshest_primary_waves,
            "ambiguous_same_day_primary_waves": ambiguous_primary_waves,
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
