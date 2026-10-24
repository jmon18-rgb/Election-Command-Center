#!/usr/bin/env python3
"""Read-only 2026 Minnesota Senate-by-county candidate-only adapter.

Uses the official semicolon-separated 16-column file layout. This module
DOES NOT fetch files, publish votes, know current 2026 production coverage,
or supply ballots-counted denominators. The official October 2026 site
currently says TEST RESULTS; callers must prove external source approval.
"""
import datetime as dt
import json
from pathlib import Path
import re

SOURCE = "https://electionresultsfiles.sos.mn.gov/20261103/ussenatecty.txt"
INDEX = "https://electionresults.sos.mn.gov/Select/MediaFiles/Index?ersElectionId=201"
CLOSE = dt.datetime(2026, 11, 4, 2, tzinfo=dt.timezone.utc)
MAX_SOURCE_BYTES = 500_000
MAX_CANDIDATE_ROWS = 2500
CROSSWALK_FILE = (Path(__file__).resolve().parents[1] /
                  "data" / "mn_2026_official_county_fips_crosswalk.json")
APPROVED_STATUS = "EXPORT_LINKS_NOT_APPROVED_FOR_INGESTION"
# Despite the name, this source-discovery status is NOT authorization.
REVIEW_REQUIRED = ("reviewed", "production_not_test_independently_verified",
                   "source_timestamp_independently_verified",
                   "rights_and_attribution_reviewed", "county_fips_join_reviewed")


def no(reason):
    return {"ready": False, "status": reason, "race_key": "MN-SEN",
            "candidate_votes": None, "counties": [],
            "verified_live_2026_source": False,
            "statewide_coverage_verified": False,
            "percent_reporting": None, "ballots_remaining": None,
            "professional_calls": None, "may_move_national_needle": False,
            "may_update_model": False}


def instant(value):
    if not isinstance(value, str) or not re.fullmatch(
        r"2026-11-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})", value
    ):
        return None
    try:
        out = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return out.astimezone(dt.timezone.utc)
    except ValueError:
        return None


