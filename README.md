# In Search of Blue Waves

A personal, data-first 2026 U.S. midterms dashboard. Serious about polling; occasionally less serious about its own branding.

## What the site shows

- **Daily briefing:** 2026 generic congressional ballot, clearly blue/red party margins, key Senate polling snapshots, and newest observations sorted by full source-posting date/time, with original poll links. Source-posting time is not verified publication time.
- **JackStradamus:** weighted polling averages for Senate, House, governors, and national generic ballot. Every firm gets a visible influence share and source-linked ratings context. The **national seat inventory** now identifies all 435 House seats, all 35 Senate contests and 65 holdovers, plus exactly which seats have actual qualifying polling. Full forecasts are blocked until district-specific fundamentals and historical calibration exist; see [SEAT_MODEL.md](SEAT_MODEL.md).
- **Four congressional outcomes:** Red Dawn = Republicans control both chambers; Shrug = Democrats control one; Blue Wave = Democrats control both; Blue Tsunami = both plus a near-sweep of a frozen battleground slate. No probabilities until the complete seat model is calibrated. See [SCENARIOS.md](SCENARIOS.md).
- **Race Lab:** individual poll observations, source dates and sponsor labels.
- **Election Night:** an explicitly partial free-state vote feed, selected 2024 archive, readable D/R leads and vote margins, with reporting limitations.
- **Bullshittery Index:** documented election-administration issues kept separate from voter preferences and candidate polling. See [BULLSHITTERY.md](BULLSHITTERY.md).

## Poll weighting

All qualifying polls use `weight = 2^(-age_in_days/21) × historical_quality × capped_sample_size × sponsorship`.

- Independent survey: **1.0×**, regardless of which party leads.
- Campaign/partisan-sponsored survey: **0.5×**, regardless of sponsor party.
- Pollster historic quality: published older FiveThirtyEight ratings, sparse-history shrinkage, and a neutral default for unlisted firms.
- Sample-size diminishing returns and only the most recent fielded wave from each firm.
- These are descriptive polling means, **not** calibrated win/seat forecasts.

See [POLLING_MODEL.md](POLLING_MODEL.md) for parameters, Silver Bulletin comparisons, transparency limitations and validation. Silver's new January 2026 ratings are a planned data upgrade; the project does not claim to replicate his proprietary forecasting model. Ettingermentum is treated as an external source of analysis, not a secretly blended data feed.

## Site artwork

The editorial hero supports **`blue-waves-hero.jpg`**, a panoramic, user-approved surf image. The CSS has a restrained navy/blue/red gradient fallback so the page still works if the asset isn't uploaded. The JPEG is checked in at repository root. The photo contains **no modeled polling numbers**: everything numerical is rendered from the actual data feed. The image has a separate downloaded copy in the user's ChatGPT Library under `Election Command Center/blue-waves-hero.jpg`.

## Refresh & checks

This is a static GitHub Pages site built from `index.html` and files under `data/`. The [Refresh election briefing](.github/workflows/refresh-briefing.yml) workflow runs about every four hours (or manually via Actions). On each run it syntax-checks the dashboard, refreshes source data, runs a walk-forward model comparison, rebuilds the averages, reconciles weighting against every included poll, and validates the integrity ledger. Some source services can fail or lag; the app exposes timestamps rather than presenting stale data as fresh.

Use GitHub Settings → Pages → Deploy from branch `main`, directory `/ (root)`.

**Model outputs depend on data availability**. A polling margin is not an election result, a chart of observed polls is not a historical model trend, and a verified incident is not evidence of a nationwide election outcome.

## Model QA (October 2026)

v1.4 retains more qualifying pollsters, calculates effective-firm concentration and sensitivity to weighting assumptions, and compares signed sponsorship-prior corrections against held-out *future polls* in an experimental test. The latter is deliberately **not** deployed without election-result validation. The official January 2026 Silver Bulletin ratings file is not yet incorporated; see [POLLING_MODEL.md](POLLING_MODEL.md).

## October 13 data provenance update

