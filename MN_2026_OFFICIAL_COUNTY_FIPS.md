# Minnesota's 87 official 2026 election county identifiers joined to 2026 Census FIPS

Reviewed October 24, 2026. The [Minnesota 2026 general-election county table](https://electionresultsfiles.sos.mn.gov/20261103/Cntytbl.txt) lists 87 official two-digit election county IDs and county names. Independently compare those names with the [2026 Census TIGER/Line county GEOIDs](https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_county_mn.html) dated January 1, 2026.

The verified one-to-one relation covers all 87 counties: MN election county `01` (Aitkin) → FIPS `27001`; `27` (Hennepin) → `27053`; `62` (Ramsey) → `27123`; `69` (St. Louis) → `27137`; `87` (Yellow Medicine) → `27173`. In this dataset the alphabetic county sequences match and FIPS suffixes happen to run through the odd integers 001–173. **Use the actual pinned mapping**; never infer FIPS from arbitrary county index for other states, offices or source feeds.

The complete county-name and five-digit FIPS lookup is `data/mn_2026_official_county_fips_crosswalk.json`, guarded in CI. It contains **no vote data**. Minnesota says supporting tables may change before Election Day; recheck the original source and independent county roster before accepting 2026 returns.

This resolves the county identity join only. The Minnesota election-result web page is presently marked **TEST RESULTS**, its scheduled metadata fetch may encounter an unapproved redirect, and the candidate-only county adapter is not a source of ballots remaining, method-level returns, race calls, probabilities or geographic needle calibration. The county map must not change the national model merely because 87 IDs are mapped.
