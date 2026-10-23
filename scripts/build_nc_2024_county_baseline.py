#!/usr/bin/env python3
"""Build a source-limited NC 2024 county baseline, never a 2026 Senate forecast."""
import argparse
import json
from pathlib import Path
from join_nc_2024_county_fips import join_nc_counties


def build(staging, reference_csv):
    joined = join_nc_counties(staging, reference_csv)
    counties = {}
    for row in joined["observations"]:
        fips = row["county_fips"]
        values = counties.setdefault(fips, {"county_fips": fips, "dem": 0, "rep": 0,
                                           "methods": set()})
        if row["mode"] in values["methods"]:
            raise ValueError("Duplicate historical county-mode cell")
        values["methods"].add(row["mode"])
        for key, dest in (("dem_votes_2024", "dem"), ("rep_votes_2024", "rep")):
            vote = row.get(key)
            if not isinstance(vote, int) or isinstance(vote, bool) or vote < 0:
                raise ValueError("Invalid certified historical vote count")
            values[dest] += vote
    if len(counties) != 100:
        raise ValueError("Missing NC county historical totals")
    total_dem = sum(v["dem"] for v in counties.values())
    total_rep = sum(v["rep"] for v in counties.values())
    if (total_dem != staging.get("presidential_dem_votes_2024") or
        total_rep != staging.get("presidential_rep_votes_2024")):
        raise ValueError("County aggregation does not match source presidential totals")
    return {"status": "NC_2024_PRESIDENTIAL_COUNTY_BASELINE_RESEARCH_ONLY",
            "election_date": "2024-11-05", "office": "president",
            "same_office_for_2026_senate_or_house": False,
            "may_update_live_model": False,
            "county_count": 100, "statewide_dem": total_dem, "statewide_rep": total_rep,
            "counties": [{**v, "methods": sorted(v["methods"])}
                         for _, v in sorted(counties.items())]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--staging", type=Path, required=True)
    parser.add_argument("--census-csv", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = build(json.loads(args.staging.read_text()), args.census_csv.read_text())
    args.output.write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
