# JackStradamus · Complete seat-model inventory (v0.1)

**Status as of October 13, 2026: seat universe built, national outcome model not yet enabled.** The live site continues to display descriptive, named-matchup polling averages without predicting winners or chamber control.

## What this stage completed

`scripts/build_seat_universe.py` creates `data/seat_universe.json` from the last validated polling-average snapshot. Its core denominator is **every seat that matters**, not the subset covered by a national polling aggregator.

| Office | 2026 universe | Definition | Source |
|---|---:|---|---|
| House | **435** voting seats | Full 2020 Census state apportionment, every numbered district slot | [U.S. Census Bureau, 2020 apportionment](https://www.census.gov/data/tables/time-series/dec/apportionment-data-text.html) |
| Senate regular elections | **33** | States holding Class II seats, terms ending January 2027 | [U.S. Senate, Class II](https://www.senate.gov/senators/Class_II.htm) |
| Senate special elections | **2** | Florida and Ohio, both Class III vacancies on the 2026 ballot | [2026 election inventory](https://senatordb.com/elections/2026) |
| Senate holdovers | **65** | Other seats not scheduled for a 2026 vote; carried into congressional control logic, not counted as races | [Senate facts and historical party lineup](https://www.dailypress.senate.gov/on-the-floor/senate-facts/) |

The **65-seat holdover breakdown is a dated July 14, 2026 starting reference, not an election-night feed**: 31 Republican, 32 Democratic, 2 independent senators caucusing with Democrats. Subsequent vacancies, caucus changes and election-specific circumstances must be checked independently before simulating control.

The current qualified polling coverage is computed dynamically. A source race is only counted if it has a **valid, named-matchup model mean** (`single_poll` or `multi_poll`). Raw source presence alone does not imply a usable poll. Each house and senate slot has a `poll_status`, verified-fundamentals status, party/ballot placeholders, and **null** forecast margin and winning probability. House districts in the published inventory are seat slots; **they are not verified 2026 district geographic boundaries**.

## What is intentionally *not* done

- **No invented values for unpolled seats.** Their `election_day_margin_estimate` and `outcome_probability` remain null.
- **No automatic extrapolation** from House generic-ballot polling to House district winners or Senate control.
- **No invented incumbency or historical partisanship.** Real 2026 ballot identities, district boundaries, incumbents, 2024 district-specific presidential/House results and 2022 results still require properly licensed and sourced imports.
- **No untested bias correction or fake confidence.** The 2026 Silver ratings comparison remains experimental and does not magically supply 435 local forecasts.
- **No chamber probabilities** in the Red Dawn / Shrug / Blue Wave / Blue Tsunami section. They require a calibrated, joint model of all House races plus all Senate contests and holdovers.

## Release gates and tests

`scripts/test_seat_universe.py` tests 435 unique House codes, the 33+2+65 Senate identity, source coverage, unknown/invalid district handling and the absence of unsupported forecasts. `build_seat_universe.py` rejects polls with district codes outside the apportionment/ballot inventory; this flags source-mapping anomalies rather than silently dropping data. Both scripts run inside the normal scheduled GitHub Actions refresh.

The JackStradamus page now shows an **informational coverage panel** (`N / 435`, `M / 35`) to make the missing data conspicuous. The panel explicitly distinguishes survey availability from a prediction. The seat model's `forecast_readiness.ready` stays false until the actual blockers are resolved.

## Next implementation milestone (v0.2)

1. **Historical constituency results:** Import MIT Election Data and Science Lab's [U.S. House 1976–2024 constituency-level returns](https://electionlab.mit.edu/data) and state-level Senate returns. Store an immutable source snapshot, parsed candidate-vote totals, historic year, provenance and stable district IDs. Audit third parties, uncontested races and fusion voting so sums and denominators are meaningful.
2. **2026 redistricting bridge:** Audit the states that changed boundaries for 2026 against authoritative state/court maps; do **not** pretend the 2024 House totals in the old lines represent the new district. For those seats, acquire reaggregated 2024 precinct-level outcomes on new lines or mark `geography_mismatch`.
3. **Candidate + incumbency metadata:** Source the general-election ballot slate from election authorities and current incumbency, validate open seats/specials/independents; store a timestamp because these can change.
4. **Baseline model (research only):** Combine the election-year-correct district fundamentals with the nationwide polling environment via a regularized model. Evaluate on actual earlier election years held out *as a unit*; no borrowing 2026 outcome data. Compare the baseline to simpler historical benchmarks.
5. **Correlated seat and Congress-control draws:** Fit historical election-day model residuals, including national/regional common error, Senate holdover caucusing and the predeclared competitive slate for Blue Tsunami. Verify proper probabilistic calibration before enabling any win/seat/scenario percentages.

A historical House election under old boundaries is **not** a valid 2026 district prior until the map/version match is explicitly verified. This is the most important safeguard against overconfident seat totals in a redistricting-heavy year.
