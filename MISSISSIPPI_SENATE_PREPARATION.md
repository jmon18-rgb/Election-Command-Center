# Mississippi Senate historical research tooling

The offline inspector validates the saved OpenElections 2020 county table and
its independently documented county-name bridge. It produces research evidence;
it does not create a live source, a runtime baseline or a calibrated forecast.
Nothing imports this module into the dashboard, collector or national model.

The processed table has 246 Senate rows: exactly Mike Espy (Democrat), Cindy
Hyde-Smith (Republican) and Jimmy L. Edwards (Libertarian) in each of 82 counties.
Their statewide sums are 578,691 / 709,511 / 23,152, matching the existing
MIT/MEDSL statewide reference. This reconciliation does not establish native
official certification, independent reporting chronology or source-file rights.
Other votes here mean the published Libertarian candidate; write-ins have not
been independently reviewed.

## Local inputs and reproducibility

No new downloads are needed. Previously captured inputs remain in the ignored
`artifacts/readiness/mississippi-source-research/` directory:

| Local input | Decoded original SHA-256 | Scope |
| --- | --- | --- |
| `20201103__ms__general__county.csv` | `c6fe255353e08f6c76f72966cd7fb5e6499d28924df4541b163fa0a3dd241e5f` | Exactly 142,502 processed-publisher bytes; not a native official canvass |
| `ap-spring2026-reporting-unit-identity.html.gz` | `bbfe64e2db63fc002fe8f6b825da24fb181b90bd264d37caa9653b5a18b22740` | Exactly 60,643 decoded bytes of a public identity document; not AP results |
| `ap-spring2026-reporting-unit-identity-receipt.json` | Checked against the pinned document, URL, byte count and capture clocks | Local HTTP receipt; not an election publication/correction chain |

The existing Census ZIP and statewide reference remain at their installed
repository paths. The ZIP is pinned to SHA-256
`3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0`.
The inspector matches 81 county names exactly. Its one explicit bridge is
Mississippi `Jeff Davis` → Census `Jefferson Davis`, FIPS `28065`.
[AP's reporting-unit identity document](https://developer.aptechlab.com/ap-elections-api/docs/Spring2026_Reporting_Unit_Updates.htm)
states that old/new name and unchanged FIPS. The state and code must match;
Louisiana's similar label and Mississippi's separate Jefferson County are rejected.
AP's reporting-unit number is not adopted as a native 2026 contest/county ID.

Run from a checkout containing the previously captured local originals:

```powershell
python scripts/inspect_mississippi_senate_preparation.py
python scripts/test_mississippi_senate_preparation.py --local-originals artifacts/readiness/mississippi-source-research
```

The first command prints only the summary. `--source-dir DIRECTORY` selects an
existing local capture directory without fetching it. An optional
`--output artifacts/readiness/NEW-NAME.json` writes the full research report;
output must stay inside ignored `artifacts/readiness`, and existing files are
never overwritten. Original/receipt pins fail closed; the tool cannot write a
`data/` baseline or an application file.

## What CI verifies

```powershell
python scripts/test_mississippi_senate_preparation.py
```

Public CI uses explicitly fictional county distributions and tiny identity-table
fixtures, together with the existing pinned public Census/statewide references.
It tests candidate/party/office/district/count/coverage rejection, duplicate and
wrong-state/FIPS aliases, exact original pins, and output placement/overwrite
guards. These fixtures are not observed returns or calibration cases.

The full processed CSV, AP document/receipt and derived county output remain
local and are absent from public CI. Passing CI does **not** mean that CI has
replayed those originals. The explicit `--local-originals` run additionally checks
all saved bytes, 246 rows, 82 one-to-one county identities, three-candidate totals
and document receipt/clocks. Both modes make zero source requests.

## Admission remains closed

File-specific repository lineage was checked separately on October28: publisher
commit `c7e31f42d44eedfc1c792c2025475b6d66527fb8`, dated January18,2021,
contains the exact saved142502byte blob
`c7540d5750654ed7a581f8b38519c25bd844d3d6`. Only commit/tree metadata was
requested; no original CSV or PDF was downloaded again. This establishes a
processed repository version, not native certification, source-file reuse rights
or election-night publication/correction chronology. The local metadata receipt
is a saved connector serialization, not original HTTP response bytes.

Every full report retains `runtime_eligible: false`,
`current_2026_source_admitted: false`, `chronological_calibration: false`,
`reuse_rights_established: false` and
`native_official_certification_reviewed: false`.

Remaining evidence: source-specific reuse/provenance, native official
certification comparison, and a separate exact current 2026 identity/status/
source-clock/correction contract. Neither this tool nor its identity bridge
authorizes publishing the raw/derived table or expanding the 18 runtime routes.
Current advisory `81004` remains invalid/excluded. The stopped state-directory
403 must not be retried through another query, header, host, tool, proxy or a
copied PDF. No current votes, winner flags, transfer scenario or calibration
claim is inferred from this historical table.
