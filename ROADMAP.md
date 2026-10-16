# JackStradamus · development plan

**Direction:** A personal election site with the utility of a serious polling desk and occasional deadpan humor. No forced jokes, no repetitive methodology cards, no controls that exist just because they can.

## October 15 owner priorities — current architecture overrides older historical notes below

**The intended user experience:** Open one desktop browser window while watching TV. At a glance: both-chamber *actual* control probability, Four Endings (real Democratic control at 218/51; Tsunami 235/52), fresh polling changes, source-confirmed calls, meaningful Bellwether alerts, time of last valid result and data-quality state. One click for office, state or race drilldown. Disclosures stay available under details rather than occupying the main desk. All odds must derive from the same correlated draw revision, with model-source timestamps.

### Now (P0: electoral integrity and reliability)
- [x] Four exclusive **actual-control-based** outcome buckets in the correlated model: Tsunami ≥235 House/≥52 Senate; Wave ≥218/≥51 excluding Tsunami; Shrug split control; Red Dawn Republicans both. These reconcile to the actual 51-seat Senate majority, not the looser Polymarket 49-seat prop.
- [x] Shared home/night definitions and test cases; dashboard copy trimmed, original recorded Fish Head clip retained with bottom-up arrival; concise curated Bullshittery pulse restored to Daily Brief.
- [x] Oct 15 official North Carolina source review: 1,392 **planned citizenship-verification letters**, no automatic deregistration or observed lost ballots; linked one review lead to documented case without increasing its monitoring risk by guess.
- [ ] **Polling parity audit:** verify Silver CSV row identities, actual active model coefficients and partial 28 Senate/98 House coverage; publish per-race blend diagnostics. Keep paid subscription export/license restrictions in view.
- [ ] **Integrity review service:** conservative related-headline grouping and 50-state tagging have been implemented; two individual cases (NC notices and CA federal eligibility-review demand) received primary-source checks. **Remaining:** independently review the large live backlog, validate official case consequences/remedies, deduplicate actual affected voter records, add court docket follow-ups and state-specific deadline reminders. Headline counts are not affected-voter counts.
- [x] **Shared office source-freshness gate (October 15):** Every Election Night office button, feed-status counter and national reconciliation now uses the same ≤3-hour timestamp validation; an old non-live snapshot cannot be presented as a healthy source, while pre-election empty feeds are labeled standby rather than misreported as failures. Tests cover failure/recovery, standby, invalid schema, future timestamps and vote records missing a source timestamp. This does not solve nationwide source gaps.
- [x] **House supplemental source integrity (October 15):** Every civicAPI House race outside the primary provider now goes through a dedicated exact-district 2026 general-election adapter, with all 435 valid seat keys, source race ID, detailed candidate arithmetic, stale/early/future timestamp and ambiguous result checks. A missing or unsafe House race remains unavailable; this does **not** guarantee national House coverage or a professional call.
- [x] **Rotating House source coverage diagnostic (October 16):** a bounded four-hour preflight now probes six priority races plus ten rotating source gaps from the validated 435-seat inventory, checks exact Nov. 3 general-election identity/CORS, and stores a 15-day JSON audit artifact. It does **not** certify that every district has live results, resolve NH-01, or supply authoritative calls.
- [x] **Near-synchronous cross-provider D/R share diagnostics (October 16):** when overlapping source records share the same race, timestamps within three minutes, ≥5,000 two-party votes each and ≥90% comparable totals, warn about a ≥10-point Democratic vote-share gap even where both providers name the same leader. Advisory source quality only; no automatic source overrides, fraud claim, extra vote totals or changes to forecast coefficients.
- [x] **Browser-side civicAPI upstream backoff (October 16):** actual October 16 preflight HTTP 503s motivate bounded temporary circuit breaks for 429/502/503/504; escalating 1/2/5/10-minute cooldown stops forced/background sweeps from hammering an unhealthy supplement. Per-race source errors stay distinct from upstream HTTP failures, cached data is retained but not treated as verified current votes after error, and the source-health panel shows pause/retry time. Does not cover primary feed provider failure or create national coverage.
- [x] **Fail-closed civicAPI winner calls across provider outages (October 16):** a race error or shared upstream 429/502/503/504 immediately disqualifies all affected cached civicAPI winner flags and partial returns from joint simulation, race-nowcast, Wave Breaks, achievement triggers and office/control reporting. Expiry of a cooldown **does not** re-enable calls; a newly validated source detail must prove recovery. Open America primary still operates independently; historical source records remain auditable. Test through the real dashboard race-call source path under both per-race error and 503 recovery.
- [x] **National 35-Senate source-status freshness (October 16):** the national Senate desk now counts primary races as reporting only when the shared reconciliation's office-health classifier accepts the 2026 Senate snapshot, including no upstream error, restore-in-progress or stale timestamp. Out-of-primary civicAPI races also require a non-stale original source timestamp and per-race recovery gates. Earlier totals remain visible as audit-only source history, never counted as current coverage.
- [ ] **Election-night feed stress test:** 435-House/35-contest source reconciliation, simulated upstream outage checks and actual Chromium desktop/mobile tests are implemented. **Still missing:** real 2024 election-clock replay, nationwide 2026 source adapters, cross-provider live-data reconciliation, race-call/holdover completeness and load/failure soak testing. Current partial coverage is not a guaranteed national feed.
- [x] **Provider winner flag gate (Oct 15):** before a civicAPI flag may affect the experimental joint model or election-night milestone, require fresh ≤180-minute 2026 timestamp, correctly scoped House/Senate/Governor seat, numeric positive provider race ID, unique winner identity, valid normalized parties, positive winner votes, and no candidate-total arithmetic contradictions. A source flag remains **unofficial and not independently professionally reviewed**. Separate licensed professional-call integration and 65 Senate holdover reconciliation remain open.
- [ ] **Race-call hierarchy:** external professionally reviewed source calls under distinct attribution from *our own experimental win probabilities*; vendor/provider winner flags must pass schema, timestamp, candidate/race identity, and state scope checks. Never auto-call merely because odds exceed a fixed threshold.
- [x] **2024 true-clock archive admissibility harness (October 16):** a research-only module verifies original timestamped 2024 snapshot sequence, separately certified final vote totals, race/office identity, capture provenance and research rights; computes descriptive D/R margin errors by ballot fraction and tracks corrections/leader changes. Synthetic CI tests reject final-only pseudo-snapshots and wrong-cycle data. No archived AP payloads are redistributed and this is NOT a completed real 2024 chronological or geography-adjusted backtest.
- [ ] **Needle methodology:** fit county/precinct early votes relative to geographically matching 2024 baselines, account for absentee/early vs Election Day votes and outstanding ballots, and backtest on historical reporting-order replays before promoting geographic signals into the live national swing.
- [x] **Where the Wave Breaks relevance focus (October 16):** The full validated 35-seat Senate and broad tracked House rosters remain available on demand, but both Daily Brief and Election Night default to excluding races at ≥95% win chance for **either** party. Races without model odds remain visible only where Senate-wide or supported by current polling/source evidence. Office filters, exact-race search (which can find hidden safe races), and a reversible “Show full roster” control remain. Presentation-only; no changes to correlated odds or live-provider source queries.
- [x] **Where the Wave Breaks full race roster:** briefing and Election Night now expose every independently validated 2026 contested Senate seat (35 regular/special slots), the broad documented House editorial watchlist, additional qualifying House district polls and model-identified seats. A race does not have to be close or polled to remain on the Senate roster. Office filter, district search, scrollable keyboard-accessible grouped results, source attribution and missing-odds honesty are tested. This is not an election prediction or an addition to the forecast model.
- [ ] **Ambient-first design:** election-wide main screen, House/Senate/Governor drilldown buttons, collapsed watchlist with visible count, native keyboard focus, research controls behind disclosure, and real desktop/mobile Chromium smoke are now implemented. **Still missing:** tighter priority-event sorting, real live-source failure/continuity simulation, manual mobile/desktop visual inspection and full accessibility audit.
- [x] **Authentic John Brown portrait poster:** the Kansas milestone now uses actual 1859 John Brown photography from Library of Congress record 2009633567, with source credit, Kansas typography and local illustration fallback. **Follow-up:** vendor the archival image locally to avoid external CDN dependency; original public-domain reuse advisory says no known restrictions.
- [x] **Local Texas poll capture:** independently source-checked University of Houston TX-09 Senate (Paxton +1) and Governor (Abbott +4) *district electorate* questions appear in Poll Wire. Geographic samples are excluded from statewide Texas odds; fully automatic local poll discovery is still pending.
- [x] **Real-browser regression:** PR #133 runs actual Chromium desktop/390px mobile checks of offline source behavior, source-mode isolation, office switching, watchlist keyboard disclosure and overflow.
- [ ] **Fish Head audio:** current owner-supplied announcement MP3 is present. For a musical intro use owner-licensed audio or a new original news-bumper stinger; browser autoplay may need one explicit Preview click.

