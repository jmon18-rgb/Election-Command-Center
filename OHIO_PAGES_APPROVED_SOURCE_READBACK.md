# Ohio source: live GitHub Pages publication proof

The Ohio NIST candidate importer and browser desk are release-gated so
pre-election MOCK Ohio results never appear as real 2026 votes. Once the
original statewide XML is independently reviewed after poll close, the
refresh workflow can publish genuine candidate-only county snapshots.

This follow-on **readback check** verifies the actually served GitHub
Pages website, rather than merely the successful source-converter commit.
It checks the Ohio county drawer and both JS modules against their
12-digit Git blob fingerprints, the site-served source-approval gate,
real post-poll approval timestamp, original XML SHA-256 identity and
candidate-only/no-needle safeguards.

After approval, a stale 2026 source is a failure during the active
Election Night reporting window; an archived post-election snapshot
remains historical and isn't incorrectly labeled live. A mismatched
source SHA or generation timestamp versus main is tolerated only
during a bounded 20-minute Pages deployment grace period; afterward
the monitor fails, leaving an actionable Actions log/artifact.

The monitor runs after successful Pages deployments and periodically,
with a higher frequency during the November 3–4 counting window.
Before official 2026 Ohio publication, **disabled/zero-vote import**
is the only passing legitimate readiness state; that does NOT mean
Ohio is actually covered on Election Night.

This is neither an authoritative Ohio race call, nor a certification
of votes remaining, voter-mode reporting, chamber control or 2026
national needle movement.
