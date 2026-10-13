# The four endings: control of Congress

Revised October 13, 2026.

These are **congressional-control outcomes**, not bins of the national popular vote. The earlier experimental normal-distribution bands (`R vote lead`, `D +0–5`, `D +5–10`, `D +10+`) answered the wrong question; they have been removed from the dashboard. A generic-ballot advantage does **not** establish House or Senate control.

## Mutually exclusive outcomes

| Label | Operational meaning |
|---|---|
| **RED DAWN** | Republicans control **both** the House and Senate. |
| **THE SHRUG** | Democrats control **exactly one** chamber: House only or Senate only. |
| **BLUE WAVE** | Democrats control **both** chambers, without satisfying the near-sweep test below. |
| **BLUE TSUNAMI** | Democrats control **both** chambers **and** win **at least 90%** of a predeclared slate of major competitive House and Senate races. |

The fourth is deliberately a **subset of the unqualified two-chamber Democratic outcome**. Applying Blue Tsunami first makes the categories mutually exclusive and collectively exhaustive **when chamber-control outcomes are fully resolved**. Chamber control should use seats/caucus organization and relevant tie-breaking rules, not simply poll leader party or a generic-ballot proxy. This classification is not an endorsement.

## Defining "major competitive races" before computing a tsunami

The slate must be frozen before Election Day from timestamped **external nonpartisan race ratings** (e.g. tossups and lean-category contests) with provenance and a documented cutoff. It must include both House and Senate and must not be revised after seeing results or dropped just because an outcome is inconvenient.

Proposed working cutoff: **90%** of the frozen slate's contests won by Democratic candidates; validate sensitivity to 85%, 90%, and 95%. This percentage is a descriptive scenario convention, **not** a statistical threshold inferred from the polling. A completed slate is required to classify the final outcome as a tsunami. If any critical race's result or chamber organization is unresolved, show **Pending**, not an invented category.

Do not use the currently *polled* set as the competitive universe. It disproportionately selects closely watched contests, and the available survey feed covers just a fraction of 435 House districts.

## A useful reach-race watch: South Carolina Senate

A near-sweep of a **frozen, competitive slate** is the operative Blue Tsunami definition. A single noncompetitive/likely-party-held seat flipping would not alone satisfy it. Nevertheless, outcomes outside the frozen battleground slate can be reported separately as an **outlier/reach-race indicator** showing the geographic breadth of actual results. This is descriptive, not a replacement for calibrated scenario probabilities.

