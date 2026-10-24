# Election Night supplemental Senate: failed vs stale vs not checked

The all-35-Senate coverage panel must distinguish an outside-primary source
whose ID is merely curated from a source that has **actually failed**.

The new runtime bridge reads the existing browser civicAPI circuit breaker,
per-race error records, pending request pool, last request timestamps, and
whether a previously cached candidate detail is still usable. These are
passed only as *source health observations* to the 506-race coverage desk.

Source status cases now include:

- **FAILED** when an exact race request has failed, or a provider-wide
  cooldown blocks an unvalidated supplemental race.
- **STALE** when a previously observed result is no longer usable.
- **CHECKING** when a race request is in progress.
- **CHECKED WITHOUT USABLE CURRENT RESULT** when a request was attempted
  but no current candidate count can be verified.
- **NOT QUERIED** when a curated source has never been checked in the
  current browser session.

These statuses cannot turn missing, cached, zero, or unverified counts
into reporting races. The source ID and votes remain handled only by
`ElectionNightReconciliation`. No changes to JackStradamus forecasts,
winner calls, race counts, or 2024 archive mode. Tests include specific
Maine, Ohio special, Nebraska and New Hampshire source-health scenarios.

Next priority: verify actual election-night availability of high-impact
supplemental source responses and create a reliably source-attributed
official-results ingestion path for states with no working provider.
