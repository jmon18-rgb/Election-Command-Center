# NC official Senate ZIP observation chronology

This intentionally conservative P0 readiness batch preserves an append-only **retrieval-time** sequence of exact reviewed 2026 North Carolina Senate candidate-count ZIP archives rather than overwriting the only version on each scheduled refresh.

On Nov 3+, if and only if the existing independent source review enables the official NCSBE exact-archive monitor, each newly changed SHA-256 gets an ordered, bounded county D/R/other count snapshot keyed to 5-digit FIPS. The original, strictly reviewed source payload stays the source of truth. Unchanged hourly refetches don't invent a new source release. Identity disagreement, prior snapshot/journal disagreement, digest rollback, missing counties, timestamp reversals, source regression, malformed records and journal overrun **fail publication**; there is never a silent history rewrite.

This does **not** establish actual precinct return order, source-reported timestamps, vote-method totals, ballots outstanding or a calibrated election forecast. The journal records time **we retrieved** the ZIP, explicitly stores source_reported_at=null and keeps may_move_national_needle=false. It is groundwork for validated replay and reporting-order research, not a predictive promotion.

Automated hourly/10-minute approved ZIP workflow now commits the config, current county ZIP-derived JSON and the immutable observational journal as a single Git revision. Disabled current source config remains unchanged.

Unit tests cover provenance, prior-vs-journal consistency, source rollback, phantom results, candidate regressions, identical rereads and missing counties.
