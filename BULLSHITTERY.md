# Bullshittery Index · how it works

_Reviewed October 13, 2026._

**There are two separate outputs.**

- **0–100 monitoring score:** a conservative relative priority indicator of documented election-administration problems, **not** the probability of fraud, intentional interference, or an election result changing.
- **Scenario probability:** our *subjective, uncalibrated* odds that one *specific documented incident* ultimately prevents **100 or more otherwise-eligible voters** from casting a countable ballot after ordinary corrective processes. It is explicitly NOT the probability of any inconvenience, any voter affected, or a different election winner.

## Monitoring score (starter rubric)

- Voter-list disclosure litigation with no demonstrated access impact: **4**.
- Implemented reduction in a voting opportunity: **18**, +2 for at least ten affected counties.
- Actual registration transmission/processing failure: **25**, -4 when the upstream defect is documented as fixed while downstream resolution remains uncertain.
- The largest distinct unresolved issue defines a state's score. Repeated reports are never summed; issues with no verified basis cannot add points. No tracked cases = Not assessed, not zero.

Currently: **Texas 21/100**, **North Carolina 20/100**, tracked voter-list litigation **4/100**.

## Subjective probability v0

Given the user's preference for *rough* estimates now rather than leaving probabilities blank indefinitely, the starter estimates are intentionally simple and explicitly based on judgment, not regression or historical calibration:

| Issue type | Exact scenario | Central | Broad plausible judgment range |
|---|---|---:|---:|
| Texas registration backlog | ≥100 unique otherwise-eligible voters cannot cast countable ballots because of this backlog, even after normal remedies | **12%** | 3–30% |
| NC Sunday-hours elimination | ≥100 unique otherwise-eligible voters fail to cast a countable ballot as a consequence of the changed schedule, even after other voting opportunities | **10%** | 2–25% |
| DOJ voter-list access litigation | ≥100 unique otherwise-eligible voters cannot cast countable ballots because of an actual access-changing action resulting from this litigation | **1%** | 0.1–5% |

These percentages are **not observed frequencies**; there are no adequate data from which to calculate them precisely. The large uncertainty ranges matter more than the rounded central values.

### Sources and reasoning

**Texas — why 12%?** Evidence of scale and timing: 500,000+ delayed **registration and update records** sent to counties shortly before the registration deadline. Evidence of remediation: state officials said the transmission problem was corrected, facilitated county staffing assistance, and said eligible people could use provisional ballots if their timely submitted registration was missing. Remaining uncertainty: complete county-level processing and subsequent ballot disposition. [Texas SOS September 22 memo](https://content.govdelivery.com/accounts/TXSOS/bulletins/42c0759), [Texas SOS September 25 follow-up](https://content.govdelivery.com/accounts/TXSOS/bulletins/42c9345), [Votebeat reporting](https://www.texastribune.org/2026/10/05/texas-voter-registration-backlog-county-frustration/).

**North Carolina — why 10%?** Elections board action removed Sunday early-voting hours in ten named counties that had them in 2022. Remaining alternatives—other early-voting days, election-day voting, and mail ballots where available—reduce the risk of *lost votes*, though some individuals face heightened access barriers. Actual county-level Sunday participation and 2026 capacity changes are needed to refine the estimate. [NC Newsline coverage with named counties](https://ncnewsline.com/2026/08/21/republicans-on-the-nc-elections-board-agree-to-drop-sunday-early-voting-hours-in-10-more-counties/), [NC State Board historical absentee data](https://www.ncsbe.gov/results-data/absentee-and-provisional-data).

**DOJ voter-list cases — why 1%?** The database entries cover litigation seeking access to voter-list data. The suits themselves do not demonstrate an implemented election-access change or voter disenfranchisement; several were dismissed or dismissed on appeal. A new order affecting eligibility or verified adverse implementation would trigger rapid reassessment. [NCSL litigation overview](https://www.ncsl.org/elections-and-campaigns/federal-requests-for-statewide-voter-lists).

## The number of people — what is and isn't estimated

**Texas: 500,000+ is a count of delayed application/update records, not people.** Multiple records may belong to the same voter, many may be updates rather than new registrations, and many timely applications may be counted through corrective procedures. It is **not** a credible worst-case numerical count of lost votes.

**North Carolina: ten counties is the identified geographic scope, not a number of voters deprived of ballots.** The historical number of people who voted on Sundays in these particular counties is needed to form a defensible participation-exposure bound. Even those historical Sunday voters must not be equated with lost ballots.

**Legal disputes:** no verified affected voter population has been identified by these records.

The JSON field `worst_case_unique_eligible_voters` remains null until an evidence-grounded *plausible unique-person bound* is estimated. Each incident contains an explicit `exposure_proxy`, precise units, probability range and assumptions. The repository validator checks that a real number, if later added, has a source.

Avoid the tempting but incorrect calculation `worst_case * P(worst-case scenario)` as an estimate of expected affected voters: it confuses tail risk with the distribution of intermediate outcomes.

## How these estimates should evolve

1. Replace broad priors with date-specific evidence of processed transactions, corrected voter records, provisional ballot acceptance and precinct/site access.
2. Add state- and county-specific historical comparisons, distinguishing higher exposure from a higher rate of actual lost votes.
3. Calculate conditional scenario ranges and compare previous assessed situations with final confirmed outcomes, tracking calibration.
4. Version the assumptions and record review dates in `data/integrity_impact.json`, never silently retroactively rewriting historical assessments.

The index measures monitoring urgency; it is not a statement of any party's intent or voters' political preferences.
