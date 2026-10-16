# Election Night · sources, integrity and architecture

Updated October 13, 2026. Goal: a useful, trustworthy watch-through-the-evening dashboard that **keeps actual vote counts separate from race calls, from projections, and from polling averages.**

## October 16 — exact House IDs connected to the browser's real source path

The four-hour audited ledger also writes [`data/election_night_house_pins.json`](data/election_night_house_pins.json), a small, independently checked lookup list of **previously indexed 2026 House districts** outside primary-source states. The Election Night browser loads it once per tab (same-origin, no-store, four-second timeout), checks schema/date/duplicates against its 435-seat identity gate, and only accepts a manifest generated within 48 hours containing race IDs matched in the last ten days. It then fetches `/race/{id}?light=` directly, requiring the detailed 2026 House general-election **office, district, state, race ID, candidate counts, timestamps and vote arithmetic** to match before allowing source data into any watchlist or model evidence. Invalid or absent hints fall back to a uniquely matched exact-district search; temporary provider outages keep the shared circuit breaker engaged. **A pinned source ID alone is never a counted return, professional winner call or forecast outcome.** The first manifest contains 15 search-verified IDs; NH-01 remains unindexed and is never silently imputed.

## October 16 — persistent 506-contest source-identity coverage ledger

The repository now publishes [`data/election_night_source_coverage.json`](data/election_night_source_coverage.json), a strict **435 House + 35 Senate + 36 state-governor** audit. For every race, it separates the documented 22-state Open America **scope**, civicAPI IDs previously matched in the curated statewide adapter, two scoped New Hampshire adapters without pinned IDs, and the latest bounded House source-discovery probe (including missing, ambiguous, provider-error and upstream-paused statuses). Its last-probe timestamp and preflight outcome are distinct from historical identity evidence; records older than 24 hours are no longer treated as recently probed. The initial checked-in inventory has **no live-provider observations**; new probes only become evidence when the scheduled preflight actually runs.

The four-hour external API preflight generates a new ledger even when a source is down, uploads the snapshot and probe result to timestamped 90-day workflow artifacts, and commits the latest JSON to repository history. The status step fails on a broken provider/probe/ledger publication; audit history still records which step failed. **A source being in a state or indexed under an exact civicAPI ID never means the district has live vote data or a professional winner call.** This audit cannot establish guaranteed national result coverage; it is an actionable map of gaps and provider health.

## October 16 — House source probe safety and completeness gate

The four-hour supplemental House audit now queries at-large `-00` districts using a generic `US House` search scoped to their exact state, instead of the misleading `US House 0` string; an exact 2026 general-election, district and candidate-detail match is still mandatory. If civicAPI returns 429/502/503/504 or a transport failure, the audit stops further requests for that batch, emits explicit `NOT_CHECKED_UPSTREAM_PAUSED` records for every unattempted district, and reports planned versus actually attempted probes. These are **unknown**, not a failure to index a race and never zero votes. The GitHub source-preflight workflow checks its House probe outcome and fails if the probe script fails; a source discovery audit cannot silently disappear behind two passing office-source checks. This is bounded sampling, not 435-race live results certification.

## October 16 — rotating nationwide source-gap audit (not a full feed)

`scripts/probe_house_coverage_2026.py` reads the repository's validated **435-seat state apportionment** and separately identifies every House district outside Open America's 22 primary states. Each four-hour preflight checks six persistent high-interest districts (NH-01, ME-02, NV-03, NE-02, NY-17 and WI-03) **plus ten rotating districts**, keeping requests bounded. The rotation traverses all non-anchor districts if each scheduled run succeeds; missed or delayed runs mean no guarantee of complete coverage. The preflight retains source-identity details and missing/ambiguous/outage reasons in a short-lived JSON GitHub Actions artifact (15-day retention) and a human-readable step summary. No payload becomes a national vote feed, a source-derived polling average, or an independent professional call.

The prior six-district direct-provider trial confirmed exact 2026 source records for five districts and *NH-01 not indexed* on October 15; this observation may change as the provider indexes more races. The script measures **indexability of audited samples**, not nationwide election results, candidate wins, or a verified fraction of all 435 races. All source probes check browser CORS, general-election race identity and candidate detail schema. Until independently verified election-night data arrive, zero reported votes remains unreported.

## October 15 — current source status (supersedes early integration notes below)

The Open America primary provides **22-state 2026 House/Senate/Governor coverage** where valid live data are available, not nationwide source coverage. The civicAPI integration is active for individually verified source records and supplemented by bounded source-probed Senate and governor state batches. A new dedicated **House general-election adapter** enforces exact 2026 district keys from the 435-seat apportionment, unique Nov. 3 House search results, candidate/party totals, provider race IDs, timestamps and same-race detail identity before results may appear in the dashboard or experimental nowcast. An unsupported/unindexed district remains **unknown**, not an inferred zero or a call.

