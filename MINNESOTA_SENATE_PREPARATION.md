# Minnesota Senate historical preparation

This resolves the historical county-row preparation step for the requested
Minnesota Senate connection. It adds **no current results adapter, collection
request, model route, call or celebration trigger**. Runtime remains17county
inputs and five connected owner Senate paths. Minnesota's personal card continues
to label its own county connection pending.

## Original publication and independent matching

The [2020 Minnesota results download directory](https://electionresults.sos.mn.gov/Select/MediaFiles/Index?ersElectionId=136)
explicitly declares [Senate county](https://electionresultsfiles.sos.mn.gov/20201103/ussenatecty.txt),
[Senate statewide](https://electionresultsfiles.sos.mn.gov/20201103/ussenate.txt)
and [county identity table](https://electionresultsfiles.sos.mn.gov/20201103/Cntytbl.txt)
exports. Original bytes are compressed without modification under
data/minnesota_historical_sources/. The importer pins decoded SHA256values;
sanitized capture receipts retain request/HTTP clocks separately from results.
Neither a current capture of this archive nor its HTTP Date establishes an
election-night publication chronology.

The portal **still labels these archived exports Unofficial Results**. The
[state canvassing page](https://sos.mn.gov/elections-voting/election-results/2020/2020-general-election-results/2020-state-canvassing-board-general/)
states that the election was certified November24,2020, but the linked
[document211337 metadata](https://officialdocuments.sos.mn.gov/Document/Details/131848)
exposes copy-request instructions rather than numerical tables in the reviewed
public UI. Numeric certification was not independently checked. No email,
document request or sign-in was performed. The output therefore says
numeric_certification_independently_verified=false and keeps the archive's label.

All87native county names independently match the already-pinned Census2024
national county file and the existing reviewed2026MN native-ID/name/FIPS
crosswalk. Only case folding is needed; no guessed FIPS, geographic allocation,
new Census download or precinct-to-county imputation. Historical precinct totals
are checked against the historical county table, not treated as2026boundaries or
an outstanding-ballot denominator.

All435candidate-county rows retain the exact five historical candidates:

| Historical candidate | Source party | Statewide votes |
| --- | --- | ---: |
| Tina Smith | DFL |1,566,522|
| Jason Lewis | R |1,398,145|
| Kevin O'Connor | LMN |190,154|
| Oliver Steinberg | GLC |57,174|
| WRITE-IN | WI |2,261|

County sums reconcile to all five statewide rows, total3,214,256, and the existing
independently imported MIT2020MN regular-Senate reference. DFL is historical D;
LMN/GLC/write-ins remain Other. Historical ballot-order IDs are not2026candidate
IDs. These final totals are neither polling expectations nor calibration data.

## Scope, validation and next contract

The importer checks the pinned directory/year/download,16fields, office/scope,
candidate name/party/order,87unique counties, historical precinct reconciliation,
integer/percentage/count conservation and complete all-candidate accounting.
Tests reject changed identities, wrong office/county, duplicates, missing/extra
rows, negative/decimal counts, NaN percentages, total/reporting contradictions,
independent geography conflicts and changed original bytes. Optimized Python
retains the same guards; no security depends on assert statements.

The historical layout URL redirected to a security-validation service. That
resource was stopped without retry, alternate headers/tool or mirror. The
separate text exports explicitly linked by the accessible directory were captured
normally on the resultsfiles host; the already-reviewed16column candidate format
was reused offline. Raw local response cookies/challenge query/network identifiers
are excluded from published receipts.

Next required fields remain: exact independently reviewed2026nominees/native
candidate IDs; production-versus-test and source/count-clock provenance; browser
delivery/transport/rights and correction/withdrawal/recovery contract; and a
reviewed eighteenth-route state-budget/capture/history change with exact old17
outputs when Minnesota is absent or rejected. Existing201TESTstatus is not
approval. Do not re-download these originals, retry the blocked layout page,
probe unchanged2026test/zero results, reuse2020candidate IDs or raise caps alone.

Reproduce entirely offline:

```
python scripts/test_build_minnesota_senate_county_baseline.py
python -O scripts/test_build_minnesota_senate_county_baseline.py
python scripts/build_minnesota_senate_county_baseline.py
```
