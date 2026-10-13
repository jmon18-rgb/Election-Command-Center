# House geography: 2022 → 2024 → 2026

**Verified against U.S. Census Bureau Redistricting Data Program congressional-boundary releases on October 13, 2026.** These are historical-data compatibility rules, **not** polling corrections, predicted district winners or validated forecasts.

## Authoritative sources

- **[120th Congress — boundaries for the 2026 elections](https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.html):** The Census Bureau explicitly identifies nine states with new maps compared with 2024: **AL, CA, FL, LA, NC, OH, TN, TX, UT**. The other 41 states are unchanged. **Missouri's** proposed replacement 2026 plan was blocked; the 2024 map stays in effect. The Census updated the block equivalency files by October 7, while some geospatial products were still being regenerated.
- **[119th Congress — boundaries for the 2024 elections](https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.119th_Congress.html):** Five states were redrawn since 2022: **AL, GA, LA, NY, NC**. The other 45 states are unchanged from 2022.
- [NCSL mid-decade tracker](https://www.ncsl.org/redistricting-and-census/changing-the-maps-tracking-mid-decade-redistricting) supplies legislative/legal context. It may describe *enacted* maps subsequently blocked by courts; Census's 2026 effective-boundary statement controls this specific historical-geography join.
- [Texas Redistricting](https://redistricting.capitol.texas.gov/) identifies PlanC2333 for 2026, distinct from the previous congressional plan.
- [MIT Election Data and Science Lab](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/IG0UN2) House candidate-level returns (accessed through a CC0 public mirror), archived for 2022 and 2024 in distinct research-only files.

## What has been implemented

`scripts/build_map_bridge.py` compares all **435** numbered 2026 House slots to the staged 2024 results. It applies Census map version metadata. Every district in a changed 2026 state has its previous vote totals **blocked**, even if the district number is unchanged. Districts in the 41 unchanged states may include recorded 2024 party vote totals as **historical context**, but only where both D and R votes actually exist.

| Geographic comparison | State-level result | Voting House districts |
|---|---|---:|
| 2024 vs 2026 same boundaries | 41 states | **262** |
| 2024 vs 2026 changed boundaries | 9 states | **173** |
| Same-boundary 2024 districts with both major-party recorded votes | — | **238** |

`scripts/build_house_two_cycle.py` then checks the *second* boundary transition and requires a 2022 source row plus actual D/R candidate votes in **both** 2022 and 2024. Its output contains the two observed D shares and percentage-point difference, and carries no forecast values.

| Three-election comparison | Result |
|---|---:|
| States with same House boundaries in 2022, 2024 and 2026 | **39** |
| Districts with same boundaries in all three elections | **222** |
| Districts also having both D/R recorded vote totals in 2022 and 2024 | **191** |
| All other districts blocked (map differences or absent party votes) | **244** |

These are **recorded two-party House candidate vote shares**, not 2024 presidential district lean; they depend on candidate choice, turnout, ballot availability and midterm vs presidential-year electorate. A 2022→2024 recorded swing is **not** a 2026 swing forecast.

## Data and controls

- `data/house_history_2022_staging.json` / `data/house_history_2024_staging.json`: original-year raw D/R/other candidate vote totals, with uncontested/missing party flags.
- `data/house_geography_bridge.json`: a district-by-district 2024-to-2026 Census map check, with historical vote shares suppressed for changed-map states.
- `data/house_two_cycle_context.json`: safe 2022–2024 comparisons only where *both* map transitions and both parties pass.
- `scripts/test_map_bridge.py`, `scripts/test_house_two_cycle.py`: 435-seat uniqueness, Missouri status, changed-state maps, source completeness, mandatory null historical shares when blocked, and mandatory null **forecast** outputs.
- `index.html` shows the coverage counts on the JackStradamus tab and candidate-race-specific two-election historical context when available. The UI clearly labels it *descriptive history, not forecast*.

Every scheduled briefing refresh rebuilds the bridges after fresh polling/model data is available; the independently staged raw 2022/2024 returns are not overwritten by the polling pipeline.

## What's next

The nine changed-map states cannot receive a defensible historical district baseline by a same-number join. Obtain **precinct-level 2024 returns with trustworthy geocodes**, overlay against current 2026 congressional boundaries, and reaggregate by precinct/geographic assignment with a documented method for split precincts. The Census 120th Congress block-equivalency files describe geography **but contain no 2024 election votes**; they are not themselves a vote crosswalk. Coverage may differ by state, and split precincts should be marked estimated rather than silently assigned whole.

Separately, obtain **2024 presidential results on the relevant 2026 lines**, candidate/incumbency data, and Senate election and holdover history. Test fundamentals against multiple held-out election cycles before combining them with current polling. Even the 191 currently comparable historical results are not sufficient by themselves to calibrate a 435-seat forecast.

**Do not enable Red Dawn / Shrug / Blue Wave / Blue Tsunami percentages** until the seat model has complete contest coverage, independently validated district baselines, Senate holdovers, correlated election-error estimation, and historical probability calibration.