The House adapter improves the safety of existing curated/pinned House discovery, **not** the number of districts the external provider guarantees to cover. It does not make the site a nationwide results provider. There is still no professionally licensed call feed, 65 Senate holdovers are assumptions rather than independently reconciled calls, and no complete live 2024 chronology has been obtained for reporting-order backtests. Open America primary states remain primary-owned; a stale primary does not silently promote secondary records for those states.

Provider winner indicators are always labeled **unofficial civicAPI calls** rather than AP calls, professional independently corroborated calls, or certified election results. More broad-based House/Governor identity probes and true nationwide source coverage remain open.

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
- **Partially integrated as of October 15.** Multiple individually verified 2026 statewide race IDs and source-matched watchlist House districts use v2 search/detail checks with direct-browser CORS. The new House adapter requires exact 2026 general-election/district identity; full nationwide reach, same-race 2024 historical comparisons, independent professional-call validation and national coverage certification remain open.
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

A second **independently attributed** browser data source now supports the election-night personal watchlist for 2026 races in states missing from Open America's 22-state feed. [civicAPI v2](https://civicapi.org/api-documentation) returned CORS `Access-Control-Allow-Origin: *` and a structurally valid Nov. 3, 2026 race search for **New Hampshire US Senate, NH Governor** and 2026 Nevada statewide races in the Oct. 13 GitHub Actions source probes. **Important coverage correction:** the separate Oct. 13 source-real check for **NH-01 returned no indexed race** when queried as `US House 1`; NH-02 has not passed an equivalent targeted contract test. Neither NH House district should be described as individually verified. An independent, source-real contract test checks the actual discover + candidate-detail endpoints before deployment. Its secondary `getElectionDates` directory returned 503, so the dashboard does not depend on that directory.

**Isolation:** civicAPI is used **only for a user-pinned 2026 race outside the primary provider's 22 supported states**, and only while Election Night is open. It is never merged into the primary provider House/Senate/Governor totals, not counted as primary official-state-derived votes, and not used to estimate nationwide chamber control. Its calls are shown only as explicitly **civicAPI calls**, not official certifications or votes/projections from AP/DDHQ. Other possible sources are not quietly treated as verified calls.

**Exact matching:** Query by country US, Nov. 3 date, two-letter state, human-readable office, and then require exactly one source race with the expected state, office, complete known 2026 House district key or null statewide district, qualifying November general election, no primary/runoff and a numeric provider ID. Fetch the full record by that exact provider ID and reconcile the date, office identity, candidate list, vote totals, percentage fields and provider call flags before rendering. Pre-election votes or calls, impossible percentages, negative counts, duplicate candidate keys, a dated source regression, and a sudden change from counted votes to zero all fail closed. No source votes are persisted by the app beyond the browser session; only user-selected pins are retained. Link to original civicAPI records for independent checking.

**Rate limits:** No national bulk polling. Only individually pinned races, at most twelve supplemental out-of-coverage races per automatic refresh, requested serially. Before Nov. 3, repeat queries no more than once every ten minutes; during the election-night period, no more than once per minute while the watchlist is open. Verified race IDs are cached in session so subsequent refreshes request only their small detailed records. If civicAPI is unreachable or no unique match exists, the item remains source-unavailable, never zero. These frequency controls supplement, rather than replace, the 60-second Open America refresh.

**Limitations:** Watchlist-supplemental coverage is not proof of 50-state continuous reporting. Specific candidate / special-race identity and independent winner-call behavior remain dependent on civicAPI's reporting quality, timestamps, and attribution. The model's probabilities are untouched.

## New Hampshire Senate adapter pilot (October 13; build → test → merge → stop)

The first **individually testable civicAPI race adapter** is
[`scripts/civicapi_nh_adapter.js`](scripts/civicapi_nh_adapter.js), used only for the
**2026 New Hampshire US Senate general election** (`NH-SEN`, internal `Senate|NH`).
This does not introduce a second winner-call authority or expand state coverage.
The personal watchlist and 35-contest Senate board still label its results as
**civicAPI** and keep those vote totals completely separate from Open America.

The pilot locks the discovery query to `country=US`, `province=NH`,
`2026-11-03`, `US Senate`. Its source matcher rejects House races,
September primaries, specials, invalid dates, municipal elections and
multiple plausible NH Senate races. The race-by-ID response must agree on the
provider ID (where included), state, office, election date, seat and contest
name. Candidate totals must be safe nonnegative integers; identities unique;
candidate percentages consistent with vote counts; and at most one candidate
can have a provider call. Votes and calls cannot appear before Election Day;
stale/future-dated sources and no-vote winner flags are rejected. There is no
fallback to an unverified candidate or zero total if validation fails.

