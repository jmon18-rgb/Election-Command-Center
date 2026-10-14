# Senate fundamentals provenance: separating geography and candidate identity

**October 14, 2026 — reproducible research diagnostic, no live forecast modification.**

To understand disagreements between Senate polling and candidate fundamentals, start with what the current JackStradamus **pre-poll margin prior** is actually made of. Run:

```sh
node scripts/test_senate_prior_continuity.cjs
node scripts/audit_senate_prior_continuity.cjs
node scripts/audit_senate_prior_continuity.cjs --json
```

The module reconstructs the exact currently deployed 35 Senate modeled means from original sources, independent of the model's own returned formula:

- For regular contests with usable 2020 results, the historical baseline is **65% of recorded 2020 regular Senate candidate margin + 35% of recorded 2024 House state margin**. That historical result contains the **2020 candidates' individual attributes**. Neither component is independently a 2026 candidate-specific expectation.
- For 2026 special contests or unavailable 2020 regular result, the baseline is the state's recorded 2024 House margin. This is an imperfect proxy: uncontested House races can distort pooled two-party statewide vote totals.
- Both baselines receive **0.68 × 0.68 × (2026 generic ballot margin minus 2024 recorded national House margin)**. This is a transparent provisional chain of assumptions, not historically fitted calibration. Polled races receive 90% contemporary poll weight when there are at least two independent firms, otherwise 78%. Only 24 of 35 Senate races have qualifying polls.

The new research-only comparator builds **statewide two-party 2024 presidential vote margins** by adding all 435 congressional districts under the 2026 district map (exact vote-count reconciliation, independently sourced external provenance). It applies its own disclosed exploratory national generic-ballot adjustment. The comparator is **a geographically coherent partisan-lean benchmark, not a recommendation to substitute the presidential margin for Senate polling or for a candidate fundamentals model**. It never calls the simulation or creates new public forecast odds.

## Crucial candidate-continuity question

For each of the 35 Senate slots, the audit:

1. Identifies the real recorded 2020 Senate winner, using the original named candidate and vote totals.
2. Compares their first and last names with the current 2026 poll matchup. This is a provisional matchup-continuity label, not proof of current ballot certification.
3. Cross-checks with the **separate independently reconstructed historical-candidate study**, in which 12 Senate incumbents have verified 2020 winner/candidate identity and descriptive overperformance. A contradiction between a verified historical incumbent and current poll roster fails the audit.
4. Labels 2026 specials as a different seat and never attaches the 2020 regular winner to their incumbency.
5. Retains source uncertainty: no recent named matchup is *unknown*, not evidence a historic winner is on or off the ballot.

This particularly guards a subtle model failure: carrying the personal 2020 margin of a **different candidate** forward into a 2026 contest and then interpreting the resulting poll-versus-prior gap as evidence of genuine disagreement about the *current* candidates. Maine, Minnesota, Georgia and other individually consequential races can have very different continuity histories; the module derives these from source identities instead of copied third-party forecasts.

The report contains baseline components, selected candidate-history flags, incumbent residuals *where actually verified*, original poll-vs-prior gaps, alternative candidate-neutral geographic prior gaps, and a ranked list of **data disagreements** (NOT model-predicted winning likelihood). These fields support future candidate-specific research.

## What this does *not* do

- It does **not** ingest or publish paid Silver Bulletin charts, subscriber tables or proprietary regression coefficients. Screenshots can be evaluated locally as a source-separated diagnostic.
- It does **not** promote the 2024 presidential geographic comparator to the live baseline; the generic-ballot-to-presidential swing remains an assumption.
- It does **not** apply universal incumbency bonuses, unverified campaign-finance advantages, or 2020 incumbency effects to people who are not on the 2026 ballot.
- It does **not** change JackStradamus vote averages, race odds, House or Senate chamber probabilities, or four-endings outcomes.

**Next research gate:** source 2026 contender identities from official ballot filings, then validate candidate-specific prior-race residual persistence with held-out *modern* elections. Distinguish historical geography, previous individual performance, current candidate incumbency, and national vote movement before changing coefficients. For the House, use verified 2026 congressional boundaries and a separate 2022/2024 candidate history holdout.

Data source provenance is in `data/presidential_2024_by_2026_district_staging.json`, `data/senate_history_2020_2022_2024.json`, `data/historical_candidate_overperformance_2026.json`. CI tests the exact 2026 source snapshot, stale geography, duplication, candidate-match conflicts and prior reconstruction.
