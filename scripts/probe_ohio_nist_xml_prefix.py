#!/usr/bin/env python3
"""Bounded GET-prefix inspection of Ohio's 2026 NIST election export route.

HEAD is documented to return 405 on the root route despite the HTML
downloadReport() JavaScript pointing there. A GET may behave differently.

This is NOT a vote import: request a maximum 8192-byte prefix, never
parse or log candidate counts, reject redirect following and DTD/entity
content, and never turn a response into an approved live source.
"""
import argparse
import datetime as dt
import hashlib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from probe_ohio_xml_export_headers import (
    SCRIPT_RESOLVED, ROOT_ALTERNATIVE, OHIO_HOST,
)

LIMIT = 8192
VALID_HOSTS = frozenset({OHIO_HOST})
XML_ROOT = re.compile(
    r"^\s*(?:<\?xml\s+[^>]*\?>\s*)?"
    r"(?:<!--[^>]*-->\s*){0,3}"
    r"<(?:[A-Za-z][\w.-]*:)?ElectionReport(?:\s|>)",
    re.DOTALL,
)
HTML_ROOT = re.compile(r"<!doctype\s+html|<html(?:\s|>)", re.IGNORECASE)
DANGEROUS_XML = re.compile(r"<!DOCTYPE|<!ENTITY|<\?xml-stylesheet", re.IGNORECASE)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def allow_target(url):
    parsed = urllib.parse.urlsplit(url)
    return (
        parsed.scheme == "https"
        and parsed.hostname in VALID_HOSTS
        and parsed.username is None
        and parsed.password is None
        and parsed.port in (None, 443)
        and url in {SCRIPT_RESOLVED, ROOT_ALTERNATIVE}
    )


def characterize(prefix, response):
    if not isinstance(prefix, bytes) or len(prefix) > LIMIT:
        raise ValueError("Ohio XML sample exceeds bounded budget")
    if not isinstance(response, dict):
        raise ValueError("Ohio HTTP response metadata missing")
    status = response.get("status")
    if type(status) is not int or status < 100 or status > 599:
        raise ValueError("Invalid HTTP status")
    mime = str(response.get("mime") or "")[:90].lower()
    text = prefix.decode("utf-8-sig", errors="replace")
    danger = DANGEROUS_XML.search(text) is not None
    html = HTML_ROOT.search(text[:1200]) is not None
    declared_root = XML_ROOT.search(text[:2000]) is not None
    return {
        "http_status": status,
        "mime_type": mime,
        "response_bytes_sampled": len(prefix),
        "prefix_sha256": hashlib.sha256(prefix).hexdigest() if prefix else None,
        "redirect_hostname_only": response.get("redirect_hostname"),
        "looks_like_nist_election_report_xml": (
            status in (200, 206) and declared_root and not html and not danger
        ),
        "html_or_gateway_page_detected": html,
        "doctype_or_external_entity_risk": danger,
        "official_2026_election_verified": False,
        "mock_votes_excluded_from_results": True,
        "complete_xml_downloaded": False,
        "candidate_votes_parsed": False,
    }


def fetch_prefix(url):
    if not allow_target(url):
        raise ValueError("Not an exact official Ohio export path")
    req = urllib.request.Request(
        url, headers={
            "User-Agent": "ElectionCommandCenter/1.0 Ohio-XML-bounded-prefix-audit",
            "Range": "bytes=0-8191",
            "Accept": "application/xml,text/xml,application/octet-stream",
            "Cache-Control": "no-cache",
        }, method="GET"
    )
    opener = urllib.request.build_opener(NoRedirect)
    try:
        response = opener.open(req, timeout=16)
    except urllib.error.HTTPError as e:
        response = e
    with response:
        status = response.status
        location = response.headers.get("Location")
        hostname = None
        if location:
            target = urllib.parse.urljoin(url, location)
            hostname = urllib.parse.urlsplit(target).hostname
        content = response.read(LIMIT)
        # Never read beyond LIMIT, including for HTTP 200 range-ignored
        # responses. The public mock vote XML may be arbitrarily large.
        return characterize(content, {
            "status": status,
            "mime": response.headers.get("Content-Type"),
            "redirect_hostname": hostname,
        })


def run(check=fetch_prefix):
    values = []
    for label, url in (
        ("official_root_candidate", ROOT_ALTERNATIVE),
        ("javascript_document_relative_candidate", SCRIPT_RESOLVED),
    ):
        try:
            report = check(url)
        except (OSError, ValueError, urllib.error.URLError) as err:
            report = {
                "error": str(err)[:220],
                "complete_xml_downloaded": False,
                "candidate_votes_parsed": False,
            }
        values.append({
            "candidate": label, "url": url,
            "verified_2026_live_ingestion": False, **report,
        })
    return {
        "schema": "ohio-nist-bounded-xml-prefix-probe-v1",
        "status": "DIAGNOSTIC_ONLY_PRE_ELECTION_MOCK_POSSIBLE",
        "tested_method": "GET Range bytes=0-8191; no redirects",
        "probes": values,
        "no_full_export_body_retained": True,
        "source_approval_required_after_real_nov_3_publication": True,
        "independent_vote_validation_completed": False,
        "may_move_national_needle": False,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--probe", action="store_true")
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    if not args.probe:
        p.error("Use --probe to inspect official Ohio export prefix only")
    report = run()
    report["checked_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    args.output.write_text(json.dumps(report, indent=2)+"\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
