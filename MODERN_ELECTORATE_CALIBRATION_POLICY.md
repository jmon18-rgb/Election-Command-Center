# JackStradamus: recent-electorate calibration policy (2026)

## Model-design decision

**Do not use 2012–2018 House election outcomes to train the current 2026 candidate-strength or national-electorate assumptions.** The Trump-era and post-2020 political coalitions differ in geography, turnout, candidate behavior and polling error from earlier eras. More historical rows are not inherently better observations of 2026.

The 2026 forecast should prioritize, in order:
1. **Contemporary 2026 race polling** with source, population, sponsor and field-date checks, blended with local candidate/partisan fundamentals and shared election error.
2. **2024 House and presidential election results**, measured on the actual 2026 map where geography is valid. This is the freshest completed national election.
3. **2022 House midterm** to estimate how incumbent-specific residuals persist into 2024 on comparable districts. These are **2022→2024 retrospective tests**, not proof that the reverse 2024→2026 presidential-to-midterm change will match.
4. **2020 presidential results solely as geographic context** for measuring 2022 performance (2020 votes reaggregated into 2022 districts), not as a standalone forecast of 2026 candidate performance.
5. If older results are ever examined, they remain explicitly labeled **external historical stress tests only** and carry **zero automatic 2026 calibration weight**. The active modern calibration scripts deliberately exclude them.

## Modern incumbent robustness results

The current reproducible artifact `data/modern_incumbency_robustness_2022_2024.json` uses **148** candidate matches from **34 states**, exclusively 2022/2024 House election outcomes, with leave-one-state-out fitted predictions and contemporary presidential geographic context.

| Pre-specified subgroup | Matched candidates | RMSE, no incumbent residual | RMSE, out-of-state modern shrinkage |
|---|---:|---:|---:|
| All 2022→2024 re-runners | 148 | 5.522 | 4.732 |
| Presidential 2020 district margin within 10 points | 32 | 5.978 | 4.641 |
| Presidential margin within 20 points | 63 | 5.782 | 4.767 |
| Presidential margin over 20 points | 85 | 5.321 | 4.706 |
| First elected in 2022 | 33 | 5.041 | 4.695 |
| Already incumbent in 2022 | 115 | 5.652 | 4.742 |
| 2022 Democratic winners | 83 | 5.875 | 5.140 |
| 2022 Republican winners | 65 | 5.035 | 4.152 |

The **all-sample historical shrinkage coefficient is 0.345**. A deterministic **1,200-resample state-cluster sensitivity analysis** yields a 5th–95th-percentile descriptive coefficient range of about **0.265–0.429**, and a descriptive held-out RMSE improvement range of about **0.523–1.075 margin points**. These bootstrap values are diagnostic sample sensitivity, **not calibrated forecasting uncertainty bands**.

This is evidence of *some historical persistence of candidate-specific overperformance*, across both parties and competitive seats. **It is not evidence to give every incumbent an identical bonus**. The first-term cohort has visibly weaker incremental benefit in this single sample, and the competitive cohort is relatively small. No subgroup-specific automatic coefficient is justified by only one two-year test period.

There is an especially important limitation: **only four of the 148 returning 2022 winners lost in 2024**, so these data cannot robustly calibrate upset probabilities or the probability that an apparent incumbency advantage disappears. Selection into running again is not random. A candidate's historical residual combines candidate brand, campaign quality, party environment, turnout and noise. **Forecasting 2026 midterm conditions from a 2022-midterm-to-2024-presidential transition remains a direction-of-cycle mismatch.**

## Implementation and safeguards

- `scripts/audit_modern_incumbency_robustness.cjs` recomputes modern cohorts directly from the existing fully staged 2022 and 2024 study. It does not ingest 2012/2014/2016/2018 election data.
- `scripts/test_modern_incumbency_robustness.cjs` checks year boundaries, all counts, subgroup scores, state-cluster resample reproducibility and the absence of any older-cycle input file.
- The committed JSON is reproducible via `--check`.
- No subgroup coefficient or state-specific adjustment is promoted to 2026 headline probabilities; the previous House candidate residual is still prevented from being double-counted on top of the observed 2024 House outcome.
- Neither the Senate nor governor incumbency effect is inferred from this House-only sample. Minnesota’s gubernatorial administration context stays candidate-specific and source-linked, not a state party penalty.

## Next, to become legitimately better

Prioritize forward evidence: accurate 2026 district maps, fresh likely-voter polls, verified candidate matchups, approval for the **actual candidate** rather than everyone of the same party, fund-raising by itemized contributors, and a correlated House/Senate uncertainty model. Where recent evidence disagrees, **widen uncertainty**, rather than assuming a historical coefficient is a constant or forcing polls toward partisan expectations.

This is a deliberate **modern-electorate constraint** on a Silver-inspired model, not a claim to replicate Silver's proprietary or longer-horizon training.
