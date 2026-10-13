# JackStradamus · build roadmap

The dashboard is a personal, lightly irreverent election briefing. Jokes belong in the presentation; polling, election administration, and factual claims still require sources and clear definitions.

## Shipping now
- JackStradamus is the name of the descriptive Senate polling model, not a probabilistic election forecast.
- Fresh Off the Poll Presses shows field-ended battleground Senate polls from the last 14 days (not just new changes in a four-hour refresh). Partisan sponsors are labeled.
- JackStradamus Radar surfaces closest model margins, polling blind spots, and documented integrity issues instead of repeating the Senate margin cards.
- Dashboard smoke checks run during refreshes to catch malformed scripts and removed panels returning.

## P0 · Trust the data
1. **Actual-new-poll history.** Keep persistent first-seen timestamps and a rolling seven-day list separate from date-of-fieldwork. Avoid incorrectly calling refreshed historical polls new. Persist the historical poll ID index, and cap storage.
2. **Automated incident reconciliation.** Verify each Texas and North Carolina record against original election-office documents, follow changes to administrative remediation and early-vote plans, log review dates, distinguish reported record counts from eligible voters unable to cast ballots.
3. **Poll quality audit.** Review pollster duplication, partisan sponsor exclusions, matching of candidates, and upstream source coverage. Flag silent feed failures.

## P1 · A genuinely useful daily briefing
4. **What actually changed since yesterday?** Show changes in poll estimates only when reproducible from comparable snapshots; explain which new/expired polls drove them. Avoid passing refresh noise off as voter movement.
5. **Senate seat math.** Combine battleground pathways and fixed baseline seats into an interactive, source-documented path-to-control calculation with correct caucus rules.
6. **Integrity priority scale.** Build a *descriptive monitoring-priority index* with published weights (severity, exposure, unresolved status, election proximity, quality of sources), versus an unsupported “fraud probability.” No-event data means unassessed, not safe.

## P2 · The full JackStradamus experience
7. **Calibration first, forecast second.** Keep descriptive polling averages distinct from win probabilities. Backtest 2018/2022/2024 analogs and candidate-specific errors before publishing a forecast.
8. **Visual trend sparklines.** Store daily immutable snapshots to support meaningful graphs and change logs.
9. **Mobile-first morning briefing.** Compact “Since your last visit” news, polling, Bullshittery changes with direct citations and no duplicated panels.
10. **Personality pass.** Light jokes in headings, actionable labels throughout, no self-serious “war room” theater where actual facts should do the work.

## Rules
- An incident count is not an affected-voter count.
- A polling margin is not a win probability.
- New source observations and substantive electoral changes are not the same thing.
- Never quietly convert uncertain reports into confirmed allegations.
