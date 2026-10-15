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

## October 15: automatic editorial triage + California primary-source check

The automated queue now classifies headlines across **all 50 states**, filters obvious off-topic new reports, counts distinct **pending** versus **source-checked** leads, and conservatively groups likely related headlines into **advisory overlap buckets**. Related headlines retain independent IDs, publisher attribution, and separate review statuses. Multiple articles about one allegation do **not** imply multiple verified incidents or corroborate that the allegation is true. The HTML source-review queue now exposes the pending-vs-checked distinction and, after the next generated queue refresh, possible related-headline group counts. This supports source investigation; it **does not verify reports automatically** or change the 0–100 monitoring scores.

A second specific primary-source review was completed using California Secretary of State's [October 14 official press release PR26-127](https://www.sos.ca.gov/administration/news-releases-and-advisories/2026-news-releases-and-advisories/california-secretary-state-shirley-n-weber-phd-issues-statement-response-us-department-justice-letter). The SOS reports that DOJ sent an October 13 demand for review/action within **48 hours**, that California SOS itself had not received the referenced suspected-noncitizen list, and that Los Angeles County had received material on a USB device. The **review demand** is documented; the federal list's accuracy, underlying eligibility allegations, the separate reported October 15 court action, and any eligible 2026 ballots prevented from counting **are not established by this primary record**. We linked one relevant news lead to case `ca-doj-voter-letter-review-demand-20261013` without claiming that an allegation was verified, assigning an affected-voter number, or estimating disenfranchisement probability.

**Still pending:** actual legal filings, notices and official remedial records for other pending stories; voter-level deduplicated scopes; meaningful nonpartisan outcomes; and timely scheduled human follow-ups. Newsroom article frequency and political labels do not change modeled vote margins. Review backlogs remain substantial even after the second source check.

## October 15: first new lead checked against an original election authority

The automatically compiled news queue contained 125 unreviewed leads on October 15. An October 13 North Carolina notification story was checked against the [North Carolina State Board of Elections' own October 13 release](https://www.ncsbe.gov/news/press-releases/2026/10/13/ncsbe-send-letter-potential-non-citizens-voter-rolls). The Board announced plans to mail correspondence to **1,392 registered voters** flagged for additional citizenship verification. It explicitly confirms **no automatic removal** based solely on SAVE information, and that receiving the letter **does not cancel registration or bar eligible voting**. The Board's mailing intentions are documented; mailing delivery and any ultimately lost ballots are **not** independently established.

This is now separately logged as `nc-save-citizenship-letters-20261013` (an **officially confirmed announcement**, not verified disenfranchisement). One related source lead is marked `primary_source_checked` and links to the official release; related headlines remain separate leads. The reported **1,392** is a registered-voter **notice cohort**, not evidence of 1,392 affected voters, ballots, or deliberate suppression. The adverse ballot-loss scenario has **no numerical probability** because relevant removal, challenge, corrections and countable-vote outcomes have not been established. This is an **unscored case type** in the 0–100 index and does not artificially increase North Carolina's priority beyond its separately documented voting-hours changes.

**Verification workflow that still needs implementation:** cluster duplicate articles by underlying incident and primary source; open official records and court dockets; record verified action, scope, dates, affected units, remedies and contradictions; assign independent review status per incident; set a next-review date and surface unresolved items; promote only verified source-specific claims to the public ledger. Alerts require evidence thresholds and newly documented consequences, not article volume. Before adjusting a state election forecast, additionally establish geographically and partisan *differential* effects with defensible unique-voter counts and ballot dispositions, and test the adjustment as a sensitivity—not as a presumed election outcome.

## October 14 interface clarity — monitored does not mean assessed

The personal dashboard's `Bullshittery Index` appears on all polled Senate race cards, but the underlying **sourced ledger is curated and non-exhaustive**. The previous generic `Not assessed` label did not distinguish an untouched state from a documented incident with unknown voter effects. The race cards now distinguish:
- **Sourced cases:** Counts of ledger incidents whose verification status is not `unverified_report`; case titles, dates and source links are inspectable.
- **Leads awaiting verification:** Only state-tagged leads from `data/integrity_review_queue.json`, clearly separated and never promoted to an incident or included in the 0–100 monitoring priority.
- **No case in ledger:** A coverage-gap statement, **never a zero-risk score, evidence of no incidents, or a certification that voting is unaffected**.
- **Documented case with unquantified impact:** Still a sourced case; the impact count remains unknown instead of becoming zero.

The page summarizes the number of states represented, documented incident records, and numeric impact assessments. The 0–100 monitoring-priority indicator is shown on compact cards **only when** a corresponding sourced case has an existing defined score, never assigned to other states by extrapolation. This is a *coverage and interface* improvement, not a newly verified national incident database.