Tests: `node scripts/test_civicapi_nh_adapter.cjs` (standalone,
fixture-based checks) plus `node scripts/test_dashboard_runtime.cjs`
(real application DOM and source-isolation coverage). Both are PR gates, alongside
the already existing real-source CORS/scheme smoke test. The deployment remains
a live-feed *readiness* integration: there are no authentic November 2026
general-election votes to verify until counting begins. Other states retain
their existing generic, separately attributed experimental adapter; none
are declared validated by the NH pilot alone.

## New Hampshire governor adapter pilot (October 13; second build → test → merge → stop)

`scripts/civicapi_nh_governor_adapter.js` is now the narrowly scoped second adapter, only for the **Nov. 3, 2026 New Hampshire governor general election** (public pin `NH-GOV`, internal `Governor|NH`). Independent live-source verification finds this exact race indexed under civicAPI race ID 87284. The adapter searches by state, date and office; rejects Senate, House, primaries, other dates, local races, duplicate results and detail records for another race; validates candidate identities, count/percentage agreement, zero-vote call flags and timestamps; and attributes any provider call as **civicAPI**, not an official certification.

The generic fallback for other states is unchanged. No NH House or nationwide coverage is asserted from this integration. In the browser, the governor feed only supplements personally pinned races outside Open America's supported states. It cannot alter official-state-derived source totals, and a bad later provider response retains the most recent valid record with an error indicator.

Verification: `node scripts/test_civicapi_nh_governor_adapter.cjs` (deterministic invalid/valid source fixtures), plus full `node scripts/test_dashboard_runtime.cjs` (real watchlist interactions, source isolation, and failed-update retention). PR CI requires both source adapters' tests and the live civicAPI browser-CORS check, which now demands the exact NH Governor record. Genuine November vote counting cannot be tested before Election Day.

## Four-state civicAPI race batch: Alaska, Maine, Massachusetts, Nevada (Oct 13)

After two small New Hampshire pilots, a single common `scripts/civicapi_state_batch.js` now performs the same strict search/detail validation across **four additional states and six independently indexed statewide Nov. 3 contests**:

| State | Verified 2026 office | civicAPI race ID |
|---|---|---|
| Alaska | US Senate | `86916` |
| Alaska | Governor | `148898` |
| Maine | US Senate | `87188` |
| Maine | Governor | `87189` |
| Massachusetts | Governor | `87276` |
| Nevada | Governor | `87260` |

The real-source discovery gate `scripts/probe_civicapi_batch.py` checks CORS, exact race ID, country, state, Nov. 3 date, statewide seat, expected stage, search/detail agreement, and candidate shape **for all six IDs** during PR validation. Massachusetts Senate was **not** returned as an exact indexed race by the first 20-result search and is deliberately **excluded**, along with Nevada Senate (not a 2026 contest), House seats, and races whose source coverage is not proven. Missing or ambiguous records remain unavailable, never zero.

Each adapter enforces the exact 2026 office/state/ID, a bounded single search match, consistent candidate vote counts and reported percentages, unique candidate identities, no pre-election votes or calls, at most one provider call, and source timestamp sanity. On a failed or regressed fetch, the app retains its previous verified per-race result and marks that provider as retrying. All six races remain *supplemental civicAPI* records; they never alter Open America state-derived totals, historical research, or JackStradamus probabilities. civicAPI winner flags are explicitly provider calls, not certification.

Local deterministic verification: `node scripts/test_civicapi_state_batch.cjs` tests all six fixtures and cross-state/office attacks. Browser integration in `node scripts/test_dashboard_runtime.cjs` pins a race in each state, verifies independent source IDs and links, preserves last-good data after bad details, and tests isolation from the primary provider. The existing New Hampshire pilots and full dashboard regressions remain running. Real 2026 counting will still require an Election Day smoke test.

**Larger batch policy:** work in approximately four states per PR when upstream actually indexes the races; confirm provider identity first, build all passing races in one shared adapter, test on simulated counts and real-source metadata, merge only on green checks, then stop. Never treat an unindexed race as covered.


## Seven more source-indexed races: Ohio, Wisconsin, Nebraska, Kansas (Oct 13)

The second four-state build extends the existing strict `scripts/civicapi_state_batch.js`
adapter with these individually verified **November 3, 2026** provider identities:

