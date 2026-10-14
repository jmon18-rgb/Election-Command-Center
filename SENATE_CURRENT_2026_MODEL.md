# 2026 Senate forecast: current candidates and current polls

**October 14, 2026 — active on the JackStradamus page after this pull request is merged.**

The old joint simulator was **not** a good Senate candidate model: it recycled the 2020 Senate winner's result (65% of the historical baseline), added an imperfect statewide 2024 House vote aggregate (35%), then discounted that with current polls at a fixed 78%/90%. In the 2026 Minnesota open-seat contest, that silently carried Tina Smith's 2020 result into a Peggy Flanagan–Michele Tafoya race. Worse, Minnesota's 2024 House vote aggregate contains a known missing-party-label error. Neither old candidate nor broken House source belongs in a 2026 Senate matchup prior.

## New live model

The web app explicitly requests `ChamberControlModel.prepare(sources,{senatePriorMode:'current_2026'})`. It requires 435 validated presidential vote rows on **2026** congressional district geography. It aggregates 2024 actual two-party presidential votes by state and compares the national presidential margin with the **current 2026 generic congressional ballot**. The raw difference between those incomparable office questions is deliberately multiplied by 0.55 as a conservative provisional national environment transfer.

The current Senate candidate-neutral prior equals:

`state_2024_presidential_two_party_DminusR + 0.55*(generic_2026_DminusR - national_2024_presidential_two_party_DminusR)`

In Senate races with qualified polls, the actual **named 2026 candidates** determine the forecast's primary data signal:

`current_race_margin = w*latest_2026_candidate_poll_margin + (1-w)*candidate_neutral_prior`

where **`w=0.90` for 3+ independent polling firms, `w=0.83` for 2, and `w=0.60` otherwise**. The prior version unintentionally reduced the influence of heavily polled 2026 contests to 75%, despite the geographically neutral 2024 presidential prior lacking the individual 2026 candidate's characteristics. With fewer than three weeks until Election Day, robust qualified candidate polls are prioritized over that cross-office prior. These cutoffs are provisional model choices, **not independently calibrated weights**. Individual candidate or campaign advantage is **not guessed**; the difference between the named-matchup polling and neutral state baseline is reported separately as a contemporaneous observed candidate/campaign residual. It is neither a causal candidate-quality statistic nor a historical personal-incumbency bonus.

