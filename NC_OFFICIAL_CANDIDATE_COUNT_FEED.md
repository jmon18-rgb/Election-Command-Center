# Official NC candidate-count-only archive feed

This is the next link between the official NCSBE ZIP and the Election Night county results panel. It is a source-attributed candidate-vote display, **not** evidence of completed ballots, outstanding ballots, percent reporting, winner calls, or a statistically validated needle.

## Prerequisites

1. Observe the actual November 3, 2026 NCSBE ZIP via the publication probe; inspect its contest identities and verify the official `https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip` download. Do not approve a guessed URL before publication.
2. Independently record its observed SHA-256, exact `Contest Name` and `Contest Group ID`, and the appropriate `NC-SEN`, `NC-GOV`, or exact `NC-XX` race identity. Validate county-to-FIPS mapping. Keep the approval in a separate reviewed JSON config; the fetched ZIP cannot self-approve.
3. Provide that review JSON to `python3 scripts/build_nc_official_candidate_votes_2026.py --approved-review /tmp/nc-reviewed.json --output /tmp/nc-candidate-snapshot.json`. The exporter redownloads the official ZIP, checks its full SHA-256 and archive structure, and aggregates the exact contest. If the publisher has revised the archive since the reviewed SHA, it refuses to publish until the new fingerprint is reviewed.
4. After independently reviewing the generated snapshot, place it in `data/` and configure `data/nc_county_results_desk_config.json` with `enabled:true`, `snapshot_path:"./data/<approved-file>.json"`, and `expected` equal to the separate approved source identity object. Commit as one coherent PR; keep production safeguards and source attribution checks enabled.

The review JSON has fields `mode:"nc-candidate-only"`, `reviewed:true`, `verified_source_url`, `verified_archive_sha256`, `office`, `race_key`, `contest_name`, and `contest_group_id`. **Never check in a test/fabricated approval.** No source is currently approved.

The UI polls same-origin data every two minutes while visible during Election Night and refreshes on refocus. That is *not* an upstream ZIP refresh; GitHub Actions/publication and GitHub Pages deployment introduce additional delay. The UI expires a county archive observation after two hours without a fresh source retrieval.

Every county must have positively observed candidate votes. Rows with all-zero candidates are omitted, not counted as reported counties. The ZIP retrieval time is labeled as such and must never be displayed as the state's published vote-update time. Missing source metadata blocks display; it never becomes zero votes or a model adjustment. The predictive geographic needle remains disabled until historical matching, ballot-denominator data, representativeness, and uncertainty have been separately calibrated.
