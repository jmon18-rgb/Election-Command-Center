#!/usr/bin/env python3
"""Append-only observational ZIP chronology for independently approved NC Senate votes.

This is a retrieval chronology, NOT state-reported ballot release times or
precinct-by-method arrival. No turnout/ballots-remaining/calibrated swing.
The checked-at clock describes OUR ZIP retrieval only.
"""
import datetime as dt
import re

from build_nc_official_candidate_votes_2026 import SOURCE

SCHEMA = "nc-senate-zip-observation-chronology-v1"
MAX_OBSERVATIONS = 256
START = dt.datetime(2026, 11, 4, 0, 30, tzinfo=dt.timezone.utc)


def clock(value):
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ValueError("Source observation needs an explicit UTC retrieval time")
    try:
        x = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError) as exc:
        raise ValueError("Invalid source retrieval time") from exc
    if x.tzinfo is None or x.utcoffset() != dt.timedelta(0) or x < START:
        raise ValueError("Pre-close or non-UTC retrieval timestamp")
    return x


def record(snapshot):
    if (not isinstance(snapshot, dict) or
        snapshot.get("schema") != "nc-official-candidate-votes-v1" or
        snapshot.get("race_key") != "NC-SEN" or snapshot.get("office") != "Senate" or
        snapshot.get("state") != "NC" or snapshot.get("election_date") != "2026-11-03" or
        snapshot.get("ballots_reported", "missing") is not None or
        snapshot.get("reporting_fraction", "missing") is not None or
        snapshot.get("may_move_national_needle") is not False or
        snapshot.get("source", {}).get("url") != SOURCE or
        snapshot.get("source", {}).get("archive_member") != "results_pct_20261103.txt" or
        not re.fullmatch(r"[a-f0-9]{64}", snapshot.get("source", {}).get("sha256", ""))):
        raise ValueError("Not an approved source-attributed NC Senate county snapshot")
    when = clock(snapshot.get("archive_checked_at"))
    counties = snapshot.get("counties")
    if not isinstance(counties, list) or not 1 <= len(counties) <= 100:
        raise ValueError("Missing or oversized NC county sample")
    data = []
    seen = set()
    for county in counties:
        if not isinstance(county, dict) or not re.fullmatch(r"37\d{3}", county.get("county_id", "")):
            raise ValueError("County needs an exact North Carolina FIPS")
        fid = county["county_id"]
        if fid in seen:
            raise ValueError("Duplicate NC county in ZIP snapshot")
        seen.add(fid)
        votes = {"DEM": 0, "REP": 0, "OTHER": 0}
        candidates = county.get("candidates")
        if not isinstance(candidates, list) or not 2 <= len(candidates) <= 30:
            raise ValueError("Invalid NC candidate roster")
        distinct = set()
        for c in candidates:
            if not isinstance(c, dict) or not isinstance(c.get("name"), str) or not c["name"].strip():
                raise ValueError("Candidate identity unavailable")
            key = c["name"].strip().casefold()
            if key in distinct:
                raise ValueError("Duplicate candidate identity")
            distinct.add(key)
            party, count = c.get("party"), c.get("votes")
            if not isinstance(party, str) or not party.strip() or not isinstance(count, int) or isinstance(count, bool) or count < 0:
                raise ValueError("Invalid candidate party or vote count")
            bucket = party if party in ("DEM", "REP") else "OTHER"
            votes[bucket] += count
            if votes[bucket] > 20_000_000:
                raise ValueError("County candidate totals are implausible")
        if sum(votes.values()) <= 0:
            raise ValueError("Zero-vote county must not masquerade as reporting")
        data.append([fid, votes["DEM"], votes["REP"], votes["OTHER"]])
    data.sort()
    return {"archive_retrieved_at": when.isoformat().replace("+00:00", "Z"),
            "source_reported_at": None,
            "archive_sha256": snapshot["source"]["sha256"],
            "county_count": len(data),
            "counties": data}


