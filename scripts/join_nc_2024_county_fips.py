#!/usr/bin/env python3
"""Fail-closed NC 2024 county-name -> FIPS crosswalk for historical staging.

Expects a locally provided authoritative Census county reference with statefp,
countyfp and name columns. Does NOT treat presidential totals as a same-office
Senate/House baseline or permit updates to the live needle.
"""
import csv
import io
import re


def normalize(value):
    return re.sub(r"[^A-Z]+", " ", str(value).upper()).strip().removesuffix(" COUNTY").strip()


def join_nc_counties(staging, census_csv):
    if staging.get("state") != "NC" or staging.get("status") != (
        "OFFICIAL_NC_2024_HISTORICAL_MODE_COUNTS_NOT_A_2026_NEEDLE"):
        raise ValueError("Unverified historical staging dataset")
    reader = csv.DictReader(io.StringIO(census_csv))
    fields = set(reader.fieldnames or [])
    if not {"statefp", "countyfp", "name"}.issubset(fields):
        raise ValueError("Missing official county mapping columns")
    mapping, ids = {}, set()
    for row in reader:
        if row["statefp"] != "37":
            continue
        fips = row["statefp"] + row["countyfp"]
        name = normalize(row["name"])
        if not re.fullmatch(r"37\d{3}", fips) or not name or name in mapping or fips in ids:
            raise ValueError("Invalid or duplicate NC county crosswalk")
        mapping[name] = fips
        ids.add(fips)
    if len(mapping) != 100:
        raise ValueError("Expected exactly 100 NC county FIPS mappings")
    observations = staging.get("observations")
    if not isinstance(observations, list):
        raise ValueError("Missing historical observations")
    seen = set()
    output = []
    for row in observations:
        name = normalize(row["county_name"])
        if name not in mapping:
            raise ValueError("Unmapped official county name: " + name)
        mode = row.get("mode")
        if mode not in {"election_day", "early_in_person", "mail", "provisional"}:
            raise ValueError("Unknown vote method")
        key = (mapping[name], mode)
        if key in seen:
            raise ValueError("Duplicate county-by-method row")
        seen.add(key)
        output.append({**row, "county_fips": mapping[name]})
    if {f for f, _ in seen} != ids:
        raise ValueError("Historical observations do not cover all counties")
    return {"status": "NC_2024_PRESIDENTIAL_RESEARCH_ONLY", "state": "NC",
            "fips_join_complete": True, "same_office_baseline_verified": False,
            "may_update_live_model": False, "observations": output}
