#!/usr/bin/env python3
"""Bounded discovery-only canary for unresolved 2026 MA/MS US Senate feeds.

NO unreviewed race ID, results, winner, estimated ballots or model probabilities
are published. Provider HTTP/CORS errors remain errors, never missing votes.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
from test_civicapi_live_source import source

ELECTION = "2026-11-03"
BASE = "https://civicapi.org/api/v2"
TARGETS = {"MA": "Massachusetts US Senate", "MS": "Mississippi US Senate"}
POLL_CLOSE_UTC = {"MA": "2026-11-04T00:00:00+00:00",
                  "MS": "2026-11-04T01:00:00+00:00"}

def utcnow():
    return dt.datetime.now(dt.timezone.utc)

def same_race(row, state, name):
    if not isinstance(row, dict):
        return False
    return (
        row.get("country") == "US"
        and row.get("province") == state
        and row.get("municipality") is None
        and row.get("district") is None
        and row.get("election_date") == ELECTION
        and row.get("election_name") == name
        and row.get("type") == "US Senate"
        and row.get("election_type") == "General"
        and type(row.get("id")) is int
        and row["id"] > 0
    )

def discover_one(state, request, now=None):
    if state not in TARGETS:
        raise ValueError("Out-of-scope Senate state")
    now = now or utcnow()
    name = TARGETS[state]
    output = {"race": "Senate|" + state, "state": state,
              "election_date": ELECTION, "source": "civicAPI",
              "observed_at": now.isoformat(),
              "is_live_vote_approval": False, "candidate_only": True}
    params = {"country": "US", "province": state, "startDate": ELECTION,
              "endDate": ELECTION, "query": "US Senate", "limit": 20}
    try:
        search = request("/race/search", params)
        rows = search.get("races") if isinstance(search, dict) else None
        count = search.get("count") if isinstance(search, dict) else None
        if not isinstance(rows, list) or len(rows) > 20 or (
                count is not None and
                (type(count) is not int or count < len(rows) or count > 20)):
            output["status"] = "INVALID_OR_PARTIAL_SOURCE_SEARCH"
            return output
        matches = [r for r in rows if same_race(r, state, name)]
        if len(matches) != 1:
            output["status"] = ("AMBIGUOUS_SOURCE_IDENTITY" if len(matches) > 1
                                else "NOT_INDEXED_EXACT_RACE_AT_CHECK_TIME")
            output["returned_rows"] = len(rows)
            return output
        row = matches[0]
        detail = request("/race/" + str(row["id"]), {"light": ""})
        if not isinstance(detail, dict):
            output["status"] = "INVALID_SOURCE_DETAIL"
            return output
        fields = ("country", "province", "district", "municipality",
                  "election_date", "election_name")
        if any(detail.get(k) != row.get(k) for k in fields) or (
                detail.get("election_type") != "US Senate") or (
                detail.get("id", row["id"]) != row["id"]):
            output["status"] = "MISMATCHED_SOURCE_DETAIL"
            return output
        candidates = detail.get("candidates")
        if not isinstance(candidates, list) or not 2 <= len(candidates) <= 60:
            output["status"] = "INVALID_CANDIDATE_STRUCTURE"
            return output
        ids = set()
        vote_total = 0
        for candidate in candidates:
            if not isinstance(candidate, dict) or not isinstance(
                    candidate.get("name"), str) or not candidate["name"].strip() or not isinstance(
                    candidate.get("party"), str) or not candidate["party"].strip() or (
                    type(candidate.get("votes")) is not int) or candidate["votes"] < 0:
                output["status"] = "INVALID_CANDIDATE_STRUCTURE"
                return output
            ident = (candidate["name"].strip().casefold(),
                     candidate["party"].strip().casefold())
            if ident in ids:
                output["status"] = "DUPLICATE_CANDIDATE"
                return output
            ids.add(ident)
            vote_total += candidate["votes"]
        polls_close = dt.datetime.fromisoformat(POLL_CLOSE_UTC[state])
        if now < polls_close and vote_total > 0:
            output["status"] = "PRE_POLL_CLOSE_VOTES_UNSAFE_MOCK_OR_ERROR"
            return output
        output.update({"status": "EXACT_IDENTITY_CANDIDATE_NEEDS_MANUAL_REVIEW",
                       "race_id_hint": row["id"],
                       "source_detail_url": BASE + "/race/" + str(row["id"]),
                       "candidate_count": len(candidates)})
        return output
    except Exception as err:
        output["status"] = "SOURCE_UNAVAILABLE_OR_ERROR"
        output["error_type"] = type(err).__name__
        return output

def run(request=source, now=None):
    now = now or utcnow()
    rows = [discover_one(state, request, now) for state in TARGETS]
    return {"schema": "missing-senate-source-candidate-v1",
            "checked_at": now.isoformat(),
            "coverage_claim": "NONE_SOURCE_DISCOVERY_NOT_LIVE_RESULTS",
            "automatic_source_approval": False,
            "races": rows}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="/tmp/missing-senate-source-canary.json")
    args = parser.parse_args()
    result = run()
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2), flush=True)
    if any(row["status"] == "SOURCE_UNAVAILABLE_OR_ERROR" for row in result["races"]):
        raise SystemExit("Source transport unavailable; saved evidence is not a no-match")

if __name__ == "__main__":
    main()
