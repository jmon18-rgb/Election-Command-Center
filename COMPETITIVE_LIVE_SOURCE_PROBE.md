# Actual competitive-source probe

This separate workflow checks the Iowa, Kansas, Texas Senate and WI-01/WI-03 House source-to-national-needle
paths with actual public provider responses. It never fulfills those requests
with fixtures and never changes the browser clock. Unrelated provider requests
are blocked, so this is an isolated county-path check, not a full nationwide load
test. Its report is separate from synthetic readiness and replay artifacts.
The report identifies the probe environment/revision, dirty local working trees
and the actual served page fingerprint. Access from a CI runner and access from
the owner's laptop are separate observations.

The probe checks real HTTP responses, the deployed parsers and independent
Census references, source test flags, fresh post-close publication times, accepted
counts, the displayed forecast and exact admission into the national correlated model.
The report records the loaded script versions and the provider/capture clocks.
County timestamps are not independently observed; these are race snapshots.

Report states:

- `LIVE_DELIVERY_UNPROVEN`: expected test mode, missing/unavailable source, no
  genuine post-close counts or another unmet delivery requirement. A passing
  safety check in this state is **not** live-source or calibration acceptance.
- `LIVE_INPUT_FORECAST_OBSERVED_NOT_CALIBRATED`: all five real feeds produced
  validated positive post-close inputs and corresponding race forecasts. This
  proves the observed input path, not forecasting accuracy or calibrated odds.
- `SOURCE_AVAILABILITY_REVIEW_REQUIRED`: a feed still lacks usable current input
  more than 90 minutes after final statewide poll closure. This is a declared
  operational review threshold, not a provider SLA or permission to bypass a
  guard. Review the current source/race state; a completed race with aging final
  counts differs from an outage during counting. The report remains unaccepted.
- `ACTION_REQUIRED`: a page/model failure or safety violation, including a
  forecast on test/pre-close/invalid counts, count disagreement, missing forecast
  after validated input, or national changes without exactly matched admitted source evidence.
  The workflow fails for these defects.

Only actual non-test payloads passing identity, count and post-close/freshness
gates are archived. The archive records the exact decoded response-body hash,
completed-body receipt time, provider snapshot time and source URL. A separate
county-vote-vector hash distinguishes actual count changes from repeated
captures or timestamp-only updates. Repeated captures are not independent
election reports or calibration evidence. Test vote payloads are never
saved. Counts are attributed to [civicAPI](https://civicapi.org); its
[public API documentation](https://civicapi.org/api-documentation) permits use
with attribution. Source calls are not certified call evidence.
Artifacts are retained for 90 days so genuine captures survive the canvass period.

The workflow runs hourly before Election Day, then every 15 minutes November 3–4.
Actual requests stop after November 4 at noon Eastern. Outside the 2026 campaign
window it records a skip before loading a browser. Runs do not implement code.

Local reproduction uses the installed/pinned Playwright runtime:
`node scripts/probe_competitive_live_sources.mjs`.
The classifier test is `node scripts/test_competitive_live_source_report.cjs`;
its synthetic inputs never become actual-source reports.

## Timeliness acceptance

The dashboard targets 15-second automatic full-route intervals for these five
sources after each race's earliest poll close through November 4 noon Eastern.
Before close it uses ten minutes; afterward it returns to one minute. Hidden or
inactive tabs pause automatic requests; preview and busy controllers cannot
launch overlapping requests. Five sources imply at most twenty regular automatic
starts per minute under this policy, apart from explicit manual refreshes.
Shared concurrency, request queue, breaker and backoff still apply. Browser sleep,
network time, queueing and source availability can all increase observed delay.
This is an application polling target, not an end-to-end freshness guarantee.
A missing optional cadence helper retains the existing one-minute timer.

The actual-source probe records request-start, header-receipt and completed-body
receipt times plus request-to-body milliseconds. This measures HTTP transport,
not the time at which the provider first had a vote batch. Provider timestamps
may advance without votes changing. Neither a fast request nor source timestamp
age measures lag behind another publication. Comparative publication lag remains
UNPROVEN_REQUIRES_INDEPENDENT_MATCHED_REAL_BATCHES until independently observed
identical real county/candidate/count batches can be paired with receipt clocks.
No such comparative capture currently exists. All five latest real responses are
TEST DATA, so real post-close timeliness and independent fallback delivery remain
open acceptance gaps. civicAPI's FAQ describes 5-10 second active updates; this is
a provider claim, not a measured latency promise. A candidate probe uses a local
page with actual upstream requests; it is explicitly not deployed acceptance.
