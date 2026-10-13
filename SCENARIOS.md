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

## Probabilities — not yet available

The old four percentages used a guessed 4-point standard deviation around the national generic ballot. Those percentages never estimated the outcomes listed above. They have been **removed**, not relabeled. Display "Not modeled" until the dataset and forecaster support real control-of-chambers draws.

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

## Interactive seat-math sandbox (October 13)

The site now has a deliberately **hypothetical calculator**, so the four scenario cards do something even before an empirical forecast is available. Selecting Red Dawn, Shrug, Blue Wave or Blue Tsunami loads an illustrative House Democratic seat total, Senate Democratic-caucusing seat total and hypothetical share of a *future frozen battleground slate* won by Democratic candidates. Three range controls recalculate the classification immediately. All these values are user-provided **what-if assumptions**, not model predictions, current seats or data-derived probabilities.

The illustrative rules assume **435 occupied voting House seats** (218 Democratic seats for control) and **100 Senate seats**. Senate Democrats/independents caucusing with them need **51** for outright control; a 50–50 tie is treated as Republican control given the Republican vice president in October 2026. The Blue Tsunami classification requires both Democratic majorities and the user-assumed **≥90%** share of an as-yet-unfrozen competitive-race list. That component is not an actual determination until the list is fixed and real outcomes exist.

In particular, do not label these sliders “odds,” “probabilities,” or “projections.” [QA_AUDIT.md](QA_AUDIT.md) explains the interactive tests and known limitations.
