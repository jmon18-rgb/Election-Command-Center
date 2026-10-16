# 2024 election-clock replay: admissibility gate

The geographic live needle needs **genuine archived intermediate results**, not a final precinct CSV re-stamped every 30 minutes. `scripts/historical_election_clock_replay.js` accepts one race with:

- Independently reviewed capture provenance and internal-research reuse permission for its timestamped archive.
- A separately attributable 2024 certified final election result for that *same* race and office.
- Four or more distinct, chronologically ordered real 2024 reports containing major-party candidate counts; a useful series must span early and near-final ballot counts.
- Explicit distinction between *fraction of later certified two-party votes* and a misleading precinct reporting percentage. Vote-count corrections are tracked rather than discarded.

For valid series it calculates observed D−R margin error versus the certified result by reported-vote fraction, leader changes, and downward vote corrections. All of these are **descriptive statistics on the particular archived race**, not model probabilities, polling-environment estimates, representativeness claims or inferred 2026 vote totals.

The public MIT/MEDSL 2024 precinct results archive includes post-election final results, **not** a guaranteed chronological stream. A separate third-party GitHub archive of AP election-night snapshots exists, but the maintainer notes uncertain license/copyright. Neither is automatically ingested; historical proprietary AP payloads must not be copied into this public repo without proper rights. Source-reported winner labels are not independently verified professional calls. No actual 2024 reporting-order backtest is claimed by the synthetic acceptance tests.

**Status:** Source/provenance validation harness complete. True rights-cleared 2024 time-series dataset and county/method historical clock replay remain open. Shared model updates are always disabled in this module.

References:
- https://github.com/MEDSL/2024-elections-official
- https://github.com/cuihaoleo/2024-us-election-result-snapshots
