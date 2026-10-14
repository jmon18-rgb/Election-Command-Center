# Senate win probabilities: ballot identity, projected margins, and uncertainty

**As of October 14, 2026.** This release corrects a verified ballot/caucus logic error in our *published* joint forecast and creates two separately switchable **research-only** Senate experiments. **Neither research coefficient is promoted merely to resemble Nate Silver's FLIPR.**

## Important ballot correction (published model)

Some data suppliers place an independent contender in a field called `dem_candidate` as the Republican's principal opponent. That is not evidence that the contender is a Democrat or would caucus with the Democrats. The previous Monte Carlo incorrectly awarded Democratic Senate control when these Independents won.

- **NE-SEN:** Dan Osborn (independent) vs Pete Ricketts (Republican). Source: [Nebraska Examiner, July 16](https://nebraskaexaminer.com/2026/07/16/nebraska-nonpartisan-us-senate-candidate-dan-osborn-qualifies-for-november-ballot/), [Oct 12 noncaucusing commitment](https://southdakotasearchlight.com/2026/10/12/independent-us-senate-candidates-from-plains-states-say-they-would-not-caucus-with-either-party/).
- **SD-SEN:** Brian Bengs (independent) vs Mike Rounds (Republican). Source: [South Dakota Searchlight, Oct 12](https://southdakotasearchlight.com/2026/10/12/independent-us-senate-candidates-from-plains-states-say-they-would-not-caucus-with-either-party/).
- **ID-SEN:** Todd Achilles (independent) vs Jim Risch (Republican). The Democratic nominee withdrew; Achilles says he will not caucus with either major party. Source: [Idaho Capital Sun, Oct 7](https://idahocapitalsun.com/2026/10/07/independent-us-senate-candidate-todd-achilles-says-he-wont-caucus-with-either-political-party/).
- **MT-SEN:** Alani Bankhead (D) remains in the race, and Seth Bodnar (I) is a major third contender. Our legacy two-party proxy ignores Bodnar, so its predicted vote share/win odds are explicitly flagged as **incomplete** rather than falsely representing a real three-way final-result simulation. [Washington Post, Oct 10](https://www.washingtonpost.com/politics/2026/10/10/montana-democrat-who-refuses-drop-out-may-spoil-partys-senate-hopes/).
- **AK-SEN:** Alaska uses **ranked-choice** voting, with several qualifying candidates (including candidates with similar surnames). The model's two-candidate head-to-head margin is only a proxy, **not** a simulated final RCV round. [Alaska Division of Elections](https://www.elections.alaska.gov/election-information/).

The first three races now report **I-versus-R**, not D-versus-R. Independent wins do **not** automatically increase Democratic caucus seats. The known candidates pledged no major-party caucus, but their future behavior cannot be guaranteed; use this as an evidence-based declared-intent baseline, not a law of nature.

### Why there is now a fifth mutually exclusive outcome

Where neither Democratic caucus members (minimum 51) nor Republican caucus members (at least 50 with a Republican vice president) can organize the Senate because independent contenders hold the balance, it is dishonest to classify the election as **Red Dawn**. These runs now belong to a separate **Independent Wildcard** bucket. The four named original categories remain intact for elections with ordinary Democratic or Republican Senate control. This fifth outcome is particularly relevant if Nebraska elects Osborn and control is otherwise closely divided.

The fifth outcome never overlaps the other four; *all five* probabilities sum to 100%. It is measured from the **same correlated draws** as the race-win estimates. The existing source uses a fixed count of 34 Democratic-caucus holdovers and 31 Republican-caucus holdovers, which remains a separately verifiable prerequisite.

## Why D+3.3 polling can have 62%, 72%, or 89% winning odds

A **polling margin is not a forecasted Election Day margin**. The joint model currently weights 2026 race polling 90% for a well-polled Senate race and blends the rest with provisional 2020 Senate/2024 House fundamentals. For Minnesota this produces about **D+2.6** from an actual poll average of **D+3.28**. The local model's *overall election-day error* is about **9.1 margin points** and produces low-60s odds for Flanagan.

The old **72%** number came from an unrelated standalone normal-CDF poll-only research file: it divided 3.28 by the historical Senate 5.633-point total RMSE. This older research output is **not** the linked JackStradamus individual race forecast.

The subscriber-provided Silver Bulletin screenshot (Deluxe forecast updated Oct 13) reports Flanagan **89.4%**, and its projected-margin plot appears appreciably more Democratic than the polling average. It therefore cannot be explained by applying a different win-probability curve to a fixed D+3.3 estimate alone. **Paid-subscriber full odds are not copied into this public repository.** External FLIPR outputs are an independent benchmark, not a calibration target. [Public methodology](https://www.natesilver.net/p/flipr-midterms-model-methodology) distinguishes polls, fundamentals and ratings and explicitly models national, demographic, state and local forecast errors.

## Identified double count in current Senate error model

The 42-race 2020/2022/2024 historical Senate retrospective sample produced a **5.633-point total polling error RMSE**, with:
- 2020: **6.911** RMSE; signed mean +5.375 (predicted D margin minus final D margin)
- 2022: **4.473** RMSE; signed mean −0.161
- 2024: **5.365** RMSE; signed mean +4.156

That RMSE **already includes correlated/yearwide misses**. The original Monte Carlo set the well-polled **local** noise floor to at least 7 points and **also added** national (3.5), Senate (3), and state (3.5) noise. This creates roughly 9.1 points of full uncertainty for well-polled races such as Minnesota—far wider than a 5.633-point *historical total*. The original floor was not independently calibrated.

The optional `historical_total_budget_shadow` instead assigns **provisional** common national SD 3.5, Senate SD 2.0 and state SD 2.0, and allocates only the **remaining historical total-variance budget** to local noise. For a well-polled race without a polling/fundamentals conflict, the joint full error SD is close to 5.633, not 9.1. Scarce, partisan or outdated polls still widen the forecast via their own error estimate; genuine poll/fundamentals disagreement adds uncertainty too.

These **components are not yet identified from just 42 polls across three national cycles**. The research option is a correction to the variance-accounting *logic*, not a proven prediction interval. Keep it as a shadow until joint error/tail coverage is backtested.

## Separate state partisan fundamentals experiment

The optional `presidential_2024_state_shadow` aggregates state-specific 2024 presidential D/R votes from our checked 435-district 2026-map dataset. It projects a 2026 congressional environment using the current generic ballot versus the national **two-party** presidential margin, with the existing 0.68 shift coefficient. It replaces the unverified Senate 2020 candidate/2024 state-House mean proxy **for the experimental Senate prior only**, with poll blending unchanged.

The extrapolation compares different electorates and ballots, and loses candidate-specific incumbency effects. It is **not a replacement for candidate fundamentals**. The two switches (state prior and error budgeting) can be combined or compared independently, with full joint simulation and chamber-control consistency.

## Likely voter (LV) adjustments must use actual 2026 evidence

Nate Silver's public FLIPR methodology adjusts RV/all-adult polls toward matched LV estimates. We can only fit a similar adjustment once we have verified same-survey LV/RV results; `scripts/audit_2026_likely_voter_pairs.cjs` assesses current `data/polls.json` population coverage and returns **no automatic adjustment** if there are fewer than ten valid same-survey comparisons. Unlabeled polls do not count as RV.

## How to test

```bash
node scripts/test_chamber_control_model.cjs
node scripts/audit_senate_probability_mechanics.cjs
node scripts/audit_2026_likely_voter_pairs.cjs
node scripts/test_dashboard_runtime.cjs
```

### Promotion and remaining work

1. **2026 current-data model:** improve likely-voter composition, sponsor/house effects, verified candidate ballots (especially **MT three-way**, **AK ranked-choice**) and state voter environment. No guesses from unlabeled samples.
2. **Historical joint prediction coverage:** validate shared national, demographic, state and race residuals, including worst-case joint Senate majority tails and systematic party misses. The old total RMSE is NOT a local SD.
3. **Senate candidate quality:** modern, separate Senate incumbency/approval/fundraising evidence, not 2022→2024 House regression coefficients applied to all races.
4. **Probability fidelity:** measure candidate-first and congressional chamber odds from identical draws; report election-day projected margin and **full** modeled uncertainty alongside win percentages.
5. **External benchmark:** compare with paid FLIPR **Lite / Classic / Deluxe** when the subscriber supplies screenshots, without copying proprietary complete datasets, and use differences as explanatory diagnostics rather than training objectives.

This is a personal experimental forecast and cannot be characterized as a calibrated probabilistic prediction until validated on independent, historically available inputs.
