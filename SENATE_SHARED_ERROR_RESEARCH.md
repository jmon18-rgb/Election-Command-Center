# Shared Senate forecast errors: empirical cycle audit and correlated control odds

**October 14, 2026. RESEARCH ONLY.** This step does not change the default national/Senate/state error coefficients, any 2026 individual race mean, or the published JackStradamus probabilities. It makes one of the least supported assumptions in our full-chamber forecast inspectable, and tests which Senate-control conclusions are robust to it.

## What is currently assumed?

In each Monte Carlo draw, the 2026 model shares a national shock of **3.5 margin points (sigma)** across House, Senate and governor contests and another **3.0 margin points** across all Senate races. Thus two Senate elections in different states have **sqrt(3.5² + 3.0²) = 4.61 points** of shared common-mode variation. A 3.5-point state component is also present but is not shared between Senate contests in *different* states, except in simultaneous races in the same state. Each race's remaining local residual is calculated from its own whole-race sigma so that correlated errors are not counted twice.

This decomposition was never estimated from a multi-decade historical covariance series. The total race uncertainty is currently more historically grounded than the **allocation** of that uncertainty to countrywide versus locally independent error.

## What do the historical polls say?

`data/historical_senate_horizon_backtest.json` contains assembled 2020, 2022, and 2024 polls by **fieldwork end date**, not verified original publication date. For races with at least two independent polling firms, estimate the per-cycle average (`poll_margin - final_margin`) and the within-cycle SD. Approximate common-mode uncertainty is calculated as:

`sqrt(max(0, sample_variance(three cycle means) - mean(within_cycle_variance / n_races)))`

The 20-day window shows:

| Cycle | Eligible races | Mean historical poll error (D−R) |
|---|---:|---:|
| 2020 | 13 | +5.715 |
| 2022 | 13 | +0.246 |
| 2024 | 15 | +3.667 |

The very rough common-error sigma is around **2.57 points at 20 days** (and approximately 2.3–3.0 across 30/20/14/10/7-day horizons). The actual candidate-specific baseline error may contain systematic biases and compositional selection. Three cycles are **far too few to estimate cross-state correlations** accurately: these results do not prove 4.61 is objectively wrong or imply 2.57 is the unique true 2026 value.

## Transparent variance-conserving scenarios

The option `ChamberControlModel.simulate(basis,{senateCorrelationResearch:{nationalScale,chamberScale}})` **never runs in the default production forecast**. It rescales only the Senate version of those two shared shocks; House/governor use the original shocks. For every Senate race, the simulator adds the variance removed from the common components *back into that race's independent local residual*:

`local_sigma_research² = local_sigma_original² + national_sigma² * (1 - nationalScale²) + senateChamber_sigma² * (1 - chamberScale²)`

This preserves the original total sigma, expected race margin, assumed risk of surprise for each individual race, and (up to Monte Carlo noise) all Senate race win probabilities. No extra RNG calls are made. The national swing **mean** control is never rescaled. The same draws are used for both control outcome and individual race odds. House/governor probabilities remain exactly unchanged.

A new disclosure under the site's **Four Endings** cards compares three cases, only on user expansion:

- **Production**: scales `(1.00, 1.00)`; shared Senate cross-state sigma **4.61**.
- **Moderate research**: scales `(0.80, 0.65)`; shared sigma **3.41**.
- **Lower research**: scales `(0.65, 0.55)`; shared sigma **2.81**.

These cases are **sensitivity scenarios, not independently validated forecasts or alternate odds to select from**. They expose how Senate-control probability could change when several competitive races are less correlated than originally assumed, without manufacturing candidate confidence. Correlation sensitivity is disabled during a vote-informed election-night model to avoid mixing research assumptions with actual returns.

## Regression gates

Run `node scripts/audit_senate_correlated_error.cjs` or `--json`, and `node scripts/test_dashboard_runtime.cjs` (requires jsdom). The audit requires three historical cycles, deterministic same-draw comparisons, *exactly identical House and governor race odds*, *identical expected Senate margin and total error sigma for every race*, sufficiently similar simulated individual race win probabilities, and coherent control probabilities. It forbids silently activating the research case as the model default.

