# The four endings — JackStradamus joint-control beta

Updated October 14, 2026. **Experimental sensitivity model, not a historically calibrated forecast.** The data pipeline and live results are real; the probabilities depend on several unvalidated baseline assumptions. The joint probabilities are authored by this project and are **not** DDHQ numbers.

## Exactly four exclusive outcomes

| Label | Operational classification in every Monte Carlo draw |
|---|---|
| **Blue Tsunami** | Democratic control of both chambers **and** Democratic wins in at least **18 of 20** fixed battleground races |
| **Blue Wave** | Democratic control of both chambers, **but not** the Blue Tsunami threshold |
| **Shrug** | Exactly one chamber controlled by Democrats |
| **Red Dawn** | Republicans control both chambers |

These four categories exhaust the simulated chamber-control outcomes; the total is approximately 100%, subject only to display rounding. **Blue Wave excluding Tsunami** is deliberately distinct from the aggregate both-Democratic probability, reported separately for comparison. A Senate tie is treated as Republican control under the pre-election vice-presidential tie-breaking assumption. The Senate model assumes 34 Democrats or aligned independents and 31 Republicans in uncontested holdover seats based on the July 14, 2026 caucus reference, not a newly verified November 3 Senate roster.

## Frozen 20-race battleground slate (beta definition)

The slate is fixed in `scripts/chamber_control_model.js` before Election Day. It is a transparent **internal provisional selection**, including statewide and district contests with current model attention; it is **not represented as independently verified Cook/Sabato 2026 tossup/lean ratings**. A rigorous externally rated frozen slate is a future improvement.

**U.S. Senate (8):** NC-SEN, MI-SEN, ME-SEN, OH-SEN (special), TX-SEN, AK-SEN, NE-SEN, IA-SEN.

**Governors (6):** AZ-GOV, GA-GOV, MI-GOV, WI-GOV, NV-GOV, OH-GOV.

**U.S. House (6):** AZ-01, ME-02, NC-01, NE-02, NY-17, PA-10.

At least 18 Democratic wins means **90%** of the full 20, including all three office types. Governors help describe the broad near-sweep, but **do not change congressional seat totals**. The slate is not rewritten after counting starts. A different defensible battleground selection or threshold could materially change the tsunami probability; this beta does not yet model slate-selection uncertainty.

