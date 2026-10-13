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

1. **Historical constituency results — House 2024 STAGED.** `scripts/stage_house_history_2024.py` fetches a [CC0 public mirror](https://crproject.org/data/jsoncsv/mit-1976-2024-house.csv) of MIT Election Data and Science Lab's House district returns, retains the 2024 *recorded* Democratic/Republican/other candidate votes in `data/house_history_2024_staging.json`, excludes non-voting D.C. delegates, and requires exactly **435 voting districts**. Of those 435 historical districts, **44 lack recorded votes for at least one major party**; that is missing raw party vote evidence, NOT a zero-vote public-opinion estimate. `scripts/test_house_history.py` tests schema changes, 2024 election filtering, vote preservation and geography blocking. The 2024 records remain **not eligible** as 2026 district priors until actual district boundaries are matched. Senate history and multi-cycle results still need ingest.
2. **2026 redistricting bridge:** Audit the states that changed boundaries for 2026 against authoritative state/court maps; do **not** pretend the 2024 House totals in the old lines represent the new district. For those seats, acquire reaggregated 2024 precinct-level outcomes on new lines or mark `geography_mismatch`.
3. **Candidate + incumbency metadata:** Source the general-election ballot slate from election authorities and current incumbency, validate open seats/specials/independents; store a timestamp because these can change.
4. **Baseline model (research only):** Combine the election-year-correct district fundamentals with the nationwide polling environment via a regularized model. Evaluate on actual earlier election years held out *as a unit*; no borrowing 2026 outcome data. Compare the baseline to simpler historical benchmarks.
5. **Correlated seat and Congress-control draws:** Fit historical election-day model residuals, including national/regional common error, Senate holdover caucusing and the predeclared competitive slate for Blue Tsunami. Verify proper probabilistic calibration before enabling any win/seat/scenario percentages.

A historical House election under old boundaries is **not** a valid 2026 district prior until the map/version match is explicitly verified. This is the most important safeguard against overconfident seat totals in a redistricting-heavy year.

## First historic source import — October 13

The 2024 staging importer retrieved candidate-level results for **435 voting House districts**, with **44** districts lacking recorded votes for one of the two major parties. It deliberately retained raw vote counts rather than filling uncontested contests with invented opposition votes. Its original downloaded source has an additional non-voting House delegate record (D.C.), which is excluded from the 435-seat apportionment universe; a regression test guards this distinction. Raw 2024 vote totals and sample integrity are now available for historical research, **not** yet for assigning 2026 predicted winners.