**Next empirical prerequisite for promoting any new common-error coefficient**: obtain at least several additional comparable modern Senate election cycles (2018 is useful; pre-Trump history should be downweighted), usable as-published poll dates, verified individual candidate fundamentals, and cross-cycle held-out scoring of **joint** Senate-control outcomes rather than fitting coefficients to another forecaster's published percentages. Even that will yield a wide interval because there is just one Senate chamber outcome per cycle. Until then, leave the published covariance unchanged and display the uncertainty.

**Subscriber privacy**: Silver's private CSVs remain user-local browser inputs and are never included in this research script or published historical file. On an opted-in device, the displayed research sensitivities use that device's *active locally augmented* Senate means; nothing is uploaded.


## October 14 extension: independently reconstructed 2018 midterm

The original three-cycle fieldwork study and every live `data/senate_history_2020_2022_2024.json` record remain unchanged. The separate `data/historical_senate_2018_extension.json` contains 35 MIT-derived statewide 2018 contest results (33 states), reconstructed from a historical MIT-format dataset copy archived in a public third-party GitHub repository; its source blob is pinned. **The canonical MIT original was not independently hash-matched with the mirror**, so this research extension must not become a production candidate-history input without further provenance verification. The derived 2018 fieldwork snapshots are in `data/historical_senate_2018_horizon_backtest.json`; **no raw third-party polling rows are committed**.

The exact same 45-day poll lookback, **latest observation per independent firm**, recency half-life of 21 days, minimum two firms, no poll beyond the cutoff, and two-party denominator are reused via `research_senate_horizon_backtest.py`. States with two simultaneous Senate races (**MN and MS**) are excluded entirely rather than falsely merging their overlapping RCP poll questions. Unusual non-D/R comparisons such as California's two Democrats, Maine's independent incumbent, and Vermont's independent incumbent are likewise excluded.

At **20 days** before the election, 2018 adds **19 eligible race snapshots**, bringing the comparison to **60 races in four cycles** (2018: 19, 2020: 13, 2022: 13, 2024: 15). At **seven days**, 2018 adds **21** (63 across four cycles). In 2018, the 20-day poll-minus-result mean was approximately **+2.826 D points**, with whole-race RMSE **6.272 points**, and seven-day bias approximately **+1.349 D**. The 20-day nominal 90% margin coverage on that 2018 sample is **89.5% at 6.5 sigma**, versus 100% at 7.5 sigma. This is another reason to retain source-quality and model-misspecification safeguards rather than shrinking every race's uncertainty.

With all four cycles, a basic *between-cycle-average minus within-cycle sampling-variance* estimate of a common Senate polling-error sigma is approximately **1.98 points at 20 days**, versus approximately 2.57 from the previous three-cycle study and **4.61** from the production shared national-plus-Senate-chamber shocks. **This does not identify a unique true correlation.** It ignores source-selection bias, candidate-fundamentals error, shared House/Senate measurement issues, and the uncertainty in only four observations.

### Out-of-cycle covariance scenario scoring

The enlarged audit now compares the same **fixed three shared-volatility scenarios** with **leave-one-election-cycle-out predictive density of each cycle's mean polling error**. For each held-out cycle, poll bias and within-cycle dispersion are estimated using *only the other three cycles*, with the cohort size and 2018 eligibility determined separately. No cycle is allowed to tune its own predictive width. Lower negative log density is better.

| Scenario | Shared sigma in 2026 model | Mean held-out score at 20 days | At seven days |
|---|---:|---:|---:|
| Current production covariance | 4.61 pts | 2.627 | 2.666 |
| Moderate reduction (research) | 3.41 pts | 2.459 | 2.528 |
| Lower reduction (research) | 2.81 pts | 2.393 | 2.490 |

All four-cycle cases favor a lower shared-volatility assumption on this **specific proxy scoring method**, but it is **not** a replay of 2018/20/22/24 Senate **control** outcomes, not a validation of 2026 candidate strengths, and cannot separate the national shock from Senate-only partisan error. In particular, heldout 2022 and 2020 sometimes score worse at the lower sigma, even when the pooled four-year score improves. The four samples are not enough to support a precise Bayesian posterior over the covariance coefficient. **No coefficient has been promoted to production, and the current JackStradamus win probabilities remain unchanged.**

To reproduce: `python3 scripts/test_senate_2018_extension.py`, `python3 scripts/research_senate_2018_extension.py --verify` (downloads the immutable, SHA1-blob-pinned source), and `node scripts/audit_senate_correlated_error.cjs`. The 2018 reports are **separate** and must not be used by 2026 public `prepare()`.