| State | 2026 contest | civicAPI ID | Internal race key |
|---|---|---|---|
| Ohio | **US Senate special election** | `87527` | `Senate|OH-special` |
| Ohio | Governor | `87365` | `Governor|OH` |
| Wisconsin | Governor | `87491` | `Governor|WI` |
| Nebraska | US Senate | `87254` | `Senate|NE` |
| Nebraska | Governor | `87255` | `Governor|NE` |
| Kansas | US Senate | `87162` | `Senate|KS` |
| Kansas | Governor | `87163` | `Governor|KS` |

The Ohio special is **not** interchangeable with a regular Ohio Senate contest.
The adapter demands source name `Ohio US Senate Special`, source ID `87527`, the
November general-election date, `US Senate` class and `General` stage, and
retains `OH-special` as its internal result key. A mismatched office, regular
seat, date, district or source ID fails closed. Provider winner indicators remain
*source calls*, never official election certifications. Unindexed races are
unknown, not a zero-vote result.

Source discovery uses `scripts/probe_civicapi_oh_wi_ne_ks.py` to query
**actual civicAPI search and detail JSON** through browser-CORS-compatible
requests, cross-checking all seven IDs and candidate list shapes.
`scripts/test_civicapi_oh_wi_ne_ks.cjs` supplies simulated counts to check
party totals, percentages, premature votes, identity substitution and winner
flags. The main DOM regression checks the actual personal watchlist for all
seven contests, a wrongly identified Ohio Senate detail update, provider
separation, and last-good result retention.

The new coverage is limited to these seven verified source records. There is
**no claim of comprehensive county results, nationwide House coverage, or
live November 3 votes before Election Day**. As before, no civicAPI tally is
added to Open America's primary source or to JackStradamus probabilities.

## Five-state source-verified pilot: Illinois, Kentucky, New Jersey, New York, Oregon (Oct 13)

The next **five-state batch** adds seven additional Nov. 3, 2026 statewide civicAPI source records, each independently found through a search request followed by a browser-CORS-verified race-by-ID detail request:

| State | Statewide race | civicAPI source race ID |
|---|---|---|
| IL | U.S. Senate | `87129` |
| IL | Governor | `87130` |
| KY | U.S. Senate | `87174` |
| NJ | U.S. Senate | `87302` |
| NY | Governor | `87329` |
| OR | U.S. Senate | `87374` |
| OR | Governor | `87375` |

The source identity is pinned to exact state, office, stage, race name and ID in `scripts/civicapi_state_batch.js`. The unchanged source validation also rejects mismatched detail records, malformed vote/percentage distributions, duplicate candidate identities, pre-election totals, premature provider calls, regressed source updates and multiple competing search matches. An API error leaves the last verified browser-local result intact, labeled as retrying rather than incorrectly zero. civicAPI data **never enters the Open America national totals or JackStradamus probability calculations** and an upstream `winner` flag is explicitly attributed to its publisher rather than certification.

Release gates are `scripts/test_civicapi_il_ky_nj_ny_or.cjs` (7 distinct simulated race fixtures with negative cases), `scripts/test_dashboard_runtime.cjs` (actual seven watchlist pins, external source links and failed-update preservation), and `scripts/probe_civicapi_il_ky_nj_ny_or.py` (real provider search, CORS, exact seven IDs and matching detail). Source discovery does **not** establish real election-night vote operations until counting is underway on November 3.

## Five-state Senate-first expansion: Alabama, Montana, New Mexico, Oklahoma, Tennessee (Oct 13)

A single source-verified batch adds **eight exact statewide 2026 civicAPI records** across five previously uncovered states:

| State | 2026 race | Verified civicAPI ID |
|---|---|---|
| AL | Senate | `86907` |
| AL | Governor | `86908` |
| MT | Senate | `87247` |
| NM | Senate | `87288` |
| NM | Governor | `87289` |
| OK | Senate | `87526` |
| TN | Senate | `87475` |
| TN | Governor | `87476` |

Each identity was checked against a real Nov. 3 `race/search` record followed by the corresponding CORS-compatible `race/{id}` detailed source, including office, state, date, stage and candidate-list shape. The Oct. 13 Oklahoma governor discovery **did not pass** the same exact statewide office/stage matcher; it is **not** included as a verified adapter or assigned any result.

The shared adapter continues to reject mismatched IDs, primaries, special-election substitutions, wrong offices/states/dates, ambiguous search results, impossible vote/percentage distributions, premature reporting or calls, and invalid timestamps. Failed provider updates retain the latest valid counts, labeled as retrying. Vote reporting is supplementary and attributed to civicAPI only; no values mix into Open America source totals or JackStradamus odds, and civicAPI winner flags do not establish official certification.

