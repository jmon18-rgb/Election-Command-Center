# JackStradamus · development plan

**Direction:** A personal election site with the utility of a serious polling desk and occasional deadpan humor. No forced jokes, no repetitive methodology cards, no controls that exist just because they can.

## Current experience
- **Daily briefing:** Generic ballot, Senate polling overview, new surveys, race alerts, and the Bullshittery Index radar.
- **JackStradamus:** Four office tabs: Senate, House, Governors and National Generic Ballot. All use the same recency-weighted polling method with 0.5× weight for otherwise qualifying sponsored polls. Drilldowns show dated source observations, included polls and influence weights. House/Gov are limited to races for which source data exists, not exhaustive chamber predictions. Source-vs-model reconciliation runs after refreshes.
- **Race Lab:** Explore Senate, House and gubernatorial polls without altering the headline Senate model.
- **Bullshittery Index:** Separate sourced election-administration concerns from the candidate polling data.
- **Election Night (new):** A live-results view from a documented, free state-derived JSON source with a 2024 historical archive and separately labeled race-leading vote tallies. It is partial (22 states supported by the provider), never calls a winner, and does not yet estimate chamber control. The former manual vote-entry prototype is retired. The old **Senate Paths** slider remains retired.
- **Bullshittery Index v1.2:** Conservative 0–100 monitoring priority plus subjective, explicitly defined P(100+ otherwise-eligible voters unable to cast countable ballots because of the incident), with broad uncertainty ranges. Actual worst-case distinct people remain unquantified; exposure proxies keep their original units. See [BULLSHITTERY.md](BULLSHITTERY.md).

## P0 — Substantially better race drilldowns
1. **Long-term race polling history.** Save older surveys and dated model snapshots to chart actual changes over months rather than drawing fake trend lines through 12 recent polls.
2. **Individual poll sources.** Capture poll-specific URLs, field start/end, likely-voter vs registered-voter samples, and sponsor information when supported by upstream data.
3. **Pollster track record.** Add defensible pollster quality ratings, assess systematic effects and compare alternative average models. Separate model changes from polling changes.

## P1 — What's changed?
4. **Since yesterday:** Report first-seen polls, substantive polling-average changes, and new verified Bullshittery developments in a compact morning briefing. Preserve baseline snapshots.
5. **Bullshittery Index v2:** Replace the subjective starter odds with sourced local implementation evidence and historically compared affected-voter rates. Determine unique voter exposure (vs records/counties), validate remedied registrations, and track whether the initial ranges were calibrated.
6. **Better race context:** Historical results, incumbency, fundraising and other non-poll indicators with explicit sources. Do not silently roll these into a polling average.

## P2 — Modeling beyond polling averages
7. **Calibrated uncertainty.** Expand historical backtests, correlated errors and model sensitivity before making any election-outcome or majority-control claims.
8. **Election Night nationwide control:** Source hierarchy and acceptance tests documented in [ELECTION_NIGHT_SOURCES.md](ELECTION_NIGHT_SOURCES.md). Expand beyond the Open America 22-state feed; test civicAPI as a secondary call/coverage provider; ingest structured state exports and site HTML via controlled state parsers. No control board until complete verified calls, holdover Senate seats and uncalled contests are reconciled. Add county benchmarks only from verified historical and current county vote data.
9. **Mobile polish.** Make overview-to-race navigation seamless and preserve direct links to individual races.

## Boundaries
- Polling margins are descriptive measurements, not outcome probabilities or projected winners.
- A chart of historical poll observations is not historical model output.
- A reported incident, an affected record and a disenfranchised voter are different things.
- Sources and units are more useful than more disclaimers.
