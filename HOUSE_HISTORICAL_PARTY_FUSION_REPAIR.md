# Historical House party-label and fusion-vote integrity repair

**October 14, 2026 — source-parser change under staged validation, not yet promoted.**

## Defect confirmed against public election returns

The MIT House-source importer classified a row as Democratic only when its `party` field was exactly `DEMOCRAT`, `DEMOCRATIC` or `DEM`; Republican fields had an equally narrow allowlist. It therefore misclassified Democratic-Farmer-Labor, Democratic-NPL and some combined-party ballot labels as **other**, then treated legitimately contested seats as if the Democratic party received zero votes.

A particularly clear public example: official 2024 Minnesota District 3 results were **Kelly Morrison 240,209 votes** and **Tad Jude 170,427 votes**, with 504 write-ins. The currently committed, incomplete MIT-derived staging instead records 0 Democratic, 170,427 Republican and 240,713 other votes. That is an attribution failure, not a competitive or uncontested district. See [Minnesota Secretary of State US House District 3 results](https://electionresults.sos.mn.gov/Results/Index?districtId=558&ersElectionId=170&scenario=USRepresentative).

There are also New York fusion-voting records, where the same candidate can appear on multiple party lines. A raw Democratic/Republican party-row sum fails to include votes on the same person's Working Families, Conservative, and other endorsed minor-party lines, distorting the actual candidate's two-party margin. Independents must NOT be coerced to either party simply because they are a third name on the same ballot.

The previously staged independent 2024 candidate-name data disagreed with the raw party-label import in **32 districts**. Not all 32 can be safely 'corrected' from that secondary source: Alaska uses ranked-choice transfers, Arizona has tiny vote-total discrepancies, and some additional mismatches require comparison against certified ballot tables. This parser repair is deliberately narrower than a blanket overwrite.

## Source parser adjustments and tests

- Normalize explicit DFL, Democratic-NPL and Republican combined labels.
- Within one district and election, group ballot rows by fully matching candidate name. Add minor-party line votes to D/R ONLY when that same named candidate has exactly one D/R party assignment in the race.
- Do not transfer write-ins, blank/anonymous totals, or other genuine independent candidates.
- Record `fusion_vote_rows_attributed` metadata and retain total candidate-row/vote integrity.
- Unit test a 435-seat full source with synthetic Minnesota, North Dakota, Vermont and New York rows. CI now runs this test.
- Change the prior hardcoded count of 44 'uncontested or missing' 2024 races into an exact staged-file metadata reconciliation check, since the old count reflects the documented parser bug.

## Deliberate integration gate before merge

**Do not merge this source-parser change in isolation.** `.github/workflows/stage-house-history.yml` currently regenerates the 2022/2024 source files on pushes to `main`, but downstream `house_geography_bridge.json`, `house_two_cycle_context.json`, `historical_candidate_overperformance_2026.json` and `candidate_fundamentals_staging.json` were built using the older source. A partial source regeneration could make model diagnostics stale, fail data guards or silently misalign candidate-strength evidence.

The production migration must be atomic, with an auditable rebuild order: stage both raw House years; rebuild the 2024/2026 geography bridge; regenerate paired House context; recompute candidate-specific historical results and re-enrich candidate features using independently confirmed identities; rebuild the derived model snapshots; then run all site and forecast regression tests **before** publishing.

Until that migration passes, retain existing public forecast data and leave this parser fix in draft status. Separately, `presidential_2024_gap_fill` provides a controlled research alternative for geographic holes without modifying staged historical records.

No Silver subscriber data has been used to set the actual historical vote totals.
