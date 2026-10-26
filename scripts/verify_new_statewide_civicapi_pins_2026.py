#!/usr/bin/env python3
"""Independently inspect three newly pinned 2026 civicAPI statewide identities.

Read-only: a 2026 provider race may be indexed but have ZERO election-night
votes. Never publish ballots, race calls or model probabilities from this probe.
"""
from __future__ import annotations

from datetime import datetime, timezone
import json
import math

from probe_missing_statewide_sources_2026 import exact, detail_rejection, detail_identity_rejection, CLOSE_UTC
from test_civicapi_live_source import source

EXPECTED = (
    ("MS", "Senate", "US Senate", 81004, "Mississippi US Senate"),
    ("HI", "Governor", "Governor", 87100, "Hawaii Governor"),
    ("OK", "Governor", "Governor", 87582, "Oklahoma Governor"),
)


def audit(fetch=source, now=None):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("Timezone-aware observation clock required")
    records = []
    race_ids = set()
    for state, office, query, wanted, expected_name in EXPECTED:
        spec = (state, office, query)
        search = fetch("/race/search", {
            "country": "US", "province": state,
            "startDate": "2026-11-03", "endDate": "2026-11-03",
            "query": query, "limit": 20,
        })
        if not isinstance(search, dict) or not isinstance(search.get("races"), list):
            raise ValueError("Missing source search rows: " + state)
        if len(search["races"]) > 20 or type(search.get("count")) is not int or (
            search["count"] < len(search["races"]) or search["count"] > 20
        ):
            raise ValueError("Ambiguous or truncated source query: " + state)
        matches = [r for r in search["races"] if exact(spec, r)]
        if len(matches) != 1:
            raise ValueError("Missing or ambiguous pinned source race: " + state)
        row = matches[0]
        if row["id"] != wanted or row["election_name"] != expected_name or wanted in race_ids:
            raise ValueError("Pinned race ID/name changed: " + state)
        race_ids.add(wanted)
        detail = fetch("/race/" + str(wanted), {"light": ""})
        if isinstance(detail, dict) and (search.get('test_data') is True or detail.get('test_data') is True):
            # A successful check can prove that real provider test data is
            # excluded. It cannot certify a usable production result source.
            identity = detail_identity_rejection(spec, row, detail)
            if identity is not None:
                raise ValueError('Test detail metadata mismatch: ' + state + ' ' + identity)
            records.append({'race': office + '|' + state, 'source_race_id': wanted,
                            'exact_2026_identity': True, 'source_test_data': True,
                            'source_status': 'TEST_DATA_EXCLUDED_NOT_LIVE',
                            'adapter_shape_compatible': False,
                            'accepted_live_votes': 0, 'positive_vote_feed_verified': False,
                            'may_update_forecast': False, 'professional_winner_calls_verified': False})
            continue
        reason = detail_rejection(spec, row, detail, now=now)
        if reason is not None:
            raise ValueError("Source search/detail contract mismatch: " + state + " " + reason)
        reporting = detail.get("percent_reporting")
        if isinstance(reporting, bool) or not isinstance(reporting, (int, float)) or (
            not math.isfinite(reporting) or reporting < 0 or reporting > 100
        ):
            raise ValueError("Missing browser adapter percent_reporting: " + state)
        total, calls, percentages = 0, 0, []
        for c in detail["candidates"]:
            v = c["votes"]
            pct = c.get("percent")
            if isinstance(pct, bool) or not isinstance(pct, (float, int)) or (
                not math.isfinite(pct) or not 0 <= pct <= 100
            ):
                raise ValueError("Missing browser-compatible candidate percent: " + state)
            total += v
            if total > 2**53 - 1:
                raise ValueError("Unsafe JS candidate vote count")
            calls += int(c["winner"])
            percentages.append((v, pct))
        if calls > 1 or (calls > 0 and total == 0):
            raise ValueError("Ambiguous or premature source winner: " + state)
        if total > 0:
            if abs(sum(p for _, p in percentages) - 100) > 2 or any(
                    abs(100*v/total-p) > 1.5 for v, p in percentages):
                raise ValueError("Votes and candidate percentages disagree: " + state)
            stamp = detail.get("last_updated")
            try:
                source_time = datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
            except ValueError as exc:
                raise ValueError("Positive 2026 votes missing source time") from exc
            if source_time.tzinfo is None or source_time.astimezone(timezone.utc) < CLOSE_UTC[state]:
                raise ValueError("Source timestamp predates local polls closing: " + state)
            if source_time > now.astimezone(source_time.tzinfo):
                raise ValueError("Source timestamp exceeds receipt clock")
        elif any(p != 0 for _, p in percentages):
            raise ValueError("Zero totals with nonzero candidate percentages: " + state)
        records.append({"race": office + "|" + state, "source_race_id": wanted,
                        "exact_2026_identity": True, "candidate_count": len(detail["candidates"]),
                        "adapter_shape_compatible": True,
                        "positive_vote_feed_verified": total > 0,
                        "may_update_forecast": False,
                        "professional_winner_calls_verified": False})
    return {"schema": "new-pinned-statewide-source-2026-audit-v1",
            "checked_at": now.isoformat(), "races_checked": 3, "races": records,
            "test_data_sources_excluded": sum(r.get('source_test_data') is True for r in records),
            "actual_live_vote_coverage_guaranteed": False,
            "source_approval_is_not_certified_race_call": True}


def main():
    result = audit()
    # Metadata-only JSON; source candidate votes are never republished.
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
