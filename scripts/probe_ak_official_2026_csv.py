#!/usr/bin/env python3
"""Read-only Alaska 2026 election-night CSV source discovery.

The state links a precinct CSV from its election reporting page, but the
actual 2026 URL, production status and House contest schema are NOT approved.
No vote body is downloaded, parsed, persisted or promoted into live results.
"""
import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import re
import urllib.request
from urllib.parse import urljoin, urlsplit

OFFICIAL = "https://www.elections.alaska.gov/enr26/"
DOMAIN = "www.elections.alaska.gov"
EARLIEST_UTC = datetime(2026, 11, 4, 5, tzinfo=timezone.utc)
MAX_HTML = 400_000
MAX_SCRIPT = 200_000


def same_official(url):
    p = urlsplit(url)
    return (p.scheme == "https" and p.hostname == DOMAIN and
            p.username is None and p.password is None and
            p.port in (None, 443) and bool(p.path) and
            not any(x in p.path for x in ("\\", "\x00")))


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.csv, self.scripts, self.labels = [], [], []
        self._anchor = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script":
            s = urljoin(OFFICIAL, attrs.get("src", ""))
            if attrs.get("src") and same_official(s) and s not in self.scripts:
                self.scripts.append(s)
        if tag == "a":
            url = urljoin(OFFICIAL, attrs.get("href", ""))
            self._anchor = url if same_official(url) else None
            if self._anchor and urlsplit(url).path.lower().endswith(".csv") and url not in self.csv:
                self.csv.append(url)

    def handle_data(self, text):
        if self._anchor and re.search(r"precinct|csv|download", text, re.I):
            self.labels.append({"label": " ".join(text.split())[:100],
                                "official_href": self._anchor})

    def handle_endtag(self, tag):
        if tag == "a":
            self._anchor = None


def assess(html, *, checked_at, script_summaries=None, http_ok=True):
    if checked_at.tzinfo is None:
        raise ValueError("UTC-aware audit time required")
    parsed = Links()
    parsed.feed(html or "")
    plain = " ".join(re.sub(r"<[^>]*>", " ", html or "").lower().split())
    reporting_page = "election night reporting" in plain
    download_advertised = ("results by precinct" in plain and "csv" in plain)
    testing = bool(re.search(r"testing in progress|test results|sample results", plain))
    script_summaries = script_summaries or []
    # Only literal, SAME-HOST links directly published on the official page
    # count as discoverable URLs. JS string references are hints, not approved
    # download URLs (scripts may interpolate paths or refer to old elections).
    status = ("SOURCE_UNAVAILABLE" if not http_ok else
              "UNEXPECTED_PAGE" if not reporting_page else
              "TEST_CONTENT_BLOCKED" if testing else
              "OFFICIAL_CSV_LINK_FOUND_IDENTITY_UNVERIFIED" if parsed.csv else
              "OFFICIAL_CSV_ADVERTISED_LINK_UNRESOLVED" if download_advertised else
              "NO_OFFICIAL_CSV_EVIDENCE")
    return {
        "schema": "alaska-2026-official-csv-discovery-v1",
        "checked_at": checked_at.astimezone(timezone.utc).isoformat(),
        "source": OFFICIAL, "race": "House|AK-00",
        "status": status,
        "advertises_precinct_csv": download_advertised,
        "testing_marked": testing,
        "official_csv_links": parsed.csv[:10],
        "linked_script_count": len(parsed.scripts),
        "linked_script_csv_hints": script_summaries[:6],
        "earliest_poll_close_utc": EARLIEST_UTC.isoformat(),
        "may_ingest_votes": False,
        "candidate_votes": None,
        "winner_call": None,
        "source_id_approved": False,
        "may_move_forecast": False,
        "requires": ["actual Nov 3 CSV identity and publication",
                     "candidate and contest schema inspection",
                     "timestamps and test-mode exclusion",
                     "network/CORS or approved server ingestion",
                     "source rights and outage recovery verification"],
    }


def fetch_small(url, budget):
    if not same_official(url):
        raise ValueError("Rejected non-official URL")
    req = urllib.request.Request(url, headers={
        "User-Agent": "ElectionCommandCenterAKStatusAudit/1.0",
        "Accept": "text/html,application/javascript,text/javascript",
    })
    with urllib.request.urlopen(req, timeout=12) as res:
        if not same_official(res.geturl()) or res.status != 200:
            raise ValueError("Unexpected redirect or HTTP status")
        data = res.read(budget + 1)
    if len(data) > budget:
        raise ValueError("Official asset over bounded read limit")
    return data.decode("utf-8", "replace")


def probe():
    now = datetime.now(timezone.utc)
    try:
        html = fetch_small(OFFICIAL, MAX_HTML)
        parsed = Links()
        parsed.feed(html)
        hints = []
        for script in parsed.scripts[:3]:
            try:
                source = fetch_small(script, MAX_SCRIPT)
                # Only report whether an official script mentions CSV. Do not
                # infer that a filename fragment equals the 2026 result path.
                if ".csv" in source.lower():
                    hints.append({"official_script": script,
                                  "mentions_csv": True,
                                  "download_endpoint_verified": False})
            except Exception:
                hints.append({"official_script": script,
                              "script_read_failed": True,
                              "download_endpoint_verified": False})
        return assess(html, checked_at=now, script_summaries=hints)
    except Exception as exc:
        result = assess("", checked_at=now, http_ok=False)
        result["error_type"] = type(exc).__name__
        # Do not report untrusted response bodies or secrets in errors.
        return result


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--probe", action="store_true")
    args = p.parse_args()
    if not args.probe:
        p.error("Use --probe; regression tests import assess() without network")
    print(json.dumps(probe(), sort_keys=True, indent=2))
