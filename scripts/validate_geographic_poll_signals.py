#!/usr/bin/env python3
"""Validate curated local samples of statewide contests before web publication.

This dataset intentionally never enters the statewide Senate/governor averages:
district-only samples require demographic/turnout weighting and calibrated
geography to infer state-level support.
"""
import datetime as dt
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "geographic_poll_signals.json"
SEATS = ROOT / "data" / "seat_universe.json"
VALID_OFFICES = {"senate": "SEN", "governor": "GOV"}
VALID_SCOPE = {"congressional_district"}


def validate(source, house_codes=None):
    if source.get("schema_version") != "geographic-poll-signals-v1":
        raise ValueError("Unknown geographic signal schema")
    if source.get("status") != "CURATED_SOURCE_VERIFIED_NON_STATEWIDE_NOT_MODEL_INPUT":
        raise ValueError("Scope protection status missing")
    records = source.get("signals")
    if not isinstance(records, list) or not records:
        raise ValueError("No scoped signals")
    house_codes = set(house_codes or [])
    keys = set()
    for x in records:
        key = (x.get("poll_id"), x.get("question_id"))
        if key in keys or not all(key):
            raise ValueError("Duplicate/missing scoped poll question")
        keys.add(key)
        if x.get("sample_scope") not in VALID_SCOPE or x.get("model_eligible") is not False:
            raise ValueError("District samples may not enter statewide polling model")
        office = x.get("office")
        if office not in VALID_OFFICES:
            raise ValueError("Invalid statewide target office")
        district, race = x.get("sample_district"), x.get("race_code")
        if district not in house_codes or not re.fullmatch(r"[A-Z]{2}-\d{2}",district):
            raise ValueError("District not in verified 2026 House universe")
        if race != district[:2] + "-" + VALID_OFFICES[office]:
            raise ValueError("Statewide race inconsistent with sampled district")
        if x.get("sample_geography_map_year") != 2026:
            raise ValueError("District sampling map vintage unspecified")
        dates = []
        for k in ("field_start", "field_end", "release_date"):
            try:
                dates.append(dt.date.fromisoformat(x[k]))
            except (KeyError, ValueError, TypeError):
                raise ValueError("Invalid signal field/release date")
        if not (dt.date(2026, 1, 1) <= dates[0] <= dates[1] <= dates[2]):
            raise ValueError("Impossible field/release chronology")
        if not (isinstance(x.get("sample_size"), int) and 50 <= x["sample_size"] <= 100000
                and x.get("sample_population") in ("lv", "rv")):
            raise ValueError("Invalid scoped sample")
        if any(not isinstance(x.get(name), (int, float)) or
               isinstance(x.get(name), bool) or not math.isfinite(x[name])
               for name in ("dem_minus_rep_points", "sample_margin_of_error_points",
                            "reference_presidential_2024_two_party_d_minus_r_points")):
            raise ValueError("Missing finite margin or reference")
        if not (-100 <= x["dem_minus_rep_points"] <= 100) or not (0 < x["sample_margin_of_error_points"] <= 25):
            raise ValueError("Invalid polling result or uncertainty")
        if x.get("review_status") != "confirmed_public_source":
            raise ValueError("Unverified source prohibited")
        if not all(isinstance(x.get(name), str) and x[name].strip()
                   for name in ("survey_firm", "dem_candidate", "rep_candidate",
                                "result_provenance", "reference_provenance")):
            raise ValueError("Missing named candidates or provenance")
        if not all(isinstance(x.get(name), str) and x[name].startswith("https://")
                   and len(x[name]) > 16 and "." in x[name].split("/")[2]
                   for name in ("source_url", "reference_url")):
            raise ValueError("Missing authenticated https provenance link")
    return len(records)


if __name__ == "__main__":
    doc = json.loads(SOURCE.read_text(encoding="utf-8"))
    seats = json.loads(SEATS.read_text(encoding="utf-8"))
    names = [x["race_code"] for x in seats["house"]["seats"]]
    if len(names) != len(set(names)) or len(names) != 435:
        raise ValueError("2026 House district provenance not trustworthy")
    count = validate(doc, names)
    print(f"PASS: {count} verified geographically scoped poll results, 0 statewide model inputs")
