# Ohio NIST 2026 candidate-only bridge — real-source approval required

The Ohio Secretary of State's true election-results XML endpoint, identified
through actual first-party JavaScript and confirmed by bounded GET, is:

`https://liveresults.ohiosos.gov/Api/v1/download?filename=VSSC1622XmlFileBlob`

Its ~2.1 MB NIST/IEEE 1622 document includes explicit `ElectionReport`,
`Election/ContestCollection/Contest`, candidate `BallotSelection`, typed
`VoteCounts Count`, county `GpUnitId`, and voter/reporting summaries. The
parser uses those **observed exact paths**, not guesses about a different NIST
version.

`scripts/build_approved_ohio_nist_results.py` can convert an independently
reviewed genuine official report into county-by-county candidate totals for
specific 2026 Ohio Senate, governor and House contests. It explicitly **cannot
predict remaining ballots, call races or change JackStradamus probabilities**.

### Why production is disabled
Ohio's published page is explicitly displaying **MOCK election totals**
ahead of November 3. The committed
`data/ohio_nist_source_approval_2026.json` has `enabled=false` and no
candidate, county or race authorizations. The CLI checks the gate BEFORE it
reads any provided XML file.

To activate ONLY AFTER actual November 3 publication and poll closing, a
human must independently review and commit:
- Current official origin and publication proof, with a post-poll-closing
  reviewed-at timestamp;
- Exact NIST `ElectionReport Status` and `VoteCounts Type` from genuine
  returns (do not infer `Total` from the mock samples);
- Explicit `GpUnit ObjectId` to all 88 unique official Ohio county FIPS
  mappings, and the observed county `Type`;
- Exact office/contest identities, source candidate IDs and party IDs for each
  allowed 2026 Ohio race.

Every 2026 dataset is then validated for exact election date, an acceptable
fresh report timestamp, source/status, uniqueness and nonnegative typed
candidate totals. County values are aggregated only across independently
approved county GpUnits; state totals are excluded to prevent double counting.

**This PR does not yet add an automatic scheduled source-download/publishing
workflow or modify the Election Night display.** A separate workflow and
source-browser integration are needed, after real-source identities and its
mock/real transition can actually be verified. The goal is a safe, auditable
building block, not a misleading promise that Ohio votes are live already.