- Fixed Race Lab's `Governors` vs `governor` filter mismatch; all available governor contest rows now render.
- Race Lab displays **party-leading polling-contest counts among the currently filtered, qualified polls**, not predicted chamber seats. Unpolled and insufficient-data races are not assigned to either party.
- The Daily Brief ingests a second NYT-derived public feed ([PollResults.org](https://pollresults.org/), CC BY 4.0) with original survey links, LV/RV sample labels and source **posted dates**. These are **not** verified publication dates. The full source archive includes additional records beyond the displayed 14-day window. Fallback to the original ElectIndex feed remains in place.
- Supplemental observations are strictly matched back to existing model polls using poll ID, race, field end, and vote shares. **Unmatched polls never silently alter the model average.**
- [Silver Bulletin January 2026 XLSX](https://www.natesilver.net/p/pollster-ratings-silver-bulletin) has been parsed into `data/silver_ratings_staging.json`. It contains 540 pollsters, with 68 reviewed/archived name matches. Its predictive accuracy and bias scores are **research-only**. See `data/model_tests.json` for held-out future-poll comparisons and `POLLING_MODEL.md` for the calculations.

## Dynamic daily brief and correct post-time sorting

The daily brief prioritizes **new survey postings and meaningful changes in matched polling averages**, replacing the static largest-lead / closest-race tiles. `data/model_history.json` keeps up to 30 days of compact time-stamped model snapshots. A shift only compares the same race **and same candidate matchup**; field-end age changes are not asserted as evidence of changing voter sentiment. Model history requires time to accumulate after deployment. When there is no meaningful movement, the page says so rather than filling the space with trivia.

The supplemental PollResults.org feed is sorted by its **full source `createdAt` date and time**, not fieldwork end, state or pollster alphabetically. Its timezone is unspecified. **This is an index-posting time, not necessarily when the poll was publicly released.** Original-source links remain attached so publication timestamps can be checked independently. The UI puts these postings near the top of Daily Brief.

## Model milestone — full national seat inventory

`scripts/build_seat_universe.py` produces a source-linked `data/seat_universe.json` after every model refresh, and `scripts/test_seat_universe.py` verifies the district census denominator, Class II + Florida/Ohio specials, and missing-data gates. The **JackStradamus** tab displays live House and Senate polling coverage against the full universe. This is a prerequisite for a model, **not** a complete election-day seat projection; no new winning probabilities have been published.

## Historical vote groundwork (not a forecast)

A separate [2024 House history staging workflow](.github/workflows/stage-house-history.yml) ingests MIT/MEDSL constituency-level returns from a [CC0 mirror](https://crproject.org/), with source attribution and validation. It stores exactly 435 voting districts (not D.C.'s non-voting delegate), including flags for 44 contests without recorded votes for one of the two major parties. Every historic result is marked **ineligible as a 2026 prior** until its geography is verified against the 2026 redistricted map. See [SEAT_MODEL.md](SEAT_MODEL.md).

## Congressional district geography checks (October 13)

The latest build follows the [U.S. Census 120th Congressional District boundary collection](https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.html) and the [2024 collection](https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.119th_Congress.html). There are **nine states with redrawn 2026 House maps** (AL, CA, FL, LA, NC, OH, TN, TX, UT), affecting **173 district slots**; Missouri's 2026 plan reverted to its previous lines. The **262 other districts** can be compared directly with 2024 geography, and **238** of those have recorded D/R votes in the 2024 House historical file.

The historical research archive now includes **both 2022 and 2024** raw House returns. A separate three-election Census cross-check excludes additional states with boundary changes between 2022 and 2024 (AL, GA, LA, NY, NC): **222** districts share the same boundaries across all three election years; only **191** also have recorded D and R candidate votes in both historical years. The JackStradamus race detail can show their observed two-election House vote shares, clearly labeled historical and never used as a 2026 projected winner. See [MAP_GEOGRAPHY.md](MAP_GEOGRAPHY.md) for sources and rules.

**No independently calibrated JackStradamus House/Senate seat forecast has been enabled.** The separate externally attributed DDHQ congressional-control probabilities are available, but should never be conflated with our incomplete district polling model.

## October 13: dashboard bug audit and interactive scenarios

The [dashboard QA audit](QA_AUDIT.md) documents specific repairs after user testing: What Actually Changed cards identify the precise state/office/matchup, the linked primary-model survey is highlighted on click (including distinct Texas Senate and governor questions in the same ReconMR survey), and the model now preserves exact included poll IDs so it can validate what was really weighted. Poll inclusion and cross-source matching are checked in the normal model reconciliation and new DOM integration suite (`scripts/test_dashboard_runtime.cjs`) in every automated refresh.

The Four Endings formerly included hypothetical seat sliders; those have been retired in favor of external, attributed DDHQ joint-control probabilities. This is **not** a complete JackStradamus congressional forecast; an unreported Blue Tsunami probability remains blank. See [SCENARIOS.md](SCENARIOS.md).

## Real probabilities in The Four Endings (October 13)

The hypothetical slider widget has been retired. The Daily Brief now displays **joint congressional-control probabilities published by [Decision Desk HQ](https://votes.decisiondeskhq.com/forecast/2026)**, which models House and Senate control together. As of its October 13 public update: Democrats both **54%**, Democrats exactly one chamber **24%**, Republicans both **21%** (99% sum from source rounding). The **Blue Tsunami subset is not separately measured**, so its probability appears unavailable, not zero. These figures are explicitly attributed to DDHQ and are **not independently calculated from JackStradamus's incomplete district polling model**. The public DDHQ joint fields are ingested and validated every four hours; see [SCENARIOS.md](SCENARIOS.md) and `scripts/test_scenario_forecast.py`.

## New-poll alerts and reach-race watch (October 13)

- **Two-secret Gmail notification setup**: the existing four-hour GitHub Actions refresh can email new source-indexed poll observations, including survey details and original release links. Setup and delivery limitations: [ALERTS.md](ALERTS.md). This is **off until secrets are configured**; the first run initializes a no-spam baseline.
- **New since last visit**: the Daily Brief tracks poll questions indexed since the current browser last viewed the site, using local browser storage. These are *source-index postings*, not verified first-publication dates. Multiple ballot questions in the same survey are kept distinct.
- **Beyond the battlegrounds**: South Carolina Senate is shown as a dated, source-attributed reach-race example. A Democratic win outside the current toss-up slate would not itself define Blue Tsunami or supply an independent outcome probability.
