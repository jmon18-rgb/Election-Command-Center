#!/usr/bin/env python3
"""Trace Ohio's published NIST XML download button without executing scripts.

A page action like javascript:downloadReport('VSSC1622XmlFileBlob') is NOT
a source URL. Inspect bounded, publicly served first-party scripts to locate
the implementation and identify the network method; never download the
referenced result XML or promote pre-election mock results.
"""
import argparse
import datetime as dt
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from discover_ohio_official_nist_xml import (
    PAGE, OFFICIAL_HOSTS, download, inspect,
)

MAX_JS_BYTES = 800_000
MAX_SCRIPTS = 24
MAX_SNIPPET = 2500
NEEDLES = (
    "downloadReport", "VSSC1622XmlFileBlob",
    "createObjectURL", "XMLHttpRequest", "fetch(", "window.location",
)

class ScriptInventory(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.external = []
        self.inline = []
        self._in_script = False
        self._inline = []

    def handle_starttag(self, tag, attrs):
        if tag != "script":
            return
        self._in_script = True
        self._inline = []
        values = dict(attrs)
        if "src" in values:
            self.external.append(values["src"])

    def handle_data(self, data):
        if self._in_script:
            self._inline.append(data)

    def handle_endtag(self, tag):
        if tag != "script" or not self._in_script:
            return
        body = "".join(self._inline)
        if body.strip():
            self.inline.append(body[:MAX_JS_BYTES])
        self._inline = []
        self._in_script = False


def official_js_url(src):
    if not isinstance(src, str) or not src or len(src) > 1200:
        return None
    url = urllib.parse.urljoin(PAGE, src)
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in OFFICIAL_HOSTS:
        return None
    if not parsed.path.lower().endswith(".js"):
        return None
    if parsed.username or parsed.password:
        return None
    return url


def find_snippets(content):
    if not isinstance(content, str):
        raise ValueError("JavaScript source must be readable text")
    discovered = []
    for needle in NEEDLES:
        matches = list(re.finditer(re.escape(needle), content, flags=re.I))
        for match in matches[:3]:
            start = max(0, match.start() - 400)
            end = min(len(content), match.end() + MAX_SNIPPET)
            discovered.append({
                "signal": needle,
                "excerpt": content[start:end],
                "position": match.start(),
            })
    return discovered[:16]


def collect(html, get_script=None):
    if not isinstance(html, str) or len(html) > 1_500_000:
        raise ValueError("Unexpected Ohio HTML response")
    classified = inspect(html)
    scripts = ScriptInventory()
    scripts.feed(html)
    findings = []
    for i, body in enumerate(scripts.inline[:MAX_SCRIPTS]):
        samples = find_snippets(body)
        if samples:
            findings.append({
                "source": "first-party inline script #" + str(i),
                "snippets": samples,
            })
    candidates = []
    for raw in scripts.external[:MAX_SCRIPTS]:
        clean = official_js_url(raw)
        if clean and clean not in candidates:
            candidates.append(clean)
    errors = []
    if get_script:
        for url in candidates:
            try:
                body = get_script(url)
                if not isinstance(body, str) or len(body) > MAX_JS_BYTES:
                    raise ValueError("Oversized first-party JavaScript resource")
                samples = find_snippets(body)
                if samples:
                    findings.append({"source": url, "snippets": samples})
            except (OSError, ValueError, UnicodeError) as ex:
                errors.append({"script": url, "error": str(ex)[:180]})
    return {
        "schema": "ohio-official-xml-download-action-trace-v1",
        "status": "OFFICIAL_FIRST_PARTY_SCRIPT_STATIC_TRACE_NOT_A_LIVE_RESULTS_FEED",
        "official_page": PAGE,
        "download_actions": [
            {
                "action": row["official_download_action"],
                "object_key": row["official_download_object_key"],
            }
            for row in classified["possible_feed_links"]
            if row.get("official_download_action") == "downloadReport"
        ],
        "official_js_files_listed": len(candidates),
        "scripts_examined": len(scripts.inline[:MAX_SCRIPTS]) +
                            (len(candidates) if get_script else 0),
        "source_excerpts": findings[:20],
        "failed_first_party_script_reads": errors,
        "pre_election_data_must_be_treated_as_mock_until_independent_review": True,
        "official_feed_url_certified": False,
        "source_vote_counts_ingested": False,
        "ready_for_automatic_2026_ingestion": False,
        "may_move_national_needle": False,
    }


def read_script(url):
    if official_js_url(url) != url:
        raise ValueError("Only same-host HTTPS JavaScript may be read")
    req = urllib.request.Request(url, headers={
        "User-Agent": "ElectionCommandCenter/1.0 OhioOfficialStaticTrace",
        "Accept": "text/javascript,application/javascript,*/*",
    })
    with urllib.request.urlopen(req, timeout=12) as response:
        if response.status != 200:
            raise ValueError("First-party script status " + str(response.status))
        data = response.read(MAX_JS_BYTES + 1)
        if len(data) > MAX_JS_BYTES:
            raise ValueError("First-party script too large")
        charset = response.headers.get_content_charset() or "utf-8"
        return data.decode(charset, errors="replace")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--probe", action="store_true")
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    if not args.probe:
        p.error("Pass --probe to inspect static public Ohio source scripts")
    try:
        report = collect(download(), read_script)
    except (OSError, ValueError, UnicodeError) as ex:
        report = {
            "schema": "ohio-official-xml-download-action-trace-v1",
            "status": "OFFICIAL_OHIO_SOURCE_TRACE_UNAVAILABLE",
            "reason": str(ex)[:220],
            "source_excerpts": [],
            "source_vote_counts_ingested": False,
            "ready_for_automatic_2026_ingestion": False,
            "may_move_national_needle": False,
        }
    report["checked_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    # Emit only bounded static JS snippets and identities, never XML votes.
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
