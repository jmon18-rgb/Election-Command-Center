# Pinned NC 2020 Senate county reference (historical only)

The independently audited original NCSBE November 3, 2020 precinct ZIP has
SHA-256 `b388536c61930d03ed3b0fb8d1dae39a65665969f90eeb6578512de0d96c47c0`,
a single `US SENATE` contest with group ID `1374`, and all 100 NC counties.
The published official statewide major-party counts are Cunningham
(DEM) 2,569,965 and Tillis (REP) 2,665,598.

The pinned baseline builder re-downloads the exact official ZIP and refuses
any archive fingerprint change, contest name/group change, missing FIPS
county, mismatched candidate name, duplicate party or statewide total change.
The source's historical **One Stop** early-vote column is interpreted only
as early in-person votes, with exact vote-method arithmetic checked; the
informational Real Precinct field is not counted as votes.

The output is a reproducible 100-county table with official 2020 Senate
Democratic and Republican votes and D-minus-R two-party county margins.
It is available as a GitHub Actions research artifact, not a deployed
2026 live county feed.

A historical Senate office matches the 2026 Senate office but **not
the candidates**, electorate, or early-reporting order. This baseline does
not estimate 2026 turnout, votes outstanding, race odds or national seat
control, and the generator expressly forbids promoting it into the
JackStradamus geographic needle. Those require real verified 2026 returns,
method-specific ballot denominators and rigorous out-of-year calibration.
