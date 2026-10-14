# Senate variance accounting and independent Senate candidates

**October 14, 2026 — audit only, no central-forecast coefficient changes.**

Run `node scripts/audit_senate_error_budget.cjs` or `--json`. All comparisons reuse 6,000 seeded, nationally correlated joint House/Senate/governor election simulations. PR CI runs the audit and checks that the House race marginals remain identical.

## Why this matters

The upstream historical Senate backtest reports an overall **5.633-percentage-point margin RMSE** from **42 retrospective Senate races in 2020, 2022, 2024**. This is total polling-to-election error, not a race-specific conditional residual after national, chamber and state errors are removed. Its lack of contemporaneous first-publication dates also prevents a fully leakage-free real-world `as-of` score.

The joint model currently uses a **7-point local Senate SD floor** and *additionally* national SD 3.5, Senate chamber SD 3, and state Senate SD 3.5. Even before candidate-prior disagreement, a well-polled Senate race therefore receives `sqrt(7²+3.5²+3²+3.5²)` = approximately **9.2 points of modeled total error**. The combined shared-component SD alone is approximately **5.8 points**, slightly higher than the 5.633 retrospective whole-race RMSE.

This is an **important variance-provenance warning**, not proof the 2026 joint sigma must be 5.633. The current model forecasts a poll/fundamentals blend, not the historical raw polling mean. Errors differ by stage of the campaign, margin, pollsters and geography. We need honest historical forecast snapshots and modern held-out election cycles to fit components.

## Research controls

The audit reports baseline, and two **full-error-budget** shadows for polled Senate races: 7.5 and 8.5 total margin points as *explicit nonfitted conservative floors* before candidate-prior disagreement, with the existing national/chamber/state variance subtracted when calculating local conditional error. It leaves unpolled Senate races, all House races, all means, and the common-shock structure unchanged. No coefficients are promoted automatically.

This distinguishes a valid uncertainty accounting question from silently forcing race probabilities toward an external forecaster. House/Senate joint outcomes are still sampled together. The report includes expected Senate seats, full modeled Senate control probability and selected Senate race marginals for each case. An apparent improvement in agreement with Silver is NOT a validation or selection criterion.

## Two independent candidates represented as a Democratic polling column

The upstream two-party Senate poll feed lists `NE-SEN` **Dan Osborn** and `SD-SEN` **Brian Bengs** under the `dem_candidate` key even though their actual ballot affiliation is **Independent**, not Democratic. We now guard their identities against the exact source matchup names in the model basis, making the distinction accessible downstream.

A separately selectable research control `independentSenateCredit:'no_credit'` treats an independent victory in NE or SD as **zero guaranteed Democratic caucus/organizational votes**, instead of the old default of one. This is a deliberately conservative sensitivity bound, not a claim that such senators necessarily vote for Republicans, or an exact forecast of Senate organization; on a narrowly divided Senate, an independent could still vote for Democratic leadership without caucusing. The original `dem_proxy` setting is deliberately retained as the original optimistic organizational-credit bound until ballot modeling is verified. *All candidate-winning probabilities remain identical between the two organizational-credit modes*, while Senate control can change.

Sources for ballot status:
- [April 28, 2026 South Dakota Secretary of State: Bengs validated as an Independent Senate candidate](https://sdsos.gov/about-the-office/assets/Press%20Releases/BengsValidationPressRelease.pdf).
- [August 4, 2026 South Dakota withdrawal of Democratic nominee](https://www.washingtonpost.com/politics/2026/08/04/democrat-exits-senate-race-south-dakota-clearing-way-independent/).
- Osborn's October 12, 2026 pledge reported independently; inspect signed statement and Ballotpedia/official Nebraska ballot to refresh the affiliation/caucus assumption.

## Go/no-go for central model

Do not lower the seven-point conditional Senate error floor merely because Silver shows more Democratic wins. First acquire nonleaking historical snapshot forecasts and final results; hold out entire modern election years; evaluate margin residual decomposition; calibrate national vs state vs independent error and event-level scoring (Brier, log loss, credible coverage); audit non-R-vs-R independent party treatment and the exact Senate organizing rules for 50-49-1 outcomes. Maintain immutable source dates and bias model version. This remains an experimentally useful forecast, not a validated probability guarantee.

Files: `scripts/audit_senate_error_budget.cjs`, `scripts/chamber_control_model.js`, `scripts/test_chamber_control_model.cjs`.
