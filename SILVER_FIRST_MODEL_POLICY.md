# JackStradamus forecast philosophy: Silver first, Jack at the margins

**Target:** approximately **90% Silver-style methodology and 10% independently tested JackStradamus experimentation**. This describes design priorities, **not** literal weights in a regression or an attempt to reproduce Nate Silver's proprietary code or paywalled outputs.

Primary publicly available methodological reference: Nate Silver, [How FLIPR forecasts the midterm elections](https://www.natesilver.net/p/flipr-midterms-model-methodology) (August 11, 2026). Our implementation and code must remain original.

## Architecture target

1. **Polling layer ("Lite")** — publish-date and fieldwork-date distinct; sample size; pollster historical accuracy and transparent sponsored/internal priors; likely-voter comparability; pollster house effects; drift/timeline correction; avoid duplicating firms or polls across releases. Polling in comparable races informs thinly-polled races, but only after verifying district geography. Display coverage and adjustment explanations.
2. **Polling + fundamentals ("Classic")** — a national environment based on both generic ballot and bottom-up race information; geography-correct partisan leans; incumbency, fundraising, candidate experience and documented scandals where available; simple and candidate-level fundamentals remain separate, with provenance. Current 2024 House margin and 2020 Senate priors are *temporary weak proxies*, not calibrated fancy fundamentals.
3. **Small expert-rating adjustment ("Deluxe")** — Cook/Inside Elections/Sabato rating evidence is translated and de-biased against the national environment before small race-level adjustments. A rating may only enter when licensed/available and source-date verified; missing ratings stay missing. Never treat ratings as a substitute for national polling.
4. **Joint simulation** — national drift, common Election Day error, statewide common error, correlated regional/demographic misses, and residual local error are separate components. Independents, runoffs, and ranked-choice voting require dedicated logic, not an unqualified two-party shortcut. Historical-cycle holdouts choose final error scales.
5. **Auditability** — distinguish *polling average*, *current estimated margin*, *Election Day projection*, *win probability*, and *chamber control* at every data boundary.

All modes remain **EXPERIMENTAL/UNCALIBRATED** until real retrospective historical election-outcome validation succeeds. Do not describe the current beta as FLIPR Lite, Classic or Deluxe: these are reference *layers to build* rather than capabilities we have already completed.

## A Jack departure must earn its keep

A change may depart from Silver-style defaults when there is a clearly stated reason: a new polling-methodology adaptation, recent rather than ancient pollster performance, a defensible 2026 electorate effect, source-specific reporting, or election-night vote-count evidence.

For every departure: record the hypothesis, version, cited source and forecast effect; run a **shadow model** in parallel; backtest out-of-sample where feasible; compare Brier/log scores and proper error metrics; and revert if calibration deteriorates. No manually imposing a Democratic or Republican correction simply to make the numbers bolder.

One reasonable Jack-specific difference is a more aggressive *scenario display* or election-night nowcast using actual reported voting data. It is **not** permission to turn a larger D lead into a higher win probability without data.

## First implemented improvement: polling-vs-fundamentals disagreement

The joint-control beta now computes a **transparent additional uncertainty term** in races whose locally informative historical proxy disagrees sharply with 2026 polling.

```
excess_gap = max(0, abs(poll_margin - fundamentals_proxy_margin) - 6)
extra_sigma = min(6, excess_gap * 0.35 * prior_quality)
effective_sigma = hypot(original_local_sigma, extra_sigma)
```

The margin **mean does not shift**. The rule is symmetric between Democrats and Republicans. We use prior-quality multipliers of 0.65 for unchanged competitive House districts, 0.15 for unchanged single-party House proxy, 0.55 for comparable regular Senate historical seats, 0.20 for weaker regular Senate state proxies and **zero for changed-geometry House districts and Senate specials**. Those last two priors are not comparable race observations.

These values are **provisional engineering assumptions**, not FLIPR coefficients, not historical estimates and not yet defensible probability calibration. Their purpose is to expose the consequences of conflicting indicators without hiding the conflict. The diagnostic fields are `poll_fundamentals_gap_points`, `poll_weight` and `disagreement_extra_sigma_points`.

## Work still needed before promotion

- Calibrate the gap deadzone/slope, poll weights and pollster corrections with held-out historical elections instead of tuning toward FLIPR outputs.
- Acquire geography-correct 2024 presidential district leans and national 2020/2024 presidential voting benchmarks where reliably sourced.
- Add incumbent/open-seat fundamentals and verifiable FEC fundraising inputs.
- Fit historical national/state/region/race covariance and validate seat-count distribution tails.
- Validate non-major-party candidates and ballot mechanics, especially Nebraska independents and Maine/Alaska ranked-choice races.
- Surface baseline Silver-style, Jack experimental and independent external forecast comparisons with dates and reasons for differences, without silently importing external probabilities into our own.
