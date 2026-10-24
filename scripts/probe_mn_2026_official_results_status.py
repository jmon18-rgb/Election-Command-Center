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
from urllib.parse import urlsplit, urljoin

SOURCE = "https://electionresults.sos.mn.gov/201"
STATE_CLOSE = datetime(2026, 11, 4, 2, tzinfo=timezone.utc)
MAX_BYTES = 350_000
EXPORT_INDEX = "https://electionresults.sos.mn.gov/Select/MediaFiles/Index?ersElectionId=201"
LAYOUT = "https://electionresults.sos.mn.gov/Results/MediaFileLayout/Index?erselectionId=201"
# Names independently read from Minnesota's official 2026 export index.
# These are FILE IDENTITIES, never 2026 production vote availability.
EXPECTED_EXPORTS = {
    "U.S. Senator Statewide": "ussenate.txt",
    "U.S. Senator by County": "ussenatecty.txt",
    "U.S. Representative by Congressional District": "ushouse.txt",
    "U.S. Representative by County": "USHouseCty.txt",
    "Governor Statewide": "Governor.txt",
    "Precinct Reporting Statistics": "pctstats.txt",
}



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


class OfficialExportAnchors(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.current = None
        self.text = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.current = dict(attrs).get("href")
            self.text = []

    def handle_data(self, data):
        if self.current is not None:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.current is not None:
            label = " ".join(" ".join(self.text).split())
            self.links.append((label, self.current))
            self.current = None
            self.text = []


def accepted_export_url(url, expected_file):
    parsed = urlsplit(url)
    return (parsed.scheme == "https" and
            parsed.hostname == "electionresultsfiles.sos.mn.gov" and
            parsed.port in (None, 443) and
            parsed.username is None and parsed.password is None and
            parsed.query == "" and parsed.fragment == "" and
            parsed.path == "/20261103/" + expected_file)


def accepted_export_index(url):
    parsed = urlsplit(url)
    return (parsed.scheme == "https" and
            parsed.hostname == "electionresults.sos.mn.gov" and
            parsed.port in (None, 443) and
            parsed.username is None and parsed.password is None and
            parsed.path.rstrip("/") == "/Select/MediaFiles/Index" and
            parsed.query == "ersElectionId=201" and
            parsed.fragment == "")


def discover_export_index(html, now, available=True):
    """Inspect official export HREFs only: do not request candidate-vote files.

    The source layout is 16 semicolon-separated fields per candidate-area
    record. File presence, reporting-precinct counts, and test totals NEVER
    establish production vote availability or a county needle.
    """
    if now.tzinfo is None:
        raise ValueError("Observer clock needs UTC offset")
    plain = VisibleText()
    plain.feed(html or "")
    text = " ".join(" ".join(plain.parts).lower().split())
    exact_day = bool(re.search(r"\bnovember\s+3,?\s+2026\b", text))
    correct_index = ("downloadable text files" in text and
                     "election results files" in text and exact_day)
    test = bool(re.search(
        r"\btest\s+results\b|\btesting\s+in\s+progress\b|\bmock\s+results\b",
        text))
    links = OfficialExportAnchors()
    links.feed(html or "")
    matched = {}
    ambiguous = False
    for label, href in links.links:
        if label not in EXPECTED_EXPORTS:
            continue
        dest = urljoin(EXPORT_INDEX, href)
        if label in matched or not accepted_export_url(dest, EXPECTED_EXPORTS[label]):
            ambiguous = True
            break
        matched[label] = dest
    if not available:
        status = "EXPORT_INDEX_UNAVAILABLE_NOT_ASSESSED"
    elif not correct_index:
        status = "WRONG_2026_EXPORT_INDEX"
    elif ambiguous:
        status = "UNSAFE_OR_AMBIGUOUS_EXPORT_IDENTITY"
    elif test:
        status = "MOCK_EXPORT_LINKS_QUARANTINED"
    elif now.astimezone(timezone.utc) < STATE_CLOSE:
        status = "EXPORT_LINKS_PRE_CLOSE_ONLY"
    else:
        status = "EXPORT_LINKS_NOT_APPROVED_FOR_INGESTION"
    # A partial verified link roster is metadata, not all-office source
    # assurance. Never fill a missing file or turn it into zero ballots.
    return {
        "schema": "mn-official-2026-export-link-advisory-v1",
        "index": EXPORT_INDEX, "official_schema_reference": LAYOUT,
        "checked_at": now.astimezone(timezone.utc).isoformat(),
        "status": status,
        "test_marker_seen": bool(test and available),
        "expected_file_identities": len(EXPECTED_EXPORTS),
        "exact_official_links_discovered": len(matched) if correct_index and not ambiguous else 0,
        "matched_links": matched if correct_index and not ambiguous else {},
        "format": "16-column semicolon-delimited; county IDs NOT Census FIPS",
        "precinct_file_timing": "Minnesota SOS says precinct files available next morning",
        "retrieved_vote_files": 0,
        "candidate_votes": None, "ballots_reported": None,
        "reporting_percentage": None, "winner_calls": None,
        "may_update_model": False, "geographic_needle_calibrated": False,
        "validated_live_feed": False, "race_ids_verified": False,
    }


def probe_export_index():
    now = datetime.now(timezone.utc)
    try:
        req = urllib.request.Request(EXPORT_INDEX, headers={
            "User-Agent": "ElectionCommandCenterMN2026ExportIdentity/1.0",
            "Accept": "text/html"})
        with urllib.request.urlopen(req, timeout=12) as response:
            if response.status != 200 or not accepted_export_index(response.geturl()):
                raise ValueError("Minnesota export index moved beyond reviewed host/path")
            raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("Minnesota export index too large")
        return discover_export_index(raw.decode("utf-8", "replace"), now)
    except Exception as exc:
        result = discover_export_index("", now, available=False)
        result["error_type"] = type(exc).__name__
        return result


def assess(html, now, available=True):
    if now.tzinfo is None:
        raise ValueError("Observer clock must include UTC offset")
    parser = VisibleText()
    parser.feed(html or "")
    text = " ".join(" ".join(parser.parts).lower().split())
    general = bool(re.search(r"\b(?:state\s+)?general\s+election\b", text)
                   and re.search(r"\bnovember\s+3,?\s+2026\b", text))
    test = bool(re.search(r"\btest\s+results\b|\btesting\s+in\s+progress\b|\bmock\s+results\b", text))
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
