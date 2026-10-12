# Election Command Center — v1.0

Public site: https://jmon18-rgb.github.io/Election-Command-Center/

## What works

- **Daily briefing:** sourced, dated election news and an automatically updated generic-ballot descriptive mean.
- **Polling:** Senate, House, and governor race observations, sortable and searchable; pollster, field-end date, sample size when available, and individual poll margins.
- **Changes:** new observations since the previous fetch and descriptive generic-ballot mean movement. No fabricated election-win probabilities.
- **Watchlist:** save battleground races locally in your browser. Stored only on that device.
- **Integrity watch:** search and sort recent automatically gathered reporting. Every article is explicitly *unverified* until evaluated against primary evidence.
- **Senate paths:** adjustable 100-seat scenario calculator; assumptions are not live or official seat totals.
- **Election-night war room:** manual race snapshots, vote lead calculations, need-to-win calculator, and state-office directory. **No automatic vote feed**; do not treat manual entries as verified results.
- **Data health:** timestamps and staleness indicators for both feeds.

## Updates

The GitHub Actions workflow `refresh-briefing.yml` attempts updates every four hours, and after changes to pipeline code. It uses public RSS and publicly curated NYT-derived polling tables; GitHub Actions and upstream services can be delayed or fail. GitHub Actions may need to be enabled in repository settings.

Run it manually: [Actions → Refresh election briefing](https://github.com/jmon18-rgb/Election-Command-Center/actions/workflows/refresh-briefing.yml) → Run workflow.

## Data attribution and cautions

Polling data: [ElectIndex public 2026 tables](https://github.com/ElectIndex/26_us_forecast_data), derived from New York Times polling data, licensed CC BY 4.0. Check the original upstream license for terms. Race margins are *individual poll margins*, not forecasted victory probabilities or confidence intervals. Generic-ballot mean is a simple equal-weight descriptive statistic from latest nonpartisan pollster waves in a rolling window.

News: Google News RSS search links to publishers. Search coverage is not comprehensive. News headlines may be inaccurate, disputed, or syndicated. **A news item about alleged election misconduct is not evidence of misconduct.**

## Explicitly not included in v1.0

- Real-time, provider-verified election-night vote returns, county map, or automatic race calls.
- Independently validated House/Senate control forecasts or model uncertainty bands.
- Automatically adjudicated, primary-document-supported election-security incidents.

Those require validated providers and methodology. The dashboard marks them unavailable rather than inventing values.

## Privacy

No user accounts or tracking. Watchlist and manual race board use browser local storage, which can be cleared by browser privacy settings. No local data is sent to the repository.

## Operational check

Open the dashboard and confirm that the feed-health indicator is current. If it is stale, inspect the [Actions log](https://github.com/jmon18-rgb/Election-Command-Center/actions). The data files are committed by the workflow when changed.
