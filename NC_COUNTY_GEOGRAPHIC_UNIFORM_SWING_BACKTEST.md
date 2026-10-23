# Geographic needle calibration research: why uniform county swing is fragile

We measured the **county-level difference between the FULL 2022 North Carolina U.S. Senate results and the FULL 2024 North Carolina presidential results**. The original official NCSBE precinct ZIPs are independently SHA-pinned and **re-downloaded and checked county by county** by the [historical error CI workflow](.github/workflows/nc-county-uniform-swing-error.yml).

This intentionally tests the simple hypothesis that a statewide Democratic margin shift should apply uniformly to every county. Even when the statewide two-party D−R margin changed by only about **+0.04 percentage points** between these different elections, individual counties differed: in the original source data, the county-vote-weighted uniform-shift absolute margin error was approximately **2.02 percentage points**, and the weighted root-mean-squared error was approximately **2.59 points**.

This is an **illustrative historical error diagnostic**, not a credible probabilistic uncertainty interval or 2026 calibration. The two elections have different offices, candidates, turnout and political environments; no release timestamps or vote-reporting sequence for early precincts were observed. Without 2026 source-backed denominator, precise reporting geographies, method-specific historical comparisons and out-of-year backtesting, this error size must **not** be inserted as a probability variance, source bias coefficient, or forecast swing.

The workflow preserves a JSON research artifact and never touches `data/race_probabilities.json`, Election Night live candidates, chamber control, or JackStradamus probabilities. This keeps the next needle implementation constrained by actual validation evidence.
