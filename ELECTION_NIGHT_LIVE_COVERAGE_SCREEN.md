# Actual vote reporting versus source identities — on the laptop screen

The 506-race source ledger answers whether a provider path has been
identified—not whether election-night votes have arrived. The Election Night
dashboard now adds a separate **SOURCE-OBSERVED RACES** status beside that
source readiness line and an expandable status list for **all 35 Senate races**.

The status uses the already source-validated 2026 Open America House, Senate,
and governor snapshots, plus independently validated/unexpired civicAPI race
details already fetched by the browser. Its denominator is the exact 435 House,
35 Senate and 36 governor race inventory. An absent race, outside-provider
contest, response with zero published votes, unqueried secondary ID, source
outage and stale-positive source are separate statuses. None is interpreted as
zero ballots cast.

In particular:
- Primary 22-state races count as **observed current** only when the source
  reports a strictly positive candidate-vote count and a fresh, 2026 timestamp.
- Outside-primary civicAPI details count only after the exact-race adapter,
  result identity, party/vote and provider-outage gates have approved them.
  A previously discovered race ID does not count by itself.
- Reports are unofficial. Source coverage **is not** the percentage of
  ballots remaining, an election call, the percentage of nationwide votes
  received, or a national forecast update.

Refresh uses the existing election-night data cycle, not extra vendor
requests. The complete standalone contract and synthetic outage regression
tests are in `scripts/election_night_live_coverage_506.js` and
`scripts/test_election_night_live_coverage_506.cjs`.

This improvement makes the November 3 laptop display more transparent about
missing data. It does **not** create any missing live election sources.
