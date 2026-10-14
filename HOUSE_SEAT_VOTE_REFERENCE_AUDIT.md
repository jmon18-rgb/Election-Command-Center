# House seat–vote baseline and tipping-district audit (research only)

October 14, 2026. Run `node scripts/audit_house_seat_vote_reference.cjs` or `--json` to audit the 2026 House model's 2024 electoral reference, mapped geography, and national-swing-to-seat sensitivity. Pull-request CI validates the output.

## What this investigates

The current House model uses an aggregate **recorded** 2024 House two-party margin as its national historical reference when translating the October 2026 generic ballot to expected district swing. The 2024 source includes **44 districts without recorded vote totals for both major parties** (391 with both). That aggregate differs from both (a) vote totals in the 391 races with both major-party votes and (b) presidential 2024 vote totals mapped to all 435 of the 2026 districts.

These are **three different reference populations and office-specific vote measures**. Excluding uncontested races is NOT a statistically valid national House-popular-vote correction by itself; doing so changes which constituencies are counted. Likewise, a presidential margin is not a House margin. The comparison is a **data-provenance and model-sensitivity check**, not an endorsement of any of the three estimators.

## Four same-seed House modeling sensitivities

The research code tests:
- **Original headline assumptions**, without modifying headline probabilities.
- **2024 House both-party-recorded reference** as the generic-ballot-to-House-swing denominator. It alters only the national reference and preserves per-district observed House vote margins and local poll weights.
- **2024 presidential mapped-vote national reference**, holding the same district fundamentals as the original.
- **2024 presidential district geography on 2026 boundaries**, using the existing alternate research mode already in the codebase. This removes exchangeable priors for 173 redrawn districts; it does not magically make a generic-ballot conversion historically calibrated.

All scenarios calculate Democratic expected seats, House-control probabilities, and simulated 90% seat intervals. They preserve the 35 Senate race assumptions and governor assumptions. The mapped-geography scenario changes the random-number draw sequence (no exchangeable redraw shuffles), so its Senate Monte Carlo outcomes are compared with tolerance instead of spuriously claiming matched stochastic realizations.

The script also runs an **experimental ±6 percentage-point uniform House candidate-margin-response curve**, explicitly **not** a mathematical conditioning on the realized national House popular vote. The latter requires integrating simulated turnout and district vote totals into the national vote numerator/denominator and studying how shared error factors couple to both votes and seats. Silver's published vote-to-seat chart is a useful structural benchmark for why this distinction matters, not a source for fitting our points.

## House control bellwethers

`simulate(basis,{explainControl:true})` now produces **top_house_control_bellwethers**, sorted by same-draw covariance between an observed Democratic district victory and Democratic House control. A safe-seat's mechanical pivotal counts can be high when control is decided by a single seat; the covariance ranking is a more useful watchlist of informative races. These are not equivalent to Silver's tipping point, voter power index, or state/district elasticity metrics. The output is optional; requesting it **does not affect any actual win probabilities** or the PRNG sequence.

## Before changing the live model

1. Build a complete **contested-equivalent national House popular vote** time series, with a transparent estimator for uncontested races. Quantify uncertainty in that estimate.
2. Check statewide/district fundamentals with held-out modern elections: 2022 and 2024. Preserve complete *as-of* forecast snapshots and avoid fitting on outcomes that postdate forecasts.
3. Separate partisan geography, verifiable incumbent/candidate residuals, current district polling, and national generic-ballot swing. Use 2026 maps for redrawn jurisdictions.
4. Only after validation promote improvements to expected House vote shares and their uncertainties, then re-run the correlated House/Senate chamber-control engine.
5. For an authentic national-vote-to-House-seats curve, use election simulation draws carrying turnout-weighted district votes, and condition on the actual simulated national House margin. Do not relabel arbitrary margin shifts as popular-vote probabilities.

**Privacy and source separation:** The proprietary paid Silver Bulletin charts and district-level expert-rating table supplied in the chat are not copied into the public repository. Research comparisons are performed with independent electoral sources; the model's parameters are not fitted to Silver outputs. The headline probabilities are unchanged by this PR.
