#!/usr/bin/env python3
"""Conservative new-race discovery for the poll ingestion pipeline.

A source-linked new 2026 House, Senate, or governor survey should not be
discarded just because the ElectIndex primary table has not listed its race.
Cross-check House district and contested Senate identities against the
published 2026 seat inventory. Never pick a new matchup from the margin.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "data" / "seat_universe.json"
MAX_AGE = 65


def allowed_codes(inventory):
    return {
        "house": {x["race_code"] for x in inventory["house"]["seats"]},
        "senate": {x["race_code"] for x in inventory["senate"]["contested_seats"]},
        "governor": {state + "-GOV" for state in inventory["house"]["by_state"]},
    }


def matchup(p):
    def clean(name):
        return re.sub(r"[^a-z0-9]+", " ", str(name or "").casefold()).strip()
    return clean(p.get("dem_name")), clean(p.get("rep_name"))


def usable(p, today, allowed):
    if not isinstance(p, dict) or p.get("race_type") not in allowed:
        return False
    code = p.get("race_code")
    if not isinstance(code, str) or code not in allowed[p["race_type"]]:
        return False
    if p.get("state") and str(p["state"]).upper() != code[:2]:
        return False
    demname, repname = matchup(p)
    if not demname or not repname or "generic" in demname or "generic" in repname:
        return False
    if not p.get("poll_id") or not str(p.get("pollster") or "").strip():
        return False
    try:
        link = urlparse(str(p.get("source_url") or p.get("source_poll_url") or ""))
        if link.scheme not in ("https", "http") or not link.netloc:
            return False
        age = (today - dt.date.fromisoformat(str(p["field_end"]))).days
        dem, rep = float(p["dem"]), float(p["rep"])
        n = float(p.get("sample_size") or 0)
        return (
            0 <= age <= MAX_AGE and
            all(math.isfinite(x) for x in (dem, rep, n)) and
            0 <= dem <= 100 and 0 <= rep <= 100 and
            55 <= dem + rep <= 101 and n > 0
        )
    except (ValueError, TypeError, KeyError):
        return False


def discover(primary, observations, today, inventory=None):
    """Return unrepresented races only; unresolved competing matchups stay out.

    Each new race must have an eligible, source-attributed named candidate
    study. An exact same-day disagreement over which matchup is current
    remains source-only until an unambiguous later survey establishes one.
    """
    if inventory is None:
        inventory = json.loads(INVENTORY.read_text(encoding="utf-8"))
    allowed = allowed_codes(inventory)
    known = {r["race_code"] for r in primary.get("races", [])}
    grouped = defaultdict(list)
    for p in observations:
        if usable(p, today, allowed) and p["race_code"] not in known:
            grouped[p["race_code"]].append(p)
    seeds = []
    for code, values in sorted(grouped.items()):
        # The same poll may have LV/RV or question variants; those are not
        # independent endorsements of a matchup. Compare dates first.
        latest_end = max(p["field_end"] for p in values)
        newest_matchups = {matchup(p) for p in values
                           if p["field_end"] == latest_end}
        if len(newest_matchups) != 1:
            continue
        selected = next(p for p in values if p["field_end"] == latest_end)
        pair = matchup(selected)
        office = selected["race_type"]
        seeds.append({
            "race_code": code, "race_type": office, "state": code[:2],
            "district": code.split("-", 1)[1],
            "polls": [], "recent_poll_count": 0,
            "latest_field_end": latest_end,
            "latest": {"dem_name": selected["dem_name"].strip(),
                       "rep_name": selected["rep_name"].strip()},
            "source_url": "https://pollresults.org/",
            "model_race_source": "pollresults_bootstrap",
            "matchup_provenance": "Latest unambiguous source-linked 2026 matchup; verify ballot independently",
        })
    return seeds
