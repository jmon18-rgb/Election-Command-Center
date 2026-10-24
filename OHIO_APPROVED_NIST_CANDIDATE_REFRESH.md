# Ohio Election Night approved NIST source automatic candidate refresh

**Current state: DISABLED.** Ohio's publicly displayed election-results file
is currently **MOCK** data ahead of the November 3, 2026 election. This
workflow must not fetch candidate values, publish them, or alter the national
needle without an independently reviewed genuine official election-night
source approval.

After the post-publication source/office/candidate/88-county mapping is
independently reviewed in
`data/ohio_nist_source_approval_2026.json`, the existing candidate-only
NIST importer can run every **five minutes** on November 3-4. It fetches the
actual official Ohio XML, validates the 2026 election, root namespace,
generation time and exact approved contest IDs, produces approved county
candidate rows and rejects candidate vote regressions or missing previously
reported counties. An official correction that reduces an observed count
requires separate review rather than a silent replacement.

GitHub Actions commits the candidate snapshot to `main` only if changed.
It explicitly triggers a Pages build because GitHub's own automation token
pushes do not trigger branch-based Pages rebuilds.

**This workflow does not yet mean the national dashboard imports Ohio
votes**: the separate UI source consumer/reconciliation must be wired and
tested. It also doesn't provide remaining-ballot estimates, calibrated
probabilities or professional winner calls. No scheduled workflow claims real
2026 vote delivery prior to election night and source review.

The source is a free official Ohio public result feed, not a vendor contract
with guaranteed uptime. Any stale, revised or failed source should be
surfaced as a missing/recovering feed, never filled from forecasts.
