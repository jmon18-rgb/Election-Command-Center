#!/usr/bin/env python3
"""Validate official NCSBE precinct TSV and aggregate an exact contest to counties.

No guessed FIPS, missing ballot denominators, feed certification, or 2026 data.
Output is a source-limited vote table; it is NOT a county-results-v1 envelope.
"""
import csv
import io
import re
from collections import defaultdict

REQUIRED = {
    "County", "Election Date", "Precinct", "Contest Group ID",
    "Contest Type", "Contest Name", "Choice", "Choice Party",
    "Vote For", "Election Day", "Early Voting", "Absentee by Mail",
    "Provisional", "Total Votes",
}
METHODS = ("Election Day", "Early Voting", "Absentee by Mail", "Provisional")


def votes(value):
    raw = str(value or "").replace(",", "").strip()
    if not raw.isdigit():
        raise ValueError("Missing or invalid official vote count")
    n = int(raw)
    if n > 20_000_000:
        raise ValueError("Official per-row vote count exceeds limit")
    return n


def aggregate(tsv, *, date, contest, county_fips, contest_group_id=None):
    """Return exact-contest county candidate votes; fails closed on ambiguity."""
    if (not isinstance(tsv, str) or not tsv or not isinstance(date, str) or
            not date or not isinstance(contest, str) or not contest or
            not isinstance(county_fips, dict) or
            (contest_group_id is not None and
             (not isinstance(contest_group_id, str) or not contest_group_id))):
        raise ValueError("Invalid aggregation arguments")

    reader = csv.DictReader(io.StringIO(tsv.lstrip("\ufeff")), delimiter="\t")
    if (not reader.fieldnames or len(reader.fieldnames) != len(set(reader.fieldnames))
            or not REQUIRED.issubset(reader.fieldnames)):
        raise ValueError("Official TSV schema missing/ambiguous required columns")

    totals = defaultdict(int)
    seen_rows, identities, matched = set(), set(), 0
    for row in reader:
        if row.get("Contest Name") != contest or row.get("Election Date") != date:
            continue
        matched += 1
        group = (row.get("Contest Group ID") or "").strip()
        kind = (row.get("Contest Type") or "").strip()
        if not group or not kind or (contest_group_id is not None and group != contest_group_id):
            raise ValueError("Contest group/type mismatch or missing identity")
        identities.add((group, kind))
        if len(identities) > 1:
            raise ValueError("Ambiguous official contest identity")
        if votes(row.get("Vote For")) != 1:
            raise ValueError("Cannot infer vote-for-multiple contest ballots")
        county = (row.get("County") or "").strip().upper()
        precinct = (row.get("Precinct") or "").strip()
        fips = county_fips.get(county)
        if (not isinstance(fips, str) or
                not re.fullmatch(r"37\d{3}", fips) or not precinct):
            raise ValueError("Unmapped county or missing precinct: " + county)
        candidate = (row.get("Choice") or "").strip()
        party = (row.get("Choice Party") or "").strip()
        if not candidate:
            raise ValueError("Unnamed official candidate")
        identity = (fips, precinct, group, kind, candidate, party)
        if identity in seen_rows:
            raise ValueError("Duplicate precinct candidate row")
        seen_rows.add(identity)
        count = votes(row.get("Total Votes"))
        if sum(votes(row.get(k)) for k in METHODS) != count:
            raise ValueError("Official vote methods do not reconcile to total")
        totals[(fips, candidate, party)] += count
        if totals[(fips, candidate, party)] > 20_000_000:
            raise ValueError("Implausible aggregated candidate votes")

    if matched == 0:
        raise ValueError("Requested election date/contest not present")
    counties = {}
    for (fips, candidate, party), count in totals.items():
        counties.setdefault(fips, []).append(
            {"name": candidate, "party": party, "votes": count})
    return [
        {"county_id": fips,
         "candidates": sorted(rows, key=lambda r: (r["name"], r["party"]))}
        for fips, rows in sorted(counties.items())
    ]
