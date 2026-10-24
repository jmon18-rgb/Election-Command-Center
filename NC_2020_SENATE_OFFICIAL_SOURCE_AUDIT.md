# 2020 official NC Senate baseline — discovery and provenance audit

The next step toward a statistical geographic needle is **same-office
historical evidence**, not presuming a 2024 presidential margin is a
2026 Senate margin. North Carolina's own elections site publishes a
November 3, 2020 precinct-results ZIP containing the Thom Tillis vs.
Cal Cunningham Senate contest.

`scripts/audit_nc_2020_senate_official_zip.py` downloads the original
2020 NCSBE archive, verifies the exact ZIP member and TSV schema, dynamically
resolves a unique US Senate contest name and group ID, checks vote-method totals
for every precinct, maps all 100 county FIPS, and compares the statewide major-
party total against NCSBE's published 2020 certified results:

- Cal Cunningham (DEM): 2,569,965
- Thom Tillis (REP): 2,665,598

The SHA-256 digest is **discovered, not silently approved**. The original
source ZIP, exact contest group and hash must still be independently pinned in
the subsequent production historical baseline implementation. This workflow
publishes a research artifact ONLY; no 2020 counties are loaded into the 2026
live dashboard or JackStradamus model.

The 2020 Senate-vs-2026 Senate office matches, but the nominees, electorate,
turnout and political environment do not. Predictive county residuals still
require out-of-year holdout tests, reporting-order adjustment and a legitimate
ballots-remaining denominator.