**Qualitative, current-cycle no-poll safeguard:** All 11 Senate races with no qualified published polling in this dataset are rated *Solid* by [Inside Elections' October 1, 2026 public Senate ratings](https://insideelections.com/ratings/senate/). Five favor Democrats (CO, DE, NJ, OR, VA), six Republicans (KY, MS, OK, TN, WV, WY). The old default local sigma of 15 points, stacked on national/chamber/state error, incorrectly gave Cory Booker in New Jersey and Mark Warner in Virginia only ~75% chances despite current public independent Solid ratings. For those 11 **only**, the new total margin-error budget is provisionally **7 points**, with 5.79 points of modeled shared shock deducted in quadrature from the local component. This is a **symmetric** D/R repair. It **does not** import outside win probabilities and it disables itself immediately for any race with a qualifying poll. A Solid rating is qualitative evidence of low competitiveness, not proof of a 7-point forecast RMSE; this choice still needs held-out validation.

**October 14 probability-error revision (v3):** The previous uniform **8.5-point** full-race margin-error floor is replaced with **7.5 points for recent, reasonably well-polled regular Senate contests** (at least two independent firms, at least three contributing firms, and most recent fieldwork within 14 days of the polling snapshot). **8.5 points remains the floor for thin, stale, and special-election polling.** An independent historical error source can widen either tier but never tighten it. These are symmetric, race-agnostic rules: no Roy Cooper, Jon Ossoff, Maine, Minnesota, or party-specific win probability targets enter the calculation.

The motivation is the 42-race Senate polling study from 2020, 2022, and 2024, using a fixed seven-day pre-election *fieldwork* cutoff. The observed whole-race polling RMSE is **5.633 points**, versus the former assumed 8.5-point minimum. Applied retrospectively to polling-only margins, the candidate 7.5-point sigma improves pooled Brier score from **0.1088 to 0.1051** and log loss from **0.3488 to 0.3347**, while 90% nominal margin coverage changes from **97.6% to 95.2%**. Year-by-year results in 2020/2022/2024 also improve on both probability scores. The 7.5-point floor remains appreciably wider than the historical RMSE to recognize that October 14 is approximately 20 days before Election Day, that retrospective observations are selected, and that source first-publication dates are unavailable. The *pollster-depth and recency tiers are provisional safeguards*, not empirically estimated calibration strata; the historical data do not independently establish those threshold choices or validate the complete 2026 forecast.

The **shared national + Senate-chamber + state polling-error variance is subtracted in quadrature from the chosen full-race sigma**, not added again. The existing penalty for disagreement between polls and neutral fundamentals can widen that total further. As new polls arrive, the tier can change automatically. The live model and the retrospective audit are kept separate from the poll-only input `data/race_probabilities.json`, avoiding circular forecast inputs. Tests run `node scripts/test_senate_probability_calibration.cjs` and `node scripts/audit_senate_probability_calibration.cjs`. These are *research informed*, **not an independently calibrated or guaranteed accurate 2026 probability model**. The paid Silver exports were **not** used as regression targets, model coefficients, or public data.

If the verified 2026-map presidential source is missing, the new mode **fails closed** instead of falling back silently to a stale 2020 candidate assumption. All races use exactly the same correlated House/Senate/50-state shock draws, so revised race odds flow into the live Senate chamber-control and four-endings probabilities.

## Regression safeguards

Run `node scripts/test_senate_current_candidate.cjs` (or `--json`). CI proves:

- The 435 House district priors, the governor priors, **every individual House and governor race probability**, and the entire House-control probability are bit-for-bit identical to the existing model.
- All 35 Senate races return candidate-aware current 2026 modeled margins; polled races use contemporaneous named candidate surveys; and the prior's 2020 historical Senate candidate is excluded from the modern means.
- A deliberately mangled 2020 Minnesota Senate historical result changes the *old* model but cannot move the *new* Minnesota race margin.
- 2026-map presidential source gaps/mismatches are rejected instead of substituted.
- Every polled Senate race's full modeled error reconciles to the national/chamber/state/local variance decomposition; no duplicated whole-error RMSE. Poll eligibility, stale-data handling, and symmetric error tiers are covered by direct tests.
- Every one of the 11 unpolled Solid races carries 7 points of **total**, not local-plus-shared, uncertainty, from source-dated public ratings; no polled race receives the rating guard.
- `node scripts/audit_senate_four_endings_reconciliation.cjs` separates the old poll blend, poll-priority-only revision, Solid no-poll guard-only revision, combined production revision, and an explicit independent-caucus-credit sensitivity. All five preserve the House outcome distribution exactly.
- Minnesota has a materially revised projected margin and probability while staying short of implausible near-certainty with a narrow D+3 polling lead.
- Democratic House and Senate chamber-control probabilities are still generated from the same simulation, not multiplied from independent distributions.

## What is *not* updated

`data/race_probabilities.json` remains the transparent **poll-only input** and legacy experimental uncertainty study, not the live joint election forecast. Replacing it with a model's own forecast would produce circular feedback. The website reads those polling inputs and computes the **new** race odds through the revised joint simulator, including the election-night board. Historical parser repair and the House geography alternative remain separately gated projects.

Recent polls, 2026-map electoral geography and the modern candidates drive this update, not pre-Trump electoral extrapolation. There is no publisher-derived Silver regression target or artificial boost to match Silver's Minnesota forecast.

## Why Silver's Democratic Senate odds can still be higher

Silver's proprietary model is an external diagnostic, not a calibration target. The public no-poll classification and restored late-cycle poll weighting address demonstrable input/modeling weaknesses but do **not** justify simply forcing our joint Democratic-control probability to match another forecast. Contested-race fundamentals, candidate-specific advantages not explained by state partisanship, the correct covariance of polling errors, and the caucus status of independently elected candidates require additional validation. The public ratings list must also be reviewed for any current-cycle changes; a date-stamped October 1 classification is not a permanent rating-feed substitute.
