# Outside-primary Senate source readiness: 17 pinned civicAPI races

The primary Open America feed spans 15 of the 35 2026 Senate contests.
Among the other 20, the repository's strict StateBatch adapter has 17
individually curated 2026 Senate race IDs (including Maine and the Ohio
special election). A race ID is **not a live results feed**.

The workflow checks two high-priority source identities (ME, OH special)
on every run, plus five rotating additional curated Senate races. The
deterministic three-day rotation exercises all 17 without hammering a
free API. On Election Night it retries the small batch hourly.
Each check fetches the exact HTTPS race-detail URL and requires browser
CORS access and exact source identity, state, election day, office and
contest title. This is independent of published votes, precinct counts
or winner calls, and does not authorize a source for a different state.
Source failure is recorded as a failed or unverified *transport*, not
a fictitious zero vote or proof of source tampering.

Before Election Night a missing endpoint is a readiness warning in the
artifact; during active counting a failed batch raises an Actions alert.
The workflow does not issue source calls from PRs. Offline tests mock all
network requests. The two remaining Senate races without curated source
IDs (Massachusetts and Mississippi), and the separately scoped NH adapter,
remain uncovered by this specific canary.

Live results still need real Nov. 3 election-night publication, source
identity validation, fresh candidate totals and outage recovery within
the desktop app. The preflight does not imply source availability at
9 PM, professional race calls or national control verification.
