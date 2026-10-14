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

The poll uncertainty now uses a declared total-race margin error floor of **8.5 points**. Before injecting simulated national + Senate-chamber + state shocks, that shared variance is subtracted from the total budget so it is **not counted twice**. This is more coherent than the legacy local 7-point floor *plus* shared shocks (at least 9.08 points total for Minnesota). These coefficients and the national environment transfer remain provisional: they have not been calibrated against independent 2026 election results. The paid Silver exports were **not** used as regression targets, model coefficients, or public data.

If the verified 2026-map presidential source is missing, the new mode **fails closed** instead of falling back silently to a stale 2020 candidate assumption. All races use exactly the same correlated House/Senate/50-state shock draws, so revised race odds flow into the live Senate chamber-control and four-endings probabilities.

## Regression safeguards

Run `node scripts/test_senate_current_candidate.cjs` (or `--json`). CI proves:

- The 435 House district priors, the governor priors, **every individual House and governor race probability**, and the entire House-control probability are bit-for-bit identical to the existing model.
- All 35 Senate races return candidate-aware current 2026 modeled margins; polled races use contemporaneous named candidate surveys; and the prior's 2020 historical Senate candidate is excluded from the modern means.
- A deliberately mangled 2020 Minnesota Senate historical result changes the *old* model but cannot move the *new* Minnesota race margin.
- 2026-map presidential source gaps/mismatches are rejected instead of substituted.
- Every polled Senate race's full modeled error reconciles to the national/chamber/state/local variance decomposition; no duplicated whole-error RMSE.
- Every one of the 11 unpolled Solid races carries 7 points of **total**, not local-plus-shared, uncertainty, from source-dated public ratings; no polled race receives the rating guard.
- `node scripts/audit_senate_four_endings_reconciliation.cjs` separates the old poll blend, poll-priority-only revision, Solid no-poll guard-only revision, combined production revision, and an explicit independent-caucus-credit sensitivity. All five preserve the House outcome distribution exactly.
- Minnesota has a materially revised projected margin and probability while staying short of implausible near-certainty with a narrow D+3 polling lead.
- Democratic House and Senate chamber-control probabilities are still generated from the same simulation, not multiplied from independent distributions.

## What is *not* updated

`data/race_probabilities.json` remains the transparent **poll-only input** and legacy experimental uncertainty study, not the live joint election forecast. Replacing it with a model's own forecast would produce circular feedback. The website reads those polling inputs and computes the **new** race odds through the revised joint simulator, including the election-night board. Historical parser repair and the House geography alternative remain separately gated projects.

Recent polls, 2026-map electoral geography and the modern candidates drive this update, not pre-Trump electoral extrapolation. There is no publisher-derived Silver regression target or artificial boost to match Silver's Minnesota forecast.

## Why Silver's Democratic Senate odds can still be higher

Silver's proprietary model is an external diagnostic, not a calibration target. The public no-poll classification and restored late-cycle poll weighting address demonstrable input/modeling weaknesses but do **not** justify simply forcing our joint Democratic-control probability to match another forecast. Contested-race fundamentals, candidate-specific advantages not explained by state partisanship, the correct covariance of polling errors, and the caucus status of independently elected candidates require additional validation. The public ratings list must also be reviewed for any current-cycle changes; a date-stamped October 1 classification is not a permanent rating-feed substitute.
