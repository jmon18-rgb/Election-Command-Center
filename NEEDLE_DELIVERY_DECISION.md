# Scoped predictive-needle delivery decision — October 25

Scope: prioritize an NC Senate data-to-display path, then expand only with
equivalent evidence. A descriptive county comparison does not complete the
owner's predictive needle request. The existing call-informed joint forecast
is separate from a model of votes still outstanding.

## Evidence actually available in this checkout

| Input | Present | Remaining limitation |
| --- | --- | --- |
| NC Senate historical county baseline and county polygons | Pinned 2022 same-office county CSV and 100 FIPS-matched polygons | A final result is not a historical reporting sequence |
| NC historical presidential county counts | Pinned 2024 county CSV | Cross-office differences and reporting methods need explicit treatment |
| NC 2026 county adapter/configuration | Existing exact-race source bridge; county desk configuration is disabled | Config states official 2026 ZIP has not been published and independently verified; no live counts can be assumed |
| Fairfax actual 2024 research series | Existing Senate and presidential county research files, with three shared original-PDF-verified section checkpoints | One county and one election; document-generation clocks, not independently archived publication/capture clocks; no multi-county held-out calibration |
| Nationwide 2024 AP-derived archive lead | Capture metadata exists in the research manifest | Underlying data use/redistribution rights remain unresolved; no ingestion approval |

Re-ran `scripts/audit_fairfax_2024_paired_office_clocks.py` with the bundled Python
runtime. It passes the existing source-limited descriptive checks and returns
**zero approved national-needle inputs**. This is stronger evidence than saying
there are no historical intermediate counts, but it does not establish a
transferable prediction model. Original PDF URLs attempted through the web tool
in this run were inaccessible; no new original-source inspections are claimed.

The audited Fairfax presidential example starts with 46.53% of the eventual
two-party votes and a Democratic share 1.64 percentage points above the final
share. At a later 92.51% checkpoint it is 0.38 points below final. These are
computed observations from the committed research fixture, not a calibration
interval or a national swing. They demonstrate why a current raw margin alone
cannot justify a precise predictive needle.

## Next executable work, in order

1. Preserve the existing NC source/race/FIPS/correction safeguards and inspect
   the official publication watch output. Verify a genuine new source before
   enabling the adapter; do not turn on the disabled config as a substitute.
2. Find a second independent county/election chronology with comparable vote
   methods and documented original-source provenance. Research the specific gap;
   do not repeatedly rediscover the already-blocked AP mirror.
3. Define a reproducible held-out evaluation: train reporting-order adjustments
   without the held-out county/election, predict the final margin at each real
   checkpoint, and measure margin error and interval coverage. Certified final
   totals may score the result, but must not leak into live ballot denominators.
4. Only promote a scoped predictor after evidence supports its error estimates;
   otherwise keep the live descriptive map and call-informed joint forecast
   available with clear separate labels. Do not claim those fulfill the missing
   geographic outstanding-vote estimator.

Decision: **continue scoped implementation/research; not yet eligible to publish
a calibrated geographic predictor.** Reassess by October 27 against the above
specific evidence, alongside ongoing celebration production. No forecast
coefficients, odds, source approval flags or calibration permissions changed.
