# JackStradamus race-win probabilities: one source of truth

## Why Peggy Flanagan showed 72% while polling was D+3.3

The old source in `data/race_probabilities.json` computes a *standalone poll-only* two-party normal-CDF chance:

- 2026 Minnesota Senate polling average **D+3.28**, with local Senate historical polling-error scale **5.633 margin points**.
- Normal CDF of 3.28 / 5.633 ≈ **71.98% Democratic**. This is not the probability inferred by the full House/Senate simulator.
- The connected joint model, at 6,000 common-seed draws, uses the **poll + fundamentals** mean, plus shared national, Senate and state shocks, and the race's local variance. This produces a materially less confident probability (roughly low 60s, depending on snapshot and seed).
- Nate Silver's publicly available [2026 FLIPR methodology](https://www.natesilver.net/p/flipr-midterms-model-methodology) *explicitly* uses a three-point lead as an example: 88% under a **5-point margin-of-error scenario**, but only around **72%** when the assumed **margin of error is 10 points**. These are illustrative uncertainty settings, **not FLIPR's Minnesota race forecast**. Silver's published methodology does not provide a full table of proprietary race chances.

**A polling margin alone cannot establish a win chance.** Nor does a 72% number prove bias. The key issue is that there were two *different models* being labeled similarly. Only JackStradamus's joint simulation has any right to supply the site-wide race odds. The historical poll-only research calculations may be retained as an internal source for means and error-floor diagnostics, not shown as competing candidate probabilities.

## Implementation

- The JackStradamus individual-race board, race detail and Senate cards all take percentages from `ChamberControlModel.simulate().race_probabilities`, generated from the **same correlated draws** as the House, Senate and four-ending probabilities.
- The research-only poll-normal-CDF table is explicitly **not a headline odds forecast** and is not substituted if the real correlated simulation is unavailable or the data are stale.
- The user-visible odds header clarifies that this is a **correlated joint model**, not a standalone polling probability. Election-night third-party references no longer include the unnecessary DDHQ link.
- `scripts/audit_joint_race_odds.cjs` now explicitly compares every polled district's obsolete standalone odds with the joint probability, and prints the Minnesota case. It also checks error-width scenarios **by re-running the same full joint simulation** at 0.8×, 1× and 1.3× uncertainty, rather than falsely assigning different independent odds that cannot cohere with chamber control.
- GitHub CI rejects a missing Minnesota comparison, an unexpected race count, or any disappearance of the distinction between the old 72% and the current joint-model probability.

## Next modeling calibration priorities

1. Validate **2026 Senate, House, governor and generic-ballot polling recency/house effects** against observed cross-pollster disagreement and independent poll coverage.
2. Infer a separate **bottom-up national political environment** from 2026 House and Senate polls relative to 2024 geographic leans, then compare to the generic ballot before blending. Avoid treating all polled races as representative.
3. Measure joint-model **national, statewide and chamber-wide correlation** and tail behavior with recent election outcomes; incorporate heavy-tail scenarios where justified.
4. Model candidate-specific risks, third parties, and state election procedures: independent candidates, ranked-choice states, jungle elections, runoffs, special elections.
5. Increase simulations/variance reduction only after fixing data and structure. More Monte Carlo draws reduce sampling jitter but do not make wrong assumptions more accurate.

**The probabilities remain experimental**. No automatic party-specific correction or ad hoc Flanagan override was introduced. There is no evidence from the current poll margin alone to assert what Silver's individual Minnesota win chance is.
