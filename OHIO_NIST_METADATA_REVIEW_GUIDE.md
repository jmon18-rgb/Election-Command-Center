# Faster Ohio NIST source review without approving MOCK returns

The Ohio 2026 NIST importer requires independently reviewed identifiers for
88 source county units, party IDs, and the Senate special, governor and House
contests. Filling these identifiers manually on November 3 could cause delays
or wrong county-to-FIPS joins.

`scripts/prepare_ohio_nist_manual_review.py` accepts an explicitly
supplied original NIST XML file and emits a **review-only metadata draft**:

```bash
python3 scripts/prepare_ohio_nist_manual_review.py \
  --xml /secure/local/ohio-original-export.xml \
  --output /secure/local/ohio-source-review-draft.json
```

The output contains geographic source IDs and reported names, party IDs,
contest IDs, office IDs, ballot selection candidate IDs and names, and
an explicitly **disabled** approval-template skeleton. It stores NO numeric
candidate vote counts or XML VoteCounts fields. It never downloads a
source automatically, enables publication, or fills in unknown county FIPS.
It preserves the XML fingerprint for a reviewer to check separately.

**Using pre-election MOCK data for rehearsal:** the source IDs and layout
may change when the genuine Election Night feed is published. A draft made
from mock data **does not authorize** use on November 3. Once polls close,
a human must separately verify that real results have replaced mock totals,
approve the actual status and total-vote type, check all 88 county FIPS
against an independent reference, verify party/contest/candidate identities,
and explicitly activate `data/ohio_nist_source_approval_2026.json`.
The production parser re-verifies approved fields and timestamps.

The standalone offline test intentionally supplies synthetic fake vote
counts and verifies that none can escape into the review draft. The
original NIST XML should be handled privately and not committed to the
repository, particularly while Ohio's source contains mock data.
