# Dashboard QA audit — October 13, 2026

This is a targeted user-reported bug review plus functional integration coverage, **not** a declaration that every API result, ballot line, mathematical assumption or browser configuration has been independently verified.

## Reproduced or confirmed defects

| Area | Finding | Fix | Test |
|---|---|---|---|
| What actually changed | Insights called both the Texas Senate race and Texas governor race simply **Texas**. | Each insight now displays the **state, office, and candidate matchup**. House districts show their district identity. | Render a feed containing only TX-SEN and TX-GOV and verify distinct headings. |
| Source → model traceability | Clicking a source-poll insight opened a **race average**, not the actual survey row. ReconMR/Siena's October survey contains different Senate and governor questions sharing the same underlying poll ID. | Cards link to the exact **office-specific poll observation**, highlight the matching row in JackStradamus and show its published source URL. If the item is not in the weighted mean, the app switches to *All recent* and labels its absence. | Live current-data fixture opens TX Senate Recon, TX governor Recon, and the newest TX governor GBAO, verifying each exact selected survey. |
| Model inclusion integrity | The UI used *pollster + field-end date* to decide if a poll was included; this is less robust than retaining the actual source poll ID. | Every selected model poll now includes `poll_id`; the UI uses that ID, with a compatibility fallback for legacy snapshots. `validate_model_drilldown.py` rejects missing/mismatched IDs and still independently reconciles all weights and margins. | Existing model reconciliation, plus DOM test checking exact source rows. |
| Four endings | Four static scenario descriptions showed "Not modeled" without an action or useful calculation. | Implemented an **interactive hypothetical House/Senate seat calculator**: four presets and editable House Democratic seat total, Senate Democratic-caucusing seat total, and assumed share of a hypothetical predeclared competitive slate. The outcome classification changes instantly. | DOM tests cover all four classifications, sliders and preset clicks. |
| New-posted poll ordering | Earlier corrections depended on a source posted timestamp; a date-only fallback must not be confused with public release time. | Preserved full `createdAt` date and minute for ordering, displayed source-post time and separately showed field-end. Original links are retained. | DOM feed renders from current dated JSON; source-level ordering checked by timestamp. |
| Regression coverage | Former `check_dashboard.py` mostly checked for expected strings, duplicate IDs and JavaScript syntax. It couldn't detect a wrong poll link or inert UI. | Added a **JSDOM application integration test** executed in every four-hour refresh, in addition to the original syntax and data-model checks. | `scripts/test_dashboard_runtime.cjs` in CI. |

## What "The Four Endings" now means

The interactive calculator is **not** a forecast. The controls represent *invented user-selected hypotheticals*. With all 435 House voting seats occupied and a 100-seat Senate, the illustrative thresholds are 218 House Democratic seats and 51 Democratic-caucusing senators. A 50–50 Senate split assumes a Republican vice president breaks organization ties. A Blue Tsunami also assumes Democrats win at least 90% of a **hypothetical fixed slate** of battleground contests, not a percentage of total House seats.

**There is still no calibrated probability model** for Red Dawn, The Shrug, Blue Wave or Blue Tsunami. That requires all 435 House districts, all Senate contests and holdovers, externally audited predeclared swing-race membership, correlated uncertainty and historical election-year validation. The original site had labeled the missing capability as "Not modeled", which was truthful but not a functioning user experience.

## Verification scope

The DOM tests load the actual `index.html` inline script with current committed `data/polls.json`, `data/polling_estimates.json`, `data/pollresults_recent.json` and `data/model_history.json`. They exercise navigation to both TX offices, selected survey highlighting, interaction state transitions, and JavaScript errors.

The polling workflow also runs `scripts/validate_model_drilldown.py`, which reconciles exact selected source IDs, per-survey weight shares, calculated averages, sensitivity statistics and experimental Silver rating calculations. These data/DOM tests are stronger than syntax checks but **do not** replace a real-browser cross-device check, a visual pixel review or independent verification of external pollsters' releases.

## Known limitations remaining

- A source's **posted timestamp** is *not* necessarily the original first public release timestamp; PollResults provides no authoritative timezone.
- The limited upstream sources are *not* every poll conducted in the country, and being "new in source" may differ from "published today".
- Some surveys may be excluded from the weighted mean due to firm-repetition rules, insufficient data or a different candidate matchup. The direct link to the survey in *All recent* must not be interpreted as model inclusion.
- The Four Endings sliders have no connection to live district-specific election probabilities. Publishing percentages based on them would be misleading.
- Historical House geography, incomplete constituency fundamentals, independent candidate handling and unpolled races still block an actual national-control forecast.
- CI's JSDOM test does not measure responsiveness, rendering/layout, or assistive-technology quality in a real Chrome, Firefox or Safari instance. A Playwright/browser-level suite remains a recommended next hardening step.

## Concurrent-refresh publishing hardening

During QA, the pipeline sometimes passed all data and DOM tests and then failed its final `git pull --rebase` because another scheduled run committed overlapping JSON files. The refresh publisher now fetches current `main`, checks whether the application/model code changed during its run, rejects an older model snapshot when a fresher one is already committed, and stages **only generated data files** on the current head. Pushes are retried up to three times rather than rebasing an obsolete bulk JSON commit. Source-code changes during a run trigger a safe skip instead of stale model publication. This is operational robustness, not a guarantee about uptime or polling-source availability.
