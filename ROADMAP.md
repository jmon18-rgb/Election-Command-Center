# JackStradamus · development plan

**Direction:** A personal election site with the utility of a serious polling desk and occasional deadpan humor. No forced jokes, no repetitive methodology cards, no controls that exist just because they can.

## Current experience
- **Daily briefing:** Generic ballot, Senate polling overview, new surveys, race alerts, and the Bullshittery Index radar.
- **JackStradamus:** A complete Senate polling board plus a selected-race breakdown inspired by the useful FLIPR interaction pattern. Each drilldown shows the dated, recency-weighted polling average; candidate support; pollster coverage; a chart of source observations; a sortable-in-spirit survey table with "In average" vs "All recent" views and recency influence. Selected polls are reconciled with the published model after refreshes.
- **Race Lab:** Explore Senate, House and gubernatorial polls without altering the headline Senate model.
- **Bullshittery Index:** Separate sourced election-administration concerns from the candidate polling data.
- The former **Senate Paths** and **Election Night** prototypes were removed. Do not re-add the old manual seat slider or vote-entry calculators.

## P0 — Substantially better race drilldowns
1. **Long-term race polling history.** Save older surveys and dated model snapshots to chart actual changes over months rather than drawing fake trend lines through 12 recent polls.
2. **Individual poll sources.** Capture poll-specific URLs, field start/end, likely-voter vs registered-voter samples, and sponsor information when supported by upstream data.
3. **Pollster track record.** Add defensible pollster quality ratings, assess systematic effects and compare alternative average models. Separate model changes from polling changes.

## P1 — What's changed?
4. **Since yesterday:** Report first-seen polls, substantive polling-average changes, and new verified Bullshittery developments in a compact morning briefing. Preserve baseline snapshots.
5. **Bullshittery Index evidence quality:** Update TX/NC developments with official documents, current remediation status, quantified exposure only with matching units, and citations for every critical claim.
6. **Better race context:** Historical results, incumbency, fundraising and other non-poll indicators with explicit sources. Do not silently roll these into a polling average.

## P2 — Modeling beyond polling averages
7. **Calibrated uncertainty.** Expand historical backtests, correlated errors and model sensitivity before making any election-outcome or majority-control claims.
8. **Real election night data, if worth building.** Only reconsider an Election Night experience after integrating a trustworthy live results feed and a clearly documented unofficial-versus-certified status.
9. **Mobile polish.** Make overview-to-race navigation seamless and preserve direct links to individual races.

## Boundaries
- Polling margins are descriptive measurements, not outcome probabilities or projected winners.
- A chart of historical poll observations is not historical model output.
- A reported incident, an affected record and a disenfranchised voter are different things.
- Sources and units are more useful than more disclaimers.