def append(history, previous_snapshot, replacement):
    latest = record(replacement)
    if history is None:
        observations = [record(previous_snapshot)] if previous_snapshot is not None else []
    else:
        if (not isinstance(history, dict) or history.get("schema") != SCHEMA or
            history.get("race_key") != "NC-SEN" or history.get("source_url") != SOURCE or
            history.get("ballot_denominator_available") is not False or
            history.get("may_move_national_needle") is not False or
            not isinstance(history.get("observations"), list) or
            not 1 <= len(history["observations"]) <= MAX_OBSERVATIONS):
            raise ValueError("Existing NC observation journal identity unsafe")
        observations = history["observations"]
        # Only validated, canonical, bounded rows can influence the observed timeline.
        prev_stamp = None
        found = set()
        for entry in observations:
            if not isinstance(entry, dict) or set(entry) != {
                "archive_retrieved_at", "source_reported_at", "archive_sha256",
                "county_count", "counties"} or entry["source_reported_at"] is not None:
                raise ValueError("NC source journal contains unsupported fields")
            t = clock(entry["archive_retrieved_at"])
            sha = entry["archive_sha256"]
            county_rows = entry["counties"]
            if (not isinstance(sha, str) or not re.fullmatch(r"[a-f0-9]{64}", sha) or
                sha in found or (prev_stamp is not None and t <= prev_stamp) or
                not isinstance(county_rows, list) or
                not 1 <= len(county_rows) <= 100 or
                entry["county_count"] != len(county_rows)):
                raise ValueError("NC source journal contains duplicate or malformed entries")
            keys = []
            for row in county_rows:
                if (not isinstance(row, list) or len(row) != 4 or
                    not isinstance(row[0], str) or not re.fullmatch(r"37\d{3}", row[0]) or
                    any(not isinstance(n, int) or isinstance(n, bool) or n < 0 for n in row[1:])):
                    raise ValueError("Invalid observed candidate tuple")
                keys.append(row[0])
            if keys != sorted(set(keys)):
                raise ValueError("Duplicate or unordered journal county identity")
            found.add(sha)
            prev_stamp = t
        if previous_snapshot is None or record(previous_snapshot) != observations[-1]:
            raise ValueError("Journal and published previous snapshot disagree")
    if observations:
        prior = observations[-1]
        if latest["archive_sha256"] == prior["archive_sha256"]:
            if latest["counties"] != prior["counties"]:
                raise ValueError("Different votes under an unchanged official ZIP fingerprint")
            return {"status": "NO_NEW_ARCHIVE", "journal": {
                "schema": SCHEMA, "race_key": "NC-SEN", "source_url": SOURCE,
                "ballot_denominator_available": False,
                "may_move_national_needle": False, "observations": observations}}
        if latest["archive_sha256"] in {o["archive_sha256"] for o in observations}:
            raise ValueError("Previously observed ZIP digest returned out of order")
        if clock(latest["archive_retrieved_at"]) <= clock(prior["archive_retrieved_at"]):
            raise ValueError("New ZIP revision has a non-increasing observation time")
        old_rows = {r[0]: r for r in prior["counties"]}
        new_rows = {r[0]: r for r in latest["counties"]}
        if not old_rows.keys() <= new_rows.keys():
            raise ValueError("Previously observed county disappeared from source chronology")
        # Automatic publication refuses candidate decreases; the journal
        # also rejects aggregate party regressions if called independently.
        for fid, old in old_rows.items():
            if any(new_rows[fid][i] < old[i] for i in (1, 2, 3)):
                raise ValueError("Source correction needs manual review, not a silent replay")
    if len(observations) >= MAX_OBSERVATIONS:
        raise ValueError("NC ZIP observation archive full; require operator archive rotation")
    observations = [*observations, latest]
    return {"status": "APPENDED", "journal": {
        "schema": SCHEMA, "race_key": "NC-SEN", "source_url": SOURCE,
        "ballot_denominator_available": False,
        "may_move_national_needle": False, "observations": observations}}
