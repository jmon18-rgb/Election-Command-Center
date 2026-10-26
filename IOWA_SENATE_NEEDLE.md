# Iowa Senate: source-to-predictive-needle implementation

Iowa is the first pilot because it is competitive in the active model and has
substantial recent polling. This work implements a remaining-vote estimator;
it does not substitute provider calls or a descriptive map for a forecast.

## Implemented

The official 2020 and 2022 Iowa canvasses provide all 99 counties, with separate
Election Day and Absentee candidate totals. Both tables are now reproduced from
committed source excerpts and reconciled against their statewide totals:

| Year | Democratic votes | Republican votes | All ballots including other candidates and under/overvotes |
| --- | ---: | ---: | ---: |
| 2020 | 754,859 | 864,997 | 1,700,130 |
| 2022 | 533,330 | 681,501 | 1,230,416 |

Sources: [Iowa official index](https://sos.iowa.gov/iowans/election-results-statistics),
[2020 canvass, PDF pages 16–25](https://sos.iowa.gov/elections/pdf/2020/general/canvsummary.pdf),
[2022 canvass, PDF pages 1–10](https://sos.iowa.gov/elections/pdf/2022/general/canvsummary.pdf).
The PDF web reader supplied the table facts; direct HTTP returned 403. Excerpt
hashes identify committed normalized text, not downloaded PDF bytes. Absentee
combines methods: it must not be mislabeled as mail-only or early-in-person-only.
2020 is the previous same Senate seat; 2022 is a different Senate class and is
used as a separate same-office development experiment, not same-seat truth.

`scripts/iowa_senate_partial_forecast.cjs` fixes reported votes and forecasts the
remaining county-method vote. It centers the historical pattern on a supplied
**two-party** polling margin, learns a shared swing only from explicitly completed
county-method units, updates method-specific turnout from completed units, and
propagates county, shared, structural and turnout uncertainty into a race probability
and margin interval. Incomplete batches contribute actual counted votes without
being treated as representative statewide samples. Precinct percentages never
stand in for ballot completion. A turnout overrun with incomplete status withholds
the probability until its turnout estimate is revised. No national update or call.

## What the first historical experiment actually shows

The evaluator hides actual 2022 county-method votes and reveals them under four
**assumed**, not recorded, release orders: absentee first, Election Day first,
small units first and large units first. Orders use baseline data, not hidden 2022
votes. A prespecified neutral prior is a stress test, not a reconstructed 2022 poll.

Across 16 partial snapshots, margin error averages 4.56 points versus 19.89 for
naively treating the counted-vote share as the final result. The model's nominal
90% intervals contain the actual final margin in only 13 of 16 cases. These are
correlated scenario checks from one election, **not calibration**. The estimator
still needs improved uncertainty and independent historical evaluation. All
complete returns recover the actual result with no modeled votes remaining.

## Live input blocker and next implementation

The existing Open America contract supplies Iowa statewide race totals, not the
county/method inputs this estimator needs. Its precinct reporting percentage is
not a remaining-ballot denominator. On October 26 an ordinary Edge request to
`https://electionresults.iowa.gov/` returned CloudFront HTTP 403, with no public
result API calls exposed. No verification challenge was bypassed. The official
2026 index has absentee-return statistics but no general-election count export
published yet. Returned absentee ballots are not counted candidate votes.

Next: obtain a permitted Iowa county/method result transport or independently
published county feed and implement its parser, identity/timestamp reconciliation
and normalized input bridge. Inspect actual source completion semantics; do not
infer completion from 100% precincts. In parallel, extend independent historical
evaluation and turnout scenarios, then attach this race estimator to the visible
needle with explicit experimental uncertainty. It is not yet live-connected or
loaded into the production dashboard. Kansas Senate is the next competitive
source candidate if the Iowa transport remains inaccessible.
