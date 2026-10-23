# November 3: Actual coverage versus 506 source identities

The [provider preflight workflow](.github/workflows/election-night-provider-canaries.yml) now records a `nationwide_506_observation_pulse` alongside its real HTTP/CORS observations.

This reconciles the canonical **435 House + 35 Senate + 36 governor race** identities to observed 2026 Open America responses by exact office and exact ballot key. An unavailable provider, a state outside the primary feed, an absent race, a published zero, a positive source count, and a stale/invalid update time are **different states**, never interchangeable zero-vote values. Pinned civicAPI IDs and scoped adapters are labeled *not queried* instead of being promoted to live results.

All 35 Senate contest statuses are included in the artifact. House and governor statuses are aggregated by reason and exact office without republishing candidate vote tallies. A provider-reported positive count is labeled descriptive, **not independently certified**, and cannot create a professional race call, a national vote estimate or a geographic needle adjustment.

The existing primary provider validator still checks source office/election identity, candidate arithmetic, timestamps and fake calls first. Failed validation excludes that office from the pulse, rather than assuming no races reported. The diagnostics inherit the limitations of the primary 22-state source: uncovered states require independently validated alternate providers.

Run the offline test:
`python3 scripts/test_national_results_coverage_pulse.py`

Operator workflow on Election Night: inspect the `election-night-provider-preflight` GitHub Actions artifact and compare per-office status counts and the full Senate statuses across successive runs. If an important Senate race switches from `PRIMARY_OBSERVED_CANDIDATE_COUNTS_UNCALLED` to `PRIMARY_PROVIDER_UNAVAILABLE`, investigate source health and use the existing official-backstop page; never silently replace it with a predicted vote.
