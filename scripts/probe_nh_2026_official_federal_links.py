#!/usr/bin/env python3
"""Advisory discovery of actual official NH 2026 federal race-result links.

The Secretary of State's public 2026 page advertises reports that will be
linked after the election, not a live API. No vote documents are fetched.
Identifying an official report link does NOT approve votes or official calls.
"""
import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import re
from urllib.parse import urljoin, urlsplit
import urllib.request
import urllib.error

URL = "https://www.sos.nh.gov/2026-general-election-results"
PAGE_PATH = "/2026-general-election-results"
EARLIEST_NH_UTC = "2026-11-04T01:00:00Z"
EARLIEST_NH = datetime(2026,11,4,1,tzinfo=timezone.utc)
HEADLINE = re.compile(r"\b2026\s+general\s+election\s+results\b",re.I)
UNSAFE_PATH = re.compile(r"(?:202[0-5]|primary|mock|sample|test[-_]?results)",re.I)
TARGETS = {
    "House|NH-01": re.compile(r"^representative in congress district (?:no\.?\s*)?1$", re.I),
    "House|NH-02": re.compile(r"^representative in congress district (?:no\.?\s*)?2$", re.I),
    "Senate|NH": re.compile(r"^(?:us|united states) senator summary$", re.I),
}

def official_page_url(url):
    p = urlsplit(url)
    return (p.scheme == "https" and p.hostname in ("www.sos.nh.gov", "sos.nh.gov")
            and p.username is None and p.password is None and p.port in (None, 443)
            and p.path.rstrip("/") == PAGE_PATH and not p.query and not p.fragment)


def official_link(url):
    p = urlsplit(url)
    return (p.scheme == "https" and p.hostname in ("www.sos.nh.gov", "sos.nh.gov")
            and p.username is None and p.password is None and p.port in (None,443)
            and bool(p.path) and p.path != "/" and
            p.path.rstrip("/") != "/2026-general-election-results"
            and chr(92) not in p.path and not UNSAFE_PATH.search(p.path+" "+p.query))


