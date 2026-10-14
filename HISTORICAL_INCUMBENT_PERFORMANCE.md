# Historical incumbent overperformance, without imaginary bonuses

## What was computed

We now calculate **candidate-matched, prior-election relative performance** using **2024 House** and **2020 regular Senate** votes. This is a historical measurement. It is neither a prediction of any 2026 outcome nor a causal estimate of incumbency.

For each incumbent whose current 2026 seat identity can be matched to a previously elected winner, the signed residual is:

```
Historical candidate excess (D-R margin points)
  = incumbent party sign × [
      previous congressional election two-party D-R margin
      - same-year presidential two-party D-R margin in the same jurisdiction
      - office/year-wide House(or Senate)-vs-presidential climate gap
    ]
```

The office/year gap is estimated from an **outcome-independent sample** of comparable D/R-complete races: for House 2024, only verified unchanged 2024→2026 district maps with exact historical-party vote matching; for Senate 2020, all regular-state races with D and R candidate votes and 2020 presidential votes. We use a turnout-capped, 25-point-winsorized average of the within-race congressional-minus-presidential two-party margin gaps to prevent individual extreme races dominating. These are office/year contemporaneous adjustments, not a fitted national generic-ballot parameter. The party sign makes a **positive residual always mean historical performance above that party's geographic baseline**.

### Actual verified coverage (Oct. 14, 2026 staging)

- **149 House incumbents**: same 2026 candidate matched by first/last name to the 2024 historic winner, exact 2024 MIT party totals matched across independent data sources, D/R votes both recorded, and 2026 district boundaries unchanged since 2024.
- **12 Senate incumbents**: same current incumbent matched to the 2020 *regular* U.S. Senate election winner with historical candidate-party and 2020 presidential state results; special races and mismatched candidates are not imputed.
- **36 governor contests**: no prior governor-specific candidate results are yet sourced; current senator running for governor does not receive a prior governor overperformance score.
- Other incumbent records are withheld for changed districts, uncontested vote totals, source vote discrepancies, candidate mismatch, or uncertain office continuity.

The national two-party climate difference in the qualified sample is **House 2024: −0.379 D-R margin points** and **Senate 2020: −0.787 D-R margin points**. The benchmarks are office-year sample divergences, **not** national generic-ballot polls. These values are automatically rederived and verified against staged source files.

## Historical sources and verification

- [MIT Election Data and Science Lab U.S. House 1976–2024](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/IG0UN2) via our previously verified `data/house_history_2024_staging.json`.
- 2024 candidate names independently obtained from the [2024 race-level candidate aggregation](https://github.com/Hackquantumcpp/snoutcounter-midterms-2026-model/blob/main/transformed/past_house_results.csv); the entire historical candidate row is **rejected** if its D/R votes differ from the staged MIT returns. **403 of 435** party vote totals reconcile; many discrepancies are due to fusion/multi-line voting or source data differences. Nothing about a party match alone establishes candidate identity.
- [MIT Senate 1976–2024](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/PEJ5QU) from the already staged source preserving regular versus special races and named candidates.
- Historic presidential totals: [ElectIndex source election history](https://github.com/ElectIndex/26_us_forecast_data/blob/main/historical.csv), 2024 votes on the **2026 district map** for unchanged House districts only, and 2020 statewide votes for the 2020 Senate comparison. Source blob SHAs are retained.

The candidate-specific signed raw residual is stored in `data/historical_candidate_overperformance_2026.json`, with prior-year result, presidential baseline, office climate and excluded reason for **all 506 races**. Matched candidates also receive `incumbent_last_race_overperformance_points`, `elected_vs_appointed=elected` (because they match the earlier winning candidate), and, for verified House districts, `verified_old_new_district_overlap_fraction=1`, in `data/candidate_fundamentals_staging.json`. A first-term flag is filled only for House winners identified as **not** incumbent *on the 2024 ballot*. Other fields stay explicitly unknown.

## Important double-counting protection

The **current headline joint House fundamentals** use **actual 2024 House votes**, which already include the historical candidate’s performance. Adding the full 2024 residual on top would double-count it.

The opt-in `JackIncumbencyFeatures.scenarioBasis` therefore applies a residual or same-office personal bonus only to the *portion not already embedded in the fundamental prior*:

| Model context | Historical election directly embedded in the baseline | Remaining fraction eligible for experimental historical residual |
|---|---:|---:|
| 2024-only, unchanged House | 100% 2024 House margin | 0% |
| 2022/24 House shadow, unchanged | 100% 2024 House margin + extra two-cycle correction | 0% |
| 2024 presidential House shadow (unchanged district) | 35% 2024 House margin | 65% |
| Regular Senate 2020 + state House prior | 65% 2020 Senate margin | 35% |
| Changed House map without same-candidate evidence | no valid previous district match | 0% (no residual available) |

The separately modeled *first-term increment* can still be tested because an incumbent first elected in 2024 had **no incumbency advantage in their earlier challenger race**. Poll evidence then shrinks the remaining hypothetical fundamentals effect by the existing `(1 − poll_weight)`. No change is applied to published odds.

This is an **engineering guard against double-counting**, not a historically trained choice of coefficients. Party-specific labels do not imply any preferred electoral outcome.

## Examples of historical *measurements*, not forecasts

- **Maine Senate, Susan Collins (2020):** signed historical margin excess **+17.757** percentage points relative to the 2020 presidential vote and the qualified Senate office/year gap. The sensitivity module caps the contribution at ±12 points *before* weighting; the raw historical score remains inspectable.
- **Arizona 6th House, Juan Ciscomani (2024):** historical excess **+1.438** points, on verified unchanged geography. Because the default model already uses his 2024 House result as an input, the historical excess is **not added again**.
- **Minnesota 2nd House:** no current same-seat candidate match, so no candidate residual is attributed to a different person.
- **Minnesota Senate:** open-seat candidate Peggy Flanagan is not treated as the incumbent 2020 Senator; no historical Senate incumbency residual is fabricated.

## What is still missing for promotion

The historical excess is noisy: it combines actual candidate skill, constituency service, campaign organization, opponent quality, turnout and random errors. The 2024 House residual describes an election that already happened; by itself it does **not validate** its predictive strength in 2026. Backtesting previous-election candidate residuals against *later* election outcomes requires geography-correct presidential results and name-matched candidate returns from earlier cycles, including 2022→2024 and earlier holdouts. Any calibrated coefficient must be tested on election outcomes **without later outcome leakage or winner-only selection bias**.

Incumbency congressional approval, first-term, elected vs. appointed, new-district overlap, FEC in-state individual contributions, candidate experience and their interactions still need independent measurement, not speculative bonuses. The 2026 governor context remains a separate office model.

## Reproduce

```sh
node scripts/build_historical_candidate_strength.cjs --check --json
node scripts/test_historical_candidate_strength.cjs
node scripts/test_incumbency_features.cjs
```

These commands are mandatory in PR CI, fail on changed source totals or candidate identity, and never change main forecast probabilities.

Methodology inspiration: [Silver Bulletin FLIPR (Aug. 2026)](https://www.natesilver.net/p/flipr-midterms-model-methodology). These calculations and gating rules are original; they are **not** Silver’s proprietary regression estimates.
