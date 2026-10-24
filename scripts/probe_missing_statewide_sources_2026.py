#!/usr/bin/env python3
"""Advisory discovery for four unresolved 2026 statewide result identities.

Read only: never publishes 2026 vote counts, race calls, pins, or forecasts.
Search and detail must independently agree on state, office, date and race ID.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re

from test_civicapi_live_source import source

SPECS = (
    ("MA", "Senate", "US Senate"),
    ("MS", "Senate", "US Senate"),
    ("HI", "Governor", "Governor"),
    ("OK", "Governor", "Governor"),
)
# Must agree with the shared 50-state earliest local close contract.
# A pre-close mock/winner flag cannot establish a real source's eligibility.
CLOSE_UTC = {
    "MA": datetime(2026, 11, 4, 1, 0, tzinfo=timezone.utc),
    "MS": datetime(2026, 11, 4, 1, 0, tzinfo=timezone.utc),
    "HI": datetime(2026, 11, 4, 5, 0, tzinfo=timezone.utc),
    "OK": datetime(2026, 11, 4, 1, 0, tzinfo=timezone.utc),
}
DATE = re.compile(r"^2026-11-03(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$")


def exact(spec, row):
    state, office, _ = spec
    if not isinstance(row, dict) or row.get("country") != "US" or row.get("province") != state:
        return False
    if row.get("municipality") is not None or row.get("district") is not None:
        return False
    if type(row.get("id")) is not int or row["id"] <= 0:
        return False
    if not isinstance(row.get("election_date"), str) or not DATE.fullmatch(row["election_date"]):
        return False
    if not isinstance(row.get("election_name"), str):
        return False
    name = row["election_name"]
    if re.search(r"\b(primary|runoff|special primary)\b", name, re.I):
        return False
    if office == "Senate":
        return row.get("type") == "US Senate" and row.get("election_type") == "General" and bool(
            re.search(r"\bUS\s+Senate\b", name, re.I))
    return row.get("type") == "Governor" and row.get("election_type") == "Statewide" and bool(
        re.search(r"\bGovernor\b", name, re.I))


def detail_rejection(spec, row, detail, *, now=None):
    """Reason-only diagnostic. Never return candidate votes or raw source data."""
    if not exact(spec, row):
        return "UNVERIFIED_SEARCH_IDENTITY"
    if not isinstance(detail, dict):
        return "DETAIL_NOT_OBJECT"
    # civicAPI detail URLs identify the exact requested search ID. Some
    # valid detail responses omit a duplicate id property. Explicitly
    # conflicting IDs remain fatal. This matches the existing Senate
    # canary contract (probe_missing_senate_sources.py).
    if "id" in detail and detail["id"] != row["id"]:
        return "DETAIL_EXPLICIT_ID_MISMATCH"
    for field in ("country", "province", "district", "municipality",
                  "election_date", "election_name"):
        if detail.get(field) != row.get(field):
            return "DETAIL_" + field.upper() + "_MISMATCH"
    if detail.get("election_type") != row["type"]:
        return "DETAIL_OFFICE_CLASS_MISMATCH"
    candidates = detail.get("candidates")
    if not isinstance(candidates, list) or not 2 <= len(candidates) <= 60:
        return "INVALID_CANDIDATE_SET"
    identities = set()
    counted = False
    for c in candidates:
        if not isinstance(c, dict) or not isinstance(c.get("name"), str) or not c["name"].strip():
            return "INVALID_CANDIDATE_NAME"
        if not isinstance(c.get("party"), str) or not c["party"].strip():
            return "INVALID_CANDIDATE_PARTY"
        if type(c.get("votes")) is not int or c["votes"] < 0 or type(c.get("winner")) is not bool:
            return "INVALID_CANDIDATE_VOTE_OR_WINNER_SHAPE"
        counted = counted or c["votes"] > 0 or c["winner"]
        ident = (c["name"].strip().casefold(), c["party"].strip().casefold())
        if ident in identities:
            return "DUPLICATE_CANDIDATE"
        identities.add(ident)
    if counted and now is not None:
        if now.tzinfo is None:
            return "UNVERIFIED_RECEIPT_CLOCK"
        if now.astimezone(timezone.utc) < CLOSE_UTC[spec[0]]:
            return "PRE_POLL_CLOSE_COUNTED_OR_CALLED_NOT_LIVE"
    return None


def validate_detail(spec, row, detail):
    return detail_rejection(spec, row, detail) is None


def probe(fetch=source, now=None):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("Evidence timestamp requires timezone")
    records = []
    for spec in SPECS:
        state, office, query = spec
        identity = office + "|" + state
        entry = {"race": identity, "status": "UNKNOWN", "race_id": None}
        try:
            search = fetch("/race/search", {
                "country": "US", "province": state,
                "startDate": "2026-11-03", "endDate": "2026-11-03",
                "query": query, "limit": 20
            })
            if not isinstance(search, dict) or not isinstance(search.get("races"), list) or (
                len(search["races"]) > 20 or
                type(search.get("count", len(search["races"]))) is not int or
                search.get("count", len(search["races"])) > 20
            ):
                entry["status"] = "INVALID_OR_TRUNCATED_SEARCH"
            else:
                matches = [row for row in search["races"] if exact(spec, row)]
                if len(matches) > 1:
                    entry["status"] = "AMBIGUOUS_EXACT_RACE"
                elif not matches:
                    entry["status"] = "NOT_INDEXED"
                else:
                    row = matches[0]
                    detail = fetch("/race/" + str(row["id"]), {"light": ""})
                    reason = detail_rejection(spec, row, detail, now=now)
                    if reason is None:
                        entry["status"] = "INDEXED_EXACT_RACE_IDENTITY_ONLY"
                        entry["race_id"] = row["id"]
                        entry["candidate_count"] = len(detail["candidates"])
                    else:
                        entry["status"] = "INVALID_OR_MISMATCHED_DETAIL"
                        entry["reason"] = reason
        except Exception as e:
            # Provider failures are unknown, not proof that a contest is absent.
            entry["status"] = "PROVIDER_UNAVAILABLE"
            entry["failure_type"] = type(e).__name__
        records.append(entry)
    return {
        "schema": "advisory-2026-four-statewide-gaps-v1",
        "checked_at": now.astimezone(timezone.utc).isoformat(),
        "provider": "civicAPI",
        "source_origin": "https://civicapi.org/api/v2",
        "identity_only_not_voting_results": True,
        "may_publish_live_votes": False,
        "may_update_model_or_source_pins": False,
        "checked": len(records),
        "exact_matches": sum(r["status"] == "INDEXED_EXACT_RACE_IDENTITY_ONLY" for r in records),
        "records": records,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    result = probe()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({k: result[k] for k in ("checked_at", "checked", "exact_matches", "records")}, indent=2))
    print("ADVISORY ONLY. IDs are not live votes or production-approved source pins.")


if __name__ == "__main__":
    main()
