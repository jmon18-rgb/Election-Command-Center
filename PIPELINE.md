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

## Additional posted-date poll source

A second data step, `scripts/update_pollresults_recent.py`, fetches publicly accessible poll records from PollResults.org (NYT-derived, CC BY 4.0), with original links, sample populations and API posted dates. These records populate `data/pollresults_recent.json`. They are separate from the ElectIndex primary model source and not an independent underlying survey dataset. The script optionally enriches primary polls only on exact poll ID/race/field-date/share matches. On supplemental-source failure the weighted average continues to use the established primary feed; the UI falls back to its old observation list. Do not call the API's created/posted date a publicly verified release date.

The January 2026 Silver Bulletin pollster workbook is imported separately by `scripts/stage_silver_ratings.py` with a dedicated workflow. Staging and any alternative quality weights never silently modify production polling averages.

## Snapshot history and time ordering

The poll model writes `data/model_history.json` alongside `data/polling_estimates.json` at every refresh. A bounded 30-day series records every qualifying race's margin, candidate matchup, pollster count and most recent field date. The Daily Brief selects an older snapshot (preferably 24h; otherwise a prior refresh at least 3h old) and **never** compares different ballot matchups as though they were the same race. Absence of history or meaningful movement is shown explicitly, not replaced with static superlatives.

Posted-poll ingest retains source wall-clock `createdAt` as `posted_source_datetime` (`YYYY-MM-DDTHH:MM:SS`) and sorts on the whole timestamp. The provider specifies **no timezone**; never convert it to an invented UTC offset or call it a verified public release time. Poll field-end dates remain distinct from source posted time.
