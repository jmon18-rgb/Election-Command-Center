# Two-cycle House fundamentals shadow (research, not production)

## What changed

JackStradamus already has **2024 recorded House votes**, Census-verified 2026 district boundary comparisons, and **2022 historical election votes**. This PR connects a strictly qualified subset to an optional House fundamentals **shadow** — and displays the resulting joint House/Senate odds next to, but never in place of, the main beta.

Only the **191 / 435** House districts with verified unchanged maps in both **2022→2024** and **2024→2026**, AND D/R recorded vote shares in BOTH past elections, qualify. The 244 other districts are untouched, including **all states with 2026 redrawn House maps**.

## Construction

All margins are 100 × (D votes − R votes)/(D votes + R votes).

1. For the 191 qualified districts, calculate each district's 2022→2024 change in the Democratic two-party margin.
2. Take the **median** change across the same 191 districts as the paired-sample *national-environment proxy*. Do **not** assume it is the actual national House popular-vote swing.
3. For each qualified district, project its 2022 margin to the 2024 environment by adding that paired-sample median shift.
4. Compute the difference between this 2022-derived 2024 proxy and that district's **observed** 2024 margin.
5. Winsorize the difference to ±12 points, and add only **25%** of it to the district's 2024 fundamental baseline, i.e. at most ±3 margin points.
6. Apply the existing 2026 generic-ballot swing and poll-blend rules; a well-polled race has less exposure to the additional historical signal.

The baseline House 2024-only model remains the default. The shadow changes only the fundamentals calculation for eligible House districts. The Senate, governors, seat geography, polling data, simulated error scales, and election-night live inputs remain unchanged.

## Important limits

This **does not validate 2026 odds**. The 2022 and 2024 elections have different candidates, incumbency, turnout and issue environments. The paired sample disproportionately consists of stable-boundary contested seats. A single paired comparison cannot determine historical optimal weights, reveal a reliable trend, or prove that the 2022 signal makes the 2026 forecast more accurate. A large 2022→2024 candidate-specific margin swing can be real; winsorization is deliberately protective, not an estimate.

The **0.25 signal weight**, **12-point cap** and **paired median environment adjustment** are provisional. The default and shadow are both marked experimental. The resulting shadow percentage is a *sensitivity*, not a second independent calibrated forecast, a confidence interval, or an authorized substitute for FLIPR.

## Run and inspect

```sh
node scripts/test_chamber_control_model.cjs
node scripts/audit_two_cycle_fundamentals.cjs
node scripts/audit_two_cycle_fundamentals.cjs --json
node scripts/test_dashboard_runtime.cjs
```

The audit prints baseline and shadow same-seed joint congressional simulations plus changes in each House district's expected margin. GitHub Actions runs the deterministic tests. The browser exposes the comparison behind a collapsed disclosure on both the home and election-night joint-control cards.

## Next milestone

Backtest this and several alternative fundamentals specifications on at least three historical election cycles with comparable, historical-as-of-date inputs, adding **partisan presidential district lean** and candidate incumbency first. Evaluate *held-out* House margin error, proper win-probability scores, and House seat-count tail coverage before making this the main forecast.

Primary inspiration: [Silver Bulletin FLIPR methodology](https://www.natesilver.net/p/flipr-midterms-model-methodology); the implementation and coefficients are original and not claimed as Silver's proprietary weights.