Testing: `scripts/test_civicapi_al_mt_nm_ok_tn.cjs` exercises all eight source IDs plus negative cases; `scripts/test_dashboard_runtime.cjs` pins and renders all eight from the actual Election Night controls, verifies per-race source URLs and primary-provider isolation, and preserves Montana's last-good count after a wrong-ID response; `scripts/probe_civicapi_al_mt_nm_ok_tn.py` verifies real browser CORS/search/detail identity for all eight in CI. **Real general-election counting must still be checked on November 3.**

## Five-state California/Delaware/Maryland/South Dakota/Wyoming civicAPI batch (Oct 13)

This release extends the source-isolated civicAPI watchlist adapter to **seven independently verified November 3, 2026 statewide races**:

| State | Election | civicAPI race ID |
|---|---|---|
| California | Governor | `86952` |
| Delaware | U.S. Senate | `87036` |
| Maryland | Governor | `87198` |
| South Dakota | U.S. Senate | `87446` |
| South Dakota | Governor | `87447` |
| Wyoming | U.S. Senate | `87496` |
| Wyoming | Governor | `87497` |

A live source discovery also tested Mississippi Senate, but it did not pass the exact office/stage/November 3 search match. It is **not** included, assigned zero, or represented as operationally confirmed. Maryland governor independently passed the same source test and replaced it for the fifth state.

The shared `scripts/civicapi_state_batch.js` enforces the seven immutable race IDs, exact general/statewide office class, date, source state, stage and name, vote percentages, unique candidate identities, timestamps and pre-election reporting guardrails. Bad provider updates never erase last-known-good source records. civicAPI data remains attributed and completely separate from Open America state reporting, chamber totals and JackStradamus race probabilities. Any publisher winner flag is not an official election certification.

Tests: `scripts/test_civicapi_ca_de_sd_wy.cjs` validates all seven fixture identities and adversarial source payloads; `scripts/test_dashboard_runtime.cjs` exercises actual Election Night pinning, individual state-source deep links, last-good preservation after a deliberately incorrect California race ID, and primary-source isolation. `scripts/probe_civicapi_ca_de_ms_sd_wy.py` requires the seven real provider CORS/search/detail records on GitHub Actions. The existence of indexed races **does not** imply Election Day counted-vote availability; verify that live on November 3.

## Nationwide 35-race Senate desk (October 13)

A new collapsible **35-contest Senate results monitor** is driven directly by `data/seat_universe.json`: 33 regular races and the Florida/Ohio special elections, with precise different keys (`FL-special` / `OH-special`). It validates all 35 named ballot slots before rendering. The primary Open America provider handles its supported states; civicAPI provides separately identified data for individual unmatched-state races. **Source totals are never merged or extrapolated**. A count of recorded races means that a trusted provider reported at least one vote, not that the seat has been won. A civicAPI call is separately labeled as a *provider call*, not official certification.

The desk has a **Track all 35** control, which does not consume the separately saved 40-race personal watchlist quota. The button persists the user's preference in this browser; tracking defaults to enabled on the morning of Election Day if never set. Outside the 22 primary-source states, the civicAPI requests continue to be serially bounded to at most 12 per sweep and rotate over uncovered Senate races (and any other user-pinned uncovered races); election-night cadence is no faster than 60 seconds. The other main Senate source can refresh in the background even while the user views House/governor results. The desk stays visible, with all 35 source identities, even when tracking is paused. Clicking an unsupported-state seat opens its exact validated candidate detail in the panel, not a made-up leaderboard.

The same validated seat inventory fixes the legacy pin parser: `FL-SEN` and `OH-SEN` resolve to the 2026 **special**, while `CA-SEN` and other noncontested 2026 state Senate codes are rejected after the universe loads. Older saved Florida/Ohio regular-key pins are migrated to the actual special-seat keys without requiring manual user cleanup. Only source-reported vote counts appear on the election-night display; this remains distinct from the dated DDHQ congressional-control forecast.

## Personal watchlist alerts and browser notifications (October 13)

The Election Night desk now contains a compact **Watchlist Alerts** inbox for individually pinned 2026 House, Senate and governor races. It records the **first genuinely reported vote batch**, **party-lead changes**, **candidate-vote reallocations without any net total-vote increase**, **a watched race withdrawn from the primary source**, and **new civicAPI provider winner calls**. These are the only alert-worthy events; ordinary vote accumulation, unchanged refreshed timestamps, static polling snapshots and unpinned nationwide Senate rows do not produce browser alerts. Each event carries the race/office and provider explicitly. A civicAPI race call is always labeled a *provider call, not official certification*. Open America never supplies race calls and the app cannot invent them.

