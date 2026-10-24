#!/usr/bin/env python3
"""Bounded, identity-only audit of the two missing 2026 Senate machine sources.

No unreviewed race IDs go into the dashboard. No vote totals, race calls or
historical data are printed or written. Errors remain source-unavailable.
"""
import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from test_civicapi_live_source import source

DAY = "2026-11-03"
POST_POLL_UTC = datetime(2026, 11, 4, 1, tzinfo=timezone.utc)
STATE_NAMES = {"MA": "Massachusetts", "MS": "Mississippi"}
DATE_PATTERN = re.compile(r"2026-11-03(?:T\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d))?\Z")


def exact(row, state):
    return (
        isinstance(row, dict) and row.get("country") == "US"
        and row.get("province") == state
        and row.get("municipality") is None
        and row.get("district") is None
        and row.get("type") == "US Senate"
        and row.get("election_type") == "General"
        and row.get("election_name") == STATE_NAMES[state] + " US Senate"
        and isinstance(row.get("election_date"), str)
        and bool(DATE_PATTERN.fullmatch(row["election_date"]))
        and type(row.get("id")) is int and row["id"] > 0
    )


def check_detail(row, detail, state, now):
    if not isinstance(detail, dict) or not exact(row, state):
        return False
    for key in ("id", "country", "province", "municipality", "district",
                "election_name", "election_date"):
        if detail.get(key) != row.get(key):
            return False
    if detail.get("election_type") != "US Senate":
        return False
    candidates = detail.get("candidates")
    if not isinstance(candidates, list) or not 2 <= len(candidates) <= 60:
        return False
    identities = set()
    for candidate in candidates:
        if not isinstance(candidate, dict):
            return False
        name, party = candidate.get("name"), candidate.get("party")
        votes, winner = candidate.get("votes"), candidate.get("winner")
        if (not isinstance(name, str) or not name.strip()
                or not isinstance(party, str) or not party.strip()
                or type(votes) is not int or votes < 0
                or type(winner) is not bool):
            return False
        identity = (name.strip().casefold(), party.strip().casefold())
        if identity in identities:
            return False
        identities.add(identity)
        if now < POST_POLL_UTC and (votes > 0 or winner):
            return False
    return True


def probe(state, fetcher=source, now=None):
    """Only exact, source/detail-verified metadata can become review evidence."""
    if state not in STATE_NAMES:
        raise ValueError("Unsupported Senate state")
    now = now or datetime.now(timezone.utc)
    status = {"state": state, "race": "Senate|" + state, "status": "SOURCE_UNAVAILABLE",
              "source_identity_verified": False, "live_votes_verified": False,
              "approved_for_2026_results": False}
    try:
        result = fetcher("/race/search", {
            "country": "US", "province": state, "startDate": DAY,
            "endDate": DAY, "query": "US Senate", "limit": 20
        })
        if not isinstance(result, dict):
            status["status"] = "SEARCH_SCHEMA_UNVERIFIED"
            return status
        rows = result.get("races")
        count = result.get("count")
        if (not isinstance(rows, list) or len(rows) > 20
                or (count is not None and
                    (type(count) is not int or count < len(rows) or count > 20))):
            status["status"] = "SEARCH_INCOMPLETE_OR_INVALID"
            return status
        matching = [row for row in rows if exact(row, state)]
        if len(matching) != 1:
            status["status"] = "NOT_INDEXED" if len(matching) == 0 else "AMBIGUOUS_IDENTITY"
            return status
        row = matching[0]
        detail = fetcher("/race/" + str(row["id"]), {"light": ""})
        if not check_detail(row, detail, state, now):
            status["status"] = "DETAIL_UNVERIFIED_OR_PREPOLL_MOCK"
            return status
        status.update(status="REVIEW_CANDIDATE_SOURCE_ID_NOT_APPROVED",
                      race_id=row["id"], candidate_count=len(detail["candidates"]),
                      source_identity_verified=True)
    except (OSError, ValueError, TypeError, TimeoutError) as error:
        # Do not turn a provider outage into NOT_INDEXED, and do not write raw
        # HTTP or exception text that could contain source vote totals.
        status["status"] = "SOURCE_UNAVAILABLE"
    return status


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="/tmp/ma-ms-senate-source-discovery.json")
    options = parser.parse_args()
    now = datetime.now(timezone.utc)
    result = {"schema": "missing-2026-senate-source-identity-audit-v1",
              "checked_at": now.isoformat(), "election_date": DAY,
              "purpose": "operator-review-only-not-live-results",
              "races": [probe(s, now=now) for s in STATE_NAMES]}
    Path(options.output).write_text(json.dumps(result, indent=2) + "\n")
    for row in result["races"]:
        print("SENATE ID CHECK", row["race"], row["status"],
              "id", row.get("race_id", "NONE"), flush=True)
    print("No votes, calls, forecasts, or source IDs were published to dashboard.")


if __name__ == "__main__":
    main()
