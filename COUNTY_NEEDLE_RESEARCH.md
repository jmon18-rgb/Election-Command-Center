# Geographically matched early-return indicator — evidence gate

**Research only. It is intentionally not loaded in the live dashboard and cannot alter race, chamber or Four Endings odds.**

`scripts/election_night_county_mode_signal.js` defines an offline, testable contract for 2026 county-by-voting-method early-return performance. It requires:

- Verified 2026 election race identity and live timestamp, plus separately attributed 2024 baseline and live results sources.
- Exactly matching 2026 geographic county IDs between historical reaggregation and current returns, and the same voting mode (early, mail, election-day); no matching by raw precinct/district number across changed boundaries.
- Nonduplicated county-and-mode cells and an explicit estimated *countable two-party ballot* denominator (not 'precincts reporting').
- A validated state-level estimated total, at least three distinct counties, >=80% of estimated state ballots represented by the geographic sample, and >=65% of estimated statewide two-party ballots already reported before producing an exploratory residual.
- 2024 baseline D/R votes and live 2026 D/R votes; returns 2026 observed minus expected D-minus-R **two-party margin** in percentage points. This is a local descriptive comparison, not a predictive confidence interval.
- Every output, including a passed eligibility gate, sets `may_move_national_needle: false`. A match is **not** proof of sample representativeness, candidate-vs-president equivalence, cross-office historical comparability, return order randomness or error calibration. No automatic race call or statistical national projection is allowed.

`scripts/test_election_night_county_mode_signal.cjs` uses exclusively fabricated county counts. It checks exact matching, duplicate rejection, stale data, geography mismatch, vote-method mismatch, vote-count vs precinct-fraction mismatch, insufficient statewide coverage, impossible totals, source provenance and mathematically correct D–R residual scaling.

**Next live work (not implemented):** Obtain county and voting-mode 2024 outcomes and official 2026 live reporting schema from original state election authorities. Verify stable 2026 county geography and reaggregate precincts including split precincts. Estimate outstanding ballots by county and mode, quantify systematic release order and sample-selection bias, then run leave-year-out and reporting-order backtests. Only promote as a source-attributed, appropriately uncertain **separate** needle model after these calibrations.