Events are generated only from **two successive validated source snapshots** after November 3, not from an initial import of already-running counts; no backfilled or pre-election vote alerts are sent. Primary race comparisons use actual candidate votes even when the provider's aggregate update timestamp remains constant. The event signature includes source, office, race, event type and candidate-vote fingerprint, preventing repeated identical source readings without concealing different same-total corrections. civicAPI entries require the same exact 2026 state, seat, general-election date and race ID used by its candidate detail adapter.

The small inbox retains up to 35 notable events in this browser's local storage; **Clear** empties it. None of these events or preferences goes to the app's server. *Desktop alerts are off by default*, requiring an explicit click and the browser's own notification permission. Unsupported/blocked browsers keep the on-page inbox. Desktop alerts operate while the Election Night browser is open and refreshing; this isn't an unattended push service, and a laptop may suppress notifications while sleeping. No retroactive alerts are generated for already counted votes on opening the page.

## Local resume after laptop refresh (October 13)

While 2026 general-election results are being reported, Election Night stores one last-valid **Open America 2026** result snapshot per office and up to 70 observed race movements in that browser's `localStorage`. No vote content is sent to another service, and this does not create a public results mirror or a permanent historical election-night archive. It is simply a local session-recovery copy.

On page reload, the app checks the storage version, election date, save timestamp (maximum age **72 hours**), each office's full original source integrity contract and the shape of all saved movement records. It either restores the complete validated snapshot collection or leaves it unused; corrupt, cross-office, pre-election and expired data are rejected. The UI labels restored values **RESTORED BROWSER SNAPSHOT** and **RESTORED · REFRESHING**, not live counts, until the remote source reconnects. Failed remote refreshes retain the locally verified results. After the first valid 2026 provider response, normal source freshness statuses resume.

A different 2024 rehearsal source never saves or restores as 2026. Stored events do not automatically trigger desktop alert pop-ups again after reload. Browsers that block or exhaust localStorage still display live results normally but cannot resume locally. This does not persist civicAPI supplemental vote totals or source race calls, which remain per-session only.

## One-click personal CSV audit (October 13)

The Election Night activity panel supports **Export vote CSV** and **Export activity CSV** in 2026 mode. This is an on-demand browser-only download: no uploads and no server storage. Reported-vote exports enumerate the actual candidate votes in separately attributed **Open America** and **civicAPI** columns (with their own original URLs, provider timestamps and precinct-reporting figures). civicAPI source calls are explicitly labeled as *provider calls*; Open America never generates a fictional call. The export does not sum, impute or substitute counts between providers, and ignores unreported zero-vote races.

Activity exports include the actual changes observed while this browser was running or restored from the 72-hour local-resume store: first batches, net vote increases, downward revisions, vote-leader changes, same-total candidate reallocations and removed source races. This is not a historical replay, a national audit log or evidence of an election irregularity. All spreadsheet text, including source-supplied candidate names, is escaped for Excel-style formula-injection safety, with UTF-8 BOM and CRLF rows. Both buttons remain disabled until a validated report or actual local movement exists. Personal exports remain the viewer's responsibility to store.


## November 3 laptop stress rehearsal: independent sources and outage recovery (Oct 13)

The actual Election Night app now uses a **four-worker bounded civicAPI sweep** over a rotating set of up to 12 source races per cycle, rather than one serial request per race. Both the source discovery and detail requests have a **12-second browser-side timeout**. An abort is attempted when supported; timeout is enforced even if a fetch ignores abort. Each source failure is isolated to its exact race, which retains the last verified tally with **SOURCE RETRYING**. Simultaneous manual refreshes cannot duplicate an in-progress sweep. Subsequent cycles still rotate beyond the first 12 watchlist/national Senate entries.

A failed foreground Open America request now **continues refreshing other watched offices** independently. The dashboard does not borrow another office's votes, and current-office failure retains the last validated snapshot. A late response from a superseded request cannot overwrite a more recent accepted snapshot; a separately fetched older `as_of` is also rejected, and recovery clears the stale/error state.

The existing GitHub Actions `scripts/test_dashboard_runtime.cjs` now includes an integrated **simulated election-night failure sequence**: hung civicAPI fetch and abort timeout, four overlapping supplemental requests with one blocked source, duplicate sweep prevention, cross-office Senate voting during House outage, late/out-of-order HTTP response, timestamp rollback rejection, source recovery, and no manufactured provider calls. Simulated votes are fixtures **only**, not real Election Day results. The same comprehensive PR suite tests polling forecasts and all source-verified state adapters. Run locally after installing `jsdom@26.1.0` with `node scripts/test_dashboard_runtime.cjs`.

Unverified until November 3: end-to-end real provider vote availability, browsers under sustained multi-hour live traffic, provider rate limits and live alert delivery. The rehearsal explicitly does not claim those are proven.

