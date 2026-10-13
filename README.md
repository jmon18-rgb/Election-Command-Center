# In Search of Blue Waves

A personal, data-first 2026 U.S. midterms dashboard. Serious about polling; occasionally less serious about its own branding.

## What the site shows

- **Daily briefing:** 2026 generic congressional ballot, clearly blue/red party margins, key Senate polling snapshots and new surveys.
- **JackStradamus:** weighted polling averages for Senate, House, governors, and national generic ballot. Every firm gets a visible influence share and source-linked ratings context.
- **Scenario lab:** Red Dawn / The Shrug / Blue Wave / Blue Tsunami are provisional national House **popular-vote margin bands**, **not** Congress-control probabilities. See [SCENARIOS.md](SCENARIOS.md).
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

The editorial hero supports **`assets/blue-waves-hero.jpg`**, a panoramic, user-approved surf image. The CSS has a restrained navy/blue/red gradient fallback so the page still works if the asset isn't uploaded. Upload that JPEG under exactly that path to activate the photo. The photo contains **no modeled polling numbers**: everything numerical is rendered from the actual data feed. The image has a separate downloaded copy in the user's ChatGPT Library under `Election Command Center/blue-waves-hero.jpg`.

## Refresh & checks

This is a static GitHub Pages site built from `index.html` and files under `data/`. The [Refresh election briefing](.github/workflows/refresh-briefing.yml) workflow runs about every four hours (or manually via Actions). On each run it syntax-checks the dashboard, refreshes source data, runs a walk-forward model comparison, rebuilds the averages, reconciles weighting against every included poll, and validates the integrity ledger. Some source services can fail or lag; the app exposes timestamps rather than presenting stale data as fresh.

Use GitHub Settings → Pages → Deploy from branch `main`, directory `/ (root)`.

**Model outputs depend on data availability**. A polling margin is not an election result, a chart of observed polls is not a historical model trend, and a verified incident is not evidence of a nationwide election outcome.
