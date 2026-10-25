# 2024 original election-clock research lead — no AP vote-data ingestion

**Status October 24, 2026: original 2024 capture timestamps are discoverable, but the AP-derived data license is not established.**

The public [2024 U.S. election result snapshot repository](https://github.com/cuihaoleo/2024-us-election-result-snapshots) records an archived git history of roughly minute-by-minute **Associated Press-derived** `progress.json` and `metadata.json` files. The author says original results came from AP's 2024 election-results site and explicitly questions the license. This is a genuinely promising **clock archive candidate**, **not approved data**.

Read-only GitHub commit metadata independently confirms at least:
- November 5, 2024 23:59:31 UTC — commit `e64377d7f5e0c519a3a962b901e19953e27c61e2`
- November 6, 2024 02:59:45 UTC — commit `454cfd8e6dc3a2474ff5eb7cc97aab3dc0f5f5ab`

Neither observation verifies contents, county votes, professional calls, source source-stamp accuracy, custody, or reuse permission. No downloaded AP results and no AP candidate tallies are in this repository's new metadata manifest.

## Approval milestones

1. Obtain rights-holder clarity for internal modeling, processing and any publication or derived outputs; reject if permission is absent. Public Git history is **not** a license.
2. Audit original per-commit source identity, time-vintage and candidate/office schema without publishing raw proprietary payloads; distinguish archive commit timestamps from original provider timestamps.
3. Secure certified 2024 final reference for exact county/contest and redistricting version; validate turnout and ballot-mode comparability, then perform historical replay.
4. Only after multiple independent chronological holdouts and county-reporting-order calibration should geographic evidence affect 2026 model probabilities. **No shortcuts from final-only precinct data.**

See `data/historical_2024_clock_source_candidates.json`; `scripts/historical_election_clock_replay.js` rejects unverified research rights and now requires original per-snapshot capture metadata. All public candidate rights flags remain false.

## Independent Fairfax County primary-source PDF chronology lead (October 24, 2026)

A potentially more usable **original election-authority** chronology exists in
[Fairfax County's public election results archive](https://www.fairfaxcounty.gov/elections/node/175).
Search-index evidence identifies county-issued 2024 **unofficial Election Night
Results** PDFs from multiple clock times. These are **Fairfax County only**,
not Virginia statewide or a representative sample of national precincts:

- [004](https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/2024November_results_unofficial-004.pdf): November 5, 8:38 PM Eastern (search-index Election Summary excerpt; original document still needs inspection)
- [008](https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/2024November_results_unofficial-008.pdf): November 5, 9:44 PM Eastern (search-index Election Summary excerpt; original document still needs inspection)
- [011](https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/2024November_results_unofficial-011.pdf): November 5, 11:27 PM Eastern (search-index Election Summary excerpt; original document still needs inspection)
- [012](https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/2024November_results_unofficial-012.pdf): November 6, 12:13 AM Eastern (**original PDF first Election Summary page visually inspected**)

**Important source clock trap:** the 012 document contains sections printed at
different times: the front Election Summary is 12:13 AM, while embedded
early-voting-location tables display an earlier 7:12 PM generation time.
Never assign a single PDF filename timestamp to every section, or confuse
an Electionware report-generation time with verified independent HTTP
capture/publication time. Likewise, an indexed text excerpt is not an
independently verified original PDF vote record.

The new `county_official_pdf_replay_lead` manifest records section timestamps,
evidence levels and the original county URLs **without any vote data**.
Its corresponding regression test requires unique chronological local section
clocks and checks that all calibration/permission gates remain closed.

Next: inspect the complete original numbered PDFs and per-section reports;
validate same-contest sequential 2024 candidate arithmetic, use the official
certified 2024 county outcome as an exact-race terminal benchmark, document
original capture/publication timing and reuse rights, then quantify genuine
reporting-order error. Even a clean **single-county** replay is only the
beginning of multi-region calibration. It cannot yet change 2026 needle odds.