### Model interaction rule for Bullshittery

A monitoring-priority score or subjective event probability **never automatically shifts partisan vote margins**. Gate a sensitivity scenario on independently verified eligible-voter ballot effects (unit and dates), deduplicated statewide/counties, expected net effect on counted votes **including remedies and counterfactuals**, and uncertainty about any partisan skew. For credible impact only: report baseline and both-sided lower/upper bounds separately; require reviewer approval and robust backtest before allowing a default forecast revision.

---

## Current experience
- **Daily briefing:** Generic ballot, Senate polling overview, new surveys, race alerts, and the Bullshittery Index radar.
- **JackStradamus v1.4:** Four office tabs: Senate, House, Governors and National Generic Ballot. Averages use 21-day recency weights, bounded sample-size influence, published 538 historical accuracy/transparency ratings, and a symmetric 0.5× sponsorship factor. Explicitly excluded pollsters are declared, and unrated firms receive neutral quality weights. Every included poll shows its published influence and historical rating; full source-to-model reconciliation runs after refreshes. See [POLLING_MODEL.md](POLLING_MODEL.md). House/Gov coverage is still limited to races with polling, not all contests.
- **Race Lab:** Explore Senate, House and gubernatorial polls without altering the headline Senate model.
- **Bullshittery Index:** Separate sourced election-administration concerns from the candidate polling data.
- **Election Night (rehearsal ready; live unconnected):** First-party 2024 MIT/MEDSL House vote aggregates across all 435 voting districts, with missing-party disclosures and historical-geography safeguards. Open America's election-specific API disallows cross-origin browser fetches; the prior direct GitHub Pages integration did not work reliably. The 2026 view explicitly marks live counts as unconnected until a browser-compatible, authorized source is validated. No race calling or chamber forecast is implied.
- **Bullshittery Index v1.2:** Conservative 0–100 monitoring priority plus subjective, explicitly defined P(100+ otherwise-eligible voters unable to cast countable ballots because of the incident), with broad uncertainty ranges. Actual worst-case distinct people remain unquantified; exposure proxies keep their original units. See [BULLSHITTERY.md](BULLSHITTERY.md).
- **Congressional scenarios:** Red Dawn / Shrug / Blue Wave / Blue Tsunami are four mutually exclusive SAME-DRAW chamber-control outcomes. Blue Tsunami requires ≥235 House and ≥52 Senate seats; the underlying live control forecast and per-race probabilities use the same simulation. See [SCENARIOS.md](SCENARIOS.md).

## P0 — Substantially better race drilldowns
1. **Long-term race polling history.** Save older surveys and dated model snapshots to chart actual changes over months rather than drawing fake trend lines through 12 recent polls.
2. **Individual poll sources.** Capture poll-specific URLs, field start/end, likely-voter vs registered-voter samples, and sponsor information when supported by upstream data.
3. **Pollster track record v2.** Current quality ratings are pinned older 538 data; retrieve and compare Silver Bulletin's January 2026 update. Then train signed pollster house effects and partisan sponsor bias (beyond weight reduction), and compare alternative average methods on leave-election-cycle-out actual outcomes. Separate model changes from polling changes.

