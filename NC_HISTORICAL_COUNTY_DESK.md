# NC partial Senate vs historical presidential county desk

The Election Night county drawer has a distinct descriptive comparison section.
It remains **empty unless a genuine, independently source-reviewed 2026 North
Carolina Senate precinct ZIP** passes the strict candidate-only contract. This
does not activate 2026 source approval, claim any votes have reported, or promote
historic totals into current counts.

The website carries `data/nc_2024_presidential_county_verified.csv`, one row
per county containing the official 2024 **presidential** major-party votes. Its
NCSBE original ZIP SHA-256 and the certified statewide totals are recorded.
The real-ZIP workflow replays the original precinct archive then compares
**every individual published county row** to the replayed artifact, not simply
the statewide sum. JavaScript also independently rejects duplicate counties,
missing source credentials, invalid party totals and missing county rows.

When the 2026 candidate-only feed becomes operational, the comparison shows
each *currently observed* county's 2026 Senate Democratic and Republican
candidate-vote margin alongside that county's *full* 2024 presidential margin.
The difference is explicitly labeled **unadjusted**: reporting method/order,
unreported precincts, candidate quality, electorate composition and vote share
completion all differ. Historical county vote counts are not a forecast of
2026 expected ballots. The display shows no statewide swing estimate, no
remaining ballots, no race calls, and **no changes to JackStradamus odds**.

The real-browser outage drill verifies that revoked, stale, or SHA-mismatched
official 2026 data remove both the candidate counts and this comparison.
The comparison returns on subsequent valid source retrieval, in desktop and
iPhone-size Chromium test views.

Next geographic needle prerequisites: official 2026 same-county ballot
denominators/precinct progress, comparable candidate-office historical
calibration, reporting-order bias adjustment and uncertainty backtests.
