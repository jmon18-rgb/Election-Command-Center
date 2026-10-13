# JackStradamus polling model · v1.4

As of October 13, 2026. **What the model currently produces:** poll averages for Senate, House, governor contests, and the national House generic ballot. These are **estimates of what polls are saying now**; they are not calibrated win probabilities or a forecast of seat control.

## What goes into an individual poll's weight

For an eligible survey, the published weight is:

`raw_weight = 2^(-age_days/21) × quality_factor × size_factor × sponsor_factor`

- **Recency:** 21-day exponential half-life, giving a survey from three weeks ago half the influence of an otherwise identical survey from today.
- **Pollster quality:** historical `numeric_grade` from the [FiveThirtyEight archived pollster-ratings dataset](https://github.com/fivethirtyeight/data/blob/master/pollster-ratings/pollster-ratings-combined.csv). It combines historical accuracy and transparency; it is **not** the latest January 2026 Silver Bulletin XLSX. This archive may be stale for firms that changed personnel or methods. A public JSON subset with manually reviewed firm-name aliases is pinned in `data/pollster_quality.json`. Unmatched firms receive neutral weight.
- **Shrinkage:** a rating from fewer than 20 historically evaluated polls is shrunk toward the neutral grade 2.0: `adjusted_grade = 2 + (grade-2)×min(1, historical_poll_count/20)`. Then `quality_factor = 1 + 0.25×(adjusted_grade-2)`. A fully established grade 3.0 gets a factor of 1.25; grade 1.0 gets 0.75. The coefficient is **provisional**, not yet fit to final election outcomes.
- **Sample size:** `size_factor = (clamp(n,300,2500)/800)^0.20`; small sub-300 and huge above-2,500 samples are capped. Unknown sample size = neutral factor 1.0. This intentionally imposes diminishing returns, without pretending that nominal sample size captures all poll design effects.
- **Partisan sponsorship:** `sponsor_factor=0.5` for either R or D sponsored polls (otherwise 1.0); applies symmetrically regardless of which party leads. A Republican-sponsored poll with a large Democratic lead is **included**, unless some separate professional-quality rule excludes it.
- **Professional-quality eligibility:** The currently released data excludes ActiVote, which Silver Bulletin said did not meet the scientific-survey standards for its January 2026 database. This is a judgment call that should be revisited as methodological evidence changes. Other unrated firms are **not automatically excluded**.

Within each contest, the model chooses the most widely polled named-candidate matchup (with a freshness tiebreak), then uses **one latest survey per polling firm** over the last 45 days. The upstream importer now retains up to **60 polls per race** (previously 12) over its 65-day source window to avoid arbitrarily dropping pollsters before weighting. That is still a rolling slice, not a historical record. It calculates weighted Democratic and Republican vote shares separately, then displays `D − R`.

For generic ballot, the window is 14 days when multiple firms are available; otherwise up to 30. The observation source is the NYT-derived ElectIndex data, retained in `data/polls.json` and updated by GitHub Actions.

## How we checked the weights

The live headline is still the v1.3 combination of recency, archived 538 quality, bounded sample size, and **symmetric 0.5 sponsored** weights. v1.4 expands input coverage and adds the following *nonprobabilistic* audit measures:

- **Effective pollsters** = `(sum of firm weights)^2 / sum(firm weight squared)`. It identifies weight concentration; it is NOT the number of respondents, the probability of a win, or a confidence estimate.
- **Weight sensitivity** = compare the live model to an equal-firm mean, an independent-firms-only weighted mean, and a faster 14-day recency weighting. The resulting range is a *sensitivity analysis*, NOT a 90% error bar.
- `scripts/validate_model_drilldown.py` independently reconstructs both the published headline and these diagnostics from source observations.

`scripts/test_polling_models.py` holds out **future independent polls**, not final election results. At the October 13 snapshot after expanding retention, there were 153 held-out observations across 31 independent race/matchup clusters:

| Trial setting | MAE on future independent poll margins |
|---|---:|
| Equal firm weight | 2.846 pts |
| Half-weight sponsored polls + 21-day recency | 2.844 pts |
| Plus historic 538 quality + bounded sample size (**live model**) | **2.837 pts** |
| Above + test-only sponsor-lean correction of 1.7 margin points | **2.799 pts** |
| Above + 14-day recency in place of 21-day (no sponsor correction) | 2.876 pts |

The 0.038-point apparent gain from applying Silver's disclosed ~1.7-point sponsor prior is **not reliable evidence of election accuracy**. All these values are from a narrow rolling 2026 dataset, and the pollster-cluster bootstrap ranges overlap widely. We have **not** enabled this house-effect correction in the live average. Nor does the project infer statistical confidence from poll-to-poll spread alone. Future method changes require historical election-result holdouts, signed systematic-error tests, and coherent chamber-level correlations.

The feed has only `end_date`, not publication timestamps. The daily briefing now records `first_seen_at` on genuinely new polls. That is the date **our scraper observed it**, not a verified release date; older legacy observations have unknown first-seen timestamps.

## Silver's methodology: what we adopted versus what remains

Read [How Silver Bulletin calculates polling averages](https://www.natesilver.net/p/silver-bulletin-polling-average-methodology) and [How FLIPR forecasts the 2026 midterms](https://www.natesilver.net/p/flipr-midterms-model-methodology).

**Already reflected here, in simplified independent code:** comprehensive professional survey inclusion, graded pollster quality, recency, diminishing size weight, a ceiling on repeat waves per pollster, explicit partisan survey handling.

**Not yet implemented (important):**
1. **Estimated signed pollster house effects**, including shrinkage toward a sponsor-specific prior. Silver describes a roughly 1.7-point prior favoring the sponsor; simply reducing a poll's *weight* isn't an actual bias correction. Correctly fitting house effects requires repeat surveys across races and time, independent consensus, and unbiased training targets.
2. **Likely-voter vs registered-voter correction** because the current source records do not retain reliable population flags.
3. **National timeline adjustment** for stale district/state polls as the generic ballot changes.
4. **LOWESS trend curves**, demographic correlations and state/district baseline partisanship.
5. **Fundamentals:** incumbency, candidate experience, fundraising, redistricting and quality; rigorously evaluated expert ratings.
6. **Correlated seat simulations and win-probability calibration** from complete historical elections and all seats rather than just polled contests.

FLIPR's code and parameters are proprietary; publicly described statistical methods can guide our independent implementation, but we must not describe JackStradamus as a reproduction of FLIPR.

## How to use Ettingermentum's analysis

[The Sept 2026 Senate ratings](https://www.ettingermentum.news/p/2026-senate-ratings-iran-makes-the) and [What to Expect From a Blue Tsunami](https://www.ettingermentum.news/p/what-to-expect-from-a-blue-tsunami) are useful qualitative outside assessments. We should keep Ettingermentum's race judgments in an **attributed analyst comparison**, alongside Silver and other forecasts, rather than quietly feeding an uncalibrated editorial label into the mathematical model. Different commentators often use the same polls and expert reports, so pretending independent opinions are independent measurements would overstate confidence.

## Current presentation

- **D +x** in blue, **R +x** in red, across the Senate cards, JackStradamus and Election Night.
- **🐑 HERDING?** reports simple inter-poll spread: a tight flock is observed agreement, **not evidence that firms coordinated**.
- Race drilldowns show individual polls, sponsor labels, archival quality ratings, and actual weights from the published model rather than a hand-computed approximation.
- The separate [SCENARIOS.md](SCENARIOS.md) describes the experimental national House popular-vote bands; they do not predict which party controls a chamber.

## Next accuracy milestones

1. Obtain and inspect [Silver Bulletin's published January 2026 ratings XLSX](https://www.natesilver.net/p/pollster-ratings-silver-bulletin), validate column mapping and firm aliases against the archived 538 dataset, and test newer predictive-plus-minus and mean-reverted bias scores before replacing the live source. That XLSX is available from its author, but has **not yet been ingested** by this repository. Never silently switch source.
2. Expand the 2026 poll source to contain sample population (LV, RV, adults), question wording and individual poll URLs.
3. Acquire full historic poll + actual race outcomes with pre-election timestamps to fit signed house effects, sponsorship bias and weights using leave-cycle-out evaluation.
4. Train a separately versioned **forecast** combining polling evidence and race fundamentals, with calibrated uncertainty and correlated outcomes. Only then attach percentages to candidates winning seats or either party controlling Congress.
