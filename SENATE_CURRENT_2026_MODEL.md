# 2026 Senate forecast: current candidates and current polls

**October 14, 2026 — active on the JackStradamus page after this pull request is merged.**

The old joint simulator was **not** a good Senate candidate model: it recycled the 2020 Senate winner's result (65% of the historical baseline), added an imperfect statewide 2024 House vote aggregate (35%), then discounted that with current polls at a fixed 78%/90%. In the 2026 Minnesota open-seat contest, that silently carried Tina Smith's 2020 result into a Peggy Flanagan–Michele Tafoya race. Worse, Minnesota's 2024 House vote aggregate contains a known missing-party-label error. Neither old candidate nor broken House source belongs in a 2026 Senate matchup prior.

## New live model

The web app explicitly requests `ChamberControlModel.prepare(sources,{senatePriorMode:'current_2026'})`. It requires 435 validated presidential vote rows on **2026** congressional district geography. It aggregates 2024 actual two-party presidential votes by state and compares the national presidential margin with the **current 2026 generic congressional ballot**. The raw difference between those incomparable office questions is deliberately multiplied by 0.55 as a conservative provisional national environment transfer.

The current Senate candidate-neutral prior equals:

`state_2024_presidential_two_party_DminusR + 0.55*(generic_2026_DminusR - national_2024_presidential_two_party_DminusR)`

In Senate races with qualified polls, the actual **named 2026 candidates** determine the forecast's primary data signal:

`current_race_margin = w*latest_2026_candidate_poll_margin + (1-w)*candidate_neutral_prior`

where `w=0.75` for 3+ independent polling firms, `w=0.72` for 2, `w=0.60` otherwise. Individual candidate or campaign advantage is **not guessed**; the difference between the named-matchup polling and neutral state baseline is reported separately as a contemporaneous observed candidate/campaign residual. It is neither a causal candidate-quality statistic nor a historical personal-incumbency bonus.

The poll uncertainty now uses a declared total-race margin error floor of **8.5 points**. Before injecting simulated national + Senate-chamber + state shocks, that shared variance is subtracted from the total budget so it is **not counted twice**. This is more coherent than the legacy local 7-point floor *plus* shared shocks (at least 9.08 points total for Minnesota). These coefficients and the national environment transfer remain provisional: they have not been calibrated against independent 2026 election results. The paid Silver exports were **not** used as regression targets, model coefficients, or public data.

If the verified 2026-map presidential source is missing, the new mode **fails closed** instead of falling back silently to a stale 2020 candidate assumption. All races use exactly the same correlated House/Senate/50-state shock draws, so revised race odds flow into the live Senate chamber-control and four-endings probabilities.

## Regression safeguards

Run `node scripts/test_senate_current_candidate.cjs` (or `--json`). CI proves:

- The 435 House district priors, the governor priors, **every individual House and governor race probability**, and the entire House-control probability are bit-for-bit identical to the existing model.
- All 35 Senate races return candidate-aware current 2026 modeled margins; polled races use contemporaneous named candidate surveys; and the prior's 2020 historical Senate candidate is excluded from the modern means.
- A deliberately mangled 2020 Minnesota Senate historical result changes the *old* model but cannot move the *new* Minnesota race margin.
- 2026-map presidential source gaps/mismatches are rejected instead of substituted.
- Every polled Senate race's full modeled error reconciles to the national/chamber/state/local variance decomposition; no duplicated whole-error RMSE.
- Minnesota has a materially revised projected margin and probability while staying short of implausible near-certainty with a narrow D+3 polling lead.
- Democratic House and Senate chamber-control probabilities are still generated from the same simulation, not multiplied from independent distributions.

## What is *not* updated

`data/race_probabilities.json` remains the transparent **poll-only input** and legacy experimental uncertainty study, not the live joint election forecast. Replacing it with a model's own forecast would produce circular feedback. The website reads those polling inputs and computes the **new** race odds through the revised joint simulator, including the election-night board. Historical parser repair and the House geography alternative remain separately gated projects.

Recent polls, 2026-map electoral geography and the modern candidates drive this update, not pre-Trump electoral extrapolation. There is no publisher-derived Silver regression target or artificial boost to match Silver's Minnesota forecast.
