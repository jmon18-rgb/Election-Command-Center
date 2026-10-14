#!/usr/bin/env python3
"""Merge newly indexed, candidate-matched PollResults polls into model inputs.

The posted-time feed and the ElectIndex primary snapshot are separate sources.
The public 'New Polls' feed must not silently contain valid new race observations
that are absent from data/polls.json and the downstream joint forecast.

No fabricated dates: source createdAt is PollResults ingestion time, NOT a
verified public release date. Only a current secondary source can add polls.
Each poll ID/office/matchup yields at most one preferred LV/RV question.
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UTC = dt.timezone.utc
MAX_FEED_AGE_HOURS = 24
MAX_POST_AGE_DAYS = 21
MAX_FIELD_AGE_DAYS = 45
VALID_OFFICES = {"senate", "governor", "house"}
# Caller retains the primary model's own candidate-matchup eligibility.
SAFE_NAME = re.compile(r"[^a-z0-9]+")


def norm_name(name):
    return SAFE_NAME.sub(" ", str(name or "").lower()).strip()


def aware_time(value):
    try:
        at = dt.datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
        return at.astimezone(UTC) if at.tzinfo is not None else None
    except ValueError:
        return None


def poll_key(p):
    return (str(p.get("poll_id") or ""), norm_name(p.get("dem_name")),
            norm_name(p.get("rep_name")))


def preference(obs):
    population = str(obs.get("sample_population") or "").strip().lower()
    rank = {"lv": 3, "rv": 2, "a": 1}.get(population, 0)
    sample = obs.get("sample_size")
    size = sample if type(sample) is int and 100 <= sample <= 100000 else 0
    # Deterministic tie resolution without using observed candidate vote shares.
    return (rank, size, str(obs.get("question_id") or ""))


def valid_observation(obs, now):
    if not isinstance(obs, dict):
        return False
    code = obs.get("race_code")
    office = obs.get("race_type")
    if office not in VALID_OFFICES or not isinstance(code, str):
        return False
    if not re.fullmatch(r"[A-Z]{2}-(?:SEN|GOV|\d{1,2})", code):
        return False
    suffix = code.split("-", 1)[1]
    if (suffix == "SEN" and office != "senate") or (
        suffix == "GOV" and office != "governor") or (
        suffix not in ("SEN", "GOV") and office != "house"):
        return False
    try:
        end = dt.date.fromisoformat(obs["field_end"])
        posted = dt.date.fromisoformat(obs["posted_date"])
    except (KeyError, TypeError, ValueError):
        return False
    if not 0 <= (now.date() - end).days <= MAX_FIELD_AGE_DAYS:
        return False
    if not 0 <= (now.date() - posted).days <= MAX_POST_AGE_DAYS:
        return False
    if end > posted + dt.timedelta(days=1):
        return False
    shares = [obs.get("dem"), obs.get("rep")]
    if not all(type(v) in (int, float) and 0 <= v <= 100 for v in shares):
        return False
    if sum(shares) < 65 or sum(shares) > 101:
        return False
    name_d = norm_name(obs.get("dem_name"))
    name_r = norm_name(obs.get("rep_name"))
    if not name_d or not name_r or "generic" in name_d or "generic" in name_r:
        return False
    if not str(obs.get("poll_id") or "").strip() or not str(obs.get("question_id") or "").strip():
        return False
    if not str(obs.get("pollster") or "").strip():
        return False
    if not str(obs.get("source_url") or "").startswith("https://"):
        return False
    size = obs.get("sample_size")
    if type(size) is not int or size < 100 or size > 100000:
        return False
    return True


def race_matchup(race):
    # The primary source's latest named matchup anchors the model; no
    # opportunistic changes to the candidates being forecast.
    for p in race.get("polls") or []:
        d, r = norm_name(p.get("dem_name")), norm_name(p.get("rep_name"))
        if d and r and "generic" not in d + " " + r:
            return (d, r)
    return None


def merge(primary, secondary, now=None):
    now = now or dt.datetime.now(UTC)
    if now.tzinfo is None:
        raise ValueError("Merge requires an aware UTC clock")
    now = now.astimezone(UTC)
    data = copy.deepcopy(primary)
    if not isinstance(data.get("races"), list):
        raise ValueError("Missing primary race input list")
    status = {"status": "not_attempted", "source": "PollResults.org",
              "accepted": 0, "already_in_primary": 0, "duplicate_questions": 0,
              "rejected_invalid": 0, "rejected_matchup": 0,
              "untracked_race": 0, "inserted_by_race": {},
              "source_release_dates_verified": False}
    at = aware_time(secondary.get("updated_at") if isinstance(secondary, dict) else None)
    if at is None or (now - at).total_seconds() < -600 or (
            now - at).total_seconds() > MAX_FEED_AGE_HOURS * 3600:
        status["status"] = "stale_or_unavailable"
        data["supplemental_model_ingestion"] = status
        return data, status
    races = {r["race_code"]: r for r in data["races"]}
    if len(races) != len(data["races"]):
        raise ValueError("Duplicate primary race codes")
    filtered = {}
    for item in secondary.get("observations") or []:
        if not valid_observation(item, now):
            status["rejected_invalid"] += 1
            continue
        code = item["race_code"]
        race = races.get(code)
        if race is None or race.get("race_type") != item["race_type"]:
            status["untracked_race"] += 1
            continue
        pair = race_matchup(race)
        if pair is None or pair != (norm_name(item["dem_name"]), norm_name(item["rep_name"])):
            status["rejected_matchup"] += 1
            continue
        key = (code,) + poll_key(item)
        prior = filtered.get(key)
        if prior is not None:
            status["duplicate_questions"] += 1
        if prior is None or preference(item) > preference(prior):
            filtered[key] = item
    for (code, *_), obs in sorted(filtered.items()):
        race = races[code]
        existing = race.get("polls", [])
        key = poll_key(obs)
        if any(poll_key(p) == key for p in existing):
            status["already_in_primary"] += 1
            continue
        if any(
            norm_name(p.get("pollster")) == norm_name(obs["pollster"]) and
            p.get("field_end") == obs["field_end"] and
            norm_name(p.get("dem_name")) == norm_name(obs["dem_name"]) and
            norm_name(p.get("rep_name")) == norm_name(obs["rep_name"]) and
            abs(p["dem"] - obs["dem"]) < .001 and abs(p["rep"] - obs["rep"]) < .001
            for p in existing
        ):
            status["already_in_primary"] += 1
            continue
        inserted = {
            "poll_id": obs["poll_id"], "field_end": obs["field_end"],
            "pollster": obs["pollster"], "dem": obs["dem"], "rep": obs["rep"],
            "margin": round(obs["dem"] - obs["rep"], 2),
            "sample_size": obs["sample_size"],
            "partisan_lean": obs.get("partisan_lean") if obs.get("partisan_lean") in ("D", "R") else "",
            "dem_name": obs["dem_name"], "rep_name": obs["rep_name"],
            "other": None, "other_name": None,
            "first_seen_at": now.isoformat().replace("+00:00", "Z"),
            "release_date": None,
            "upstream_posted_date": obs["posted_date"],
            "source_poll_url": obs["source_url"],
            "sample_population": obs.get("sample_population"),
            "date_provenance": "PollResults.org posting; NOT independently verified release date",
            "source_provider": "PollResults.org"
        }
        race["polls"] = sorted(existing + [inserted],
                               key=lambda p: p["field_end"], reverse=True)[:60]
        race["latest"] = race["polls"][0]
        race["latest_field_end"] = race["latest"]["field_end"]
        race["recent_poll_count"] = len(race["polls"])
        status["accepted"] += 1
        status["inserted_by_race"][code] = status["inserted_by_race"].get(code, 0) + 1
    status["status"] = "merged"
    status["considered_unique"] = len(filtered)
    data["supplemental_model_ingestion"] = status
    return data, status


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--root", type=Path, default=ROOT)
    a = p.parse_args(argv)
    primary_file = a.root / "data" / "polls.json"
    secondary_file = a.root / "data" / "pollresults_recent.json"
    primary = json.loads(primary_file.read_text(encoding="utf-8"))
    secondary = json.loads(secondary_file.read_text(encoding="utf-8")) if secondary_file.exists() else {}
    result, summary = merge(primary, secondary)
    if summary["status"] == "stale_or_unavailable":
        print("WARNING: secondary feed stale or unavailable; no new rows merged")
    else:
        primary_file.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Supplemental model ingestion:", json.dumps(summary, sort_keys=True))


if __name__ == "__main__":
    main()
