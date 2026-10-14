# Why might JackStradamus disagree with Silver on control of both chambers?

**October 14, 2026 — reproducible attribution, no probability override.**

Use `node scripts/audit_joint_control_gap.cjs` from the repository root to print a concise comparison, or `--json` for the underlying race-by-race diagnostic. CI runs the same audit and rejects inconsistent probabilities.

A fairly close match in several Senate race win probabilities does **not** imply close agreement on the probability of Democratic control of **both** chambers. Three distinct inputs determine that joint event:

1. **Chamber means / pivotal races.** One extra Democratic win is enough in a subset of simulated Senates; the model begins with 34 Democratic-aligned Senate holdovers and assumes Democrats need 51 total seats under Republican vice-presidential tie-breaking. An apparently minor difference in a few competitive races can materially change the chance of reaching 17 elected Democratic senators.
2. **House prior geography.** The headline currently uses 2024 House votes in unchanged districts and exchangeable state proxies across 173 redrawn districts. The alternate research model uses geographically mapped 2024 presidential votes for the actual 2026 districts. This can change House control while leaving *all Senate race means unchanged*.
3. **Cross-chamber uncertainty and correlation.** An entire national electorate polling miss moves Senate and House outcomes together; the relevant comparison is the probability of the **intersection**, not the product of two independent chamber percentages.

## Six explicitly non-promoted comparisons

The script runs 6,000 seeded same-draw joint elections for each case:

| Case | Changes | What it isolates |
|---|---|---|
| Current headline | None | Existing experimental 2026 published engine |
| House 2026-map presidential shadow | House means and prior variances | Modern 2026 geography instead of 2024 House-vote proxy |
| Senate unshrunk-polls shadow | Polled Senate race means only | How much 2020/state priors pull today's polls |
| Both fundamentals shadows | Both prior counterfactuals | Their joint interaction |
| Remove national common error | Redistribute national variance into local residuals | Less cross-chamber covariance, **identical standalone error variance for every race** |
| Stronger national common error | Shift local variance into the national factor | Greater covariance, **identical standalone error variance for every race** |

The shared-error counterfactuals preserve `local_sigma² + common_national_sigma²` per contest, with all other chamber/state components fixed. Tests verify that identity numerically. Correlation changes may alter joint control even when all individual race variances remain constant.

The report also displays the **actual** same-simulation House-only and Senate-only outcomes, conditional probabilities, the covariance/phi of House and Senate control, the independent-chamber product **as a labeled counterfactual reference**, and two different Senate diagnostics: arithmetic one-seat pivots at the majority threshold, and **control bellwethers ranked by same-draw covariance** between the race outcome and Senate control. The latter prevents safe Democratic seats from dominating a supposedly competitive-race watchlist. An arithmetic pivotal race is one whose result alone could flip a chamber with every other result held fixed in that draw. Bellwether covariance scores measure how informative observed race wins are about Senate control, factoring in outcome uncertainty and common national shocks. **Neither** is the causal influence of a candidate or a forecast of campaign spending impact.

## How to act on the findings

- If the **House geography shadow** drives a large difference, prioritize a modern-cycle held-out validation of district fundamentals and the national generic-ballot conversion. Don't just substitute Silver's control probability or flip House priors without a backtest.
- If the **Senate polls-only shadow** drives a large difference, check candidate-specific strength, the actual incumbent and 2026 polling quality. Avoid substituting stale 2020 regular-seat results for 2026 specials.
- If the **correlation-only cases** drive the difference, calibrate shared national/state/region/demographic error using non-leaking 2022 and 2024 historical forecast snapshots. Joint forecasts are especially sensitive to shared errors; tuning total sigma alone confounds separate effects.
- When the Senate is the limiting chamber, review **Senate control pivots** rather than obsessing over a safely Democratic House race.
- Benchmark against clearly dated, comparable third-party race and chamber outcomes **as independent diagnostics only**. Do not reproduce a paid model's proprietary data or manipulate our forecast to match the benchmark.

**Important caveat:** the snapshot has 60 qualified House matchups out of 435 and 24 Senate matchups out of 35. The 6,000 simulation draws reduce Monte Carlo sampling noise, **not** uncertainty about the model's structural assumptions or historical calibration. The central website probabilities are **unchanged** by this audit. Race-winning odds still come solely from the same joint simulations as congressional-control odds.

Core files: `scripts/chamber_control_model.js`, `scripts/test_chamber_control_model.cjs`, `scripts/audit_joint_control_gap.cjs`.

Background: [Silver FLIPR methodology](https://www.natesilver.net/p/flipr-midterms-model-methodology) discusses polls, fundamentals, macro error, statewide effects, geographic/demographic correlation, and fat tails; its implementation is independent of this original research model.
