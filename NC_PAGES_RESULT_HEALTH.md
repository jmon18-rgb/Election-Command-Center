# Deployed North Carolina Election Night source gate

**Purpose:** Confirm that the *served GitHub Pages site*, rather than just a green
source or commit workflow, contains the required county-results panel,
source contracts and a coherent source-attributed snapshot.

The new [Verify published North Carolina county results](.github/workflows/nc-pages-county-health.yml)
action checks after Pages deployments, on a daily safety cadence and
approximately every 15 minutes during the November 3–4 election-night window
(subject to GitHub Actions schedule delay). Its JSON evidence is kept as a
GitHub Actions artifact for 14 days.

- When the official November 2026 ZIP has **not** been approved, the deployed
  configuration must be explicitly disabled, with no snapshot path or approval
  parameters. This is a passing safety state, **not real results coverage**.
- When a source is approved, the deployed config and source ZIP snapshot
  must match the exact independently reviewed election, contest identity,
  original HTTPS URL, archive SHA, county rows and candidate totals.
- The retrieved-at timestamp (which is **not** a provider-reported timestamp)
  must be no more than two hours old during active election reporting.
  No ballots-remaining, race calls, percent reporting, or probabilities can
  come from this candidate-only feed.
- The deployed `index.html` must load all four county modules, with the
  correct blob fingerprint for the actual deployed JavaScript. Browser-cache
  revision mismatches and incomplete deployments are failures.
- When the repository has an approved snapshot, compare its approved ZIP
  fingerprint and retrieval time with the Pages-served one. Brief deployment
  lag is tolerated for 20 minutes; a persistently old Pages site is a failed
  health check, even when old files remain internally consistent.

To run locally: `node scripts/audit_nc_pages_county_results.cjs --local`.
To inspect the real deployment:
`node scripts/audit_nc_pages_county_results.cjs --remote`.
Synthetic negative tests are in
`scripts/test_audit_nc_pages_county_results.cjs`.

These checks cannot verify that an official November 3 ZIP has already been
published, nor do they turn a read-only county snapshot into a nationwide
geographic forecasting needle. Real source publication and election-night
provider outage drills remain separate release gates.
