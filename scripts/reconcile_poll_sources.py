#!/usr/bin/env python3
"""Reconcile dated PollResults observations into live polling-model inputs.

PollResults already powers the new-polls feed. Previously, its missing polls
did NOT enter the forecast's ElectIndex-derived poll average. This module adds
only current, attributable, same-candidate supplemental observations without
double-counting shared source IDs. No outside win probabilities are inputs.
"""
from __future__ import annotations

import copy
import datetime as dt
import math
import re
from collections import defaultdict
from urllib.parse import urlparse
import race_poll_coverage
from poll_source_exclusions import is_excluded_pollster

FALLBACK_SOURCE = "pollresults_secondary_fallback"
VALID_OFFICES = {"senate", "house", "governor"}
MAX_FIELD_AGE_DAYS = 65


def identity(name):
    return re.sub(r"[^a-z0-9]+", " ", str(name or "").casefold()).strip()


def direct_url(url):
    if not isinstance(url, str):
        return False
    parsed = urlparse(url)
    return parsed.scheme in ("https", "http") and bool(parsed.netloc)


def in_scope(poll, race, today):
    """Eligibility gate shared by reconciliation AND publishing validator."""
    if not isinstance(poll, dict) or not isinstance(race, dict):
        return False
    if (poll.get("race_code") != race.get("race_code") or
            poll.get("race_type") != race.get("race_type") or
            race.get("race_type") not in VALID_OFFICES):
        return False
    if not poll.get("poll_id") or not poll.get("pollster") or is_excluded_pollster(poll.get("pollster")):
        return False
    if not direct_url(poll.get("source_url") or poll.get("source_poll_url")):
        return False
    try:
        day = dt.date.fromisoformat(str(poll["field_end"]))
        if day.year != 2026 or not 0 <= (today-day).days <= MAX_FIELD_AGE_DAYS:
            return False
        dem, rep = float(poll["dem"]), float(poll["rep"])
        n = float(poll.get("sample_size") or 0)
        if (not all(math.isfinite(v) for v in (dem, rep, n)) or
                not 0 <= dem <= 100 or not 0 <= rep <= 100 or
                not 55 <= dem+rep <= 101 or n <= 0):
            return False
    except (KeyError, ValueError, TypeError):
        return False
    # Don't let unrelated head-to-head tests replace current named matchups.
    current = race.get("latest") or (race.get("polls") or [None])[0]
    if not isinstance(current, dict):
        return False
    return (identity(poll.get("dem_name")) == identity(current.get("dem_name")) and
            identity(poll.get("rep_name")) == identity(current.get("rep_name")))


def selection_key(item):
    population = str(item.get("sample_population") or "").lower()
    rank = {"lv": 3, "rv": 2, "a": 1}.get(population, 0)
    return (rank, float(item.get("sample_size") or 0),
            str(item.get("question_id") or ""))


def same_study_variant(old, incoming):
    """A sample variant must be the same firm, fieldwork, poll ID and matchup."""
    return (str(old.get("poll_id") or "") == str(incoming.get("poll_id") or "")
            and identity(old.get("pollster")) == identity(incoming.get("pollster"))
            and old.get("field_end") == incoming.get("field_end")
            and identity(old.get("dem_name")) == identity(incoming.get("dem_name"))
            and identity(old.get("rep_name")) == identity(incoming.get("rep_name")))


def preferred_lv_variant(race, old, candidates, today):
    """Replace a corroborated RV/adult wave with its LV question, never blend."""
    if str(old.get("sample_population") or "").casefold() == "lv":
        return None
    same = [p for p in candidates if same_study_variant(old, p)
            and in_scope(p, race, today)]
    likely = [p for p in same if selection_key(p)[0] == 3]
    if not likely:
        return None
    likely.sort(key=selection_key, reverse=True)
    chosen = likely[0]
    # Contradictory LV answers at equal sample priority are ambiguous.
    if any(selection_key(p)[:2] == selection_key(chosen)[:2]
           and (float(p["dem"]), float(p["rep"])) !=
               (float(chosen["dem"]), float(chosen["rep"]))
           for p in likely[1:]):
        return None
    old_population = str(old.get("sample_population") or "").casefold()
    corroborated = (old_population in ("rv", "a", "registered", "adults")
                    or any(selection_key(p)[0] in (1, 2)
                           and float(p["dem"]) == float(old["dem"])
                           and float(p["rep"]) == float(old["rep"])
                           for p in same)
                    # A prior, source-verified LV correction must survive when
                    # the primary provider re-imports an unlabelled RV wave.
                    or (chosen.get("model_source") == FALLBACK_SOURCE
                        and chosen.get("sample_population") == "lv"))
    return chosen if corroborated else None


