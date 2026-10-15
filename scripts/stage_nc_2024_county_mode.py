#!/usr/bin/env python3
"""Nonpublishing NC 2024 official precinct × vote-mode staging research.

Source: North Carolina State Board of Elections, November 5, 2024
precinct tabulated election results (mode-separated), with 2024 certification
reconciliation. This NEVER serves as live 2026 vote counts or a county needle.
"""
from __future__ import annotations
import argparse
import collections
import csv
import datetime as dt
import hashlib
import io
import json
import re
import urllib.request
import zipfile
from pathlib import Path

URL = "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2024_11_05/results_pct_20241105.zip"
LAYOUT = "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/layout_results_pct.txt"
DATE = "11/05/2024"
OFFICIAL_CERTIFIED = {"DEM": 2_715_375, "REP": 2_898_423}
MODES = {"election_day": "election day", "early_in_person": "early voting",
         "mail": "absentee by mail", "provisional": "provisional"}
REQUIRED = ("county", "election date", "precinct", "contest name",
            "choice party", "vote for", "election day", "early voting",
            "absentee by mail", "provisional", "total votes")


def canonical(key):
    return re.sub(r"[^a-z0-9]+", " ", (key or "").casefold()).strip()


def parse_int(raw):
    text = str(raw or "").replace(",", "").strip()
    if not text.isdigit():
        raise ValueError("Missing/noninteger NC election vote count")
    n = int(text)
    if n > 10_000_000:
        raise ValueError("Impossible row vote count")
    return n


def parse_tsv(text, *, min_counties=100, expected_totals=OFFICIAL_CERTIFIED):
    stream = csv.DictReader(io.StringIO(text), delimiter="\t")
    if not stream.fieldnames:
        raise ValueError("Missing NCSBE file header")
    columns = {canonical(x): x for x in stream.fieldnames}
    if not set(REQUIRED).issubset(columns):
        missing = set(REQUIRED) - set(columns)
        raise ValueError("Unexpected official data schema: " + ", ".join(sorted(missing)))
    get = lambda row, key: row.get(columns[key], "")
    totals = collections.Counter()
    buckets = collections.defaultdict(lambda: collections.Counter())
    candidates = collections.defaultdict(set)
    scanned = selected = 0
    for row in stream:
        scanned += 1
        if str(get(row, "election date")).strip() != DATE:
            raise ValueError("Wrong-cycle row in Nov 2024 official results ZIP")
        contest = canonical(get(row, "contest name"))
        if not contest.startswith("us president"):
            continue
        party = str(get(row, "choice party")).strip().upper()
        if party not in ("DEM", "REP"):
            continue
        if parse_int(get(row, "vote for")) != 1:
            raise ValueError("Presidential vote-for count is not 1")
        county = canonical(get(row, "county")).upper()
        if not re.fullmatch(r"[A-Z ]{3,35}", county):
            raise ValueError("Invalid county identity")
        selected += 1
        values = {mode: parse_int(get(row, key)) for mode, key in MODES.items()}
        row_total = parse_int(get(row, "total votes"))
        if sum(values.values()) != row_total:
            raise ValueError("Mode totals do not reconcile to candidate row total")
        totals[party] += row_total
        candidates[county].add(party)
        for mode, val in values.items():
            buckets[(county, mode)][party] += val
    if scanned < selected or selected < min_counties * 2:
        raise ValueError("Missing presidential major-party precinct rows")
    if len(candidates) != min_counties:
        raise ValueError(f"Expected {min_counties} counties, got {len(candidates)}")
    for name, sides in candidates.items():
        if sides != {"DEM", "REP"}:
            raise ValueError("Missing major-party president vote in county " + name)
    if expected_totals and dict(totals) != expected_totals:
        raise ValueError("2024 certified presidential two-party totals disagree: "
                         + json.dumps(dict(totals)))
    rows = [
        {"county_name": county, "mode": mode,
         "dem_votes_2024": count.get("DEM", 0),
         "rep_votes_2024": count.get("REP", 0)}
        for (county, mode), count in sorted(buckets.items())
    ]
    # Provisional vote method is retained separately and never silently
    # represented as early/mail/Election Day in the 2026 comparison module.
    return {"status": "OFFICIAL_NC_2024_HISTORICAL_MODE_COUNTS_NOT_A_2026_NEEDLE",
            "election_date": DATE, "state": "NC",
            "observations": rows, "county_name_count": len(candidates),
            "presidential_dem_votes_2024": totals["DEM"],
            "presidential_rep_votes_2024": totals["REP"],
            "candidate_mode_rows": selected,
            "file_input_rows": scanned,
            "note": "Post-election full election results, not the privacy-noised precinct-sort file. County keys are official names; do not assume FIPS mapping without an external validated crosswalk."}


def fetch_official():
    req = urllib.request.Request(URL, headers={
        "User-Agent": "ElectionCommandCenter/1.0 2024 historical results QA",
        "Accept": "application/zip, application/octet-stream"})
    with urllib.request.urlopen(req, timeout=50) as response:
        data = response.read(120_000_001)
    if len(data) > 120_000_000 or not zipfile.is_zipfile(io.BytesIO(data)):
        raise ValueError("Official ZIP invalid or too large")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = [x for x in archive.namelist()
                 if x.lower().endswith((".txt", ".tsv")) and not x.startswith("__MACOSX")]
        if len(names) != 1:
            raise ValueError("Unexpected ZIP tabular file layout: " + str(names[:12]))
        member = archive.getinfo(names[0])
        if member.file_size > 300_000_000:
            raise ValueError("Uncompressed official result exceeds cap")
        body = archive.read(names[0]).decode("utf-8-sig")
    return body, hashlib.sha256(data).hexdigest(), names[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true")
    ap.add_argument("--output")
    args = ap.parse_args()
    if not args.fetch:
        ap.error("Use --fetch to read the original NCSBE source. Synthetic tests are separate.")
    raw, digest, filename = fetch_official()
    report = parse_tsv(raw)
    report.update({"source_url": URL, "layout_url": LAYOUT,
                   "original_archive_sha256": digest,
                   "original_archive_member": filename,
                   "processed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                   "fips_join_certified": False,
                   "2026_state_counting_source_verified": False,
                   "may_update_live_model": False})
    print(json.dumps({k: v for k, v in report.items() if k != "observations"},
                     indent=2))
    if args.output:
        Path(args.output).write_text(json.dumps(report, indent=2)+"\n",
                                     encoding="utf-8")

if __name__ == "__main__":
    main()
