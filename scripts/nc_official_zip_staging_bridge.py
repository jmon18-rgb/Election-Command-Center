#!/usr/bin/env python3
"""Source-attributed NCSBE official ZIP -> county candidate-vote staging.

This intentionally does NOT generate a county-results-v1 production envelope.
A precinct candidate total is not the number of ballots processed. The
2026 dashboard contract additionally requires a verified reporting timestamp,
a source-backed ballot denominator, and an independently approved live source.
"""
import datetime as dt
import hashlib
import io
import re
import zipfile
from urllib.parse import urlsplit

from aggregate_nc_official_precinct_votes import aggregate

ZIP_MAX_BYTES = 95_000_000
MEMBER_MAX_BYTES = 150_000_000


def stage_zip(payload, *, manifest, county_fips):
    if not isinstance(manifest, dict) or not isinstance(county_fips, dict):
        raise ValueError("Manifest and explicit Census county crosswalk required")
    election = manifest.get("election_date")
    if not isinstance(election, str):
        raise ValueError("Missing election date")
    try:
        day = dt.datetime.strptime(election, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError("Invalid exact election date") from exc
    if day.isoformat() != election:
        raise ValueError("Noncanonical election date")
    if election not in ('2022-11-08', '2024-11-05', '2026-11-03'):
        raise ValueError('Only explicit audited NC November election dates supported')
    date_dir = day.strftime("%Y_%m_%d")
    date_stamp = day.strftime("%Y%m%d")
    member = "results_pct_" + date_stamp + ".txt"
    url = manifest.get("source_url")
    if not isinstance(url, str):
        raise ValueError("Missing official source URL")
    parts = urlsplit(url)
    if (parts.scheme != "https" or parts.netloc != "s3.amazonaws.com" or
        parts.query or parts.fragment or
        parts.path != f"/dl.ncsbe.gov/ENRS/{date_dir}/results_pct_{date_stamp}.zip"):
        raise ValueError("Unknown or wrong-election official ZIP URL")
    digest = manifest.get("sha256")
    if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise ValueError("Independently pinned source SHA-256 required")
    contest = manifest.get("contest_name")
    contest_group_id = manifest.get("contest_group_id")
    if not isinstance(contest, str) or not contest.strip():
        raise ValueError("Exact contest name required")
    if (contest_group_id is not None and
            (not isinstance(contest_group_id, str) or not contest_group_id)):
        raise ValueError("Invalid exact contest group ID")
    if not isinstance(payload, bytes) or not payload or len(payload) > ZIP_MAX_BYTES:
        raise ValueError("Missing/oversized official archive")
    actual_digest = hashlib.sha256(payload).hexdigest()
    if actual_digest != digest:
        raise ValueError("Archive does not match independently pinned SHA-256")
    try:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            members = archive.infolist()
            if (len(members) != 1 or members[0].filename != member or
                    members[0].is_dir() or members[0].file_size > MEMBER_MAX_BYTES):
                raise ValueError("Unexpected official results archive members")
            if members[0].file_size > 200 * max(1, members[0].compress_size):
                raise ValueError("Excessive ZIP expansion ratio")
            raw = archive.read(members[0]).decode("utf-8-sig")
    except (zipfile.BadZipFile, UnicodeError, RuntimeError) as exc:
        raise ValueError("Corrupt or improperly encoded results archive") from exc
    # The original 2022 ZIP uses "One Stop" for early in-person votes,
    # plus a trailing Real Precinct indicator and empty TSV header column.
    # Normalize ONLY this observed exact 2022 header: never relax validation
    # of the actual 2024/2026 results format or source bytes.
    if election == "2022-11-08" and "One Stop" in raw.splitlines()[0]:
        legacy_header = raw.splitlines()[0].rstrip("\\r").split("\\t")
        expected_legacy = [
            "County", "Election Date", "Precinct", "Contest Group ID",
            "Contest Type", "Contest Name", "Choice", "Choice Party",
            "Vote For", "Election Day", "One Stop", "Absentee by Mail",
            "Provisional", "Total Votes", "Real Precinct", "",
        ]
        if legacy_header != expected_legacy:
            raise ValueError("Unrecognized official 2022 legacy precinct TSV header")
        raw = raw.replace("\\tOne Stop\\t", "\\tEarly Voting\\t", 1)
    counties = aggregate(
        raw, date=day.strftime("%m/%d/%Y"), contest=contest,
        contest_group_id=contest_group_id, county_fips=county_fips,
    )
    return {
        "schema": "nc-official-county-staging-v1",
        "status": "SOURCE_ATTRIBUTED_CANDIDATE_VOTES_STAGED_NOT_LIVE_CERTIFIED",
        "source": {
            "publisher": "North Carolina State Board of Elections",
            "url": url,
            "archive_sha256": actual_digest,
            "archive_member": member,
            "contest_name": contest,
            "contest_group_id": contest_group_id,
            "election_date": election,
        },
        "state": "NC",
        "county_count": len(counties),
        "counties": counties,
        "ballots_reported": None,
        "source_reporting_timestamp": None,
        "production": False,
        "source_verified_for_live_2026": False,
        "may_move_national_needle": False,
    }
