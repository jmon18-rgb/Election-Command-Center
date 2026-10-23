# Election-night external results-source transport canaries

Before depending on a public provider on November 3, we need evidence of
**HTTP connectivity, browser CORS support and current response shape**, not just
a hard-coded provider URL or a race identity found by search.

`scripts/preflight_election_night_providers.py` probes the existing browser
source, Open America's election-night `results.json`, separately for 2026
House, Senate and governor. It also performs small, bounded HTTP + CORS checks
for pinned 2026 civicAPI Senate races in Maine and the Ohio special election.

The scheduled [provider canary](.github/workflows/election-night-provider-canaries.yml)
runs daily and at a limited half-hour cadence around Election Night. An
auditable JSON report is saved in each workflow's artifact. Tests use synthetic
fixtures without external network requests.

**Important semantics:** Successful HTTP, schema or CORS checks do **not**
certify that the November 3 feed is carrying authentic live votes, will be
available throughout the night, has nationwide coverage, or can make
professional calls. Pinned civicAPI IDs are routing aids, not published
results. The probe never republishes source candidate votes. Before Election
Night, source outages or unavailable records are logged as preflight warnings.
During the active overnight period, failed transport/schema/CORS checks fail
the canary workflow to surface a meaningful operator alert.

The canary intentionally avoids a large-scale 435-district crawler, which
would impose an irresponsible request load on free sources; ongoing
coverage-gap tracking and provider contracts remain separate work.
