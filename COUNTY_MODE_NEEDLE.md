# County × vote-method early results — evidence gate (October 15, 2026)

`scripts/county_mode_needle.js` is a **research-only** comparator that can be connected to properly sourced state election results when those files become available. It does **not** currently collect official county data, and does **not** change the published needle, four-ending probabilities or race calls.

## What a future official adapter must supply

For an exact 5-digit county FIPS and a single explicitly matched voting method (`election_day`, `early_in_person`, or `mail`), the record must include 2024 and 2026 two-party votes from an identified state election authority, unchanged or formally reconciled local boundary definitions, a comparable vote-method definition, the fresh 2026 result timestamp, and an **estimated share of ballots actually counted**, not a share of precincts reporting. The fraction must have a documented ballot-level basis, never guessed from precinct counts. Reconciliation must show no 2026 ballots are included in two different modes or counties.

The comparator checks identity and provenance, rejects missing votes, stale/future dates, incomplete or mismatched years/modes/geo keys, duplicate county/mode records and fewer than 80% of estimated ballots counted within a unit. It reports observed D–R margin differences between 2024 and 2026 *for the qualifying local units only*. Summarized local context requires three distinct counties and at least 10,000 two-party recorded votes; even then the output is **not a representative national shift**. No stochastic confidence bands, modeled outstanding votes or call thresholds are manufactured.

**Important:** The boolean geometry/mode-review fields are input **requirements**, not automatic evidence certification. A real adapter must derive them by cross-checking official 2024 and 2026 county boundaries, method definitions and result files; a news headline or source's own “percent precincts” field cannot set those flags.

## Next evidence task

1. Collect NC's official 2024 county/precinct and voting-method exports and test exact D/R statewide reconciliation; identify official 2026 election-night county data transport and browser CORS behavior.
2. Obtain an equivalently verified independent Virginia, Indiana or Kentucky early-closing-state county source. Ensure actual reporting status uses counted ballots rather than reported precincts.
3. Run genuine historical reporting-order replays and leave-one-region-out comparisons. Derive systematic errors and mode-mix shifts before authorizing any county signal to update shared correlated race probabilities.
4. Validate the same source identity for primary races and Senate holdovers, and maintain time-stamped source health on the Election Night desktop.

Until all of that succeeds, `shared_model_update_allowed` remains hardcoded **false**. The current publicly visible early-district comparison remains a strictly descriptive vote-versus-poll observation, not a geography-adjusted forecast.
