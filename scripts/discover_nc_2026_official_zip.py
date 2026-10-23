#!/usr/bin/env python3
"""Read-only NCSBE Nov 3 2026 precinct ZIP publication watch.

Official catalog/download-page URL pattern was inspected October 23, 2026.
A catalog entry or successful download alone does NOT certify election-night
county returns, ballots processed, reporting timestamps, or race identities.
No automatic publication to the dashboard, ingestion, or predictive needle.
"""
import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ELECTION = "11/03/2026"
ISO_DATE = "2026-11-03"
CATALOG_URL = "https://er.ncsbe.gov/enr/elections.txt"
FILTER_URL = "https://er.ncsbe.gov/enr/elections_filter.txt"
# Official downloads.html JS template audited by PR #212 (HTTP dl.ncsbe.gov);
# its 2024 ZIP matches the official S3 HTTPS mirror audited in PR #213.
# This 2026 URL is an anticipated selection result, NOT a verified live file.
CANDIDATE_ZIP = (
    "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/"
    "2026_11_03/results_pct_20261103.zip"
)
MEMBER = "results_pct_20261103.txt"
REQUIRED = {
    "County", "Election Date", "Precinct", "Contest Group ID", "Contest Type",
    "Contest Name", "Choice", "Choice Party", "Vote For", "Election Day",
    "Early Voting", "Absentee by Mail", "Provisional", "Total Votes",
}
MAX_ZIP = 95_000_000
MAX_MEMBER = 150_000_000


def select_source(catalog, blocked):
    if not isinstance(catalog, list) or not isinstance(blocked, list):
        return {"eligible": False, "reason": "INVALID_OFFICIAL_CATALOG"}
    elections = [r for r in catalog if isinstance(r, dict) and r.get("edt") == ELECTION]
    if len(elections) != 1:
        return {"eligible": False, "reason": "MISSING_OR_AMBIGUOUS_2026_ELECTION"}
    if any(isinstance(r, dict) and r.get("edt") == ELECTION for r in blocked):
        return {"eligible": False, "reason": "OFFICIAL_DOWNLOAD_FILTERED"}
    if elections[0].get("pct") != "1":
        return {"eligible": False, "reason": "NO_PRECINCT_ZIP_IN_OFFICIAL_CATALOG"}
    return {
        "eligible": True,
        "reason": "CATALOG_ENTRY_ONLY_ZIP_PUBLICATION_UNCONFIRMED",
        "catalog_date": ELECTION,
        "anticipated_source_url": CANDIDATE_ZIP,
    }


def inspect_archive(payload):
    if not isinstance(payload, bytes) or not payload or len(payload) > MAX_ZIP:
        raise ValueError("Missing or oversized official ZIP response")
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        infos = archive.infolist()
        if (len(infos) != 1 or infos[0].filename != MEMBER or
                infos[0].is_dir() or infos[0].file_size > MAX_MEMBER):
            raise ValueError("Unexpected official precinct ZIP file structure")
        if infos[0].file_size > 200 * max(1, infos[0].compress_size):
            raise ValueError("Excessive ZIP expansion ratio")
        with archive.open(infos[0]) as zipped:
            reader = csv.reader(io.TextIOWrapper(zipped, encoding="utf-8-sig"),
                                delimiter="\t")
            header = next(reader, None)
            if not header or not REQUIRED.issubset(header):
                raise ValueError("Missing expected official precinct TSV fields")
            sampled = 0
            for row in reader:
                if len(row) < len(REQUIRED):
                    raise ValueError("Malformed official precinct row")
                if row[header.index("Election Date")] != ELECTION:
                    raise ValueError("ZIP contains wrong-election results")
                sampled += 1
                if sampled == 50:
                    break
            if not sampled:
                raise ValueError("ZIP contains no precinct observations")
        if archive.testzip() is not None:
            raise ValueError("Official ZIP CRC integrity test failed")
        return {
            "status": "ZIP_STRUCTURE_OBSERVED_NOT_LIVE_CERTIFIED",
            "sha256_observed": hashlib.sha256(payload).hexdigest(),
            "archive_member": MEMBER,
            "uncompressed_bytes": infos[0].file_size,
            "sampled_precinct_rows": sampled,
            "archive_crc_checked": True,
            "source_url": CANDIDATE_ZIP,
            "source_reporting_timestamp": None,
            "county_votes_ingested": False,
            "source_verified_for_live_2026": False,
            "may_move_national_needle": False,
        }


def get_bounded(url, limit):
    request = urllib.request.Request(url, headers={
        "User-Agent": "ElectionCommandCenter/1.0 NC-source-watch",
        "Accept": "application/json, application/zip, application/octet-stream"})
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise ValueError("Non-200 response from original source")
        content = response.read(limit + 1)
        if len(content) > limit:
            raise ValueError("Original source response exceeds size limit")
        return content, response.headers.get("Last-Modified")


def probe():
    checked_at = dt.datetime.now(dt.timezone.utc).isoformat()
    output = {"election_date": ISO_DATE, "checked_at": checked_at,
              "publisher": "North Carolina State Board of Elections",
              "may_move_national_needle": False, "production": False}
    try:
        catalog = json.loads(get_bounded(CATALOG_URL, 300_000)[0])
        blocked = json.loads(get_bounded(FILTER_URL, 300_000)[0])
        selection = select_source(catalog, blocked)
    except (ValueError, OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
        return {**output, "status": "CATALOG_UNREACHABLE",
                "error_type": type(exc).__name__}
    output["selection"] = selection
    if not selection["eligible"]:
        return {**output, "status": "OFFICIAL_ZIP_SELECTION_NOT_AVAILABLE"}
    try:
        payload, last_modified = get_bounded(CANDIDATE_ZIP, MAX_ZIP)
    except urllib.error.HTTPError as exc:
        return {**output, "status": "ZIP_NOT_PUBLISHED_OR_NOT_ACCESSIBLE",
                "http_status": exc.code}
    except (ValueError, OSError, urllib.error.URLError) as exc:
        return {**output, "status": "ZIP_SOURCE_UNREACHABLE",
                "error_type": type(exc).__name__}
    try:
        inspected = inspect_archive(payload)
    except (ValueError, OSError, zipfile.BadZipFile, UnicodeError) as exc:
        return {**output, "status": "ZIP_FORMAT_INVALID",
                "error_type": type(exc).__name__}
    return {**output, **inspected, "http_last_modified": last_modified,
            "note": "A published ZIP was observed, not independently approved for live county ingestion."}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-live", action="store_true")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not args.check_live:
        parser.error("Use --check-live only for read-only publication observation.")
    output = probe()
    args.output.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
