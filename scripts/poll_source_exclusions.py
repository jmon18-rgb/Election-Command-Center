#!/usr/bin/env python3
"""Central, source-grounded eligibility gate for discredited or unverified pollsters.

A raw public aggregator is not an authenticity guarantee. Keep excluded polls
out of BOTH source feeds and the forecast, including supplemental re-ingestion.
Exclusions are exact normalized firm names, not broad substring matches.
"""
import json
import re
from functools import lru_cache
from pathlib import Path

QUALITY_FILE = Path(__file__).resolve().parents[1] / "data" / "pollster_quality.json"

def normalize(name):
    return re.sub(r"[^a-z0-9]+", " ", str(name or "").casefold()).strip()

@lru_cache(maxsize=1)
def excluded_names():
    record = json.loads(QUALITY_FILE.read_text(encoding="utf-8"))
    return {normalize(x) for x in record.get("explicit_exclusions", {})}

def is_excluded_pollster(name):
    return normalize(name) in excluded_names()
