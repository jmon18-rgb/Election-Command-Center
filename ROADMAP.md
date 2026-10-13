# JackStradamus · development plan

**Direction:** A personal election site with the utility of a serious polling desk and occasional deadpan humor. No forced jokes, no repetitive methodology cards, no controls that exist just because they can.

## Current experience
- **Daily briefing:** Generic ballot, Senate polling overview, new surveys, race alerts, and the Bullshittery Index radar.
- **JackStradamus:** A complete Senate polling board plus a selected-race breakdown inspired by the useful FLIPR interaction pattern. Each drilldown shows the dated, recency-weighted polling average; candidate support; pollster coverage; a chart of source observations; a sortable-in-spirit survey table with "In average" vs "All recent" views and recency influence. Selected polls are reconciled with the published model after refreshes.
- **Race Lab:** Explore Senate, House and gubernatorial polls without altering the headline Senate model.
- **Bullshittery Index:** Separate sourced election-administration concerns from the candidate polling data.
- **Election Night (new):** A live-results view from a documented, free state-derived JSON source with a 2024 historical archive and separately labeled race-leading vote tallies. It is partial (22 states supported by the provider), never calls a winner, and does not yet estimate chamber control. The former manual vote-entry prototype is retired. The old **Senate Paths** slider remains retired.
- **Bullshittery Index v1:** A conservative, reproducible 0–100 monitoring-priority score. Texas and North Carolina have distinct signals from voter-list litigation. Per-case worst-case unique-voter exposure and outcome probability are tracked as fields but remain unknown until estimates are defensible. See [BULLSHITTERY.md](BULLSHITTERY.md).

## P0 — Substantially better race drilldowns
1. **Long-term race polling history.** Save older surveys and dated model snapshots to chart actual changes over months rather than drawing fake trend lines through 12 recent polls.
2. **Individual poll sources.** Capture poll-specific URLs, field start/end, likely-voter vs registered-voter samples, and sponsor information when supported by upstream data.
3. **Pollster track record.** Add defensible pollster quality ratings, assess systematic effects and compare alternative average models. Separate model changes from polling changes.

## P1 — What's changed?
4. **Since yesterday:** Report first-seen polls, substantive polling-average changes, and new verified Bullshittery developments in a compact morning briefing. Preserve baseline snapshots.
5. **Bullshittery Index v2:** Quantify unique voter exposure and bounded probabilities for explicitly defined outcomes (not generic fraud odds). Review official TX processing completion and NC changes in hours, site capacity and prior Sunday turnout; publish uncertainty, assumptions and sources.
6. **Better race context:** Historical results, incumbency, fundraising and other non-poll indicators with explicit sources. Do not silently roll these into a polling average.

## P2 — Modeling beyond polling averages
7. **Calibrated uncertainty.** Expand historical backtests, correlated errors and model sensitivity before making any election-outcome or majority-control claims.
8. **Election Night nationwide control:** Expand beyond the current 22-state feed with official state downloadable results, and independently sourced race calls before claiming chamber control. Keep current vote leaders separate from called seats; add reliable county-level outstanding-vote estimates and historic benchmarks for 'ahead of expectations'. Also compare AP/DDHQ outlet calls where an authorized feed or permitted public source is available.
9. **Mobile polish.** Make overview-to-race navigation seamless and preserve direct links to individual races.

## Boundaries
- Polling margins are descriptive measurements, not outcome probabilities or projected winners.
- A chart of historical poll observations is not historical model output.
- A reported incident, an affected record and a disenfranchised voter are different things.
- Sources and units are more useful than more disclaimers.