For October 2026, a clear example is **South Carolina U.S. Senate — Darline Graham (R) vs. Annie Andrews (D)**, which [Cook Political Report classified Likely Republican](https://www.cookpolitical.com/senate/race/488671) as of its Sept. 23 race-page update and still listed in that category in its [Oct. 6 Senate ratings](https://www.cookpolitical.com/ratings/senate-race-ratings). The dashboard shows a source-dated research note rather than silently treating South Carolina as one of Cook's seven toss-ups. The outlier note does not change the frozen near-sweep rule.

A standalone probability for a South Carolina flip, or for the tsunami conditional on such a flip, would require a sourced calibrated **joint** distribution of state/district outcomes. Neither DDHQ's publicly reported joint chamber-control totals nor one state poll supplies that. Do not invent the split.

## Published joint control odds (external source; October 13 update)

The old four percentages used a guessed 4-point standard deviation around the national generic ballot. Those percentages never estimated congressional control. They are retired. **The site now uses Decision Desk HQ's publicly published, joint House/Senate 2026 outcome forecast** with explicit attribution. These are DDHQ model outputs, not calculated from JackStradamus polling averages.

At its October 13 publicly posted update, DDHQ reports **54% Democratic control of both**, **2% Democratic Senate / Republican House**, **22% Republican Senate / Democratic House**, and **21% Republican control of both**. The source-rounded 4 cells sum to 99%. Therefore the displayed outcomes are **Red Dawn 21%, The Shrug 24%, Blue Wave including any Tsunami 54%**, and **Blue Tsunami not separately estimated**. The blue-together odds are *not* the exclusive non-tsunami odds.

DDHQ does **not** publicly break its joint Democratic sweep probability into an ordinary wave and a near-clean sweep of battleground races. Blue Tsunami probability stays `null`, **not zero**. These are nested: `P(Blue Wave including Tsunami)=P(D House and D Senate)`, `P(Tsunami)≤P(D House and D Senate)`, and `P(Blue Wave excluding Tsunami)=P(D both)-P(Tsunami)`. The final two can't be assigned numerical probabilities until the conditional split is modeled. The site explains this clearly instead of presenting false four-way percentages.

Source: [DDHQ 2026 forecast](https://votes.decisiondeskhq.com/forecast/2026). `scripts/update_scenario_forecast.py` extracts exact *joint* probabilities and original provider updated date, rejects missing categories/implausible totals, and safely retains the last attributed snapshot if the page is unavailable. It runs in the every-four-hours pipeline. The source wall-clock timezone is unspecified. `data/congress_scenarios.json` is the source-attributed snapshot; `scripts/test_scenario_forecast.py` and dashboard DOM tests check it.

A future outcome simulation must jointly generate:

1. Votes for **every House district**, including unsurveyed districts, with a redistricting-aware baseline, incumbency, fundamentals, and national/regional correlations.
2. **Every Senate race on the ballot**, accounting for holdovers, third-party outcomes, independent caucus affiliation, and any ties.
3. Race results within a *predeclared* competitive slate for the blue-tsunami condition, all using the **same joint simulation draw**.
4. A chamber-control and scenario label for each complete draw, producing four probabilities that sum to 100%.

Before publishing probabilistic outputs, backtest on elections and snapshots not used for fitting; report proper scores, probability calibration, reliability curves, error dependence, and sensitivity to assumptions. Public outside forecasts can be linked as attributed external context, but must not be silently blended with primary polling.

## Why this distinction matters

A House popular-vote margin alone does not determine House seats. Senate control depends on holdovers and the specific election map, not the national generic ballot. Treating a predicted national margin as a chamber-control probability would exaggerate rigor precisely where this tracker most needs rigor.

## External methodological references

- [Silver/FLIPR methods](https://www.natesilver.net/p/flipr-midterms-model-methodology)
- [Ettingermentum — Blue Tsunami discussion](https://www.ettingermentum.news/p/what-to-expect-from-a-blue-tsunami)

These references inform the design; this site is an independent project, **not** their model.

## Retired: hypothetical seat-math sandbox

The former hypothetical calculator has been replaced by source-attributed DDHQ joint chamber-control probabilities. It no longer has seat-total sliders or user-input scenario presets. The original calculation rules are preserved here as historical background only.

The illustrative rules assume **435 occupied voting House seats** (218 Democratic seats for control) and **100 Senate seats**. Senate Democrats/independents caucusing with them need **51** for outright control; a 50–50 tie is treated as Republican control given the Republican vice president in October 2026. The Blue Tsunami classification requires both Democratic majorities and the user-assumed **≥90%** share of an as-yet-unfrozen competitive-race list. That component is not an actual determination until the list is fixed and real outcomes exist.

The discarded sliders did not provide empirical odds. Source-attributed DDHQ figures now do, but must not be represented as a fully calibrated, internally developed JackStradamus forecast. [QA_AUDIT.md](QA_AUDIT.md) explains the tests and limitations.

## Next step: separating ordinary Blue Wave from Tsunami

Use the same complete joint House and Senate simulations, with a timestamp-frozen external competitive House/Senate race slate. For each draw: classify exact congressional control, and among Democratic two-chamber wins test whether Democrats win at least 90% of the frozen slate. This creates **four disjoint simulated outcome counts**, not a guessed conditional percentage from independent marginals. Independently check any race probability inputs, simulate correlated national/regional errors, and demonstrate historical calibration before calling those probabilities "JackStradamus." An exact value may differ substantially from a casual assumption about the likelihood of a landslide.
