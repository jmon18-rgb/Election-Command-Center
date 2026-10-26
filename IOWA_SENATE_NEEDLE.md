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

## Real county source found and verified

The full public civicAPI response at
[Iowa Senate race 87151](https://civicapi.org/api/v2/race/87151) contains all 99
county result records with candidate votes and county FIPS. The `?light=` version
used by existing source polling **omits** `region_results`; this explains why the
previous lightweight probes did not find this data. The service's
[API documentation](https://civicapi.org/api-documentation) permits public use
with attribution. Its calls remain unofficial; this adapter uses counts only.

At 02:11:50Z on October 26, an actual Edge fetch from the deployed GitHub Pages
origin succeeded. Every county name/FIPS joined to the independent
[Census 2024 county Gazetteer](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip).
The provider currently sets **`test_data: true`**. The new full-source adapter
rejects all those values as live input; accepted county count is zero. Recorded
evidence contains transport/identity metadata only, not the test vote totals.

`iowa_civic_county_source.cjs` checks exact race/date/scope, explicit non-test
status, fresh post-close timestamps, pinned major-candidate identities, all 99
independent county joins, candidate arithmetic and county-to-state reconciliation.
It preserves the fact that these are **combined county counts with no voting
method split or verified ballot-completion flag**. A race snapshot timestamp
does not become an independently observed update time for each county.

## Implemented combined-county source-to-visible-needle bridge

`iowa_county_needle.js` consumes combined county D/R counts without inventing
observed method allocations. It conditions a historical turnout distribution on
the counted lower bound, models three unseen method-order scenarios, learns a
shared swing while retaining correlated batch-selection uncertainty, and fixes
already counted votes when estimating future candidate totals. Scenario weights
come from marginal evidence under the stated assumptions, not empirical calibration.
It never interprets precinct reporting percentages as ballot completion.

`iowa_needle_view.js` connects the exact approved full Iowa endpoint to this model
and a visible race probability, projected margin, estimated two-party votes
remaining and scenario uncertainty band. It uses the current Iowa polling input
normalized to a two-party margin, with a minimum six-point prior uncertainty.
Unavailable, stale, test or same-clock conflicting source updates hide the
probability. Fresh corrections may update it. National odds and counted totals
remain separate. No provider winner flag drives a predictive estimate.

The explicit historical preview stages real 2022 votes under an assumed release
order. Its final step is labeled the certified historical outcome, not a successful
model prediction. It cannot alter live results. Actual Edge checks at 1366x768
and 390px exercise source validation, probability movement, same-clock rejection,
late-response isolation, outage recovery and unchanged national odds, using
temporary synthetic 2026 provider fixtures. These do not prove live delivery.

The combined-county model's development experiment averages **9.20 points** of
margin error across 16 partial 2022 scenarios versus 19.89 for counted share.
Its scenario envelope includes the final margin in 15/16 cases. The model was
tuned using this election; these are **not independent evaluation or calibration**.
This weaker combined-input result must not be replaced with the earlier
completed-method model's 4.56-point result. Run
`node scripts/evaluate_iowa_county_needle.cjs` to reproduce it.

## Remaining production evidence

The existing Open America contract supplies Iowa statewide race totals, not the
county/method inputs this estimator needs. Its precinct reporting percentage is
not a remaining-ballot denominator. On October 26 an ordinary Edge request to
`https://electionresults.iowa.gov/` returned CloudFront HTTP 403, with no public
result API calls exposed. No verification challenge was bypassed. The official
2026 index has absentee-return statistics but no general-election count export
published yet. Returned absentee ballots are not counted candidate votes.

The public full civicAPI endpoint supplies an alternative transport, but its actual
current payload remains test data. Real post-close source delivery has not been
demonstrated. The bridge and visible needle are implemented for review, not yet
verified as deployed. Independent historical evaluation, updated turnout evidence
and calibration remain open. Kansas Senate is the next competitive source target.
