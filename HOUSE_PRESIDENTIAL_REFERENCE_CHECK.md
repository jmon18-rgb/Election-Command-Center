# Offline FL-04 historical reference comparison

This research-only tool compares one newly captured publisher reference with the
existing staged presidential counts for FL-04. It never changes a model input,
draw, live route, source pin, call, or forecast probability. The scope excludes
the four districts already spot-checked and the stopped NC01 geography path.

The source is the exact-vote spreadsheet linked from [The Downballot's
presidential district calculations](https://www.the-downballot.com/p/the-downballots-calculations-of-presidential).
Its title claims 2024 presidential results under the congressional districts
used in 2026. The saved anonymous response is 357832 bytes, SHA256
`105187a8fc3d559e86e2d9e52101059cd3450a3641c1c5c032105873a416ac49`.
The original response and receipt remain in the ignored local research folder;
they are not redistributed by this change. Fetch-decoded response bytes are not
wire/TLS bytes or an independent historical capture chronology.

The checker requires the pinned original, matching receipt, exact sheet identity,
document map-year title, separate 2024/2020 candidate headers and one FL-04 row.
It checks the printed shares against the all-candidate total and independently
computes the two-party margin. Adjacent 2020 columns are never substituted.
Differences in current publisher candidate counts are retained even if the
two-party margins agree closely. No tolerance converts unequal counts into an
exact match or silently replaces the cached source.

The public tests use fictional HTML and counts. They cover wrong maps/years,
candidate columns, duplicated districts, malformed votes, denominator confusion,
receipt/hash identity and output overwrite/location. The actual pinned-original
test runs only when that local file exists; CI reports it as NOT_RUN/skipped.
CI does not download or upload the publisher original or derived vote table.

Run locally with the existing original:

```text
python scripts/inspect_house_presidential_reference.py
python scripts/test_house_presidential_reference.py
python scripts/inspect_house_presidential_reference.py --output artifacts/readiness/early-house-geography/new-comparison.json
```

The default prints a bounded summary, without candidate vote totals. A full report
is written only to a new JSON directly inside the ignored research directory;
existing evidence is never overwritten. The original source and receipt can be
selected with explicit local paths; their pinned identities still must match.
There is no downloader or runtime import.

A publisher's asserted map year does not establish official precinct-to-plan
reconciliation, source-specific redistribution rights, independent upstream
lineage, frozen election expectations or held-out validation. Those fields stay
open. Agreement with this historical reference is not predictive calibration,
an admitted current count route, or authorization to promote the existing
presidential shadow. See PRESIDENTIAL_DISTRICT_FUNDAMENTALS.md and
NATIONAL_NEEDLE_ACCEPTANCE.md for the unchanged promotion and acceptance gates.
