# Candidate fundamentals and incumbency: no more universal bonus

This is the next original, inspectable portion of the **Silver-first** JackStradamus modeling program. Nate Silver's [FLIPR methodology](https://www.natesilver.net/p/flipr-midterms-model-methodology) explicitly models incumbency differently for open seats and incumbents, including district overlap, the incumbent's previous competitive result adjusted for national climate, first-term status and current political sentiment. It also includes fundraising and candidate experience, and acknowledges that in a polarized era these may have less influence on congressional outcomes than before.

We **do not** copy unavailable regression coefficients and **do not** assign partisan effects simply because a governor's party is unpopular.

## Data staged for all 506 federal/governor races

- **435 House + 35 Senate + 36 governor** races from the external [ElectIndex 2026 historical candidate/race/finance inputs](https://github.com/ElectIndex/26_us_forecast_data). Source blob SHA is pinned separately for `races.csv`, `candidates.csv`, and `fundraising.csv`.
- Each candidate records the source candidate name/ID, the source personal incumbency flag, party, same-seat classification, elected-vs-appointed status, freshman flag, previous adjusted overperformance, redistricting overlap, public-office experience and two types of fundraising.
- The last five fields are explicitly **unknown/null** unless independently established. Their absence must not be interpreted as zero evidence for or against a candidate. The existing imported `strength` score is **not** reused (its model construction is not independent).
- External roster inconsistencies (`RI-02`, `TN-SEN` incumbency classifications and `CA-06` candidate ID/party disagreement) are flagged as **unresolved**, not classified as confirmed open seats. The source roster is not official certified ballot information.
- Fundraising `total receipts` and `small dollar` amounts are informative context but **not equivalent** to the individual, home-state donations Silver describes. No automatic fundraising coefficient is applied.

## Minnesota: three different quantities, not one 'incumbency' variable

1. **Walz's personal approval:** Gov. Tim Walz announced [January 5, 2026](https://mn.gov/governor/newsroom/press-releases/?id=1055-718148) he would not seek reelection. The June 17 [Minnesota Poll](https://www.startribune.com/minnesota-poll-gov-tim-walz-approval-rating-voters-harris-trump-fraud-election/601850020) reported **39% approve, 53% disapprove, 8% undecided** among **Minnesota likely voters**. This is an opinion about **Walz**, not about all Democratic candidates. The poll is dated, not current individual-candidate approval.
2. **Senate candidate Peggy Flanagan:** Flanagan was Walz's lieutenant governor, and therefore has an administration link. In the U.S. Senate election she is **not** the incumbent Senator. [Star Tribune (Sept. 27, 2026)](https://www.startribune.com/what-exactly-was-lt-gov-peggy-flanagans-role-in-the-states-fraud-response/601892204) notes both her senior role and her lack of direct control over agencies implicated in fraud. This is a historically/documentarily established affiliation, **not** a scientifically measured vote transfer.
3. **Governor candidate Amy Klobuchar:** The governor race is an **open seat** and Klobuchar, although an incumbent **U.S. Senator**, is not the incumbent governor. She also was not a Walz administration executive; shared party label alone is insufficient to impute personal blame or approval. [WSJ October 2026 race context](https://www.wsj.com/politics/policy/amy-klobuchar-minnesota-governor-race-b3c19293).

**Model implication:** A full incumbency bonus applies only to a verified elected same-office incumbent, with geographic overlap required for House seats. Appointed or unidentified incumbent statuses are withheld. An *administration association* is independent from both incumbency and statewide party vote.

## Explicitly optional sensitivity, no partisan intervention

`scripts/incumbency_features.js` supplies three auditable functions:

- `validate(doc)` rejects missing/duplicate records, candidate identity mismatches, mismatched source votes, unsupported role links and approval fields.
- `explain(row)` separates same-office incumbency, first-term status, previous competitive overperformance, district overlap, official experience, fundraising provenance and executive administration association.
- `sensitivity(row, coefficients)` computes a **hypothetical fundamental margin adjustment** from **explicit** and **bounded** scenario coefficients. Default coefficients are **all zero**. No outcome probabilities are emitted.
- `scenarioBasis(jointModel, basis, stagedDoc, polls, coefficients)` builds a **separate copy** of the joint model with those experimental effects applied to **the fundamentals share, before the current poll blending**. The original model and its headline probabilities remain unchanged. The scenario is marked `EXPERIMENTAL_UNCALIBRATED_CANDIDATE_SCENARIO`.

The Minnesota unit test illustrates a coefficient of **0.15 hypothetical margin points for each percentage point of outgoing governor net approval**:

```
Walz June 2026 net approval = 39 - 53 = -14 percentage points
Flanagan *raw prior* scenario effect = -14 × 0.15 = -2.1 D-R margin points
Klobuchar *raw prior* scenario effect = 0 (not Walz administration official)
```

This **-2.1 is not an empirical finding or election forecast**: the 0.15 coefficient is selected solely to test the sensitivity plumbing. For the already well-polled Minnesota Senate race, the simulation can retain only the **non-poll portion** of that hypothetical prior change, to avoid counting the same voter attitudes once in polls and again in administration context. This is explicitly NOT an automatic 2026 correction.

## Further refinements required for a true 'fancy fundamentals' layer

1. Independently certify 2026 candidate rosters and which incumbents were **elected vs. appointed**; do not trust stale third-party incumbency flags as official.
2. Pair prior races to historical boundaries and contemporaneous national conditions to derive **candidate-specific last-race residuals**, especially for incumbents.
3. Compute 2024-to-2026 congressional **precinct/population overlap** under altered maps, rather than assuming district-number continuity.
4. Retrieve verifiable itemized **individual contributions**, separating in-state donations from totals/PAC funding and loans.
5. Gather comparable, geographically specific **approval trends** with field dates and population, separating personal incumbent approval from outgoing administration approval; estimate any transfer using a historical held-out sample, comparing linked and non-linked candidates in open-seat contests.
6. Fit first-term, fundraising, previous-overperformance, local-idiosyncrasy and administration coefficients on past cycles with regularization, not as hand-picked partisan exceptions. Compare out-of-sample error and forecast calibration before promotion.
7. A gubernatorial incumbent's reelection is an entirely different process from the successor race, from the lieutenant governor's bid for a **different office**, and from a senator running for governor. Treat them as separate data types.

## Run

```
node scripts/test_incumbency_features.cjs
node scripts/audit_candidate_fundamentals.cjs
node scripts/audit_candidate_fundamentals.cjs --json
```

Any experimental sensitivity exists to test assumptions. The main 2026 baseline odds are unchanged in this PR.