## Race-level probability desk and live-source health — October 14

The Election Night page now displays an eight-race **experimental, two-party win probability desk** from the same validated `data/race_probabilities.json` priors as JackStradamus. Personally pinned races with available poll-based priors appear first, followed by competitive Senate contests and other polled races. Races with no validated poll prior do not silently become 50/50 bets. Florida and Ohio special Senate ballot identities map to their 2026 `FL-SEN`/`OH-SEN` polling records without confusing different election types.

**Live-informed updates** use the existing Open America and independently verified civicAPI vote adapters; they never scrape a third results source. The standalone `scripts/election_night_nowcast.js` computes a transparent normal-prior plus very noisy raw-return signal, with a geographically driven error floor (7 + 20 × (1 − reported precinct fraction)^1.3 margin points) and 0.75–1.60× noise sensitivity views. Eligibility requires both party candidates' votes, an actual precinct-reporting percentage of at least 10%, a correctly dated 2026 Election Night source timestamp, a recent (within three hours) validated source record, no source integrity failure, and a matching probability/polling snapshot. If a condition fails, the displayed number remains explicitly **POLL PRIOR**, not a live win estimate. This heuristic is **not empirically calibrated to geographic ballot-reporting sequences**; precinct share is **not** treated as vote share counted, and a provider call is not inferred from probability.

A collapsible **Source health** section shows each primary House, Senate, and Governor office separately (connected/standby, delayed, retrying, restored), last provider update and last browser check, plus the number of monitored civicAPI races with validated details and retrying requests. A partial source outage does not convert stale votes into a new forecast or erase previously validated vote totals.

This is a race-level view, **not a 435-House / 35-Senate probability of chamber control**. The previously published DDHQ congressional joint outcome probabilities remain separately labeled as an external **pre-election forecast**, never recast as live-updated JackStradamus model odds. Poll-only/uncalibrated sources, missing fundamentals, lack of county/precinct mix and correlated national errors prevent responsible implied Senate+House control probabilities from this incomplete source. Implementing a national nowcast requires those extra inputs and historical calibration.

Tests: `node scripts/test_election_night_nowcast.cjs` checks priors, candidate identity, missing party votes, date/staleness/small-count gates, posterior moves and uncertainty; the actual `scripts/test_dashboard_runtime.cjs` verifies the Election Night cards and source-health panel against a 2026 synthetic count. No synthetic counts are shipped into production or described as real votes.

## Built-in interactive election-night rehearsal (October 14)

In the live 2026 Election Night page, the **Try simulated election-night rehearsal** control lets a viewer step through five strictly fictional count stages: before votes, 12%, 42%, 72%, and 94% of simulated precincts. The demo covers four polled Senate contests — NC, MI, GA and TX — with deterministic sample Democratic/Republican vote totals, evolving synthetic margins and the **same real polling-prior + deliberately noisy returns** probability code used by the live panel. This makes it possible to see how the model responds before any actual November 3 results exist.

The panel is hidden until explicitly opened, and always displays **SIMULATION ONLY · FICTIONAL VOTES · NOT LIVE RESULTS**. The simulated records live only in the `scripts/election_night_rehearsal.js` helper and its rendering panel. They are never written to `enData`, `enOfficeSnapshots`, `enCivicByWatch`, actual alerts, national vote statistics, export data, or browser persistence. The model's now-time in the helper is a fixed November 4 2026 training timestamp, and is never fed into actual result processing.

`scripts/test_election_night_rehearsal.cjs` asserts every fictional phase, party-vote consistency, no publisher calls, model updates and input nonmutation. `scripts/test_dashboard_runtime.cjs` clicks the real UI buttons through all phases, then verifies **unchanged actual race totals, watchlist, alert inbox and resume cache**. No real election-night outcome predictions or past counting patterns are claimed by the fictional examples.

## Retrospective polling-error audit and changed House map safeguards (October 14)

The live joint probabilities now include a collapsible historical polling-error audit on the home page and Election Night. It reads the repository's independently archived 2020, 2022 and 2024 Senate polling backtest; reports each year's signed Democratic poll-minus-outcome error and a leave-one-cycle-out comparison to shrunk historical bias correction. **This is retrospective, not prospective calibration**: poll fieldwork end dates were recorded, but first-publication timestamps were not. The data comprise only 42 Senate races from three years; they cannot establish 2026 race-level probability coverage, independent House district error or correct joint-chamber forecasts. Historical partisan error correction is **not automatically applied**.