def candidate_observations(primary, observations, today):
    """Pick one eligible missing observation per exact race/poll ID."""
    observations = [p for p in observations if isinstance(p, dict) and not is_excluded_pollster(p.get("pollster"))]
    by_race = {r["race_code"]:r for r in primary.get("races", [])}
    # The validation route must see newly eligible races even BEFORE merge,
    # so a missing race cannot slip past an eligibility check.
    for seed in race_poll_coverage.discover(primary, observations, today):
        by_race[seed["race_code"]] = seed
    groups = defaultdict(list)
    for p in observations:
        if not isinstance(p, dict):
            continue
        race = by_race.get(p.get("race_code"))
        if not in_scope(p, race, today):
            continue
        # One study is one modeled firm wave, irrespective of sample
        # population or number of near-identical poll questions.
        if any(str(old.get("poll_id")) == str(p["poll_id"])
               for old in race["polls"]):
            continue
        groups[(p["race_code"], str(p["poll_id"]))].append(p)
    chosen = []
    for _, alternatives in sorted(groups.items()):
        alternatives.sort(key=selection_key, reverse=True)
        top = alternatives[0]
        # Same population and sample base with inconsistent responses is
        # ambiguous. Don't cherry-pick whichever percentage we prefer.
        if any(selection_key(x)[:2] == selection_key(top)[:2] and
               (float(x["dem"]), float(x["rep"])) !=
               (float(top["dem"]), float(top["rep"]))
               for x in alternatives[1:]):
            continue
        chosen.append(top)
    return chosen


