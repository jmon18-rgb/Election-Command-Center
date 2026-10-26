# Competitive needle delivery decision

Evidence reviewed October 26, 2026, 07:31 UTC, ahead of the October 27 target.

Keep the existing Iowa and Kansas race needles available as guarded experimental
forecasts. Do not designate their probabilities as calibrated or claim genuine
live delivery has been demonstrated. Do not promote county observations into
national control odds. No new model parameters or acceptance exemptions follow
from this decision.

| Requirement | Current evidence | Remaining gap |
| --- | --- | --- |
| Competitive race | Iowa and Kansas Senate use their linked model starting margins; recent polling supports prioritizing these contests | Re-rank against new linked odds and polling; unsupported House geography is not interchangeable |
| Permitted real county source | Exact public Civic full-race routes, independent 99/105 county joins and pinned candidate/date contracts | Owner-browser responses are TEST DATA; actual post-close non-test delivery is unproven |
| Source-driven predictive needle | Deployed estimators produce race probabilities and modeled remaining votes with ranges; published desktop/mobile fixture tests change the forecast | Synthetic returns prove behavior, not live delivery or forecasting accuracy |
| Historical assessment | Official county totals and frozen assumed-order evaluations, including two close governor cohorts | Neither actual reporting clocks nor independent competitive Senate calibration is established |
| Correction recovery | PR448 prevents cached positive counts restoring a newer zero-count withdrawal; genuinely newer counts can recover | Real-provider corrections have not been observed in operation |
| Capture environment | Local Edge reaches both full routes; actual CI probe timed out on both | CI capture availability is not established; workflow success is not source readiness |

The two close governor cohorts give mixed evidence. Iowa 2018 projected-margin
MAE is about 3.25 points versus 2.80 for retaining the neutral prior; Kansas 2022
is about 1.84 versus 2.28. Both use assumed release orders, not historical
publication clocks. Correlated snapshots within one election are not independent
elections. These results cannot justify calibrated Senate odds. Preserve the
frozen reports and all missed ranges; do not tune repeatedly on them and relabel
the result independent validation.

## Work that can change this decision

1. Confirm genuine fresh non-test post-close county counts from the approved exact
   race routes, matched to independent geography and reconciled candidate totals.
   Demonstrate those actual counts moving the race forecast. Preserve source and
   capture clocks and vote-vector hashes; test data and repeated unchanged
   snapshots cannot satisfy this requirement.
2. Resolve the actual capture-environment gap. Retain the deployed probe's
   unavailable status until observed requests succeed; the local-browser and
   CI-runner observations are separate. Do not bypass source access controls or
   silently replace responses with fixtures.
3. Obtain permitted, timestamped multi-county returns for independent competitive
   races with official final outcomes. Freeze the evaluation plan and model
   before examining held-out outcomes. Assess errors, uncertainty coverage and
   probability scores against retaining the prior. Final totals revealed in an
   assumed order can stress the code but cannot supply the missing clocks.

Before polls close, the absence of genuine 2026 election-night candidate votes
is not repairable by inventing inputs. Continue concrete source/estimator work
when new usable evidence exists. Do not spend repeated runs rediscovering the
same test flags or expanding safe-seat/manual-link coverage to inflate progress.

## Evidence

- [Starting-input deployment, PR446](https://github.com/jmon18-rgb/Election-Command-Center/pull/446)
- [Actual-feed capture, PR447](https://github.com/jmon18-rgb/Election-Command-Center/pull/447)
- [Actual CI access observation](https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40281510553)
- [Correction repair, PR448](https://github.com/jmon18-rgb/Election-Command-Center/pull/448)
- [Iowa implementation and evidence](IOWA_SENATE_NEEDLE.md)
- [Kansas implementation and frozen close-cohort evidence](KANSAS_SENATE_NEEDLE_INPUTS.md)
- [Actual-source probe contract](COMPETITIVE_LIVE_SOURCE_PROBE.md)
- [Dated deployment and test evidence](readiness-progress.md)

## October 26 deployment addendum

Texas Senate now also has a deployed experimental county-input race needle,
using the original2024 official county canvass reconciled across254 independent
Census joins. Actual Pages bytes and published desktop/mobile source-fixture
behavior are verified after PR451. A separate fixture-free published check at
10:52Z reaches Iowa/Kansas/Texas HTTP200; all three responses are TEST DATA and
correctly leave live probabilities null. This extends the implemented race scope,
without changing the no-calibration/no-proven-live-delivery decision. Texas's
2024 Senate class, matchup and presidential turnout differ from2026; their
transfer is not independently validated. See TEXAS_SENATE_NEEDLE_INPUTS.md and
the dated readiness progress for exact revisions and evidence.

## Reload/startup correction follow-up (review pending)

A validated source revision is retained on this browser for each supported2026
race, including zero-count withdrawals. Only a newly fetched, fully validated
source response can produce a probability; cached signatures never supply
forecast votes. Other tabs consult the latest retained revision on their next
observation. If browser storage is blocked, protection remains in-session only;
clearing it loses the cross-reload ordering history. Invalid cached metadata is
ignored rather than treated as source authority. Provider test data never writes
this record. No calibration or true live-delivery claim follows.

A brief bounded linked-model startup wait can consume the first source response
without fetching it again. The source revision/mode/outage checks run again after
the wait. A missing protection asset withholds the race estimate and leaves the
independent national model available. These behaviors are tested with explicit
synthetic inputs; this follow-up remains pending CI and deployment.
