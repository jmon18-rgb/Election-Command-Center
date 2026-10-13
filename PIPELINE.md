# 2026 Election Command Center

Free, static election dashboard hosted on GitHub Pages.

## Automatic briefing

The workflow at `.github/workflows/refresh-briefing.yml` runs approximately every four hours and can be triggered manually via **Actions → Refresh election briefing → Run workflow**. GitHub's scheduled runs can be delayed. It uses Python's standard library and public Google News RSS search feeds; no API keys or paid accounts required.

The script writes `data/briefing.json` with article headlines, source links, original publication dates, and a fetch timestamp. These are **news leads, not independently verified facts or election incident findings**. Headlines may contain errors or allegations. Do not treat them as confirmed election interference.

If all feeds fail, the script preserves existing items and exits unsuccessfully rather than showing stale data as freshly updated.

## Limitations

* JackStradamus polling averages are integrated and use archived 538 pollster ratings, age, bounded sample-size and symmetric sponsorship weights. They are **not** calibrated seat forecasts.
* Election Night uses a partial state-derived feed; it is not a nationwide race-call or chamber-control service.
* The current poll CSV does **not** contain public release dates, demographic sample-population categories, or per-poll source URLs. First-seen timestamps are collection times, not publication dates.
* RSS results depend on external service availability and can include syndicated/duplicated coverage.
* To publish: GitHub Settings → Pages → Deploy from branch → main → /(root).
