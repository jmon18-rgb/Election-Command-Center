# Geographic needle calibration research: why uniform county swing is fragile

We measured the **county-level difference between the FULL 2022 North Carolina U.S. Senate results and the FULL 2024 North Carolina presidential results**. The original official NCSBE precinct ZIPs are independently SHA-pinned and **re-downloaded and checked county by county** by the [historical error CI workflow](.github/workflows/nc-county-uniform-swing-error.yml).

This intentionally tests the simple hypothesis that a statewide Democratic margin shift should apply uniformly to every county. Even when the statewide two-party D−R margin changed by only about **+0.04 percentage points** between these different elections, individual counties differed: in the original source data, the county-vote-weighted uniform-shift absolute margin error was approximately **2.02 percentage points**, and the weighted root-mean-squared error was approximately **2.59 points**.

This is an **illustrative historical error diagnostic**, not a credible probabilistic uncertainty interval or 2026 calibration. The two elections have different offices, candidates, turnout and political environments; no release timestamps or vote-reporting sequence for early precincts were observed. Without 2026 source-backed denominator, precise reporting geographies, method-specific historical comparisons and out-of-year backtesting, this error size must **not** be inserted as a probability variance, source bias coefficient, or forecast swing.

The workflow preserves a JSON research artifact and never touches `data/race_probabilities.json`, Election Night live candidates, chamber control, or JackStradamus probabilities. This keeps the next needle implementation constrained by actual validation evidence.


## October 24 update — county-selection sensitivity (research only)

The same SHA-pinned full 2022 Senate and full 2024 presidential county files
now support **25 deterministic whole-county selection tests**: five deliberately
nonchronological orderings (largest, Democratic-leaning, Republican-leaning and
two hindsight maximum-change cases) across target fractions of 10%, 25%, 50%,
75% and 90% of the later certified 2024 statewide two-party county votes.
Each reports the actual fraction reached by completing whole counties and the
error of the selected counties' *county-vote-weighted two-election shift*
relative to all 100 counties. This compares like with like; the benchmark
is **not** the statewide difference of raw office results.

Crucially, these are **hypothetical geographic selection sensitivities, not
timestamped archived Election Night snapshots**. Both input datasets contain
full final vote totals, and the extreme orderings use hindsight information.
The chosen fractions are fractions of **later certified** votes, not a source
for 2026 ballots remaining or precincts counted. No selected cohort is asserted
to resemble the actual election-night release order. The resulting stress
maximum must not be installed as a 2026 noise coefficient, predictive
confidence interval, or national needle adjustment. The updated research
artifact retains `may_move_national_needle: false` and
`valid_uncertainty_calibration: false` at all levels.

**Still required for a calibrated needle:** independently captured
timestamped live county/precinct histories; same-office boundaries and
county/mode matching; a well-sourced estimated outstanding-ballot denominator;
region and method-specific shift modeling; election-year-out-of-sample
probability reliability checks. No valid historical source clock was created
by this research enhancement.
