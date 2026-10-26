# Kansas Senate competitive-race county inputs

Kansas is the next Senate source target after Iowa from the linked model's
competitive shortlist. The current polling record at 04:28Z has D+1.64 from seven
contributing firms / three independent firms, latest field end October 14.
This change supplies a strict input contract
and reproducible historical facts. It does **not** deploy a Kansas predictive needle.

At 03:07:55Z October 26, actual Edge from the deployed Pages origin fetched
[full civicAPI race 87162](https://civicapi.org/api/v2/race/87162). All 105 county
names/FIPS independently match the [Census county Gazetteer](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip).
The actual source identifies Adam Hamilton (D), Roger Marshall (R) and David C
Graham (L), and sets **test_data=true**. No actual live vote rows are accepted.
Evidence retains identity metadata, not the provider's test totals.
The [public API documentation](https://civicapi.org/api-documentation) permits
public use with attribution. No private API or unofficial source-call authority
is inferred from that permission.

The new Node input adapter requires the exact source URL, race/date/scope,
explicit non-test status, pinned major candidates, independent 105-county joins,
safe candidate counts and county/state reconciliation. Counts require a fresh
provider timestamp after the applicable first poll-close gate; provider winner
flags never become calls. County methods and completion are unreported. A race
snapshot timestamp is not an independent county update time. The browser's full
Kansas route is not activated by this input-only change.

Official [Kansas source workbooks](https://sos.ks.gov/elections/election-results.html)
provide certified historical Senate precinct counts. Original workbook bytes and
SHA256 hashes are preserved. A dependency-free reader extracts cached source
values without executing workbook formulas or macros; county sums reconcile to
the independent official state totals:

| Election | Democratic | Republican | Libertarian |
| --- | ---: | ---: | ---: |
| 2020 | 571,530 | 727,962 | 68,263 |
| 2022 | 372,214 | 602,976 | 29,766 |

The main sheet supplies 101 counties; four separate sheets supply the largest
counties. Nonredacted precinct sums match their published county footers. Where
2022 precinct cells are redacted, use the actual county footer without inferring
individual redacted counts. Blank cells are not zero-filled. All 105 county
candidate sums reconcile to the published statewide totals. These files report
combined votes, not absentee/Election Day splits or election-night release times.
2020 is the previous same Senate class; 2022 is another class and the recent
midterm turnout reference. Candidate/class/turnout differences need evaluation.

Reproduce with `python scripts/build_kansas_senate_county_facts.py --check` and
`node scripts/test_kansas_civic_county_source.cjs`. Tests use temporary synthetic
post-close counts; they do not establish real November 3 delivery or calibration.
Next: integrate the validated 105-county inputs into a separately scoped forecast
after the Iowa model changes are reviewed, retaining unknown-method uncertainty
and keeping national control odds separate.

## Experimental estimator (queued browser integration)

The Kansas wrapper validates the full real-source contract before invoking the
shared estimator for exactly105 independently matched counties. Default history
is2020 (same Senate class);2022 is an explicit alternative. Neither has a
voting-method split, so the estimator uses its unknown-method uncertainty path.
It returns modeled remaining two-party votes and a scenario range, not official
ballots outstanding. Test-data responses return no forecast; calls do not set
probabilities. No national odds are updated.

Synthetic post-close source changes move the probability. This demonstrates code
behavior, not live delivery. The2020-to-2022 development stress check has margin
MAE10.10 versus23.66 for the neutral starting prior and30.66 for raw returns.
Margin ranges contain the result in15/16 assumed snapshots; remaining-vote ranges
in11/16. These misses are retained. This is one noncompetitive historical
election, different Senate class and turnout cycle, with assumed county orders;
it does not calibrate the competitive2026 race. No parameters were tuned to
these outcomes. The queued Kansas view now consumes the exact full source through the bounded
shared transport and renders the race probability and remaining-vote range.
Desktop/mobile fixtures verify source-driven probability movement, test-data and
publication-clock exclusion, outage removal and national isolation. Kansas
close-election evidence and actual post-close delivery remain unfinished.

## Separate frozen close-election check

A newly located official Wyandotte County2018 report supplies the actual county
aggregate missing from the state workbook. No precinct cell is inferred. Together
with the original2018/2022 governor workbooks, all105 county D/R sums reconcile
to official state totals (2018:506,509/453,030;2022:499,849/477,591).
The source excerpt identifies normalized facts, not original HTML bytes: direct
retrieval returned403, while the public web reader displayed the official report.

The runtime model blob41ec65dd7f17 and release-order plan were committed before
the first evaluation. Baseline-only county size/share determines four assumed
orders at four stages, not hidden outcome values. Neutral-prior stress results:
margin MAE1.84 versus prior2.28 and raw27.98; Brier0.216 versus0.25; log-loss0.621
versus0.693. Margin-band coverage16/16; remaining-vote-range coverage14/16.
Retain both misses. No numerical model parameters changed. The original full
report is frozen and must reproduce exactly with those model bytes. Future
source changes are conservatively marked reused development evidence.

This is one close governor election (D+2.28 two-party), same Democratic candidate
over four years, no method breakdown and no historical release clock. It improves
the evidence beyond a safe Senate outcome, but cannot calibrate a2026 Senate
probability. Reproduce with `python scripts/build_kansas_governor_close_cohort.py
--check` and `node scripts/evaluate_kansas_governor_close_cohort.cjs`.