## P1 — What's changed?
4. **Since yesterday:** Report first-seen polls, substantive polling-average changes, and new verified Bullshittery developments in a compact morning briefing. Preserve baseline snapshots.
5. **Bullshittery Index v2:** Replace the subjective starter odds with sourced local implementation evidence and historically compared affected-voter rates. Determine unique voter exposure (vs records/counties), validate remedied registrations, and track whether the initial ranges were calibrated.
6. **Better race context:** Historical results, incumbency, fundraising and other non-poll indicators with explicit sources. Do not silently roll these into a polling average.

## P2 — Modeling beyond polling averages
7. **Calibrated uncertainty.** The previous 4-point vote-margin assumption is no longer displayed as a congressional-control probability. Fit time-dependent and possibly fat-tailed errors to real pre-election historical snapshots and outcomes. Expand fundamentals, district boundaries, national/regional common errors and full seat simulations before making election-outcome or chamber-control probability claims.
8. **Election Night nationwide control:** Source hierarchy and acceptance tests documented in [ELECTION_NIGHT_SOURCES.md](ELECTION_NIGHT_SOURCES.md). Expand beyond the Open America 22-state feed; test civicAPI as a secondary call/coverage provider; ingest structured state exports and site HTML via controlled state parsers. No control board until complete verified calls, holdover Senate seats and uncalled contests are reconciled. Add county benchmarks only from verified historical and current county vote data.
9. **Mobile polish.** Make overview-to-race navigation seamless and preserve direct links to individual races.

## Boundaries
- Polling margins are descriptive measurements, not outcome probabilities or projected winners.
- A chart of historical poll observations is not historical model output.
- A reported incident, an affected record and a disenfranchised voter are different things.
- Sources and units are more useful than more disclaimers.

## October 13 build notes (v1.4)
- Fixed root-level `blue-waves-hero.jpg` reference; removed the forced slogan.
- New polls now sort by official release timestamp when supplied, else scraper first-seen. Upstream currently provides **field-end only**, so the brief must not label first-seen as release.
- Expanded retained race observations from 12 to 60 to avoid dropping distinct firms from the analysis; no change to the symmetric 0.5× sponsored weight.
- Visible sensitivity and effective-pollster metrics help identify weight concentration without inventing a probability interval.
- Staged, *not deployed*, a Silver-inspired signed sponsorship-prior test. Future independent-poll error changed only marginally (2.837 to 2.799 points), and no historic election-result calibration exists to support enabling it.

### Silver-parity roadmap
1. **Pollster quality:** parse Silver's January 2026 XLSX, preserve original metadata, review aliases, and evaluate predictive plus-minus against archived 538 quality on held-out election years.
2. **Poll sample type and original release:** source poll URLs and LV/RV/adult breakdowns from primary records rather than guessing from the current ElectIndex CSV.
3. **Poll averaging:** fit local-regression smoothing and population corrections against strictly future polling observations, compare house-effect shrinkage and effective-firm caps.
4. **CANTOR-like polling priors:** ingest contemporaneous district/state partisanship, post-redistricting boundaries, national environment and geographic/electoral similarities; mark unpolled races as imputed, not surveyed.
5. **Classic/Deluxe:** add fundraising, incumbency, experience, and separately attributed Cook/Ettingermentum/Silver outside forecasts (respecting reuse terms and analyst correlations).
6. **Calibration:** time-stamped historical election-result holdouts, correlated national/regional error, seat-by-seat simulations, proper scoring rules and reliability checks. Do not claim a scientifically calibrated win percentage before passing these gates.

## Completed source and diagnostics upgrade — October 13
- Governors now use consistent machine-readable singular office type throughout Race Lab.
- Scoped polling-lead counts show surveyed D-leading, R-leading, tied and insufficient-data contests, never implied national chamber control.
- Added PollResults.org supplemental source to daily briefing with posted dates, original source links, LV/RV labels, and strict ID/source reconciliation; primary model unchanged.
- Staged the actual January 2026 Silver Bulletin historical pollster XLSX with validated column mapping; held-out next-poll testing and experimental race-level comparison are live, full correction not adopted.

### Still essential before probabilities or projected seats
- Verify current incumbent/holdover Senate rosters, complete House district coverage and statewide fundamentals; handle independent senators and unusual matchups.
- Link externally supported population labels and poll disclosures to the actual survey PDFs, including signed bias differences.
- Fit national/regional time effects and signed house effects with **historical timestamped election results** and leave-election-year-out holdouts, not one 2026 rolling feed.
- Fit correlated errors and validate reliability/coverage and proper scoring rules before attaching probabilities to who controls a chamber. Document differences from Silver/FLIPR rather than claiming a clone.

## October 13: daily brief redesign
- Replaced permanently featured largest-lead/closest-race tiles with event-based insights (leader flips, meaningful margin shifts, new competitive polls, and coverage improvements). Material changes are checked against a bounded model history, by **matching candidate matchups**, not ad hoc headlines.
- Put new polling postings and election reporting higher on the daily brief, before the static cards.
- PollResults.org posted-poll ordering uses source **date/time** (full `createdAt`); timezone remains unknown, and this is not an independently verified public release timestamp. Priority: add verified original article `datePublished` evidence when available.
- Fully define four mutually exclusive House/Senate control outcomes and freeze the major-race slate in advance before any "Blue Tsunami" scenario probability is shown.

## Completed milestone — national seat inventory and readiness checks (October 13)
- [x] Reconcile every voting House district (**435**) using official 2020 Census apportionment as the seat-count denominator.
- [x] Reconcile 2026 Senate ballot inventory (**33 Class II + FL/OH special = 35**) and account for **65 holdover** seats in the model structure. Dated caucus breakout is a reference, not verified election-night result.
- [x] Source-linked `data/seat_universe.json` flags missing/usable named-matchup poll averages separately from all raw poll records, and fails on out-of-universe codes.
- [x] Expose national coverage on the JackStradamus tab, with null forecasts and an explicit refusal to classify chamber control without validated priors and calibration.
- [x] Integrate independent `scripts/test_seat_universe.py` checks into the four-hour GitHub Actions refresh.