A geographic safety correction also stops fixed assignment of 2024 margins to 2026 redrawn districts by old district-number ordering. The joint model now gives unpolled redrawn districts an exchangeable state-level baseline, and reassigns the prior year's complete state district-margin distribution without replacement on **each** simulated election. Statewide seat-mix context is retained, but none of those individual new-district baseline predictions claims a verified old-to-new geography match. Genuine 2026 district polls remain district-specific; all nine fully redrawn states are checked for complete margin-bag coverage. A partially redrawn state fails closed pending a stronger reconstruction. This does not replace Census/presidential precinct reaggregation or candidate fundamentals.

## October 15: early evening observed House district comparison — NOT a national swing

The background-friendly Election Night overview now has a compact **early local check** sourced from the existing source-validated Open America 2026 House vote adapter and the original pre-election `data/race_probabilities.json` polling margin for the **same 2026 House seat**. It requires an exact House office/race key, valid 2026 post-election-start timestamp, fresh provider, 1,000+ recorded votes, at least **80% precincts reporting**, and positive Democratic and Republican candidate votes. It displays the observed D–R two-party vote margin against the static poll-only margin for up to three predeclared early House races, and repeats that comparison within the collapsed early-race checklist. There are explicit labels: **local reported votes; no county, vote-method or national extrapolation**. Historic 2024 archive and missing/stale 2026 sources can never produce this indicator. Browser tests exercise valid, 12%-precinct and stale inputs.

This is a useful first testable intermediate step, **not yet the requested geographically calibrated NYT-style needle**. It must **not shift other races, national environment, House/Senate probabilities or race calls**. Statewide early vote shares, precincts-reporting percentages and reported vote leads remain insufficient for county outperformance inference. Next, ingest signed county/precinct results with voting-method breakdowns; establish 2024 expected baselines for *the same actual 2026 geography*; estimate ballots outstanding and systematic county/mode bias; then run 2024-style reporting-order holdout replays. Only after these tests can local-vote residuals inform a correlated shared election-night shift.

Official future data candidates: [North Carolina state board historical precinct vote-method files](https://www.ncsbe.gov/results-data/election-results/historical-election-results-data) and [Virginia elections JSON reporting page](https://www.elections.virginia.gov/results/). Their presence is not proof of an operational 2026 downloadable county feed from the viewer's browser. Each adapter still needs schema/CORS, provenance, timestamp and replay acceptance tests.

## JackStradamus four-ending joint-control Monte Carlo — experimental beta (October 14)

The Election Night page now displays **four exclusive model probabilities** for Blue Tsunami, Blue Wave (both Democratic chambers *excluding* tsunami), Shrug (split), and Red Dawn (both Republican), in addition to the existing exact-source race counts and isolated DDHQ published forecast reference. Blue Tsunami now requires **at least 235 Democratic House seats and 52 Democratic-aligned Senate seats**, while Blue Wave requires **Democratic control of both chambers (218 House / 51 Senate)** but not Tsunami. The previous 18-of-20 battleground gate was retired. This differs intentionally from Polymarket's looser Blue Wave (218/49) and Tsunami (235/51) proposition contracts. Full methodology and caveats are in [SCENARIOS.md](SCENARIOS.md).

This is not merely a poll-margin probability or a DDHQ reskin. The new `scripts/chamber_control_model.js` runs 3,000 seeded elections with 435 House seats, 35 Senate elections, 34 Democratic caucus and 31 Republican holdover assumptions, and explicit correlated national/chamber/state shocks. Inputs come only from the repository's 2024 historic House vote staging, the Census-derived 2024-to-2026 map audit, 2020–24 Senate history, and current poll-derived race odds with an exact polling-snapshot checksum. Redrawn state seats use an *unordered* prior-year state seat-margin distribution, **not** a false 2024-to-2026 district assignment. Unpolled slots are imputed with wide uncertainty, not marked zero or assumed to have valid contemporary polls.

The browser selectively blends **validated actual source counts only** into race posterior margins after 10% reported precincts and a fresh post-November 3 timestamp. A failed source or stale source cannot supply new evidence; missing data leaves the vote-informed portion of that race's model unchanged. Both source health and internal four-outcome probabilities are visible on Election Night; published primary/supplemental tallies, alerts, official provider calls, and saved caches are separate. Sensitivity switches widen/narrow assumed election errors and shift the national environment ±3 points.

**Important:** This is an **uncalibrated personal beta**. Its imputed/redrawn seats and correlated errors are heuristic, so the exact percentages are not verified predictive calibration. A 3,000-draw simulation provides numerical frequencies conditional on the assumptions, not frequency guarantees. It requires actual historical holdout validation and Nov. 3 live counting checks before being treated as a dependable statistical forecast. Actual and synthetic sources are never mixed. Tests `scripts/test_chamber_control_model.cjs` and `scripts/test_dashboard_runtime.cjs` are hard GitHub Actions CI gates.