def merge(primary, observations, today, observed_at=None):
    """Update primary snapshot and return an explicit attribution report."""
    if not isinstance(today, dt.date):
        raise ValueError("Explicit reconciliation date required")
    observations = [p for p in observations if isinstance(p, dict) and not is_excluded_pollster(p.get("pollster"))]
    report = {"new_to_model":0, "enriched_existing":0, "lv_upgrades":0,
              "added_ids":[], "added_by_race":{}, "created_races":[]}
    # A new House/Senate/governor poll may reach PollResults first, before
    # ElectIndex has any record of the RACE. Validate its district/seat and
    # named matchup, then create a source-attributed race for this refresh.
    for seed in race_poll_coverage.discover(primary, observations, today):
        primary.setdefault("races", []).append(seed)
        report["created_races"].append(seed["race_code"])
    by_race = {r["race_code"]:r for r in primary.get("races", [])}
    exact = defaultdict(list)
    for p in observations:
        if isinstance(p, dict):
            exact[(p.get("race_code"), p.get("poll_id"))].append(p)
    for race in primary.get("races", []):
        for old in race.get("polls", []):
            matches = [p for p in exact.get((race["race_code"], old.get("poll_id")), [])
                if (p.get("field_end") == old.get("field_end") and
                    p.get("dem") == old.get("dem") and
                    p.get("rep") == old.get("rep") and
                    identity(p.get("dem_name")) == identity(old.get("dem_name")) and
                    identity(p.get("rep_name")) == identity(old.get("rep_name")))]
            if len(matches) != 1:
                continue
            p = matches[0]
            old["upstream_posted_date"] = p.get("posted_date")
            old["source_poll_url"] = p.get("source_url") or p.get("source_poll_url")
            old["sample_population"] = p.get("sample_population")
            old["question_id"] = p.get("question_id") or old.get("question_id")
            old["date_provenance"] = "PollResults ingestion date, NOT public release date"
            report["enriched_existing"] += 1
    # A source survey can contain both RV and LV questions. The primary
    # importer may already carry its RV version under the same poll_id.
    # Prefer the corroborated LV answer in-place, without counting a new poll.
    # RV remains in the supplemental Poll Wire, not the weighted average.
    for race in primary.get("races", []):
        for old in race.get("polls", []):
            siblings = exact.get((race["race_code"], old.get("poll_id")), [])
            chosen = preferred_lv_variant(race, old, siblings, today)
            if chosen is None:
                continue
            old.update({
                "question_id": chosen.get("question_id"),
                "sample_population": "lv",
                "dem": float(chosen["dem"]), "rep": float(chosen["rep"]),
                "margin": round(float(chosen["dem"])-float(chosen["rep"]), 2),
                "sample_size": int(float(chosen["sample_size"])),
                "upstream_posted_date": chosen.get("posted_date"),
                "source_poll_url": chosen.get("source_url") or chosen.get("source_poll_url"),
                "date_provenance": "PollResults ingestion date, NOT public release date",
                "model_source": FALLBACK_SOURCE,
                "lv_selected_over_rv": True,
                "first_seen_at": old.get("first_seen_at") or chosen.get("first_seen_at") or observed_at,
            })
            report["lv_upgrades"] += 1
    for p in candidate_observations(primary, observations, today):
        race = by_race[p["race_code"]]
        if any(x.get("poll_id") == p["poll_id"] for x in race["polls"]):
            continue
        saved = {
            "poll_id":str(p["poll_id"]), "question_id":p.get("question_id"),
            "field_end":p["field_end"], "pollster":p["pollster"].strip(),
            "dem":float(p["dem"]), "rep":float(p["rep"]),
            "margin":round(float(p["dem"])-float(p["rep"]),2),
            "sample_size":int(float(p["sample_size"])),
            "partisan_lean":p.get("partisan_lean") if p.get("partisan_lean") in ("D","R") else "",
            "dem_name":p["dem_name"].strip(), "rep_name":p["rep_name"].strip(),
            "other":None, "other_name":None,
            "first_seen_at":p.get("first_seen_at") or observed_at,
            "release_date":None,
            "upstream_posted_date":p.get("posted_date"),
            "source_poll_url":p.get("source_url") or p.get("source_poll_url"),
            "sample_population":p.get("sample_population"),
            "date_provenance":"PollResults ingestion date, NOT public release date",
            "model_source":FALLBACK_SOURCE,
        }
        race["polls"].append(saved)
        report["new_to_model"] += 1
        report["added_ids"].append({"race_code":p["race_code"],"poll_id":saved["poll_id"]})
        report["added_by_race"][p["race_code"]] = report["added_by_race"].get(p["race_code"],0)+1
    for race in primary.get("races", []):
        race["polls"].sort(key=lambda p:(p["field_end"],p.get("poll_id") or ""),reverse=True)
        race["polls"] = race["polls"][:60]
        race["recent_poll_count"] = len(race["polls"])
        if race["polls"]:
            race["latest"] = race["polls"][0]
            race["latest_field_end"] = race["latest"]["field_end"]
    return report


def carry_forward(previous, primary, today):
    """Keep imported polls while ElectIndex lags, with first-seen preserved."""
    carry = []
    by_race = {r["race_code"]:r for r in primary.get("races", [])}
    for old_race in previous.get("races", []):
        # Preserve verified supplemental races even while ElectIndex has
        # not indexed the race itself. discover() performs seat validation.
        race = by_race.get(old_race.get("race_code")) or old_race
        for p in old_race.get("polls", []):
            if p.get("model_source") != FALLBACK_SOURCE:
                continue
            item = copy.deepcopy(p)
            item["race_code"] = race["race_code"]
            item["race_type"] = race["race_type"]
            item["state"] = race["state"]
            item["source_url"] = p.get("source_poll_url")
            if in_scope(item, race, today):
                carry.append(item)
    return merge(primary, carry, today)
