#!/usr/bin/env python3
"""Independent official South Dakota 2026 U.S. House result reader.

Source: electionresults.sd.gov/resultsSW.aspx?map=CTY&type=SWR.
Never equate pre-election 'Testing In Progress' totals to votes. This is a
bounded, exact-office results parser, NOT a licensed race call or national feed.
No downstream publishing until both transport AND parse qualify.
"""
from __future__ import annotations
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
import json
import re
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from zoneinfo import ZoneInfo

SOURCE = "https://electionresults.sd.gov/resultsSW.aspx?map=CTY&type=SWR"
CLOSE = datetime(2026, 11, 4, 2, tzinfo=timezone.utc)
CANDIDATE = re.compile(
    r'(?P<name>[A-Za-z][A-Za-z .\'"“”()\-]{1,100}?)\s+'
    r'(?P<party>Republican|Democratic|Independent|Libertarian|Nonpartisan)\s+'
    r'(?P<votes>[0-9][0-9,]*)', re.I)
STAMP = re.compile(r'Results last updated:\s*(\d{1,2}/\d{1,2}/2026\s+'
                   r'\d{1,2}:\d{2}\s*[AP]M)\s*CT', re.I)
CONTEST = re.compile(r'\bUnited States Representative\b', re.I)
NEXT = re.compile(r'\bGovernor and Lieutenant Governor\b', re.I)


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.fragments = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("style", "script", "noscript"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ("style", "script", "noscript") and self.skip:
            self.skip -= 1

    def handle_data(self, value):
        if not self.skip:
            self.fragments.append(value)


def official_url(url):
    p = urlsplit(url)
    return (p.scheme == "https" and p.hostname == "electionresults.sd.gov"
            and p.path.lower() == "/resultssw.aspx"
            and p.query == "map=CTY&type=SWR" and not p.fragment
            and p.username is None and p.password is None
            and p.port in (None, 443))


def assess(html, now=None, *, response_url=SOURCE):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("Observation time must be timezone-aware")
    checked = now.astimezone(timezone.utc)
    pending = {"race": "House|SD-00", "provider": "South Dakota Secretary of State",
               "source_url": SOURCE, "checked_at": checked.isoformat(),
               "last_updated": None, "status": "UNKNOWN_OFFICIAL_DATA",
               "candidates": [], "total": None,
               "approved_for_live_vote_reconciliation": False,
               "professional_call": None}
    if not official_url(response_url):
        return {**pending, "status": "UNTRUSTED_SOURCE_OR_REDIRECT"}
    if not isinstance(html, str) or len(html) > 1500000:
        return {**pending, "status": "INVALID_RESPONSE"}
    parser = Text()
    parser.feed(html)
    body = " ".join(unescape(" ".join(parser.fragments)).split())
    if not re.search(r"General Election November 3, 2026", body, re.I):
        return {**pending, "status": "WRONG_ELECTION"}
    # A public banner can coexist with realistic vote totals and precincts.
    if re.search(r"Testing In Progress|Mock Results|Test Results", body, re.I):
        return {**pending, "status": "MOCK_RESULTS_BLOCKED"}
    if checked < CLOSE:
        return {**pending, "status": "POLLS_NOT_CLOSED"}
    m = STAMP.search(body)
    if not m:
        return {**pending, "status": "SOURCE_TIMESTAMP_MISSING"}
    try:
        at = datetime.strptime(m.group(1), "%m/%d/%Y %I:%M %p").replace(
            tzinfo=ZoneInfo("America/Chicago")).astimezone(timezone.utc)
    except ValueError:
        return {**pending, "status": "SOURCE_TIMESTAMP_INVALID"}
    if at < CLOSE or at > checked or checked-at > __import__("datetime").timedelta(hours=3):
        return {**pending, "status": "SOURCE_TIMESTAMP_NOT_CURRENT",
                "last_updated": at.isoformat()}
    matches = list(CONTEST.finditer(body))
    if len(matches) != 1:
        return {**pending, "status": "HOUSE_CONTEST_ABSENT_OR_DUPLICATE"}
    match = NEXT.search(body, matches[0].end())
    if not match:
        return {**pending, "status": "NO_CONTEST_BOUNDARY"}
    contest = body[matches[0].end():match.start()]
    start = re.search(r"Partially:\s*\d+\s*/\s*\d+", contest, re.I)
    end = re.search(r"total votes\s+([0-9][0-9,]*)", contest, re.I)
    if not start or not end or start.end() >= end.start():
        return {**pending, "status": "CONTEST_ARITHMETIC_NOT_VERIFIABLE"}
    chunk = contest[start.end():end.start()]
    rows = list(CANDIDATE.finditer(chunk))
    if not 2 <= len(rows) <= 8:
        return {**pending, "status": "CANDIDATES_NOT_VERIFIABLE"}
    candidates, names, total = [], set(), 0
    # Exact name/party/vote groups must cover the candidate section. A
    # changed official HTML format is unknown, not permissive string scraping.
    pos = 0
    for item in rows:
        if chunk[pos:item.start()].strip(" \t\n\r·•*-"):
            return {**pending, "status": "CANDIDATE_LAYOUT_CHANGED"}
        name = " ".join(item.group("name").split())
        identity = name.casefold()
        if identity in names:
            return {**pending, "status": "DUPLICATE_CANDIDATE"}
        names.add(identity)
        votes = int(item.group("votes").replace(",", ""))
        total += votes
        candidates.append({"name": name, "party": item.group("party"),
                           "votes": votes})
        pos = item.end()
    if chunk[pos:].strip(" \t\n\r·•*-"):
        return {**pending, "status": "CANDIDATE_LAYOUT_CHANGED"}
    official_total = int(end.group(1).replace(",", ""))
    if total != official_total or total <= 0 or total > 1500000:
        return {**pending, "status": "CONTEST_ARITHMETIC_INVALID"}
    if not any(x["party"].lower() == "republican" for x in candidates):
        return {**pending, "status": "BALLOT_IDENTITY_UNVERIFIED"}
    return {**pending, "status": "SOURCE_REPORTED_UNOFFICIAL_VOTES",
            "last_updated": at.isoformat(), "candidates": candidates,
            "total": total, "approved_for_live_vote_reconciliation": True}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def fetch(max_bytes=1500000):
    req = Request(SOURCE, headers={"User-Agent": "ElectionCommandCenterSDOfficial/1.0",
                                   "Accept": "text/html", "Accept-Encoding": "identity"})
    with build_opener(NoRedirect).open(req, timeout=12) as response:
        if response.status != 200 or not official_url(response.geturl()):
            raise ValueError("Unexpected official SD response/redirect")
        raw = response.read(max_bytes+1)
        if len(raw) > max_bytes or "html" not in response.headers.get("Content-Type", "").lower():
            raise ValueError("Unexpected official SD content type/size")
    return raw.decode("utf-8", "replace")


def main():
    try:
        result = assess(fetch())
    except Exception as ex:
        result = assess("")
        result["status"] = "SOURCE_UNAVAILABLE"
        result["error_type"] = type(ex).__name__
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