def pinned_county_map():
    """Read the reviewed 87-county 2026 SOS×Census mapping, fail closed.

    This checks identity and structural provenance, not publication of
    production votes or real election-night authorization.
    """
    try:
        source = json.loads(CROSSWALK_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return None
    if not isinstance(source, dict) or (
        source.get("schema") != "mn-official-2026-election-county-census-fips-crosswalk-v1"
        or source.get("status") != "OFFICIAL_COUNTY_IDENTITY_CROSSWALK_NOT_LIVE_RESULTS"
        or source.get("election_date") != "2026-11-03"
        or source.get("state") != "MN"
        or source.get("county_count") != 87
        or source.get("independent_source_name_join_reviewed") is not True
        or source.get("requires_election_night_source_revalidation") is not True
    ):
        return None
    mapping = source.get("county_id_to_fips")
    names = source.get("county_metadata")
    keys = {f"{i:02d}" for i in range(1, 88)}
    if not isinstance(mapping, dict) or not isinstance(names, dict) or (
        set(mapping) != keys or set(names) != keys or
        len(set(mapping.values())) != 87
    ):
        return None
    for key in keys:
        geoid = mapping[key]
        record = names[key]
        if not isinstance(geoid, str) or not re.fullmatch(r"27\d{3}", geoid):
            return None
        if not isinstance(record, dict) or record.get("fips") != geoid or (
            not isinstance(record.get("county_name"), str)
            or not record["county_name"].strip()
        ):
            return None
    return mapping


def parse_candidate_only(source_text, discovery, review, now):
    if not isinstance(now, dt.datetime) or now.tzinfo is None:
        return no("INVALID_OBSERVER_CLOCK")
    now = now.astimezone(dt.timezone.utc)
    if not isinstance(discovery, dict) or discovery.get("status") != APPROVED_STATUS or (
        discovery.get("test_marker_seen") is not False
        or discovery.get("index") != INDEX
        or discovery.get("matched_links", {}).get("U.S. Senator by County") != SOURCE
    ):
        return no("OFFICIAL_SOURCE_STILL_TEST_OR_UNVERIFIED")
    if not isinstance(review, dict) or any(review.get(k) is not True for k in REVIEW_REQUIRED) or (
        review.get("source_url") != SOURCE
        or review.get("election") != "2026-11-03"
        or review.get("race_key") != "MN-SEN"
        or review.get("source_office_code") != "0102"
    ):
        return no("INDEPENDENT_PRODUCTION_SOURCE_APPROVAL_MISSING")
    source_time = instant(review.get("source_reported_at"))
    if not source_time or source_time < CLOSE or now < CLOSE or (
        source_time > now + dt.timedelta(minutes=15)
        or now - source_time > dt.timedelta(hours=2)
    ):
        return no("VERIFIED_SOURCE_TIME_MISSING_PRE_CLOSE_OR_STALE")
    # A plausible FIPS prefix or caller-provided map is not evidence that
    # official MN election county "03" is the county the caller claims.
    # Require all 87 immutable reviewed source identities, not a subset.
    mapping = pinned_county_map()
    if mapping is None:
        return no("PINNED_MINNESOTA_87_COUNTY_CROSSWALK_UNAVAILABLE")
    if review.get("election_day_official_county_table_rechecked") is not True:
        return no("ELECTION_DAY_COUNTY_SOURCE_NOT_RECHECKED")
    supplied = review.get("verified_county_id_to_fips")
    if supplied is None:
        return no("VERIFIED_MINNESOTA_COUNTY_FIPS_MAPPING_MISSING")
    if not isinstance(supplied, dict) or supplied != mapping:
        return no("UNVERIFIED_OR_MISMATCHED_87_COUNTY_FIPS_MAPPING")
    if not isinstance(source_text, str) or len(source_text.encode("utf-8")) > MAX_SOURCE_BYTES:
        return no("UNBOUNDED_OR_NON_TEXT_CANDIDATE_SOURCE")
    lines = source_text.splitlines()
    if not lines or len(lines) > MAX_CANDIDATE_ROWS:
        return no("EMPTY_OR_UNBOUNDED_CANDIDATE_SOURCE")
    groups = {}
    for line in lines:
        parts = line.split(";")
        if len(parts) != 16:
            return no("WRONG_OFFICIAL_16_FIELD_CANDIDATE_LAYOUT")
        state, county, precinct, office_code, office_name, district, order, name, suffix, inc, party, reporting, precincts, votes, share, total = parts
        if (state != "MN" or not re.fullmatch(r"\d{2}", county)
            or county not in mapping or precinct or office_code != "0102"
            or office_name != "U.S. Senator" or district or suffix or inc
            or not re.fullmatch(r"\d{4}", order)
            or not name.strip() or len(name) > 200
            or not re.fullmatch(r"[A-Z]{1,6}", party)):
            return no("MISMATCHED_MINNESOTA_CONTEST_CANDIDATE_OR_COUNTY")
        nums = (reporting, precincts, votes, total)
        if not all(re.fullmatch(r"\d{1,10}", item) for item in nums):
            return no("NON_INTEGER_PRECINCT_OR_VOTE_TOTAL")
        r, p, count, candidate_total = map(int, nums)
        if p < 1 or r > p or (count > 0 and r == 0) or count > candidate_total:
            return no("INCONSISTENT_OFFICIAL_COUNT_OR_PRECINCT_ARITHMETIC")
        try:
            reported_percent = float(share)
        except ValueError:
            return no("INVALID_SOURCE_CANDIDATE_PERCENTAGE")
        if not 0 <= reported_percent <= 100 or (
            abs(reported_percent - (count / candidate_total * 100 if candidate_total else 0)) > .15
        ):
            return no("SOURCE_CANDIDATE_PERCENTAGE_CONTRADICTION")
        item = groups.setdefault(county, {"county_id": county,
            "county_fips": mapping[county], "precincts_reporting": r,
            "total_precincts": p, "race_candidate_votes": candidate_total,
            "candidates": [], "_orders": set(), "_names": set(), "_major": set()})
        if any(item[k] != v for k, v in (
            ("precincts_reporting", r), ("total_precincts", p),
            ("race_candidate_votes", candidate_total))):
            return no("INCONSISTENT_SAME_COUNTY_SOURCE_TOTAL")
        normalized_name = name.strip().casefold()
        if order in item["_orders"] or normalized_name in item["_names"]:
            return no("DUPLICATE_COUNTY_CANDIDATE_IDENTITY")
        item["_orders"].add(order)
        item["_names"].add(normalized_name)
        normalized_party = "D" if party == "DFL" else "R" if party == "R" else "O"
        if normalized_party in ("D", "R"):
            if normalized_party in item["_major"]:
                return no("AMBIGUOUS_MAJOR_PARTY_SOURCE_COLUMNS")
            item["_major"].add(normalized_party)
        item["candidates"].append({
            "name": name.strip(), "source_party": party,
            "party": normalized_party, "votes": count
        })
    counties = []
    for item in groups.values():
        if sum(c["votes"] for c in item["candidates"]) != item["race_candidate_votes"]:
            return no("CANDIDATE_TOTAL_NOT_RECONCILED_WITH_COUNTY")
        # County vote sum does not equal ballots cast due to undervotes,
        # overvotes, and other ballot differences.
        for k in ("_orders", "_names", "_major"):
            del item[k]
        counties.append(item)
    counties.sort(key=lambda row: row["county_fips"])
    if not any(x["race_candidate_votes"] > 0 for x in counties):
        return no("OFFICIAL_FILE_CURRENTLY_REPORTS_ZERO_NOT_BALLOTS_CAST")
    return {"ready": True,
            "status": "EXPLICITLY_REVIEWED_2026_COUNTY_CANDIDATE_ONLY",
            "race_key": "MN-SEN", "source": SOURCE,
            "source_reported_at": source_time.isoformat(),
            "counties": counties, "counties_seen": len(counties),
            "counties_with_positive_candidate_votes": sum(
                c["race_candidate_votes"] > 0 for c in counties),
            "candidate_votes": sum(c["votes"] for x in counties for c in x["candidates"]),
            "verified_live_2026_source": True,
            "statewide_coverage_verified": False,
            "percent_reporting": None, "ballots_remaining": None,
            "professional_calls": None, "may_move_national_needle": False,
            "may_update_model": False,
            "purpose": "Candidate-only reviewed county rows; no outstanding-ballot or calibrated county-mode signal."}
