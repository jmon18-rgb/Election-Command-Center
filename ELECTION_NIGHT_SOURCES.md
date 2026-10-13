# Election Night · sources, integrity and architecture

Updated October 13, 2026. Goal: a useful, trustworthy watch-through-the-evening dashboard that **keeps actual vote counts separate from race calls, from projections, and from polling averages.**

## Election Night rehearsal and reliability upgrade (October 13)

**Live source update (October 13):** [Open America's election-specific API contract](https://openamerica.io/elections/api/) now explicitly specifies `Access-Control-Allow-Origin: *` on 200 and 304 responses. The dashboard is wired to request its 2026 House/Senate/Governor vote counts **directly from the user's browser**, never by repackaging or proxying the data. GitHub Actions must confirm actual provider HTTP CORS headers and response format on a real 2024 archive and 2026 endpoint before this change merges. Open America permits personal civic display with attribution and asks for permission only before creating a standalone republished results service. This is not one.

The page opens a **first-party 2024 House archival rehearsal by default before the November 3 election**, sourced from the project's separately staged MIT Election Data and Science Lab 2024 candidate-party vote totals, under a CC0-identified public mirror. It includes **all 435 voting House districts**, with **44** lacking a recorded vote for at least one major party. It contains *party aggregates*, not named-candidate returns, official certification, precinct-level progress, or winner calls. No 2024 House party-total district is automatically mapped as a 2026 geographic prior. This is a static historic dataset, **not** a chronological evening replay or a certified race result. On and after the **Eastern Time** start of Election Day (Nov. 3), the default switches to the browser-native 2026 state-derived feed. It is **not a national feed**: it covers 22 supported states and zero races before those states report. The year/office switches remain visible; 2024 House and Senate have verified local archives. Unsupported views display an explicit limitation and working external-source links rather than false zeros.

Client validation rejects unexpected year/office/API version, invalid district IDs, implausible vote totals or candidate percentages, contradictory live/stale/final flags, reported winner-call fields and dates too far into the future. Before polls close, any supposed 2026 vote totals are rejected. A failed subsequent refresh clearly warns visitors and preserves the last validated data in that tab, rather than zeroing totals or substituting polling averages.

**What Just Changed** is a real *within-this-browser-session* comparison of distinct 2026 source timestamps for the same office and race. It records newly reported totals, downward corrections and changes in provisional leading party. It does not reconstruct activity from before the page was opened, imply wrongdoing from corrections, or guess changes for states omitted from the feed. The model's race detail also shows a separate real saved-polling-average history chart, which is never treated as election-night vote movement.

The roadmap still requires another independent call source, broader state coverage, actual live-system testing, nationwide chamber reconciliation and verified county-level baselines before a full results-night desk or 'needle' can be claimed.

## What the current screen already does

The Election Night tab has a working 2024 House archive (435 seats), a separately verified 2024 Senate contest archive, and an Open America **direct-browser 2026** state-results connection for House, Senate and governor. Its latest validated counts are preserved during network outages. The 2024 Governor archive remains unavailable and is never faked. The existing source-contract and within-session change-tracking functions remain ready for a licensed/authorized future provider adapter.

### Primary: Open America state-derived results

- Docs: https://openamerica.io/elections/api/
- JSON: `https://openamerica.io/elections/results.json?year=2026&office=House` (also `Senate`, `Governor`, and year `2024`).
- Free, documented, unauthenticated, official-state-derived counts; **22-state coverage**, not a national dataset.
- The election-specific provider contract now explicitly documents **CORS headers on both 200 and 304**; a direct browser request with `credentials:'omit'` from GitHub Pages is supported. The project's `scripts/test_live_results_source.py` checks actual response headers/schema from GitHub CI, not merely documentation. If unavailable, the dashboard keeps last verified data and shows a source failure.
- Observe server `as_of`, `live`, `stale`, `counting`, `final`. It *does not call races*. Percent of precincts is not percent of ballots, and 100% precincts does not equal certification.
- Source suggests **60-second polls while live**, 10–15 minutes while not live, and ETag / conditional requests for server collectors. Do not run multiple parallel minute-by-minute polls without reason.
- The provider's documented supported states at review: AR, AZ, CO, CT, FL, GA, IA, ID, IN, LA, MI, MN, NC, PA, RI, SC, TX, UT, VA, VT, WA, and WV. Do not hardcode or extrapolate missing seats from partial coverage.

### Secondary candidate: civicAPI

- Docs: https://civicapi.org/api-documentation ; FAQ https://civicapi.org/faq
- The provider advertises unauthenticated live-results and winner-call APIs, and says its own decision desk makes calls.
- **Not integrated yet.** Before use, retrieve a concrete v2 races endpoint/schema, test previous certified general-election returns versus state totals, evaluate freshness, candidate/party key matching and missing/overcounted districts, and review its attribution requirement.
- Important: **a civicAPI call is a civicAPI call**, not an AP or official certification. Keep call origin, time and correction history visible; where it conflicts with another desk, show disagreement rather than deciding that a candidate is a winner.

### Official state-site downloads / HTML as a cross-check and gap-filler

Start with public structured exports, then published HTML when necessary. Add a **state-specific Python parser with unit tests**, not a generic blind scraper:
- North Carolina: https://www.ncsbe.gov/results-data/election-results documents its live election-night dashboard and official historical files. The publicly documented election-night reporting media file and precinct-/county-level extracts merit a focused adapter for NC and county benchmarks.
- Texas: https://electionresults.sos.state.tx.us/results.html publishes official results in the state's online format. Build a dated HTML/download parser, keep timestamps and distinguish primary/runoff vs Nov 2026 general election.
- Add official state publishers **outside** the 22-state API coverage based on the availability of machine-readable election-night exports. Prefer county/district breakdowns for an expected-vs-actual feature.
- GitHub Actions has a **five-minute minimum schedule interval** and jobs can be delayed. It is suitable for persistent archival snapshots and less frequent backstop ingestion, but **not** for guaranteed minute-by-minute results. For faster official-source scraping that cannot be done from a browser, use a small hosted worker/proxy with a scheduler and caching.
- Respect reasonable rate limits, source terms and election-site capacity. Personal use is not a blanket permission to disregard access controls.

### Outlet decision desks / model comparisons

- AP https://apnews.com/hub/elections and DDHQ https://www.decisiondeskhq.com/ are useful independent references. Do not imply their results can be programmatically republished unless a licensed/permitted feed is available.
- Track `source`, `race_key`, `called_party`, `called_candidate`, `called_at`, `last_verified_at`, `status`, and source URL independently by decision desk.
- Comparative polling numbers (JackStradamus) are **pre-election observations**, not live models updating from the counted vote.
- Do not claim national House or Senate control until called seats, holdover seats, known outstanding seats and third-party/uncontested races are reconciled with complete verified coverage.

## Quality-control rules

1. Every candidate has a normalized stable office / election / state / district / candidate identity, preventing AZ-01 House from being confused with AZ governor or a primary race.
2. Store raw immutable snapshots with timestamps and source URLs. Never silently overwrite vote revisions or a retracted race call.
3. Prefer verified official counts for votes, do not silently combine duplicate feed records, and show discrepancies across sources.
4. Distinguish **race calls**, **unofficial vote leaders**, **historical polling averages**, and **expected-vs-actual estimates** visually and semantically.
5. Flag stale sources immediately and never display "live" when the provider has stopped updating. 2024 data is an **archived snapshot**, not a timestamped evening replay.
6. County-based expectations require a documented historical baseline and comparable turnout/vote-method reporting; precincts-in alone is not the share of votes counted.
7. Rehearse with archived 2024 results and a synthetic stream of delayed, corrected, and retracted data before Election Day.

## Build sequence

**Now:** Working 2024 House/Senate archives; 2026 direct browser live adapter (subject to real CORS launch tests), 60-second refresh when `live` and 10–15-minute backoff when not. 2026 uses `as_of`, `source`, `live`, `stale`, and exact source race counts, and **never** infers missing states or winner calls. No third-party feed is mirrored or redistributed.

**Next:** Independently test browser CORS on GitHub Pages in a live desktop session, improve coverage beyond Open America's 22 official-state adapters, and integrate a second source only after schema/permissions/attribution and candidate/seat identity reconciliation.

**Next:** Verify civicAPI v2 endpoints and coverage, add its adapter and a provider-comparison test suite without enabling any unverified race-call statuses.

**Then:** Implement first two official state adapters and snapshot storage; compare state counts with two independent aggregators; identify uncovered states and automate additional adapters.

**Finally:** Reconcile holdover Senate seats, race calls and complete House/other race inventory into a national control display. Add sourced county-level historical expectations and a meaningful last-30-minutes update stream.

## 2024 Senate archive (research-only incremental source)

`scripts/stage_senate_history.py` stages the original MIT/MEDSL [U.S. Senate 1976–2024 statewide election dataset, V8, CC0 1.0](https://doi.org/10.7910/DVN/PEJ5QU), retaining regular and special contests separately as well as independent and third-party candidate votes. After the independent GitHub Actions download passes validation, the site's 2024 Senate selection can display recorded historical party aggregates; otherwise it fails closed with an accurate unavailable notice. It cannot show 2024 Senate precinct progress or election calls, and neither House nor Senate archive is a timed 2024 replay.

## Direct-browser live results operation (Oct 13 implementation)

On Nov. 3, Election Night defaults to 2026 state-derived counts at the Eastern Time date boundary, not UTC midnight. The client fetches `?year=2026&office=House|Senate|Governor` directly from Open America with `mode:'cors'`, `credentials:'omit'`, and JSON-only accept. It checks the provider's API version, year, office, keys, candidate vote sums, timestamps and no-winner-call contract. Source states absent from the payload are not counted as having zero votes. A new connection indicator distinguishes live counting, waiting, source staleness, and network errors. A failed reload retains previously verified vote totals in that office instead of replacing them with polling averages. While Election Night stays open it polls every 60 seconds when live, 15 minutes when some races are stored but not live, 10 minutes before returns and up to 10 minutes backoff on errors; timers stop while other tabs are selected. A compact dated DDHQ joint-congressional-control forecast strip is explicitly separate from the vote counting desk. It does not produce an in-house election-outcome forecast.

## Full rehearsal workflow and first-vote tracking (Oct 13)

Election Night supports two 2024 historical source views. **MIT/MEDSL full archive** covers all 435 2024 House voting districts and a separate 35-contest 2024 Senate archive with recorded party-level vote totals, but no candidates or precinct progress. **State-derived source rehearsal** fetches the unmodified Open America 2024 results endpoint directly, displaying recorded candidate names, vote counts and available official-state precinct counts through the same renderer used for 2026; it only covers states present in the provider feed (198 House and 11 Senate records in the Oct 13 CI sample, not all national races). Neither view is a timed vote-count replay or race call. Source switching never substitutes one source's votes for another.

The within-session **What Just Changed** implementation now records a new source race's first reported votes, detects an actual vote leader flip even when the overall candidate total does not move, and flags candidate vote revisions with no net new votes. Merely refreshing the `as_of` timestamp with identical candidate counts creates no fake movement. Negative net corrections remain distinguishable from genuinely new reporting.

## Personal watchlist and multi-office desk (Oct 13)

The browser now stores up to 40 user-selected **2026** House, Senate and governor races in that browser's `localStorage` under a versioned, project-specific key, with no account or server-side collection. Race codes such as `AZ-01`, `NC-SEN`, `TX-GOV` are normalized and validated against the 2026 House seat apportionment and US state names/codes. At-large voting House seats use `00`. This avoids incorrectly mapping a 2024 historic at-large seat to a 2026 result. The list can be prepared before Election Day; 2024 rehearsal remains independent.

Results are cached **in memory per office** while this page is open, preserving verified House, Senate or governor data when changing office tabs. When a watched race belongs to another office, the dashboard checks its 2026 Open America source in the background, validates its exact year/office and votes, and refreshes the watchlist; it keeps last-good office data on errors. A 60-second watch interval is used when any watched office's fresh source reports `live`, otherwise normal provider backoff applies. The watchlist explicitly distinguishes races in a supported but not-yet-reporting state from races **outside Open America's 22-state coverage**. Incomplete results never imply a zero or an officially called race.

The provider's `as_of` is the **latest state update anywhere in the feed**, not a per-state timestamp. A specific state may update with no global `as_of` change. The dashboard therefore diffs actual candidate votes even if `as_of` remains equal. If a race disappears from a newer valid source it is flagged as a withdrawal, **not counted as zero**. A sudden completely empty 2026 feed after real counting or a source timestamp regression is rejected rather than erasing already verified counts. Source-contract, local persistence, and cross-office behavior have deterministic browser tests.

## civicAPI: supplemental source for personally pinned out-of-coverage states

A second **independently attributed** browser data source now supports the election-night personal watchlist for 2026 races in states missing from Open America's 22-state feed. [civicAPI v2](https://civicapi.org/api-documentation) returned CORS `Access-Control-Allow-Origin: *` and a structurally valid Nov. 3, 2026 race search for **New Hampshire US Senate, NH-01, NH-02, NH Governor** and 2026 Nevada statewide races in the Oct. 13 GitHub Actions source probes. An independent, source-real contract test checks the actual discover + candidate-detail endpoints before deployment. Its secondary `getElectionDates` directory returned 503, so the dashboard does not depend on that directory.

**Isolation:** civicAPI is used **only for a user-pinned 2026 race outside the primary provider's 22 supported states**, and only while Election Night is open. It is never merged into the primary provider House/Senate/Governor totals, not counted as primary official-state-derived votes, and not used to estimate nationwide chamber control. Its calls are shown only as explicitly **civicAPI calls**, not official certifications or votes/projections from AP/DDHQ. Other possible sources are not quietly treated as verified calls.

**Exact matching:** Query by country US, Nov. 3 date, two-letter state, human-readable office, and then require exactly one source race with the expected state, office, complete known 2026 House district key or null statewide district, qualifying November general election, no primary/runoff and a numeric provider ID. Fetch the full record by that exact provider ID and reconcile the date, office identity, candidate list, vote totals, percentage fields and provider call flags before rendering. Pre-election votes or calls, impossible percentages, negative counts, duplicate candidate keys, a dated source regression, and a sudden change from counted votes to zero all fail closed. No source votes are persisted by the app beyond the browser session; only user-selected pins are retained. Link to original civicAPI records for independent checking.

**Rate limits:** No national bulk polling. Only individually pinned races, at most twelve supplemental out-of-coverage races per automatic refresh, requested serially. Before Nov. 3, repeat queries no more than once every ten minutes; during the election-night period, no more than once per minute while the watchlist is open. Verified race IDs are cached in session so subsequent refreshes request only their small detailed records. If civicAPI is unreachable or no unique match exists, the item remains source-unavailable, never zero. These frequency controls supplement, rather than replace, the 60-second Open America refresh.

**Limitations:** Watchlist-supplemental coverage is not proof of 50-state continuous reporting. Specific candidate / special-race identity and independent winner-call behavior remain dependent on civicAPI's reporting quality, timestamps, and attribution. The model's probabilities are untouched.

## Nationwide 35-race Senate desk (October 13)

A new collapsible **35-contest Senate results monitor** is driven directly by `data/seat_universe.json`: 33 regular races and the Florida/Ohio special elections, with precise different keys (`FL-special` / `OH-special`). It validates all 35 named ballot slots before rendering. The primary Open America provider handles its supported states; civicAPI provides separately identified data for individual unmatched-state races. **Source totals are never merged or extrapolated**. A count of recorded races means that a trusted provider reported at least one vote, not that the seat has been won. A civicAPI call is separately labeled as a *provider call*, not official certification.

The desk has a **Track all 35** control, which does not consume the separately saved 40-race personal watchlist quota. The button persists the user's preference in this browser; tracking defaults to enabled on the morning of Election Day if never set. Outside the 22 primary-source states, the civicAPI requests continue to be serially bounded to at most 12 per sweep and rotate over uncovered Senate races (and any other user-pinned uncovered races); election-night cadence is no faster than 60 seconds. The other main Senate source can refresh in the background even while the user views House/governor results. The desk stays visible, with all 35 source identities, even when tracking is paused. Clicking an unsupported-state seat opens its exact validated candidate detail in the panel, not a made-up leaderboard.

The same validated seat inventory fixes the legacy pin parser: `FL-SEN` and `OH-SEN` resolve to the 2026 **special**, while `CA-SEN` and other noncontested 2026 state Senate codes are rejected after the universe loads. Older saved Florida/Ohio regular-key pins are migrated to the actual special-seat keys without requiring manual user cleanup. Only source-reported vote counts appear on the election-night display; this remains distinct from the dated DDHQ congressional-control forecast.

## Personal watchlist alerts and browser notifications (October 13)

The Election Night desk now contains a compact **Watchlist Alerts** inbox for individually pinned 2026 House, Senate and governor races. It records the **first genuinely reported vote batch**, **party-lead changes**, **candidate-vote reallocations without any net total-vote increase**, **a watched race withdrawn from the primary source**, and **new civicAPI provider winner calls**. These are the only alert-worthy events; ordinary vote accumulation, unchanged refreshed timestamps, static polling snapshots and unpinned nationwide Senate rows do not produce browser alerts. Each event carries the race/office and provider explicitly. A civicAPI race call is always labeled a *provider call, not official certification*. Open America never supplies race calls and the app cannot invent them.

Events are generated only from **two successive validated source snapshots** after November 3, not from an initial import of already-running counts; no backfilled or pre-election vote alerts are sent. Primary race comparisons use actual candidate votes even when the provider's aggregate update timestamp remains constant. The event signature includes source, office, race, event type and candidate-vote fingerprint, preventing repeated identical source readings without concealing different same-total corrections. civicAPI entries require the same exact 2026 state, seat, general-election date and race ID used by its candidate detail adapter.

The small inbox retains up to 35 notable events in this browser's local storage; **Clear** empties it. None of these events or preferences goes to the app's server. *Desktop alerts are off by default*, requiring an explicit click and the browser's own notification permission. Unsupported/blocked browsers keep the on-page inbox. Desktop alerts operate while the Election Night browser is open and refreshing; this isn't an unattended push service, and a laptop may suppress notifications while sleeping. No retroactive alerts are generated for already counted votes on opening the page.
