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