A separate *reach-race* example is South Carolina U.S. Senate (Cook rated Likely Republican in its [September 23 race listing](https://www.cookpolitical.com/senate/race/488671)). A reach race flipping is interesting, but not automatically a tsunami or evidence of a source's integrity.

## Model inputs, how every race gets a prior

`scripts/chamber_control_model.js` requires complete and source-consistent inputs:

1. **435 voting House slots** from `data/seat_universe.json`, **2024 House recorded votes** from MIT's verified historical staging, and Census-audited **2024-to-2026 boundaries** from `data/house_geography_bridge.json`.
2. **35 Senate contests** including two specials from the complete Senate ballot universe, with 2020 Senate historical results and 2024 state House results as optional, explicitly provisional missing-poll priors.
3. Published `data/polling_estimates.json` 2026 generic ballot, plus 2026 `data/race_probabilities.json` with source-matched per-race two-party polling estimates and error widths. A mismatch refuses to calculate.
4. Six governor battleground polling estimates needed only for the Blue Tsunami threshold, **not** chamber control.

**House baseline:** A source-audited unchanged district with both parties' 2024 votes uses its recorded two-party margin. The national generic-ballot swing proxy is **0.68 × (current generic-ballot D margin − 2024 recorded national House D margin)**. This damping is a judgment call, *not* a proven statistical conversion. A seat with 2026 polling blends the poll margin with the historical proxy, emphasizing independent multi-poll coverage more heavily. Historically unopposed or missing-party races use a wide party/state proxy. For states with redrawn House boundaries, the model explicitly **does not attach old district X's votes to new district X**: it reuses only the state's 2024 distribution of House-seat margins as an unordered seat-count proxy and applies far greater error. This is a serious uncertainty source. **October 14 refinement:** the model no longer sorts those old margins and assigns each to a new district number. Instead, all unpolled 2026 districts in a fully redrawn state receive the same exchangeable historical baseline. On each simulated election, the state's historical district-margin distribution is freshly shuffled and allocated without replacement, preserving the prior statewide seat-margin spectrum but **not** inventing an old-to-new map. Any genuine 2026 district poll is still tied to its real district and blended with a smaller randomized prior component. Fully redrawn states AL, CA, FL, LA, NC, OH, TN, TX and UT are currently covered; a partially redrawn map must fail closed pending an explicit residual allocation. This remains a proxy, not geographically reaggregated votes.

**Senate baseline:** Available 2026 polling gets strong weight. The remaining **11 of 35** races receive wide-uncertainty priors from 2020 Senate vote margins (where both major parties appeared) blended with 2024 statewide House vote context, or a state proxy when the 2020 race is unusable. It does not invent new polls, incumbents or verified third-party candidate alignment.

## Correlated Monte Carlo and live voting

Every simulation draw runs all **435 House + 35 Senate + 6 governor** races. The same nationally correlated Gaussian polling error enters *all* races. Additional House/Senate/governor chamber shocks and shared state shocks make outcomes correlated within chamber and region, rather than multiplying marginal win percentages. Seat-level residuals retain explicit uncertainty, widened when geography or party baseline is missing. Default correlated uncertainty: national SD 3.5 margin points, House 2.5, Senate 3, governor 3.5; state shocks 3–3.5 (redrawn House states add 6); plus per-race SD of at least 6 and commonly 11–25 for missing/historical cases. These are provisional **assumptions**, not calibrated empirical correlation parameters.

The web app uses **3,000 seeded simulated elections** per run for reproducibility. Probabilities are the corresponding category frequencies; a 0.0% display is a sample-resolution result, not proof of impossibility. Sensitivity controls modify the national D margin by ±3 points and broaden/narrow all random election error by 1.3×/0.8×. The site also reports expected Democratic House and Senate seats, as useful model diagnostics—not actual seats won.

Starting November 3, the model may *cautiously* use reported votes from **already separately verified** Open America or exact-ID civicAPI races. Eligibility requires at least 10% reported precincts, a recent source timestamp within 3 hours, both Democratic and Republican observed vote counts, and a healthy source. The observed two-party margin is blended with the seat prior under a noisy geographic-counting signal (noise floor **7 + 20 × (1 − precinct reporting fraction)^1.3** margin points). **Precinct percentage is not percent of votes counted.** Model probabilities are never winner calls or certified vote counts; source failures leave the live part of the forecast unsupported and preserved vote snapshots distinguish source staleness.

### Especially important limitations

- **Not backtested or calibrated.** No empirical coverage, proper score or reliability curve validates these exact joint-probability numbers, national swing conversion, redraw proxies, third-party vote treatment or 20-race tsunami slate.
- **Large unknowns** include 173 redrawn House seats, districts without both 2024 major-party candidates, 11 unpolled Senate contests, candidate fundamentals, changing polling electorate, correlated political/geographic bias, and possible special caucus affiliations.
- A change to the national generic-ballot model or Senate caucus composition can move chamber probabilities significantly. Do not interpret a displayed 73.4% as a verified frequency across comparable prior elections.
- Coverage gaps **do not** mean no election or zero votes. These probabilities are independent from in-page reporting totals, source calls and election-administration alerts.

## External benchmark retained

The dashboard also shows an *independently attributed* [Decision Desk HQ 2026 joint-chamber forecast](https://votes.decisiondeskhq.com/forecast/2026) as a benchmark only. Its October 13 published 4-way party-control rounded cells were 54% Democratic both, 2% Democratic Senate only, 22% Democratic House only, and 21% Republican both (sum 99% after rounding). DDHQ does **not** estimate the beta-defined Blue Tsunami subset publicly. Its `data/congress_scenarios.json` values **are never blended into** the JackStradamus simulation.

Source/test contracts: `scripts/test_chamber_control_model.cjs`, `scripts/test_dashboard_runtime.cjs`, historical staging checks and GitHub PR CI. Actual November 3 returns, provider bandwidth and continuous laptop operation still need real-world verification.
