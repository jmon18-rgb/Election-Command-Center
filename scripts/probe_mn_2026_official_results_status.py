#!/usr/bin/env python3
"""Advisory-only Minnesota 2026 general-election page status.

The official state portal currently displays TEST RESULTS. Neither a
page view nor the disappearance of a mock banner licenses machine ingestion,
a source-reported ballot, a professional call, or a forecast adjustment.
"""
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import re
import urllib.request
from urllib.parse import urlsplit

SOURCE = "https://electionresults.sos.mn.gov/201"
STATE_CLOSE = datetime(2026, 11, 4, 2, tzinfo=timezone.utc)
MAX_BYTES = 350_000


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def assess(html, now, available=True):
    if now.tzinfo is None:
        raise ValueError("Observer clock must include UTC offset")
    parser = VisibleText()
    parser.feed(html or "")
    text = " ".join(" ".join(parser.parts).lower().split())
    general = bool(re.search(r"\\b(?:state\\s+)?general\\s+election\\b", text)
                   and re.search(r"\\bnovember\\s+3,?\\s+2026\\b", text))
    test = bool(re.search(r"\\btest\\s+results\\b|\\btesting\\s+in\\s+progress\\b|\\bmock\\s+results\\b", text))
    status = ("SOURCE_UNAVAILABLE_NOT_ASSESSED" if not available else
              "WRONG_OR_UNKNOWN_2026_GENERAL_PAGE" if not general else
              "MOCK_TEST_RESULTS_BLOCKED" if test else
              "POLL_CLOSE_NOT_REACHED" if now.astimezone(timezone.utc) < STATE_CLOSE else
              "PAGE_FOUND_SOURCE_INGESTION_UNVERIFIED")
    return {
        "schema": "mn-official-2026-general-page-advisory-v1",
        "state": "MN", "source": SOURCE, "race_scope": "MN House, Senate, Governor",
        "checked_at": now.astimezone(timezone.utc).isoformat(),
        "status": status, "test_marker_seen": bool(test and available),
        "validated_live_feed": False,
        "race_ids_verified": False, "candidate_votes": None,
        "professional_calls": None, "may_update_model": False,
        "next_step": "Human verify live state publication, contest identity, source clock, mock exclusion, reuse permission and browser access before approving ingestion."
    }


def accepted_redirect(actual):
    p = urlsplit(actual)
    return (p.scheme == "https" and p.hostname == "electionresults.sos.mn.gov"
            and p.port in (None, 443) and p.username is None
            and p.password is None and p.path.rstrip("/") == "/201"
            and not p.query and not p.fragment)


def probe():
    now = datetime.now(timezone.utc)
    try:
        req = urllib.request.Request(SOURCE, headers={
            "User-Agent": "ElectionCommandCenterMN2026SourceStatus/1.0",
            "Accept": "text/html"})
        with urllib.request.urlopen(req, timeout=12) as response:
            if response.status != 200 or not accepted_redirect(response.geturl()):
                raise ValueError("MN official page moved outside reviewed location")
            raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("MN official page exceeded bounded read")
        return assess(raw.decode("utf-8", "replace"), now)
    except Exception as exc:
        result = assess("", now, available=False)
        result["error_type"] = type(exc).__name__
        return result


if __name__ == "__main__":
    print(json.dumps(probe(), indent=2, sort_keys=True))
