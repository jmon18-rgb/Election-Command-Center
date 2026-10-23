#!/usr/bin/env python3
"""Fetch Census 2024 ACS5 NC county identifiers as a reproducible CSV.

The authoritative Census API returns NAME, state, county. No election returns
are fetched. The output is research-only and cannot promote a live needle.
"""
import csv
import io
import json
import re
import sys
import urllib.request

URL = "https://api.census.gov/data/2024/acs/acs5?get=NAME&for=county:*&in=state:37"


def transform(text):
    rows = json.loads(text)
    if not isinstance(rows, list) or not rows or rows[0] != ["NAME", "state", "county"]:
        raise ValueError("Unexpected Census county API columns")
    names, fips = set(), set()
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(["statefp", "countyfp", "name"])
    for name, state, county in rows[1:]:
        if state != "37" or not re.fullmatch(r"\d{3}", county):
            raise ValueError("Invalid NC Census FIPS")
        match = re.fullmatch(r"(.+?) County, North Carolina", name)
        if not match:
            raise ValueError("Unexpected Census county name")
        canonical = match.group(1).upper()
        if canonical in names or county in fips:
            raise ValueError("Duplicate county in Census reference")
        names.add(canonical)
        fips.add(county)
        writer.writerow(["37", county, match.group(1)])
    if len(fips) != 100:
        raise ValueError("Incomplete North Carolina county universe")
    return output.getvalue()


def main():
    request = urllib.request.Request(URL, headers={
        "User-Agent": "ElectionCommandCenterCountyReference/1.0",
        "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise ValueError("Census API unavailable")
        content = response.read(150_000).decode("utf-8")
    sys.stdout.write(transform(content))


if __name__ == "__main__":
    main()
