# Texas Senate candidate baseline audit

Texas is a competitive expansion candidate: the repository's October 26 polling
snapshot has a D+2.08 margin, 19 contributing firms and 13 independent firms,
latest poll October 20. This supports investigating its source path; it does
not prove a calibrated forecast or supersede the existing Iowa/Kansas pilots.

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

Next useful work is locating a complete official county canvass that reconciles
to certified totals, or identifying exactly why the Council figures differ using
county-level evidence. Do not repeatedly download this unchanged archive or infer
the missing counts. A House district baseline would additionally require verified
current district boundaries; statewide county aggregation does not solve that.
