# NC county-to-FIPS reference used for historical archive replay

File: `data/nc_2024_county_fips_reference.csv`

- 100 NC county names and five-digit FIPS IDs transcribed from the North Carolina State University Libraries GIS county-FIPS table: https://www.lib.ncsu.edu/gis/countyfips (reviewed October 23, 2026).
- The CSV stores state `37`, county `001` to `199`, and source county names. Those specific county assignments match the source listing; never derive unknown county codes from a name or list order at runtime.
- The 2024 replay fails on any missing, duplicate, or mismatched county. The replay additionally reconciles the official 2024 presidential DEM and REP vote totals to the state-certified historical checks.
- This pinned crosswalk removes a live Census API call from GitHub Actions after the API timed out during replay. The source should be independently cross-checked against the Census county reference before relying on it in any 2026 production promotion.
- The ZIP archive, crosswalk, and county votes are **historical test data only**. No county baseline, source timestamp, or `ballots_reported` can be inferred for 2026 from this file. The dashboard's source-verification contract and forecast needle remain unchanged.
