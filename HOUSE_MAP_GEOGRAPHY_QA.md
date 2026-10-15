# 2026 House geography quality gate

Status: **Automated identity and uncertainty gate implemented; precinct reaggregation not yet completed.** Updated October 15, 2026.

We have 435 voting House districts, but cannot treat old district numbers as the same electoral geography after 2026 changes. The official Census map comparison in `data/house_geography_bridge.json` currently tags **9 redrawn states (AL, CA, FL, LA, NC, OH, TN, TX, UT) with 173 House districts**, 41 otherwise unchanged states with 262 districts, and 24 unchanged districts with incomplete 2024 major-party candidate-vote records. Only **238 district entries** have a validated, geographically comparable, complete D-vs-R 2024 House candidate result.

## What is actually enforced

The new `scripts/audit_house_geography_risk.cjs` checks the real repository data against the same `ChamberControlModel.prepare` function used by the browser forecast, rather than recomputing a fake forecast. Its new GitHub Actions gate must fail if:

- a changed 2026 district is marked comparable to an old 2024 House district or has obsolete 2024 House candidate votes filled in;
- a changed district inherits an old seat-number-specific 2024 House election result;
- a missing-party uncontested race is treated as a complete two-party observation;
- the 435-seat map universe, nine changed-state enumeration, source status or uncertainty grouping disagree;
- any research geography file begins carrying secretly precomputed win probabilities.

Under default inputs, the redrawn districts **use an exchangeable, broad state distribution**. Their qualifying district-specific polls may alter individual estimates; historical old-district numbers cannot. A separate 435-seat third-party presidential lean research file asserts 2026 geography, but lacks independent official precinct-level reaggregation certification; it stays explicitly shadow/experimental, not a geographic certification.

The audit prints only broad QA counts and failures. It does not make up historical margins, guess at 2026 vote shares, edit a candidate forecast, or silently eliminate electoral uncertainty.

## Required actual improvement before promotion

For each of the nine states, obtain 2024 precinct-level presidential votes and an appropriately versioned precinct shapefile or precinct-to-district assignment for the Census 2026 120th Congress map. Check split-precinct allocation against official local election tabulations, aggregate each D and R vote exactly once across the new map, and reconcile the state total and all 2026 House district boundaries. Retain a source date, official file checksum, precinct count, unmatched/split precinct report, and per-district confidence/coverage status. Only then replace individual exchangeable priors, independently test if those priors add predictive accuracy and reduce the uncertainty floors, and flag differences caused by changing candidate vs president turnout.

Without that source chain, *a correct district number is not a correct geographic baseline*.
