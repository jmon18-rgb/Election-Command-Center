# JackStradamus · development plan

**Direction:** A personal election site with the utility of a serious polling desk and occasional deadpan humor. No forced jokes, no repetitive methodology cards, no controls that exist just because they can.

## Current experience
- **Daily briefing:** Generic ballot, Senate polling overview, new surveys, race alerts, and the Bullshittery Index radar.
- **JackStradamus v1.4:** Four office tabs: Senate, House, Governors and National Generic Ballot. Averages use 21-day recency weights, bounded sample-size influence, published 538 historical accuracy/transparency ratings, and a symmetric 0.5× sponsorship factor. Explicitly excluded pollsters are declared, and unrated firms receive neutral quality weights. Every included poll shows its published influence and historical rating; full source-to-model reconciliation runs after refreshes. See [POLLING_MODEL.md](POLLING_MODEL.md). House/Gov coverage is still limited to races with polling, not all contests.
- **Race Lab:** Explore Senate, House and gubernatorial polls without altering the headline Senate model.
- **Bullshittery Index:** Separate sourced election-administration concerns from the candidate polling data.
- **Election Night (rehearsal ready; live unconnected):** First-party 2024 MIT/MEDSL House vote aggregates across all 435 voting districts, with missing-party disclosures and historical-geography safeguards. Open America's election-specific API disallows cross-origin browser fetches; the prior direct GitHub Pages integration did not work reliably. The 2026 view explicitly marks live counts as unconnected until a browser-compatible, authorized source is validated. No race calling or chamber forecast is implied.
- **Bullshittery Index v1.2:** Conservative 0–100 monitoring priority plus subjective, explicitly defined P(100+ otherwise-eligible voters unable to cast countable ballots because of the incident), with broad uncertainty ranges. Actual worst-case distinct people remain unquantified; exposure proxies keep their original units. See [BULLSHITTERY.md](BULLSHITTERY.md).
- **Congressional scenarios:** Red Dawn / Shrug / Blue Wave / Blue Tsunami are now **chamber-control definitions**, with Blue Tsunami reserved for near-sweep of a predeclared competitive slate. Old national vote-margin percentages were invalid for this question and removed. Probabilities await joint seat simulations; see [SCENARIOS.md](SCENARIOS.md).

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
