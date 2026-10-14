# Same-draw 2026 House seat-to-vote distribution and private external comparison

**October 14, 2026.** This is an **experimental diagnostic**; it does not change any published win probabilities or model coefficients.

## Vote to seats: from the same election simulations

Run from the repository root:

```bash
node scripts/audit_joint_vote_seats.cjs
node scripts/audit_joint_vote_seats.cjs --json > /tmp/jack-vote-seats.json
```

The existing joint simulator can now accept the optional `voteSeatWeights` argument, an exact verified 435-record vector of `{race_code,reference_two_party_votes}`. Every simulated district margin is combined as a weighted D-minus-R two-party margin, using precisely the **same election draw** that determines House and Senate outcomes. The optional `vote_seat_explanation` provides 1-point weighted-margin bins, simulation counts, expected Democratic seats, and the probabilities of each party controlling the House, Senate or both conditional on that bin. This measures the actual model's conditional **joint distribution**, not a generic marginal shift.

The audit uses audited 2024 two-party presidential vote counts mapped to 2026 House boundaries as *fixed relative turnout weights*. Historical presidential turnout is neither projected 2026 House turnout nor the actual 2026 House popular vote. Third-party and independent vote shares and uncontested elections require more modeling. Do **not** present the bins as an exact vote-to-seat curve comparable to a complete turnout-aware election forecast.

If a conditional bin contains fewer than 30 of the 9,000 diagnostic draws, it is marked low support. CI verifies that probability-weighted bins reconstruct the exact headline chamber marginals and that requesting the entire diagnostic changes **zero** election draws or race probabilities. The model uses 2024 voters' historical geographic distribution purely as an exposure proxy; there is no hidden Silver normalization.

## Optional *local-only* subscriber forecast comparison

To compare individual race forecasts privately, put externally provided tables on your own machine and execute:

```bash
node scripts/compare_external_forecast_local.cjs \
  --house-candidates "/private/house_candidates.csv" \
  --house-margins "/private/house_race_margins.csv" \
  --senate-margins "/private/senate_race_margins.csv" \
  --house-fundamentals "/private/house_poll_fundamentals.csv" \
  --senate-fundamentals "/private/senate_poll_fundamentals.csv" \
  --json > /private/forecast-difference-audit.json
```

The required House-candidates file contains a numeric four-digit state-FIPS/district code and party-winning probabilities. The two required margin tables use race codes like `AZ-1` and `AK` and signed numerical suffixes (`@@-4.2`) in forecast cells. Fundamentals are optional. The program checks coverage, duplicated districts, probability ranges, FIPS reconciliation, and missing margins; it then independently runs 12,000 draws from *the current JackStradamus model* and reports **aggregate** district win-probability disagreements, expected House seats, margins, and candidate-identity flags. It does **not** infer whether Silver or JackStradamus will be more accurate from a forecast-to-forecast comparison.

Candidate-name flags require checking the actual verified 2026 ballot roster and poll sample's matchup. They should not be auto-corrected by treating external candidate names as official. For example, independent/third-party candidacies and multi-candidate contests can easily cause incorrect two-party alignment.

**DO NOT commit any paid source CSVs, generated subscriber report, secret URLs or exported third-party rows to this public repository.** CI tests only synthetic CSV rows and independently public 2024 electoral data. No paid third-party margins, vote probabilities, named candidate rows, or proprietary numerical outputs are stored in production code or committed tests.

## What remains to validate

- A 2026 turnout forecasting component and a credible uncontested-race imputation model are required for a genuine nationwide House popular-vote estimate.
- Calibrate the correlated national, office, state, and district error decomposition using held-out modern historical election snapshots, never optimizing toward a proprietary forecast's probabilities.
- Resolve candidate identity mismatches against official ballot filings, not publisher estimates.
- Source candidate-specific incumbency and previous overperformance to distinguish actual electoral strength from geography.
- Design a local analysis workflow to rerun these comparisons after new forecasts are published without storing paid inputs publicly.
