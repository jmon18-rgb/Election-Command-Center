#!/usr/bin/env python3
"""Read-only public GitHub Pages deployment gate for the 2026 election dashboard.

Checks the ACTUALLY SERVED HTML, important versioned JS blobs, and deployed
House source hints. Does not query live vote providers, model or race calls.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request

from check_house_pins_pages_publication import identities

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SITE = "https://jmon18-rgb.github.io/Election-Command-Center/"
REQUIRED = (
    "civicapi_house_2026_adapter.js",
    "civicapi_state_batch.js",
    "election_night_transport.js",
    "election_night_nowcast.js",
    "election_night_poll_closings_2026.js",
    "election_night_506_live_gap_desk.js",
    "election_night_reconciliation.js",
    "verified_county_source_contract_2026.js",
    "election_night_state_county_fips_2026.js",
    "election_night_early_signals.js",
)
SRC = re.compile(r'<script\s+src="(\./scripts/[a-z0-9_-]+\.js\?v=([0-9a-f]{12}))"></script>')
MAX_BODY = 2_000_000


def git_revision(contents: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(contents)).encode() + b"\0" + contents).hexdigest()[:12]


def timestamp(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError("House identity manifest is missing its issue time")
    date = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if date.tzinfo is None:
        raise ValueError("Source-manifest time is not timezone aware")
    return date.astimezone(timezone.utc)


def audit(index: bytes, remote_pins: dict, remote_coverage: dict,
          assets: dict[str, bytes], local_pins: dict, now: datetime,
          local_assets: dict[str, bytes] | None = None,
          local_index: bytes | None = None) -> dict:
    """Check all entrypoints without interpreting candidate votes or odds."""
    if now.tzinfo is None:
        raise ValueError("Audit time must be timezone aware")
    now = now.astimezone(timezone.utc)
    if len(index) < 100000 or len(index) > MAX_BODY:
        raise ValueError("Pages index is missing or unusually sized")
    html = index.decode("utf-8")
    for marker in (
        "let enHousePinsPromise=null,enHousePinsCheckedAt=-Infinity,enHousePinsCheckOK=false;",
        "let enElectionNightManualArchive=false;",
        "function enElectionNightAutoHandoff(now=Date.now()){",
        "if(enElectionNightAutoHandoff(now))return true;",
        "function enHousePinsReady(){",
        "enHousePinsCheckOK?15*60000:2*60000",
        "cache:'no-store',credentials:'omit'",
        "./data/election_night_house_pins.json?v=",
        'id="enSourceReadiness"',
        'id="enWatchItems"',
        'id="enRaces"',
    ):
        if marker not in html:
            raise ValueError("Deployed index missing open-tab Election Night contract: " + marker)
    versions = {}
    for match in SRC.finditer(html):
        name = match.group(1).split("/")[-1].split("?")[0]
        if name in versions:
            raise ValueError("Repeated script import: " + name)
        versions[name] = match.group(2)
    if len(versions) < 20:
        raise ValueError("Too few versioned production script dependencies")
    for name in REQUIRED:
        version = versions.get(name)
        if not version:
            raise ValueError("Missing served Election Night JS dependency: " + name)
        blob = assets.get(name)
        if not isinstance(blob, bytes) or len(blob) < 100:
            raise ValueError("Missing JS bytes from live GitHub Pages: " + name)
        # The probabilistic needle must not run the prior national-only
        # poll-close guard after we deployed the local-state fix. Compare
        # BOTH the referenced blob and the safety-critical source branches.
        if name == "election_night_nowcast.js":
            if (b"pollsClosedFor(item,actual.asOf,now)" not in blob or
                b"pollsClosedFor(item,new Date(now).toISOString(),now)" not in blob):
                raise ValueError("Deployed needle missing local poll-close protections")
        if git_revision(blob) != version:
            raise ValueError("Deployed script blob/version mismatch: " + name)
    # Checking blob fingerprints alone is not enough: an older HTML page
    # and its matching older JS blob could both pass while the three newly
    # approved statewide race IDs never reach the live laptop. Check the
    # exact provider-verified pins AND the actual browser strict-adapter route.
    statewide_adapter = assets["civicapi_state_batch.js"]
    source_slots = re.search(r"const enBatchPilotSlots=new Set\((\[[\s\S]*?\])\);", html)
    if not source_slots:
        raise ValueError("Deployed statewide strict-source routing unavailable")
    required_statewide = (
        ("Senate|MS", "MS", "Mississippi US Senate", "Senate", 81004),
        ("Governor|HI", "HI", "Hawaii Governor", "Governor", 87100),
        ("Governor|OK", "OK", "Oklahoma Governor", "Governor", 87582),
    )
    for race, state, name, office, race_id in required_statewide:
        exact_pin = (f"'{race}':{{state:'{state}',name:'{name}',"
                     f"office:'{office}',id:{race_id}}}").encode("utf-8")
        if exact_pin not in statewide_adapter:
            raise ValueError("Deployed statewide source pin missing or changed: " + race)
        if f"'{race}'" not in source_slots.group(1):
            raise ValueError("Deployed statewide strict-source route missing: " + race)
    # A stale deployed page and its stale versioned JavaScript blobs can
    # agree with each other. Require the checked-out release itself.
    if local_assets is not None:
        for name in REQUIRED:
            expected_asset = local_assets.get(name)
            if not isinstance(expected_asset, bytes) or len(expected_asset) < 100:
                raise ValueError("Missing checked-out release asset: " + name)
            if git_revision(assets[name]) != git_revision(expected_asset):
                raise ValueError("Deployed asset differs from checked-out main: " + name)
    if local_index is not None and index != local_index:
        raise ValueError("Deployed dashboard HTML differs from checked-out main")
    if remote_pins.get("status") != "VERIFIED_HOUSE_IDENTITIES_NOT_LIVE_RESULTS":
        raise ValueError("Deployed House manifest is not explicitly identity-only")
    when = timestamp(remote_pins.get("generated_at"))
    age = now - when
    if age < -timedelta(minutes=15) or age > timedelta(hours=48):
        raise ValueError("Deployed House IDs expire in the real browser: age=" + str(age))
    published = identities(remote_pins)
    expected = identities(local_pins)
    if published != expected:
        missing = sorted(set(expected.items()) - set(published.items()))[:8]
        extra = sorted(set(published.items()) - set(expected.items()))[:8]
        raise ValueError(f"Published House pin identities differ from main; missing={missing} extra={extra}")
    if remote_coverage.get("schema_version") != "1.0" or (
            remote_coverage.get("status") != "SOURCE_IDENTITY_AUDIT_NOT_LIVE_RESULTS_COVERAGE"
            or remote_coverage.get("election") != "2026-11-03"):
        raise ValueError("Deployed source inventory uses the wrong election or source schema")
    rows = remote_coverage.get("races")
    if not isinstance(rows, list) or len(rows) != 506 or (
            len({r.get("id") for r in rows if isinstance(r, dict)}) != 506):
        raise ValueError("Published dashboard source inventory does not cover 506 unique contests")
    return {
        "status": "DEPLOYED_PAGES_ENTRYPOINT_VERIFIED",
        "script_versions_checked": len(REQUIRED),
        "checked_out_release_asset_parity": local_assets is not None,
        "checked_out_release_html_parity": local_index is not None,
        "strict_statewide_2026_pins_verified": len(required_statewide),
        "script_dependencies_in_html": len(versions),
        "verified_house_id_hints": len(published),
        "races_in_deployed_source_ledger": len(rows),
        "unresolved_source_identities_in_deployed_ledger": sum(
            r.get("gap_status") == "UNRESOLVED_SOURCE_GAP" for r in rows),
        "house_pins_age_hours": round(age.total_seconds() / 3600, 2),
        "votes_or_winner_calls_queried": False,
        "real_time_results_guaranteed": False,
    }


def get_bytes(site: str, resource: str, *, timeout: int) -> bytes:
    url = urllib.parse.urljoin(site, resource)
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or (
            parsed.username or parsed.password):
        raise ValueError("Production Pages resource must be HTTPS")
    headers = {
        "User-Agent": "ElectionNightPagesDeploymentVerification/1.0",
        "Accept": "text/html,application/json,application/javascript,*/*",
        "Cache-Control": "no-cache",
    }
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise ValueError(f"Deployment resource not serving HTTP 200: {resource}")
        data = response.read(MAX_BODY + 1)
        if len(data) > MAX_BODY:
            raise ValueError(f"Deployed resource too large: {resource}")
        return data


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--site", default=DEFAULT_SITE)
    p.add_argument("--timeout", type=int, default=20)
    args = p.parse_args()
    site = args.site.strip()
    if not 1 <= args.timeout <= 30 or not site.startswith("https://"):
        p.error("HTTPS site and request timeout 1-30 seconds required")
    if not site.endswith("/"):
        site += "/"
    index = get_bytes(site, "index.html", timeout=args.timeout)
    pins = json.loads(get_bytes(site, "data/election_night_house_pins.json",
                                timeout=args.timeout))
    coverage = json.loads(get_bytes(site, "data/election_night_source_coverage.json",
                                    timeout=args.timeout))
    html = index.decode("utf-8")
    versioned = {
        m.group(1).split("/")[-1].split("?")[0]: m.group(2)
        for m in SRC.finditer(html)
    }
    assets = {
        name: get_bytes(site, "scripts/" + name + "?v=" + versioned[name],
                        timeout=args.timeout)
        for name in REQUIRED if name in versioned
    }
    local = json.loads((ROOT / "data/election_night_house_pins.json").read_text())
    report = audit(index, pins, coverage, assets, local, datetime.now(timezone.utc),
                   local_assets={
                       name: (ROOT / "scripts" / name).read_bytes() for name in REQUIRED
                   }, local_index=(ROOT / "index.html").read_bytes())
    report["site"] = site
    print(json.dumps(report, indent=2))
    if __import__("os").environ.get("GITHUB_STEP_SUMMARY"):
        with open(__import__("os").environ["GITHUB_STEP_SUMMARY"], "a") as out:
            out.write("### Actual deployed Election Night browser entrypoints\n\n")
            for k, value in report.items():
                out.write(f"- {k.replace('_', ' ')}: {value}\n")
            out.write("\nThis audits deployed assets and source identities only. "
                      "Election Night vote availability and the live needle remain unproven.\n")


if __name__ == "__main__":
    main()
