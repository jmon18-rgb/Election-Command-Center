# Forecast optimism audit — October 14, 2026

Run from repository root:

```sh
node scripts/test_chamber_control_model.cjs
node scripts/forecast_optimism_audit.cjs
node scripts/forecast_optimism_audit.cjs --json
```

This audits the **experimental** joint-control simulation. It does not transform it into a calibrated election forecast. All runs use the same 6,000-draw seed to make cross-scenario changes easier to interpret.

## Why the probability could be too optimistic

1. **Baseline vote-margin mismatch.** The model converts the difference between a 2026 generic congressional ballot and **recorded 2024 House votes** into a district swing (currently using a 0.68 damping coefficient). The two measures are not matched-population or matched-ballot surveys.
2. **Weakly identified House districts.** Historical redistricting proxies and unpolled seats make House-control certainty very sensitive to assumptions. The audit reports actual model poll coverage.
3. **Correlated misses matter.** Simulations include national, chamber and state effects, but the standard deviations are currently assumptions. In addition to the central run, the audit shows R-favorable misses of 2 and 4 points, D-favorable misses of 2 points, 25% wider uncertainty, and combined R-favorable/wider uncertainty.
4. **This is not Nate Silver's FLIPR.** FLIPR includes historical fundamentals, house-effects adjustments, timeline adjustments and joint simulation. It should be used as an independent comparator, never as a target used to force-fit our odds. Reference: https://www.natesilver.net/p/flipr-midterms-model-methodology.
5. **Near-sweep is custom.** The Blue Tsunami definition currently requires winning at least 18 of a fixed 20-race slate *and* both chambers. This is a user-facing scenario definition, not a calibrated statistical forecast.

## Promotion gates

- Assemble a leave-one-cycle-out election-result backtest with actual historical snapshots, including district maps and uncontested races.
- Estimate separate national, regional, state and race-specific error terms on held-out cycles. Check reliability diagrams, Brier scores, log loss and empirical interval coverage.
- Backtest House seat-count distributions and Senate joint control **together**; do not obtain joint odds by multiplying marginals.
- Use comparably defined public forecasts (including FLIPR where accessible) as external disagreement diagnostics, not calibration training data.
- Surface source date, observed polling coverage, missing data, model status and scenario sensitivity next to any numeric odds.
- Preserve separate experimental and externally attributed models; never silently mix provider probabilities with JackStradamus draws.

**No adjustment to central forecast coefficients is made by this audit.** A downward patch just to look like FLIPR would be another form of uncalibrated modeling.
