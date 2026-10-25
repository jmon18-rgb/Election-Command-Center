#!/usr/bin/env python3
"""Read-only metadata watch for the official North Dakota 2026 results portal.

NEVER fetch export files or scrape totals. Existence of an official landing
page, download menu, or official announcement is NOT machine-source coverage,
actual 2026 votes, race calls, percent precincts or county needle evidence.
"""
from __future__ import annotations
import datetime as dt
from html.parser import HTMLParser
import json
import re
import urllib.error
import urllib.request
from urllib.parse import urlsplit
from national_results_coverage_pulse import state_poll_closings

OFFICIAL = "https://www.sos.nd.gov/elections/election-results"
PORTAL = "https://resultsnd.sos.nd.gov/"
NEWS = "https://www.sos.nd.gov/news/secretary-state-launches-new-election-night-results-website"
MAX_BYTES = 1_000_000
STATUS = "ND_2026_OFFICIAL_RESULTS_PORTAL_METADATA_ONLY_NOT_VOTES"
SCHEDULE_EXPECTED = "Nov 3, 2026; ND SOS says unofficial county returns available beginning 8 PM local"


class LinkIndex(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current = None
        self.text = []
        self.links = []
        self.plain = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        if tag == "a" and not self.skip:
            self.current = dict(attrs).get("href")
            self.text = []

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        if tag == "a" and self.current is not None:
            self.links.append((" ".join(" ".join(self.text).split()), self.current))
            self.current = None
            self.text = []

    def handle_data(self, data):
        if not self.skip:
            self.plain.append(data)
            if self.current is not None:
                self.text.append(data)


def safe_link(url, host, path):
    if not isinstance(url, str):
        return False
    try:
        parsed = urlsplit(url)
        return (parsed.scheme == "https" and parsed.hostname == host
                and parsed.port in (None, 443) and parsed.username is None
                and parsed.password is None and parsed.path.rstrip("/") == path.rstrip("/")
                and not parsed.query and not parsed.fragment
                and not re.search(r"[\x00-\x20\\]", url))
    except ValueError:
        return False


def evaluate(office_html, portal_html, now, *, office_available=True,
             portal_available=True):
    if not isinstance(now, dt.datetime) or now.tzinfo is None:
        raise ValueError("Observer time must include UTC offset")
    now = now.astimezone(dt.timezone.utc)
    page = LinkIndex()
    page.feed(office_html or "")
    matches = [href for label, href in page.links if
               re.search(r"\bgeneral election results\b", label, re.I)
               and re.search(r"\bnovember\s+3,?\s+2026\b", label, re.I)]
    # Host/path-only debug is safe public metadata. Do not emit query
    # strings or raw HTML. It helps distinguish a changed 2026 results
    # navigation URL from a wrong label or a malformed landing page.
    discovered = []
    for href in matches[:5]:
        parsed = urlsplit(href or "")
        discovered.append({"scheme": parsed.scheme, "host": parsed.hostname,
                           "path": parsed.path[:120], "has_query": bool(parsed.query),
                           "has_fragment": bool(parsed.fragment),
                           "fragment_kind": "general_2026" if "2026" in parsed.fragment else
                             "other" if parsed.fragment else "none",
                           "port": parsed.port,
                           "has_credentials": parsed.username is not None,
                           "has_unsafe_whitespace": bool(re.search(r"[\\x00-\\x20\\\\]",href or ""))})
    # Fail closed on duplicate / ambiguous results links, including one
    # malicious link alongside a valid government portal address.
    confirmed = (office_available and len(matches) == 1
                 and safe_link(matches[0], "resultsnd.sos.nd.gov", "/"))
    portal_text = LinkIndex()
    portal_text.feed(portal_html or "")
    preview = bool(re.search(r"\b(?:testing in progress|test results|mock results|sample results)\b",
                             " ".join(portal_text.plain), re.I))
    portal_reachable = bool(portal_available and confirmed and portal_html)
    after_close = now >= state_poll_closings()["ND"]
    status = ("ND_OFFICIAL_2026_GENERAL_LINK_UNAVAILABLE" if not office_available else
              "ND_2026_GENERAL_PORTAL_LINK_NOT_EXACT" if not confirmed else
              "ND_2026_GENERAL_PORTAL_FETCH_UNAVAILABLE" if not portal_reachable else
              "ND_OFFICIAL_PORTAL_DISPLAYS_TEST_RESULTS" if preview else
              "ND_OFFICIAL_PORTAL_PRE_CLOSE_NOT_LIVE_VOTES" if not after_close else
              "ND_POST_CLOSE_PORTAL_ONLY_NO_VERIFIED_MACHINE_RESULTS")
    return {
        "schema": "nd-2026-general-official-portal-discovery-v1",
        "status": status,
        "review_type": STATUS,
        "checked_at": now.isoformat(),
        "official_election_page": OFFICIAL, "official_results_portal": PORTAL,
        "official_2026_general_link_confirmed": confirmed,
        "ambiguous_2026_general_links": len(matches) > 1,
        "candidate_2026_general_links": len(matches),
        "official_anchor_locations_safe": discovered,
        "portal_metadata_reachable": portal_reachable,
        "portal_test_mode_seen": bool(preview and portal_reachable),
        "canonical_nd_close_passed": after_close,
        "source_announcement": NEWS, "source_says": SCHEDULE_EXPECTED,
        "provider_updates_claimed_by_state": "approximately every 10 minutes",
        "published_download_formats_claimed_by_state": True,
        "download_endpoint_identity_verified": False,
        "browser_cors_verified": False, "export_schema_verified": False,
        "house_nd_00_machine_source_verified": False,
        "independent_race_call_provider_verified": False,
        "verified_2026_votes": None, "winner_calls": None,
        "reporting_percentage": None, "statewide_completion": None,
        "may_update_forecast": False, "may_move_geographic_needle": False,
    }


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def get_html(url, host, path):
    if not safe_link(url, host, path):
        raise ValueError("Unapproved official metadata URL")
    opener = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(url, headers={
        "User-Agent": "ElectionCommandCenterND2026Metadata/1.0",
        "Accept": "text/html", "Accept-Encoding": "identity"})
    with opener.open(req, timeout=12) as response:
        if response.status != 200 or not safe_link(response.geturl(), host, path):
            raise ValueError("Official URL changed identity")
        content = response.read(MAX_BYTES + 1)
        if len(content) > MAX_BYTES:
            raise ValueError("Official landing HTML oversized")
        return content.decode("utf-8", "replace")


def probe(now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    errors = []
    office = portal = ""
    found_office = found_portal = False
    for name, url, host, path in (
        ("office", OFFICIAL, "www.sos.nd.gov", "/elections/election-results"),
        ("portal", PORTAL, "resultsnd.sos.nd.gov", "/"),
    ):
        try:
            body = get_html(url, host, path)
            if name == "office":
                office, found_office = body, True
            else:
                portal, found_portal = body, True
        except (ValueError, TimeoutError, urllib.error.URLError, UnicodeError) as exc:
            # Emit ONLY fixed local diagnostic strings, not remote response
            # bodies, redirected URL parameters or source vote content.
            error = {"endpoint": name, "error_type": type(exc).__name__}
            if isinstance(exc, ValueError) and str(exc) in (
                "Unapproved official metadata URL",
                "Official URL changed identity",
                "Official landing HTML oversized"):
                error["safe_failure_reason"] = str(exc)
            errors.append(error)
    report = evaluate(office, portal, now, office_available=found_office,
                      portal_available=found_portal)
    report["fetch_errors"] = errors
    return report


if __name__ == "__main__":
    print(json.dumps(probe(), indent=2, sort_keys=True))
