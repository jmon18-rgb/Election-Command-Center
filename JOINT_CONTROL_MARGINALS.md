# Same-draw congressional control marginals and seat distributions

JackStradamus models the House and Senate in **one joint set of correlated election simulations**, including shared national and state errors. Publishing only four scenario buckets hid a useful probabilistic summary: the Democratic chance of holding the House versus the Democratic chance of holding the Senate.

This release derives **both chamber marginal probabilities** from **the same draws used to count Blue Wave/Tsunami, Shrug and Red Dawn**, rather than multiplying separate House/Senate forecasts.

Each draw yields:
- `house_dem_control` = whether Democratic candidates win at least 218 modeled House seats;
- `senate_dem_control` = whether Democrats reach at least 51 modeled Senate seats under the explicit 34-D-caucus holdover assumption;
- the joint scenario bucket, unchanged;
- the modeled number of D House and Senate seats.

The simulator aggregates the marginals and verifies the identity

```
House_D_probability + Senate_D_probability = 2*P(D_both) + P(split)
P(R_both) = 1 - P(House_D) - P(Senate_D) + P(D_both)
```

All probabilities are percentages and may differ at the hundredth due to rounding. The 5th, 50th and 95th percentile House/Senate modeled seat counts are also returned from the *same* simulated elections; they describe **conditional model uncertainty**, not empirical 90% real-election calibration.

The home and election-night sections now display distinct D House and D Senate control odds and modeled seat intervals in the existing joint-model summary, while retaining the four mutually exclusive ending cards. This follows the public-facing joint-forecast interpretation described in [Nate Silver's 2026 FLIPR methodology](https://www.natesilver.net/p/flipr-midterms-model-methodology).

### Important caveats

- The joint beta remains **EXPERIMENTAL_UNCALIBRATED**: deriving marginals exactly from a simulation does not validate assumptions about candidate fundamentals, ballot mechanics or correlated error scales.
- Senate holdovers, the 51-seat threshold, redistricting and special elections are provisional state-of-the-world inputs.
- The main model is unchanged; this only adds honest observability of outputs the model already generated.
- A low Monte Carlo standard error does not equal a reliable forecast. The 90% intervals do not establish frequentist prediction coverage.

### Validation

```sh
node scripts/test_chamber_control_model.cjs
node scripts/test_dashboard_runtime.cjs
```

The tests enforce same-draw inclusion-exclusion identities, probability bounds, seat interval monotonicity and actual browser rendering.
