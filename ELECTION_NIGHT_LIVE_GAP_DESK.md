# Actual Election Night returns: on-screen 506-race coverage triage

The Election Night source desk now distinguishes all 506 ballot identities
(435 House, 35 Senate, 36 governor) from the subset with **current,
source-reported positive 2026 candidate votes**. A known Open America state,
a verified civicAPI race ID, an absent race within an online provider, and a
reported zero are separate states—not indicators that no ballots were cast.

The panel lives beside the existing national source-reconciliation summary. It
lists all 35 Senate races in a collapsible source-status desk so gaps in
important out-of-primary states are immediately visible. Provider outages,
stale source timestamps, and missing exact-race data are surfaced distinctly.

Only the existing `ElectionNightReconciliation.reconcile()` result is
permitted to mark a race as actually reporting. The new module does not fetch,
interpret, or cache votes independently. Missing, unknown, stale, or
not-yet-queried records are never filled with predicted or zero votes.
The triage status itself does not modify candidate totals, probabilities,
national control, forecast priors, or alerts. 2024 archive mode remains
separate.

Dedicated tests cover correct 506/35 identities, source validation, synthetic
provider failures, zero-not-zero-ballots semantics, previously pinned IDs
without current data, the two Senate identity gaps, and corrupted inventory.
The repo's existing 12-hour simulated transport test remains a separate
regression guard for live provider outages and recovery. **No real 2026 vote
delivery is claimed before November 3.**

Outstanding: independently confirmed live source delivery for races outside
the primary 22-state coverage, professional race calls, reliable remaining-vote
denominators, and calibrated county-level predictive updates.