class Anchors(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current = None
        self.links = []
        self.in_h1 = False
        self.heading = ""
        self.headings = []

    def handle_starttag(self, tag, attrs):
        if tag == "h1":
            self.in_h1 = True
            self.heading = ""
        if tag != "a":
            return
        href = dict(attrs).get("href", "")
        # Anchors without actual targets are placeholders, not results.
        url = urljoin(URL, href)
        self.current = [url, ""] if href and not href.startswith("#") and official_link(url) else None

    def handle_data(self, data):
        if self.in_h1:
            self.heading += " " + data
        if self.current:
            self.current[1] += " " + data

    def handle_endtag(self, tag):
        if tag == "h1" and self.in_h1:
            self.headings.append(" ".join(self.heading.split()))
            self.in_h1 = False
        if tag == "a" and self.current:
            href, label = self.current
            self.links.append({"url": href, "label": " ".join(label.split())})
            self.current = None


def assess(page, *, checked_at, source_available=True):
    if checked_at.tzinfo is None:
        raise ValueError("Timezone-aware observation required")
    body = " ".join(re.sub(r"<[^>]+>", " ", page or "").split())
    preview = bool(re.search(r"\b(?:test results|sample results|mock results|testing in progress)\b",body,re.I))
    closed = checked_at.astimezone(timezone.utc) >= EARLIEST_NH
    anchors = Anchors()
    anchors.feed(page or "")
    # Require an actual results-page H1, not a body/link/script mention.
    page_ok = any(HEADLINE.fullmatch(h) for h in anchors.headings)
    results = {}
    for race, pattern in TARGETS.items():
        matching = [a["url"] for a in anchors.links if pattern.fullmatch(a["label"])]
        unique = len(matching)==1
        allowed = source_available and page_ok and not preview and closed
        status = ("SOURCE_UNAVAILABLE_NOT_ASSESSED" if not source_available else
                  "WRONG_OR_UNKNOWN_2026_GENERAL_PAGE" if not page_ok else
                  "OFFICIAL_PAGE_TEST_OR_PREVIEW_BLOCKED" if preview else
                  "SOURCE_LINK_PRESENT_PRE_POLL_CLOSE" if matching and not closed else
                  "DUPLICATED_AMBIGUOUS_LINK" if matching and not unique else
                  "EXACT_OFFICIAL_LINK_FOUND_UNVERIFIED" if unique else
                  "OFFICIAL_REPORT_LINK_NOT_YET_PUBLISHED")
        results[race] = {
            "status": status,
            "candidate_official_url": matching[0] if unique and allowed else None,
            "vote_data_verified": False, "source_id_approved": False,
            "official_link_head_status": "NOT_CHECKED",
        }
    return {
        "schema": "nh-2026-official-federal-report-links-v1",
        "checked_at": checked_at.astimezone(timezone.utc).isoformat(),
        "official_page": URL,
        "status": "SOURCE_UNAVAILABLE" if not source_available else
            "OFFICIAL_2026_GENERAL_PAGE" if page_ok and not preview else
            "OFFICIAL_PAGE_TEST_OR_PREVIEW" if page_ok and preview else
            "ELECTION_PAGE_IDENTITY_NOT_VERIFIED",
        "page_2026_general_identity_verified": bool(source_available and page_ok),
        "page_displays_test_or_mock": bool(source_available and preview),
        "polls_closed_for_first_nh_reports": closed,
        "reports": results,
        "source_note": "Official reports are linked after the election; publication timing and browser-readable format unconfirmed.",
        "approved_live_feed": False, "candidate_votes": None,
        "professional_calls": None, "may_move_forecast": False,
        "earliest_nh_poll_close_utc": EARLIEST_NH_UTC,
    }


class SafeOfficialRedirect(urllib.request.HTTPRedirectHandler):
    """Never follow a public-page/report redirect to an unrelated host."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        p = urlsplit(newurl)
        if (p.scheme != "https" or p.hostname not in ("www.sos.nh.gov", "sos.nh.gov")
                or p.username is not None or p.password is not None
                or p.port not in (None, 443)):
            raise ValueError("Redirect left official NH HTTPS host")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def check_report_head(url, *, open_head=None):
    """HEAD only: check a linked report resolves, never read/count vote data.

    A rejected, rate-limited or unsupported HEAD is inconclusive, not a
    finding that the results don't exist. Source identity remains unapproved.
    """
    if not official_link(url):
        return "REJECTED_UNSAFE_OFFICIAL_LINK"
    if open_head is None:
        open_head = urllib.request.build_opener(SafeOfficialRedirect()).open
    request = urllib.request.Request(
        url, method="HEAD",
        headers={"User-Agent": "ElectionCommandCenterNHReportDiscovery/1.0"})
    try:
        with open_head(request, timeout=5) as response:
            if not official_link(response.geturl()):
                return "UNVERIFIED_REPORT_REDIRECT"
            if response.status == 200:
                return "HEAD_200_REPORT_TARGET_UNVERIFIED"
            return "HEAD_INCONCLUSIVE"
    except urllib.error.HTTPError as exc:
        if exc.code == 404 or exc.code == 410:
            return "HEAD_REPORT_TARGET_NOT_FOUND"
        # 403/405, upstream throttling and server errors are not proof
        # that a human cannot open/download the linked report.
        return "HEAD_INCONCLUSIVE"
    except (ValueError, OSError, TimeoutError):
        return "HEAD_INCONCLUSIVE"


def run():
    now = datetime.now(timezone.utc)
    try:
        req = urllib.request.Request(URL, headers={
            "Accept": "text/html",
            "User-Agent": "ElectionCommandCenterNHReportDiscovery/1.0"})
        with urllib.request.build_opener(SafeOfficialRedirect()).open(req, timeout=12) as response:
            if response.status != 200:
                raise ValueError("Official NH results page HTTP not 200")
            dest = response.geturl()
            if not official_page_url(dest):
                raise ValueError("2026 NH general results canonical page redirect not verified")
            body = response.read(400001)
            if len(body) > 400000:
                raise ValueError("Official HTML exceeded bounded read")
        result = assess(body.decode("utf-8", "replace"), checked_at=now)
        for row in result["reports"].values():
            if row["candidate_official_url"]:
                row["official_link_head_status"] = check_report_head(row["candidate_official_url"])
        return result
    except Exception as exc:
        out = assess("", checked_at=now, source_available=False)
        out["error_type"] = type(exc).__name__
        return out


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--probe", action="store_true")
    opts = p.parse_args()
    if not opts.probe:
        p.error("Use --probe for metadata-only official results link discovery")
    print(json.dumps(run(), indent=2, sort_keys=True))
