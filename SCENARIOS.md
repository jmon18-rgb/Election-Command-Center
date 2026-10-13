# Election-night scenarios: model v0 (national House vote)

Published October 13, 2026.

The four probability bands in the daily briefing are a **first-pass, explicitly experimental** distribution over the **national Democratic minus Republican House popular-vote margin**, not over seats, chamber control, named race outcomes or national turnout.

## Input

- Center = JackStradamus's `generic_ballot.dem_minus_rep` (poll-mean-1.3), a recency-, capped-sample-, historical pollster quality- and sponsorship-weighted estimate of current generic congressional ballot preference.
- Uncertainty = **4.0 margin points** one standard deviation, selected as a conservative working spread for final national polling error and movement before Election Day. This is a *declared assumption*, not yet a fitted or backtested 2026-calibrated distribution.
- Prediction distribution: `election_day_national_margin ~ Normal(center, 4.0^2)`.
- This assumes no net partisan bias by default. Historical cycles have sometimes shown systematic pro-D polling error, which must be evaluated rather than mechanically assumed identical in 2026. The current model excludes adjustments for national vote-to-seat geographic effects, incumbency, special elections, turnout and demographic correlations.

## Four exhaustive, mutually exclusive bins

| Name | National two-party House vote margin (D minus R) |
|---|---|
| **RED DAWN** | Less than 0: Republican leads the national House popular vote |
| **THE SHRUG** | 0 up to 5: Democratic lead below five points |
| **BLUE WAVE** | 5 up to 10: Democratic lead of five to ten points |
| **BLUE TSUNAMI** | 10 or more: Democratic lead ten points or more |

Probabilities are normal CDF differences at boundaries 0, 5, 10. They sum to 100%. They are redone after each published model snapshot. The labels are editorial shorthand, not historical election classifications or an endorsement of either party.

## Why this is not an actual congressional-control forecast

- House **seats and chamber majority** depend on how national vote is distributed among all 435 districts, district boundaries, uncontested races, turnout, historical vote splits and race-specific candidate factors. A national D lead **does not guarantee** a House majority.
- Senate control depends on a much smaller set of separately elected races plus the holdover seats and tie-breaking rules; neither the generic ballot nor the names of these bands predicts Senate seats.
- County-level and demographic correlations can create fat tails. A normal distribution may understate extreme outcomes.
- A more serious version needs leave-one-election-year-out validation using actual historic generic-ballot snapshots available *before* those elections, not reconstructed from post-election information, plus a seat-level correlated model.

## Source context

- Nate Silver's [2026 FLIPR methodology](https://www.natesilver.net/p/flipr-midterms-model-methodology) uses polling, fundamentals, expert assessments and correlated simulation draws. The experimental band model here implements **none** of those seat-level forecast mechanics.
- [Silver Bulletin's polling average methodology](https://www.natesilver.net/p/silver-bulletin-polling-average-methodology) describes historical pollster ratings, diminishing size weights, house effects, adjustments for population type and sponsored polls.
- Historic generic-ballot averages have differed from final House popular votes by several points in both directions (e.g. 2018 and 2020). We still need a consistent in-repository dataset and backtest before moving away from the disclosed 4.0-point placeholder.

## Next version

1. Bring together authenticated historical GCB snapshots and final nationwide House two-party popular vote, across multiple cycles.
2. Fit drift, bias, variance and fat-tail behavior by time before Election Day, evaluate held-out election years.
3. Build a House prior for every district using contemporaneous boundaries, historical election results and incumbency, then translate correlated simulated margins to seats.
4. Simulate Senate races with their own fundamentals and correlated polling errors, plus holdover and caucus seats.
5. Only then show probabilities of House majority, Senate majority, both chambers, or sweep/landslide outcomes.

The site should never treat the v0 bin probabilities as certainty about control of Congress.
