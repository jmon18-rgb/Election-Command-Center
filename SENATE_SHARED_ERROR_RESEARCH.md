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