### Next immediate engineering work
1. **Import historical 2024/2022 House and Senate returns from MIT Election Data and Science Lab**, with stable district keys and separate vote-share denominators; validate completeness.
2. **Resolve 2026 redistricting against each 2024 historical district geography.** Different lines require reaggregation using precinct data, not an unverified match by district number.
3. **Source 2026 candidates and incumbency + Senate holdovers dynamically**, with snapshot dates, third-party rules and district election types.
4. **Backtest actual previous elections before modeling winning probabilities**: leave-year-out errors, national/regional correlations and full-district completeness, then joint House/Senate simulations. All four control-outcome categories stay unmodeled meanwhile. See [SEAT_MODEL.md](SEAT_MODEL.md).

### Historical results import (October 13)
- [x] Stage 2024 MIT/MEDSL House candidate-level **raw recorded votes** for exactly **435 voting seats**, with explicit CC0 mirror attribution; do not count D.C.'s non-voting delegate as a seat.
- [x] Flag **44** 2024 House districts missing a recorded major-party vote instead of inventing a two-party preference, and preserve the 2024 election district identity.
- [x] Test the staging parser, source fields and House universe in a separate GitHub Actions workflow.
- [ ] Import additional 2022 House and 2020/2022/2024 Senate results, verify source license and election-year outcome denominator, then fit leave-year-out historical baselines.
- [ ] Map/reaggregate 2024 votes onto **actual 2026 district geometries** where boundaries changed. Do not simply join 2024 district numbers onto 2026 seat slots.

## Completed map-version milestone — October 13, 2026
- [x] Check Census 120th Congress status against the 2024 map: **9 redrawn states / 173 district slots**, **41 unchanged states / 262 district slots**. Missouri is unchanged because the proposed replacement map was blocked. Historical 2024 two-party D/R vote comparisons are available for **238** unchanged-boundary districts; no old-map votes leak into 173 redrawn seats.
- [x] Stage **2022 and 2024** MIT/MEDSL House returns separately (435 voting districts each), preserving raw candidate votes and missing-party flags.
- [x] Check Census 119th Congress status against 2022: **5 additional/overlapping map-change states**; only **222 districts** have unchanged 2022→2024→2026 lines, and **191** have recorded major-party votes in both historical elections.
- [x] Publish reproducible, source-linked geography bridges, script tests and model-tab historical context labeled *not a forecast*; maintain all 2026 forecast fields null.

### Next priority: redrawn-district vote baselines and election-year validation
1. Obtain trustworthy **2024 precinct-level election returns** and compatible precinct geography for the **nine changed-2026-map states**; join to 2026 Census 120th congressional boundary/block-equivalency files. Split precinct and non-geocoded returns require separately documented interpolation/uncertainty.
2. Obtain **2024 presidential district-level baseline** on 2026 boundaries, not merely 2024 House candidate vote shares. Build a redistricting-aware precinct-to-district crosswalk and reconcile statewide totals.
3. Add **2026 general-election candidate, incumbency and open-seat datasets**, verify actual effective maps and state law status immediately before voting.
4. Add 2020/2022/2024 Senate historical candidate-vote returns and **verified 65 holdover caucus composition**. Backtest fundamentals out-of-year, then train national/regional correlated forecast errors against actual final results. Only then produce a full set of predicted House/Senate seats and four scenario probabilities.

[Map rules and methodology](MAP_GEOGRAPHY.md) · [Seat model prerequisites](SEAT_MODEL.md).

## Completed QA hardening — October 13
- [x] Distinct race identity in every What Actually Changed insight, including Texas Senate vs governor and House district number.
- [x] Exact-poll deep links from daily insights into JackStradamus with highlighted included/nonincluded survey and source link.
- [x] Exact `poll_id` metadata in model, UI and independent model-to-raw-poll reconciliation.
- [x] Four Endings interactive **hypothetical** House/Senate control calculator with four switchable outcomes; no manufactured probabilities.
- [x] Automated JSDOM app-level navigation and control tests using real current-source JSON (not just JavaScript syntax checks), including shared Recon poll IDs spanning two Texas offices.
- [ ] Build real-browser responsiveness/accessibility checks (Playwright/Chrome), comprehensive HTTP error-state tests and verify each original poll's true *first-publication* timestamp when its publisher makes it available.

Audit and limitations: [QA_AUDIT.md](QA_AUDIT.md).

## Completed: replace hypothetical endings with a sourced joint forecast — October 13
- [x] Remove seat sliders and four static what-if presets from The Four Endings.
- [x] Import and display **DDHQ's publicly reported joint House/Senate model probabilities** (not the product of independent House/Senate marginals). Attribute provider and date; reject malformed outcomes or unreasonable percent totals. Keep last known snapshot if new fetch fails.
- [x] Distinguish Red Dawn, Shrug, and the inclusive Democratic two-chamber win probability; **do not invent the Blue Tsunami conditional split**, which is not published by the source.
- [x] Unit tests for joint source ingestion + UI regression showing real probability values, no sliders and no fictional tsunami percentage.
- [ ] For a four-way *mutually exclusive* probability distribution, obtain calibrated correlated simulations of every House and Senate contest plus predeclared battleground membership and score each draw for the 90%-sweep test. Add independent provider comparisons without assuming different forecasters are statistically independent.

## October 13: election-night rehearsal and actual model-average history

- **2024 rehearsal is the pre-election default**: 435 archived House district records from the project's existing MIT/MEDSL 2024 CC0-staged party totals. This first-party archive does not need cross-origin polling and is not a replay or a 2026 forecast. 2026 mode does not display live votes until an authorized compatible data feed is implemented.
- **Source-contract checks:** invalid year, office, result totals, precinct coverage, fake race calls, premature 2026 vote totals and conflicting freshness flags are rejected; failed refreshes preserve the last verified data with a clear warning. These tests run in the site's DOM regression suite.
- **Within-session live movements:** first-party browser view compares *real, distinct-source-time* snapshots and flags changes, provisional lead flips and vote-count revisions. It cannot infer what happened before the viewer opened the page.
- **Historical model averages:** each JackStradamus race detail shows a chart of genuinely saved model snapshots for the same candidates and model methodology only. Averages are distinct from poll fieldwork dates, and missing historical intervals are not invented. Fewer than two compatible snapshots means no trend chart.
- **Readiness blockers:** the polling-model tab now displays all machine-generated forecast-readiness blockers from the complete 470-contest House/Senate inventory, instead of an invented % complete.
- Still ahead: reliable direct historical election-result calibration, 2026 district fundamentals and holdovers, all-state results/night calls and county reporting benchmarks. No internal House/Senate control probabilities until those inputs pass validation.

