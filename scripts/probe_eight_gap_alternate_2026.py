#!/usr/bin/env python3
"""Bounded independent 2026 alternate-provider discovery for eight source gaps.

watch.vote documents GET /api/elections/2026/ballot/results?state=XX as a
SERVER-side route with no browser CORS and no pre-election returns. This is
an ADVISORY discovery route, not approved licensed vote redistributions,
not an election call, and never a substitute for the strict 506-race ledger.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ORIGIN = "https://watch.vote"
ENDPOINT = ORIGIN + "/api/elections/2026/ballot/results"
DATE = "2026-11-03"
RACES = {
    "AK": ("House|AK-00",),
    "DE": ("House|DE-00",),
    "MA": ("Senate|MA",),
    "ND": ("House|ND-00",),
    "NH": ("House|NH-01", "House|NH-02"),
    "SD": ("House|SD-00",),
    "WY": ("House|WY-00",),
}
EIGHT = frozenset(r for group in RACES.values() for r in group)
assert len(EIGHT) == 8 and len(RACES) == 7

# Do not claim a direct machine-readable provider ID from a link labelled
# "official" or an election ballot list. In particular no 2026 *vote* can
# exist in a trusted pre-election response.
ROW_LIMIT = 500
SIZE_LIMIT = 1_500_000


def shape(payload, state: str, *, now: dt.datetime | None = None) -> dict:
    """Classify a provider response without manufacturing its undocumented schema."""
    if state not in RACES:
        raise ValueError("Unapproved state source probe")
    now = now or dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:
        raise ValueError("Probe time must have timezone")
    if not isinstance(payload, (dict, list)):
        return {"status": "UNSUPPORTED_RESPONSE_SHAPE", "row_count": 0, "row_keys": []}
    # Real Oct 25 runner observations showed a state/results/resultsFrom
    # response instead of an array. This is a published future start marker,
    # not 2026 returns, an approved result provider, or a live vote record.
    if isinstance(payload, dict) and payload.get("state") == state and (
            payload.get("results") is None or payload.get("results") == {}):
        expected = payload.get("resultsFrom")
        if isinstance(expected, str):
            try:
                begins = dt.datetime.fromisoformat(expected.replace("Z", "+00:00"))
                if (begins.tzinfo is not None and
                        begins >= dt.datetime(2026, 11, 3, 21, tzinfo=dt.timezone.utc)
                        and begins > now):
                    return {"status": "PROVIDER_PUBLISHED_FUTURE_2026_START_NO_RESULTS",
                            "row_count": 0, "row_keys": ["state", "results", "resultsFrom"],
                            "results_from": expected}
            except ValueError:
                pass
    # Provider documentation describes an empty list before Nov 3, but does
    # not warrant the outer wrapper's JSON field name or raceId structure.
    rows = payload if isinstance(payload, list) else None
    if rows is None:
        for key in ("rows", "results", "races", "data"):
            if isinstance(payload.get(key), list):
                rows = payload[key]
                break
    if rows is None:
        return {
            "status": "UNRECOGNIZED_ENVELOPE_NO_SOURCE_APPROVAL",
            "row_count": 0,
            "row_keys": sorted(k for k in payload.keys() if isinstance(k, str))[:18],
        }
    if len(rows) > ROW_LIMIT or any(not isinstance(row, dict) for row in rows):
        return {"status": "MALFORMED_OR_TRUNCATED_PROVIDER_ROWS", "row_count": 0,
                "row_keys": []}
    keyset = sorted({key for row in rows for key in row
                     if isinstance(key, str)})[:18]
    if now < dt.datetime(2026, 11, 3, 21, tzinfo=dt.timezone.utc):
        return {"status": "BEFORE_DOCUMENTED_GENERAL_RESULT_START",
                "row_count": len(rows), "row_keys": keyset}
    if not rows:
        return {"status": "NO_2026_RESULTS_YET", "row_count": 0, "row_keys": []}
    # Operator needs to review the exact real returned schema and source
    # rights BEFORE any raceId is treated as 2026 candidate/vote evidence.
    # Race IDs are purposefully not mapped by a guessed syntax.
    samples = []
    for row in rows[:16]:
        value = row.get("raceId")
        if isinstance(value, str) and len(value) <= 100 and re.fullmatch(
                r"[A-Za-z0-9_:.|/\-]+", value):
            samples.append(value)
    return {"status": "POST_START_ROWS_REQUIRE_EXACT_IDENTITY_REVIEW",
            "row_count": len(rows), "row_keys": keyset,
            "bounded_provider_race_id_examples": samples}


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Alternate results provider redirected outside pinned endpoint")


def fetch_state(state: str, *, opener=None) -> dict:
    if state not in RACES:
        raise ValueError("Unapproved alternate source state")
    url = ENDPOINT + "?" + urllib.parse.urlencode({"state": state})
    request = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "JackStradamus/2026 public-election-source-gap-audit",
    })
    client = opener or urllib.request.build_opener(NoRedirects)
    with client.open(request, timeout=12) as response:
        if response.status != 200 or response.geturl() != url:
            raise ValueError("Unexpected provider response status or origin")
        typ = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
        if typ not in ("application/json", "application/problem+json"):
            raise ValueError("Not a JSON provider response")
        raw = response.read(SIZE_LIMIT + 1)
        if len(raw) > SIZE_LIMIT:
            raise ValueError("Oversized provider response")
    return json.loads(raw.decode("utf-8"))


def probe(*, fetch=fetch_state, now: dt.datetime | None = None) -> dict:
    now = now or dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:
        raise ValueError("UTC-aware probe time required")
    result = {}
    for state, races in RACES.items():
        try:
            response = shape(fetch(state), state, now=now)
        except (ValueError, OSError, urllib.error.URLError,
                json.JSONDecodeError, UnicodeError, TimeoutError) as error:
            response = {"status": "UNAVAILABLE_NOT_SOURCE_EVIDENCE",
                        "error_type": type(error).__name__,
                        "row_count": 0, "row_keys": []}
        result[state] = {"races": list(races), **response}
    return {
        "schema": "eight-gap-alternate-provider-observation-v1",
        "provider": "watch.vote",
        "checked_at": now.isoformat(),
        "event": DATE,
        "source": ENDPOINT,
        "states_probed": len(RACES), "missing_machine_identities": len(EIGHT),
        "results": result,
        "unverified_gap_count": len(EIGHT),  # NOT silently reduced by candidates or links
        "approved_for_live_2026_votes": False,
        "approved_source_race_ids": [],
        "may_update_model_or_control": False,
        "licensing_and_browser_cors_review_required": True,
        "note": "Backend metadata-only: the documented 2026 result route is server-only and gives no verified pre-election vote records. Review exact race IDs, votes and rights before any ingestion.",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = probe()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "EIGHT_GAP_ALTERNATE_PROVIDER_METADATA_ONLY",
        "states_checked": result["states_probed"],
        "provider_http_checks": {k: {"status": v["status"],
                                        "json_keys": v.get("row_keys", [])}
                                 for k, v in result["results"].items()},
        "still_unverified": result["unverified_gap_count"],
        "output": str(args.output),
    }))


if __name__ == "__main__":
    main()
