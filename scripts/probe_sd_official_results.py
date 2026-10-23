#!/usr/bin/env python3
"""Read-only South Dakota 2026 results status probe. Never produces vote data.

The official portal publishes pre-election test returns with realistic totals.
Until its exact CSV export, contest schema, and freshness contract are verified,
this probe is advisory only; it must not feed vote totals to the dashboard.
"""
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from html import unescape

URL = "https://electionresults.sd.gov/ResultsMedia.aspx"
ELECTION_CLOSE_UTC = datetime(2026, 11, 4, 2, 0, tzinfo=timezone.utc)


def assess(html, now=None):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must include timezone")
    text = unescape(re.sub(r"<[^>]+>", " ", html or ""))
    text = " ".join(text.split()).lower()
    election = "general election november 3, 2026" in text
    testing = "testing in progress" in text or "test results" in text
    if not election:
        reason = "WRONG_OR_UNKNOWN_ELECTION"
    elif testing:
        reason = "TEST_RESULTS_BLOCKED"
    elif now < ELECTION_CLOSE_UTC:
        reason = "POLLS_NOT_CLOSED"
    else:
        reason = "EXPORT_CONTRACT_NOT_VERIFIED"
    return {"source": URL, "race": "SD-00", "status": reason,
            "production_votes_usable": False, "export_verified": False,
            "votes": None, "winner_call": None}


def main():
    try:
        req = urllib.request.Request(URL, headers={
            "User-Agent": "ElectionCommandCenterStatusProbe/1.0"})
        with urllib.request.urlopen(req, timeout=12) as res:
            if res.status != 200:
                raise ValueError("HTTP " + str(res.status))
            page = res.read(500_000).decode("utf-8", errors="replace")
        result = assess(page)
    except Exception as exc:
        result = {"source": URL, "race": "SD-00",
                  "status": "SOURCE_UNAVAILABLE", "detail": str(exc)[:200],
                  "production_votes_usable": False,
                  "export_verified": False, "votes": None, "winner_call": None}
    print(json.dumps(result, sort_keys=True))
    return 0  # advisory probe: an outage is not a fake zero-vote result


if __name__ == "__main__":
    sys.exit(main())