## October 13: functional rehearsal and live-provider gate

- Replaced an inoperable browser-to-Open-America results request with a **source-verified local 2024 House archive** covering 435 districts. It is derived from MIT/MEDSL's historical party-vote staging; no unlicensed live-feed republishing.
- 44 districts with no recorded vote for at least one major party are clearly flagged. Names are labeled *party aggregates*, never invented individual candidates.
- All 435 House archive records can be viewed using paginated race buttons instead of hiding the final 185 behind a 250-result cutoff; race search remains available.
- Source/origin and vote-integrity rules are exercised with real source data in dashboard regression tests. Premature 2026 votes and fabricated calls remain blocked. Failed archive reloads retain previously verified data with a warning.
- Explicit launch gate for 2026 results: a source whose **browser CORS and usage terms** support the site, documented authentic schemas/keys, test replay, source freshness, and at least one independent verification source. Until then no claims of nationwide live coverage.

## Completed: historical vote-share variation measurement

- JackStradamus's model page now displays the **observed 2022–2024 Democratic two-party House vote-share changes** for exactly 191 map-comparable districts, including median/10th/90th percentiles and an eight-bin distribution.
- Source checks require all 435 seat records to exist and reject any included record without unchanged boundaries or both parties' votes; 244 ineligible seats are explicitly excluded.
- This historical result variation is **not** a pollster error calibration or an outcome probability. Next genuinely probabilistic step remains sourcing timestamped pre-election polls and actual results across multiple held-out cycles, then measuring correlated errors. No coefficients are transferred into live predictions.

## October 13: official MIT Senate research source

- Added an official-Dataverse, CC0 1.0 Senate 1976–2024 (V8) importer, restricted to 2020/2022/2024 research cycles. Regular/special contests are **not merged**, and independent/minor-party totals are preserved.
- Automated offline edge-case unit tests and **real-source import verification in PR CI**. Separate GitHub Actions publishes the validated historical artifact after merge; no model-update workflow may silently substitute this for 2026 poll data.
- The model tab exposes the true availability/status of historical Senate research, while the Election Night 2024 Senate rehearsal becomes available only when the staged, provenance-verified record exists.
- Still required: reconcile independent vote totals and candidate identities; historical pre-election Senate polls and true year-held-out outcome backtests; 2026 holdovers/incumbents; authorized live election-night feeds.

## October 13: Senate poll-to-election retrospective research

- Added an exploratory comparison of **2020, 2022 and 2024 historical Senate polls versus MIT/MEDSL actual election results**, using a public source-attributed third-party compilation of historical RealClearPolling surveys. CI verifies raw-source shape, chronology and minimum observed races.
- **Polls are compared using fieldwork cutoffs 7 days pre-election**, one survey per firm and equal / 14d / 21d / 35d recency mean scenarios. The JackStradamus research panel shows actual poll-minus-result misses by year and state.
- The public compilation is retrospectively curated and lacks independently verified first-publication timestamps, so it **cannot establish strict historical as-of information** or calibrate model win odds. Do not call this a prospective holdout experiment.
- Same-state Senate regular/special collisions are excluded, as are missing major-party ballots and unusually large third-party votes. Source malformed dates are excluded and audited.
- **Next:** secure a licensed, timestamped historic poll dataset with full candidate-matchup and special-seat identities; then train/evaluate actual JackStradamus algorithms on leave-election-year-out final result errors. For Election Night, obtain a permitted 2026 live-return connection before enabling live counts.

## Completed: whole-election-year bias generalization test · October 13

- Added a deterministic **leave-one-election-year-out** evaluation of 2020, 2022, 2024 Senate *poll-to-result* signed errors, with each training cycle equally weighted. It tests three **precommitted** methods (no bias correction, half bias, full bias) and prohibits the held-out year's errors from influencing its own learned correction.
- Real-source comparisons show the full bias adjustment improves 2020 and 2024 retrospective MAE but makes 2022 markedly worse (3.46 to 5.90 D–R margin points), warning against blindly copying a partisan correction from the last election.
- Added a compact model-tab year-holdout table, independently published derived-JSON artifact, strict source checks and CI tests for duplicate race keys, future-dated polling, malformed errors and training/testing year overlap.
- The **2026 live polling model is unchanged**; three retrospectively assembled election cycles lacking original release timestamps cannot establish calibrated forecast error or national probabilities.
- **Next material model work:** obtain as-of historical releases with stable candidate/special-election identity; hold out more entire cycles; estimate shared national/regional election error, not just uncorrected D/R margins. **Next Election Night infrastructure:** source-licensed, functional live 2026 vote counts.

## October 13: Prioritize current-year evidence over older, nonstationary pollster history

