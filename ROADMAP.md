# JackStradamus · development plan

**Direction:** A personal election site with the utility of a serious polling desk and occasional deadpan humor. No forced jokes, no repetitive methodology cards, no controls that exist just because they can.

## Current experience
- **Daily briefing:** Generic ballot, Senate polling overview, new surveys, race alerts, and the Bullshittery Index radar.
- **JackStradamus v1.4:** Four office tabs: Senate, House, Governors and National Generic Ballot. Averages use 21-day recency weights, bounded sample-size influence, published 538 historical accuracy/transparency ratings, and a symmetric 0.5× sponsorship factor. Explicitly excluded pollsters are declared, and unrated firms receive neutral quality weights. Every included poll shows its published influence and historical rating; full source-to-model reconciliation runs after refreshes. See [POLLING_MODEL.md](POLLING_MODEL.md). House/Gov coverage is still limited to races with polling, not all contests.
- **Race Lab:** Explore Senate, House and gubernatorial polls without altering the headline Senate model.
- **Bullshittery Index:** Separate sourced election-administration concerns from the candidate polling data.
- **Election Night (new):** A live-results view from a documented, free state-derived JSON source with a 2024 historical archive, party-colored D/R margin indicators, vote gaps and labeled precinct progress. It is partial (22 states supported by the provider), never calls a winner, and does not yet estimate chamber control. The former manual vote-entry prototype is retired. The old **Senate Paths** slider remains retired.
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
