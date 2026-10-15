# The Four Endings — seat-based, linked 2026 simulations

Updated October 15, 2026. **Experimental, not historically calibrated probabilities.**
All figures come from one correlated national simulation with the same source-validated race polling, fundamentals, state shocks, Senate holdovers and House geography. Race calls and eligible live returns are reflected in the same draws, not assigned arbitrary odds boosts.

## Exactly four exclusive categories

| Ending | House threshold (Democratic seats) | Senate threshold (Democratic-aligned seats) | Assignment |
| --- | ---: | ---: | --- |
| **Blue Tsunami** | **235+** | **52+** | Both higher thresholds reached |
| **Blue Wave** | **218+** | **49+** | Both minimum thresholds reached, *excluding Tsunami* |
| **Shrug** | One threshold only | One threshold only | Either House >=218 and Senate <49, **or** Senate >=49 and House <218 |
| **Red Dawn** | <218 | <49 | Neither Wave threshold reached |

Tsunami is a **subset of the broader Wave-or-Tsunami threshold event**, but the displayed Blue Wave probability excludes Tsunami, preserving four mutually exclusive probabilities that sum to 100%. These labels are user-specified seat-outcome buckets, **not equivalent to actual chamber control**.

**Essential Senate arithmetic:** A result of 49 Democratic-aligned Senate seats is not a tie, a Democratic majority, or Democratic Senate control. This model treats **51** Democratic-aligned Senate seats as outright Democratic control; 50 would leave the vice president breaking ties for Republicans under its pre-election assumption. The separate `senate_dem_control_pct` and `actual_dem_both_control_pct` fields use these actual-control rules. **Do not label the Blue Wave threshold probability as the chance of Democrats controlling both chambers.** The existing `blue_both_including_tsunami` API key is retained only for backward compatibility and now means **D >=218 House AND D >=49 Senate**.

## Implementation and invariants

- `scripts/chamber_control_model.js` exports `ENDING_THRESHOLDS` and `classifyFourEndings(houseSeats,senateSeats)`. Every simulated election is classified exactly once using final simulated Democratic seat totals.
- House: 435 congressional seats (218 majority). Senate: 65 modeled holdovers plus 35 contested seats, with unusual independent-caucus uncertainties disclosed separately.
- The 20-race fixed battleground slate remains a **monitoring / descriptive** statistic; it no longer determines any of the Four Endings outcomes. Governors affect neither House nor Senate seat counts. Independent Nebraska proxy caveats still apply.
- The same Monte Carlo draws compute race probabilities, House control, Senate actual control (51 seats), both-chamber actual control, the Four Endings distribution, model seat intervals and qualified election-night source-call updates.
- Separate tallies validate that `Wave + Tsunami = P(House >=218 AND Senate >=49)` and `Shrug = P(exactly one gate)`. Actual Senate-control and actual joint-control probabilities must be less than or equal to their relaxed seat-gate counterparts.
- Early raw partial vote leads are **not** independent race calls. County, precinct and voting-mode turnout priors are not yet calibrated. Projection and provider-reported call labels remain distinct.
- `scripts/test_chamber_control_model.cjs` exercises boundary cases such as 218/49, 235/52, 235/51 and 217/49, alongside exact draw reconciliation.

## Interpretation

These numbers are valuable for tracking how a changing poll/returns environment moves a *consistent* forecast, but are not validated win probabilities with demonstrated historical calibration. The headline model currently blends source-matched polling and 2026 fundamentals (when supplied), with shared national, state and chamber uncertainty. The model's alternative experiments and historical backtests do not certify the exact 2026 error covariance.

For input data and caveats, see [POLLING_MODEL.md](POLLING_MODEL.md), [SEAT_MODEL.md](SEAT_MODEL.md), [PRIVATE_SILVER_CSV_MODEL.md](PRIVATE_SILVER_CSV_MODEL.md), [ELECTION_NIGHT_SOURCES.md](ELECTION_NIGHT_SOURCES.md) and [SILVER_FIRST_MODEL_POLICY.md](SILVER_FIRST_MODEL_POLICY.md).