- Closed unmerged [PR #10](https://github.com/jmon18-rgb/Election-Command-Center/pull/10) after questioning the relevance of 2006–2018 polling misses for the **2026 changed electorate and changed polling industry**. Longer-run checks may be useful as methods research, but should not dominate the live desk or enter direct 2026 corrections without demonstrated transportability.
- The current JackStradamus model now includes **2026-specific evidence triage**: flags races where alternative legitimate weights could change the polling leader, no independent firms substantiate a sponsored-only average, independent-only and headline estimates materially differ, pollsters have a wide observed spread, or poll evidence is thin/stale.
- Each card cites the correct race and office and opens the exact underlying polling record. Current-only, candidate-matched dataset; different races with the same state are never conflated. Observed poll dispersion is **not a forecast uncertainty interval**.
- Next high-return work: compare 2026 within-pollster *repeated-wave* changes to the overall model average, track original publication timestamps and identify independent confirmation. Live 2026 election-night results still need a working authorized source.

## October 13: live election-night desk and usable desktop layout

- Prioritized current 2026 polling, published model probabilities and Election Night, rather than extending historical biases from older methodological eras. Historical ten-cycle PR #10 was closed without merging.
- Added a direct browser source adapter for Open America's documented cross-origin election results API, for 2026 House, Senate and governor. The provider covers 22 states (partial national data) and does not call winners.
- Added 60-second live polling, 10-to-15-minute quiet backoff, a source/freshness indicator, vote validation and retention of last verified counts on failure. An integration test checks the real provider's 2024 archive, 2026 endpoint and cross-origin response headers.
- Election Night includes a concise dated Decision Desk HQ forecast-reference strip separate from votes. No in-house chamber probabilities are inferred from incomplete polling or results.
- JackStradamus collapses historical research into a drawer so current 2026 polling comes first.
- Next priorities: browser-based deployed-source confirmation, race-call provider agreement, and additional election reporting beyond 22 states.

## Oct 13: source-native rehearsal and vote-update accuracy

- Added a second 2024 rehearsal source using the Open America browser-native archive: named candidates, reported precinct shares, House/Senate and available governor data, independent from MIT full 2024 historical party aggregates. This is archived final-source-style data, not a timed historical count replay.
- Fixed reporting timeline edge cases: **first arrivals**, **lead changes at unchanged overall votes** and **candidate reallocations** now surface without generating false movement on identical refreshed records.
- Added deterministic browser tests for state archive source switching, native candidate/precinct rendering, unchanged-total corrections, initial reporting and never confusing archived records with live 2026 counts.

## Oct 13: personal desktop watchlist and multi-office live caching

- Added personally pinned 2026 House/Senate/governor races, persistent **on this laptop/browser**, with strict seat-code validation and no app sign-in or remote collection. Users can pin ahead of Election Day.
- Watchlist surfaces saved races across the three offices, displays real reported leads/precinct data where supported, and labels unsupported states and unreported races without pretending a zero vote count. Current-race detail supports pin/unpin.
- Added per-office in-session last-verified-result caches; switching among House, Senate and governors no longer discards verified counts. Watched offices can refresh in the background while Election Night is open, using 60-second updates when the source is live.
- Fixed a subtler reporting bug: global provider `as_of` can remain unchanged while a state changes; individual candidate vote differences still produce activity. Race withdrawals are shown as missing from the source, not assigned zero.
- Validations reject regressed timestamps or a sudden blank state feed after confirmed counting, retaining last verified data. DOM regression tests cover persistence, pin inputs, unsupported-state accuracy, cross-office refreshing and fail-closed updates.

## Oct 13: additional election-night coverage from civicAPI

- Verified civicAPI v2 **real browser CORS** and exact Nov. 3, 2026 indexes for **New Hampshire Senate and Governor** and Nevada statewide races. The Oct. 13 targeted `US House 1` check returned **no indexed NH-01 race**; NH House district coverage is not yet verified. The provider's election-date directory remains unreliable.
- Connected civicAPI as a **separate, source-attributed live watchlist fallback** for manually pinned races outside Open America's 22-state coverage. Matched US state, Nov. 3 date, race office, 2026 district identifier, special-vs-regular seat and provider ID to prevent displaying irrelevant primary/special-election counts.
- Added real source contract tests and client-side regression tests for candidate totals, race IDs, bad dates, source calls, wrong offices and independence from Open America's metrics. Calls clearly identified as civicAPI's own, never as official certification.
- Source-aware polling runs only for watchlisted out-of-coverage seats, at most 12 per sweep, with one-minute election-night / ten-minute pre-election pacing. User pins stay local; raw provider results are not mirrored.
- **Next:** reconcile more source-specific races and winner-call changes, ensure full state/county coverage only when observed, and improve laptop alerting when watched results update.

## Oct 13: Nationwide 35-contest Senate monitoring

- Added a compact, collapsible 2026 Senate election-night board with all 35 verified contests, including distinct Florida and Ohio special-election IDs. The panel shows 35 source slots, how many have actual recorded votes, and source-separated Open America/civicAPI reporting; no missing value becomes zero or a call.
- An optional one-click **Track all 35** automatically fetches unserved-state Senate races via the existing independently checked civicAPI contract and keeps the primary Senate office snapshot up to date while watching another office. It does **not** consume the 40 individually pinned slots. The preference stays on this browser and auto-starts on Nov. 3 when no preference was set.
- Tightened Senate pin identity so `FL-SEN` and `OH-SEN` map to the special contests; invalid or noncontested state Senate codes are refused when the 2026 universe is known. Verified legacy pins are migrated. The same per-minute 12-request ceiling and provider-specific vote/call labels remain.
- Regression coverage checks entire 35-seat list, special-election keys, source status, toggle persistence, no invented votes, and refusal of invalid published universe data.

## Oct 13: watched-race notification desk

- Added a compact Election Night watchlist alert inbox, retaining the last 35 notable 2026 source changes locally on the laptop. Only explicitly pinned races produce alerts; the optional 35-seat monitor remains visible without flooding notifications.
- Primary Open America data triggers source-attributed first-vote, lead-flip, no-net-change candidate-revision and race-withdrawal notices. Supplemental civicAPI produces separately named first-vote, lead-flip and provider-call notices, carefully distinguished from official certification.
- No alerts on routine refresh or first loading an existing election-night snapshot; no pre-election or fake alerts. Same-timestamp candidate revisions are compared via actual votes and deduplicated by vote fingerprint.
- Optional desktop notifications require a user click and the browser's own permission; off by default. In-page event history and browser-only retention work without notifications.
- DOM tests cover source provenance, consent, dedup, pre-election silence, same-timestamp revisions, civicAPI calls, persistence and clearing.
- **Next:** independent real Nov. 3 in-browser smoke test, election-night fallback for stale/slow providers, and coverage for more local House/Governor races without treating unreported regions as zero.

## Oct 13: source-verified local reload recovery

- A laptop page reload previously erased all 2026 office snapshots and observed vote movement. Added bounded localStorage recovery for last verified Open America House/Senate/Governor data and at most 70 observed updates.
- Restore is conservative: validate full 2026 vote/schema and all event records, reject pre-election, wrong office, future, corrupted, old (>72h) or oversized records. Restored counts explicitly display stale/reconnecting status rather than falsely appearing as live.
- Only actual 2026 verified votes are stored, never 2024 rehearsal or derived model forecasts; source errors keep last-good information. DOM tests use a second real page instance across an offline reload and hostile/expired local storage to verify behavior.
- Next: full cross-provider reconciliation and official call sources; an optional exportable audit trail if source terms and browser storage size allow.

## Oct 13: exportable laptop election-night audit

- Added two local 2026 CSV downloads: source-attributed candidate vote totals across separately verified Open America and civicAPI records, plus only actually observed (or source-verified locally restored) vote movement events.
- Export rows include source timestamps, office, race code, per-candidate votes and precinct share, independent call provenance and official-source links. No poll-based results or invented 2026 probabilities enter the export.
- Sanitize arbitrary external text to prevent common Excel formula injection; use UTF-8 Excel BOM and CRLF. Download UI is disabled when no validated vote/activity records exist. DOM regression tests cover party votes, provider separation, row counts and text escaping.

## Oct 13: Second isolated state race adapter — New Hampshire Governor

- Added a dedicated, independently source-verified NH-GOV 2026 civicAPI adapter, retaining the first NH-SEN pilot without expanding to another state.
- Exact statewide general identity and candidate vote/percent consistency; reject cross-office, cross-race ID, stale/future records, fabricated pre-election votes and zero-vote provider calls.
- Added standalone and browser-level regression checks: the real watchlist displays civicAPI Governor details and **retains last-good votes** if a later provider detail response fails identity validation. Source totals remain outside Open America.
- Tightened the real civicAPI CI gate to require NH Governor. The NH House districts stay explicitly unverified rather than showing invented data. Next small adapter can start with NH House only after the provider's real source returns a correctly indexed House race.

## October 13: source-locked experimental race probabilities

- Added visible 2026 House, Senate, and governor Democratic-versus-Republican race percentages computed from qualifying candidate-specific polling and an explicit election-day error assumption.
- Senate starting margin error = observed 42-race 2020–24 retrospective RMSE (5.633 points). House/governor defaults assumed; sparse, stale, sponsored-only and divergent sources widen uncertainty. No blanket retrospective partisan-bias correction.
- Each race detail now has *tighter / baseline / wider* uncertainty controls, updating probability values. Race list also shows compact implied chances.
- Build and verify the dataset with Python and actual JavaScript interaction tests; regenerate the source-dated artifact automatically after each four-hour polling refresh.
- Next substantive probability milestone: complete unpolled seat fundamentals, common national/regional election errors, and a frozen competitive House/Senate slate for true four-ending joint simulations.

## Oct 13: Four-state civicAPI adapter batch (source verified)

- Consolidated strict civicAPI race matching for **Alaska, Maine, Massachusetts and Nevada** into one six-race adapter instead of one race per pull request.
- Verified via live provider search/detail + CORS: AK Senate/Governor, ME Senate/Governor, MA Governor, NV Governor. Each exact civicAPI ID is independently gated by GitHub Actions.
- Explicitly excluded **MA Senate** (not uniquely returned in the 20-result discovery), other unverified statewide contests and House districts. No fabricated coverage or source calls.
- App regression checks source-specific 2026 votes on four personal watchlist pins and rejects later cross-race details while retaining last-good counts. No source totals flow into Open America or forecast probabilities.
- Future development cadence: **3–5 states per PR** when actual source coverage supports it; collect verified IDs, implement shared mappings and tests, merge only after the complete PR suite passes, then stop.

## Oct 13: Second four-state civicAPI batch — Ohio, Wisconsin, Nebraska, Kansas

- Verified seven 2026 election-night source identities in real civicAPI search/detail requests: OH special Senate/Governor; WI Governor; NE Senate/Governor; KS Senate/Governor.
- Extended the original shared multi-state adapter instead of creating one repetitive module per contest. Ohio special-election identity is pinned to `OH-special` and an independently checked civicAPI ID, never a regular Senate key.
- Added fixed-identity CORS discovery and deterministic candidate/percentage/identity test fixtures for all seven races, plus real dashboard interactions showing valid counts and last-good retention when a provider ID changes.
- Preserved the existing New Hampshire and first four-state adapters, provider isolation, national Senate 35-seat universe, alert rules, and live forecast probabilities.
- Continue adding 3–5 carefully sourced states at a time; do not promote unindexed races. Actual general-election counted-vote behavior remains to be tested live on November 3.

## Oct 13: Five-state civicAPI expansion — Illinois, Kentucky, New Jersey, New York, Oregon

- Indexed seven additional real Nov. 3 source-race IDs through exact `/race/search` → `/race/{id}` browser-CORS checks: IL Senate and Governor; KY Senate; NJ Senate; NY Governor; OR Senate and Governor.
- Routed these seven watchlist races through the same strict shared adapter, reusing the existing source-ID, date, office and detail validation rather than creating duplicative one-off adapters.
- Added independent fixture tests and full Election Night watchlist regression checks, including last-good vote retention and source isolation. Never infer zero votes or official winner calls from missing provider coverage.
- Follow the batch rule: source discovery → implement only verified races → full CI test → merge one PR → stop. Real November 3 counting behavior remains to be smoke-tested on Election Day.

## October 13: five-state Senate-first civicAPI batch — AL, MT, NM, OK, TN

- Added strict supplemental source IDs for **eight Nov. 3 races**: AL Senate/Governor, MT Senate, NM Senate/Governor, OK Senate, TN Senate/Governor.
- Oklahoma governor did not have a source record satisfying the same exact statewide contract and remains unverified, not assigned zero votes.
- Reused the common state-batch adapter. New deterministic and full browser tests cover per-race identity, source attribution, correct watchlist rendering, rejecting bad provider updates and preserving valid vote totals.
- Keep supplemental civicAPI numbers outside the Open America national metrics and outside polling-model probabilities. Provider calls are not official certifications.
- Next: continue batching meaningful missing statewide source coverage, then implement a first-vote Election Day smoke test when real November 3 counts exist. Merge only after green CI.

## October 13: Five-state civicAPI batch — California, Delaware, Maryland, South Dakota, Wyoming

- Independently indexed 7 more 2026 civicAPI statewide contests (CA Governor; DE Senate; MD Governor; SD Senate/Governor; WY Senate/Governor), and pinned each provider ID in the strict shared adapter.
- Mississippi Senate was separately probed but did not satisfy the required general-election identity contract and stays unverified.
- Added seven synthetic after-election result tests plus pre-election safeguards and a real-browser Election Night watchlist regression for distinct per-state votes, source links, failed update retention and isolation from Open America.
- Full CI requires all seven actual civicAPI identity/CORS contracts, but no actual Nov 3 counted votes are claimed yet.
- Continue with meaningful missing districts/states and Election Day real-vote smoke checks rather than duplicating low-value snapshots.

## October 13: Election Night source resilience stress rehearsal

- Four concurrent bounded civicAPI workers with per-request timeouts, rotating watchlist fairness and failed-update retention.
- Independently refresh watched House/Senate/Governor feeds even when the visible office's Open America source fails.
- Full browser replay tests stalls, timeout and abort, independent races, timestamp regressions, late responses, restored source availability and no invented winner calls.
- Remaining high-value work: live November 3 provider smoke test, source rate-limit behavior under hours of use, and explicit desktop source-health telemetry.

## October 14: Historical polling-error honesty and redrawn-state Monte Carlo correction

- Removed fixed alphabetic district assignment of 2024 margins in all nine fully redrawn states, preserving real 2026 polled-district identity and drawing the 2024 state-margin spectrum *without replacement per simulation* for otherwise exchangeable districts.
- Added retrospective 2020/2022/2024 Senate polling-error diagnostics, including signed error by election year and leave-one-year-out comparisons of bias correction versus no correction. No partisan bias correction is automatically transferred to 2026: historic field-end dates cannot guarantee true polling publication cutoff and the sample does not validate House/Senate joint probabilities.
- Added browser-exposed historical audit notes and unit/CI guardrails. Next work remains a genuine geographically specific reaggregation of all 173 changed House districts, wider model-year validation, candidate/incumbent data, and live election-day source acceptance.

## October 14: Election-night live-informed race probability monitor

- Expose the existing poll-derived JackStradamus probabilities on Election Night for up to eight prioritized monitored/competitive races; no unsupported races assigned guessed odds.
- Apply strictly source-validated, time-gated, sensitivity-disclosed and deliberately conservative updates based on reported two-party votes plus actual precinct reporting. Show **POLL PRIOR** until eligible data exists, never imply a call from odds.
- Add collapsible source health and retry information for House/Senate/Governor plus civicAPI, with stale-source protection and browser check timestamps.
- CI exercises per-race mathematical/provenance guardrails and a full simulated Election Night DOM. Next: source-aware election-night House/Senate joint forecast only with complete seat priors and calibrated correlated errors; real Nov 3 vote smoke-test and multi-hour traffic soak test.

## October 14: Election Night probability training mode

- Added user-triggered five-stage simulated Senate result replay (NC, MI, GA, TX) to the 2026 Election Night desk, displaying prior-to-live-informed probability movement.
- Rehearsal samples remain completely isolated from trusted source votes, real notifications, saved snapshots and national reporting. Prominent permanent SIMULATION ONLY label.
- Next: Nov 3 live-vote smoke testing, browser soak tests and source-aware joint congressional probability model after independently verified full-seat priors and correlated error calibration.

## October 14 — JackStradamus full-seat joint-control beta

- Implement `scripts/chamber_control_model.js` Monte Carlo over all 435 House seats and 35 Senate contests plus a frozen 20-race Senate/House/Governor sweep slate. Four mutually exclusive outcome probabilities (Blue Tsunami, Blue Wave excluding Tsunami, Shrug, Red Dawn), tied to existing polling and audited historical geography.
- Missing candidate/geography/polling priors receive explicit wide-variance proxies; national, chamber and state errors are drawn together so chamber control is not estimated by multiplying races or published outsider forecasts.
- Main dashboard and Election Night display our own probabilities, expected seat totals, full model-input coverage and sensible ±3-point/narrower/wider assumption toggles, retaining DDHQ as a visibly external comparison.
- Verified November 3 partial votes can enter the joint model as a conservative geographic-noise posterior without contaminating reporting totals or calls; no synthetic votes used in production.
- **Still necessary before describing as calibrated forecasts:** comprehensive historical holdout backtests, district geography-specific baselines in redrawn states, better candidate fundamentals and Senate caucus verification, improved joint correlated error measurement, validated live Nov 3 election-night results and long-running browser smoke tests.

## October 14: historical polling-probability scoring and special-seat identity hardening

- Scored existing retrospective Senate 2020/2022/2024 dataset with Brier score, log loss and 90% expected margin-interval coverage, including **leave-one-election-year-out** bias/variance evaluation. The historical record has no first-publication timestamps, so these scores are evidence of error patterns, not proof of live forecast calibration.
- Exposed source-attributed probability-scoring details in both primary and Election Night four-ending model audit panels, and clarified the actual frozen **18 of 20** near-sweep threshold in scenario cards.
- Fixed use of the 2020 *regular* Senate result as a proxy for the 2026 *special* seat; current-poll Senate variance uses a conservative 7-point floor. Kept automatic 2026 D/R bias correction **off** rather than assuming a repeated historical political error.
- Next: independently import the publicly released Silver Bulletin pollster ratings if source terms/firm identity allow; use verified external methodology as a benchmark, validate 2026 district fundamentals and 34/31 holdover caucus assumption, and assemble true election-year-held-out joint 435/35 forecast backtests with geographic histories.

## October 14 — JackStradamus model odds and integrity index clarity

- Show race-level D/R model odds prominently on all **source-matched polled Senate, House and governor** rows, with the polling margin and assumed error width retained nearby.
- Expose coverage counts and explicit unavailable-source status, rather than silently hiding probabilities when polling/probability snapshots disagree. Mirror current validated odds on the Senate intelligence cards.
- Replace dozens of vague `Not assessed` labels with separate statuses for documented cases, strictly state-tagged verification leads, and **no matching sourced case in a non-exhaustive ledger**. Unknown is not zero, and no evidence status is manufactured.
- Hard browser regression tests cover every polled office, generic ballot exclusion, mismatched-model safeguards, visible Senate odds, and incident-ledger coverage.
- Next: improve the independently sourced ledger's geographic coverage with primary-source verified incidents, then calibrate full-seat forecasts against election-year holdouts rather than extrapolating missing data.
