# Actual competitive-source probe

This separate workflow checks the deployed Iowa, Kansas and Texas source-to-needle
paths with actual public provider responses. It never fulfills those requests
with fixtures and never changes the browser clock. Unrelated provider requests
are blocked, so this is an isolated county-path check, not a full nationwide load
test. Its report is separate from synthetic readiness and replay artifacts.
The report identifies the probe environment/revision, dirty local working trees
and the actual served page fingerprint. Access from a CI runner and access from
the owner's laptop are separate observations.

The probe checks real HTTP responses, the deployed parsers and independent
Census references, source test flags, fresh post-close publication times, accepted
counts, the displayed race forecast and isolation from national probabilities.
The report records the loaded script versions and the provider/capture clocks.
County timestamps are not independently observed; these are race snapshots.

Report states:

- `LIVE_DELIVERY_UNPROVEN`: expected test mode, missing/unavailable source, no
  genuine post-close counts or another unmet delivery requirement. A passing
  safety check in this state is **not** live-source or calibration acceptance.
- `LIVE_INPUT_FORECAST_OBSERVED_NOT_CALIBRATED`: all three real feeds produced
  validated positive post-close inputs and corresponding race forecasts. This
  proves the observed input path, not forecasting accuracy or calibrated odds.
- `SOURCE_AVAILABILITY_REVIEW_REQUIRED`: a feed still lacks usable current input
  more than 90 minutes after final statewide poll closure. This is a declared
  operational review threshold, not a provider SLA or permission to bypass a
  guard. Review the current source/race state; a completed race with aging final
  counts differs from an outage during counting. The report remains unaccepted.
- `ACTION_REQUIRED`: a page/model failure or safety violation, including a
  forecast on test/pre-close/invalid counts, count disagreement, missing forecast
  after validated input, or an isolated county update changing national odds.
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
