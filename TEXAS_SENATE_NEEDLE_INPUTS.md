# Texas Senate county inputs

Texas is a competitive expansion candidate: the repository's October 26 polling
snapshot has a D+2.08 margin, 19 contributing firms and 13 independent firms,
latest poll October 20. This supports investigating its source path; it does
not prove a calibrated forecast or supersede the existing Iowa/Kansas pilots.

## Official county baseline obtained

The original [Texas results site](https://results.texas-election.com/races) loads
in the in-app browser even though the web reader returns403. Select Reports,
COUNTY BY COUNTY CANVASS REPORT, EXCEL, Generate Report. The actual downloaded
[2024 official county workbook](https://results.texas-election.com/static/data/Reports/49664/CountybyCountyCanvassReport.xlsx)
contains all254 counties and all five Senate candidates. Its sums match the
independently observed statewide OFFICIAL RESULTS page exactly:

| Candidate | Reconciled county sum / statewide total |
| --- | ---: |
| Ted Cruz | 5,990,741 |
| Colin Allred | 5,031,249 |
| Ted Brown | 267,039 |
| Tracy Andrus | 919 |
| Analisa Roche | 1,906 |

The race total is11,291,854. All254 county names join independently to the
Census2024 Gazetteer. Original workbook and Census ZIP bytes are committed with
pinned hashes. `python scripts/build_texas_senate_county_baseline.py --check`
reproduces both the baseline and independent county reference. This is a combined
2024 Senate historical baseline, not current turnout or ballots outstanding.
No voting-method split, actual release clock or calibrated forecast follows.

## Exact 2026 county source contract

The public Civic search finds exactly one2026 Texas Senate race:87438. An actual
full HTTPS response is HTTP200 with254 unique county FIPS/name identities matching
the independent Census reference, pinned James Talarico/ Ken Paxton major
candidates and Ted Brown in the roster. It is explicitly `test_data:true`.
Actual provider metadata is in `data/texas_civic_county_source_evidence.json`;
provider test vote values are not retained. Local Python HTTP access and a `*`
CORS header do not establish an actual browser's cross-origin forecast update.

The strict `texas_civic_county_source.js` adapter rejects test data, light URLs,
wrong election/candidate/geographic identity, unreconciled totals and invalid
publication clocks. Synthetic post-close adapter tests pass and the actual
provider response returns TEST_DATA_NOT_LIVE with zero accepted rows. The adapter and visible race view are deployed after current-head checks and
actual Pages verification (see the dated readiness progress). No genuine live vote delivery
is claimed.

## Programmed source-to-needle path (deployed)

The shared estimator now accepts the explicit254-county scope. No numerical
forecast parameters change. The view consumes the complete2024 official baseline,
validated county counts and the linked Texas model's unconditioned starting margin
and base uncertainty. It renders a changing race probability, projected margin
and conditional remaining-two-party-vote range. These are modeled scenarios,
not official outstanding ballots. County updates do not alter national odds.

The2024 baseline is a different Senate class and candidate matchup, and a
presidential turnout cycle. Its transfer to2026 has not been independently
validated. The Iowa/Kansas historical checks remain numerically unchanged;
changing the source blob to accept254 counties conservatively marks their reused
reports as development evidence. None supplies Texas probability calibration.

Desktop/mobile source fixtures verify linked starting inputs, updates, test
exclusion, same-clock conflicts, newer zero-count withdrawal, cached positive
replay rejection, genuinely newer recovery, outage removal and archive exclusion.
A separate real Edge request against the local view receives HTTP200 TEST DATA
and leaves probability null, accepted votes0; no source fixture or virtual clock
is used for that observation. This proves observed transport/test exclusion,
not actual post-close forecasting.

All three exact full county routes receive queue priority. Three positions are
reserved within the same64-queued/four-active cap; bulk work can occupy61 waiting
positions. Light/search routes do not acquire that priority. Current-head checks and actual Pages deployment verification passed for the
implementation. The separate three-race published-source probe observes all
three real responses HTTP200 TEST DATA, accepted votes0/Pnull. Its scheduled
workflow extension remains under review; no live-delivery acceptance follows.

## Earlier rejected candidate dataset (preserved)

The official [Texas Legislative Council dataset](https://data.capitol.texas.gov/dataset/comprehensive-election-datasets-compressed-format)
provides 2020 Senate results on 2020 general-election Voting Tabulation Districts.
Its README explains that VTDs can differ from actual election precincts and that
complete official results are maintained by the Secretary of State. The dataset
page identifies a Creative Commons Attribution license. Attribute the Council
when using its data.

The downloaded 54,629,265-byte archive contains 36,628 Senate candidate/VTD cells,
9,157 VTDs and all 254 county codes. Its statewide sums do **not** reconcile with
the [FEC's certified-results compilation](https://www.fec.gov/introduction-campaign-finance/election-results-and-voting-information/federal-elections-2020/):

| Candidate | Council VTD sum | FEC certified total | Difference |
| --- | ---: | ---: | ---: |
| John Cornyn | 5,961,643 | 5,962,983 | -1,340 |
| MJ Hegar | 4,887,309 | 4,888,764 | -1,455 |
| Kerry McKennon | 209,623 | 209,722 | -99 |
| David Collins | 81,753 | 81,893 | -140 |

The FEC also records 678 write-in votes absent from this Council candidate roster.
The discrepancy's county-level cause has not been established. No missing votes
are allocated, statewide scale applied or counties silently corrected.

`data/texas_senate_baseline_candidate_audit.json` preserves actual county aggregates,
source/member hashes and comparison facts as **blocked research inputs**. It is
not loaded by the site, a certified county baseline, current results or calibration.
Independent Census name/FIPS joining, voting-method data, historical publication
clocks and the exact 2026 live candidate/county contract remain unverified here.
No Texas needle is enabled by this audit; the existing engine remains restricted
to its supported Iowa/Kansas scopes.

Reproduce with the public original URLs in the audit and:

```
python scripts/audit_texas_senate_baseline.py --archive PATH_TO_COUNCIL_ZIP --fec PATH_TO_FEC_XLSX --check
```

The script checks both original SHA-256 hashes, candidate identities, unique
candidate/VTD cells, full candidate vectors and the independent certified totals.
Its successful check means the **blocked audit reproduces**, not that the baseline
is accepted. The PR/manual workflow downloads the originals and runs that check;
it does not schedule repeated downloads or source monitoring.

The official2024 county workbook above supplies the usable baseline. The older
Council audit remains blocked; no differences are allocated to its counties. Do not repeatedly download this unchanged archive or infer
the missing counts. A House district baseline would additionally require verified
current district boundaries; statewide county aggregation does not solve that.
