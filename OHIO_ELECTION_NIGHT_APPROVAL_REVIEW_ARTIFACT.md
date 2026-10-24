# Ohio November 3 source-activation review artifact

**Workflow:** `Stage official Ohio NIST source IDs for human Election Night approval`

This workflow runs once on November 3 at about 8:17 PM Eastern (GitHub
Actions schedules may be delayed), after Ohio's 7:30 PM polls close.
It can also be manually dispatched from GitHub Actions.

It downloads only Ohio's exact official NIST XML export in a bounded,
non-redirecting request. The original XML is discarded immediately.
The workflow writes a JSON artifact listing only reporting-unit object
IDs and names, party IDs, office/contest IDs and candidate ballot IDs.
**All numeric ballot/vote totals are intentionally omitted** whether
the original report contains MOCK, test, or real votes.

The artifact is a **review-only proposal**, not approved returns. It
cannot enable the production source or affect national odds. An operator
still needs to verify genuine Nov. 3 publication, independently map all
88 county units to correct Ohio FIPS codes, verify each actual Senate,
House and governor contest and party identity, confirm the source
status and correct total-votes category, and update
`data/ohio_nist_source_approval_2026.json` separately.

The pipeline is designed to minimize dangerous manual copying of
candidate source IDs while preserving a human, source-specific release
gate. It cannot solve real-time vote publication on its own.
