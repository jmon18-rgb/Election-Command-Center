# Time-dependent Senate probability research

This study rebuilds simple Senate polling-average snapshots with data ending **60, 45, 30, 20, 14, 10, 7 and 3 days before** the 2020, 2022 and 2024 general elections. It is a **poll-only research experiment**, not a reconstructed historical run of the full 2026 JackStradamus system.

## Reproducible pipeline

```bash
python3 scripts/test_senate_horizon_backtest.py
python3 scripts/research_senate_horizon_backtest.py
```

The second command downloads three historical Senate poll archives from [Jack Whitcomb's RCP compilation](https://github.com/Jack-Whitcomb/All-US-Senate-polls-2006-2024) and pairs them with MIT Election Data and Science Lab returns already stored in `data/senate_history_2020_2022_2024.json`. It republishes *only derived margins, scores and source provenance* to `data/historical_senate_horizon_backtest.json`; it does **not** check in the unlicensed original poll CSVs. GitHub Actions tests all horizon rules on synthetic data on every pull request and rebuilds the research artifact separately on main.

For every historical election day (November 3, 2020; November 8, 2022; November 5, 2024), only fieldwork ending no later than that horizon's cutoff is eligible. A 45-day backwards lookback and 21-day recency half-life are kept constant. The latest eligible poll per independent firm counts once, and at least two distinct firms are required. If a contest is missing sufficient polls, the contest is **missing from that horizon**, not given a fictitious 50–50 prior. Historical election returns are used *only as scoring targets*. Contests with overlapping same-state special elections, missing major-party results, or dominant third-party/independent voting are excluded.

Outputs show sample count, by-cycle signed errors, RMSE, absolute error, Brier score, log loss and 90% nominal margin-error coverage under fixed 6/7.5/8.5/10/12-point uncertainties. The study also reports a comparable panel restricted to races eligible seven days before Election Day, and a **leave-one-entire-election-year-out** candidate sigma estimate using only the other two election cycles (regularized toward 8.5 points). The year-heldout result is an exploratory sensitivity, not a production optimizer. Source digests make historical inputs auditable.

## Confidence reliability table (October 15)

Run `node scripts/test_senate_calibration_audit.cjs` to inspect the poll-only seven-day sample's 50–60%, 60–70%, 70–80%, 80–90%, and 90–100% favored-candidate probability bins. Each bucket reports the number of historical Senate contests, mean assigned confidence, expected versus observed wins, election years represented, and a 95% Wilson interval when nonempty. Empty bins explicitly remain empty; a bucket with only a handful of races is not treated as a model calibration finding. These are *favorite confidence* bins, not a certification that a specific 2026 candidate has a given chance.

The 42 sampled races span **only three national elections** and the polling archive has fieldwork-end cutoffs rather than verified first-publication timestamps. Consequently, every reliability bin is explicitly marked `statistically_validated: false`, the test makes **no automatic change to 2026 race odds**, and proper out-of-cycle backtesting of the *full* House/Senate model remains open.

## Evidence gates: why the study is not a new 2026 model

- **Source first-publication dates are missing.** A poll ending before a given cutoff might still have been published after it. The fieldwork cutoff alone is not proof that the public could have used it at that point.
- The RCP compilation selects eventual general-election candidates retrospectively. That selection can introduce hindsight even though poll fieldwork times are filtered correctly.
- Historical Senate error is correlated within election years. The number of repeated race-by-date snapshots vastly overstates independent sample size. There are only **three election cycles**, far short of convincing time-dependent covariance calibration.
- Contests with no eligible surveys are not in the poll-only probability sample. Today's unpolled Senate races and candidate quality are not represented. The live model mixes candidate-neutral fundamentals, current polling, and correlated chamber outcomes, none of which are replayed by this research.
- **No fitted coefficient is promoted to the production model** merely because it scores well in hindsight, and no named candidates get hand-adjusted chances.

The proper follow-up is acquiring *verifiable as-first-published* poll histories with enough election years, then reconstructing time-appropriate fundamentals/uncertainties on a strict heldout-cycle basis. Only after outperforming the current default on genuinely heldout elections should a time-dependent sigma curve replace the provisional 7.5/8.5-point production floors.

The source includes a last-election-candidate selection caveat and has no explicit reuse license; only derived research is stored. The MIT outcomes source is CC0. Research report flags `may_calibrate_2026_probabilities: false`, `may_automatically_change_live_2026_sigma: false`, and `first_publication_dates_available: false`.
