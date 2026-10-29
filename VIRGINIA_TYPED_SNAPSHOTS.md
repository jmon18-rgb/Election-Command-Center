# Virginia typed count snapshots

Status: candidate on `readiness/virginia-typed-snapshot`, October 29, 2026.
This change is not released until its protected checks, merge, current-main
deployment, served-byte verification and browser checks are complete.

## What the candidate preserves

Virginia's existing VA-02 source reports eight district-part localities, five
named candidates and five vote methods. Its accepted aggregate keeps D/R/other
totals, but combines three other-candidate totals and discards some native
clocks. Two individual other candidates can move in opposite directions while
the aggregate remains identical. That aggregate alone cannot establish that an
update is safe to coalesce behind a completed calculation.

The candidate retains the already validated native cells and omitted clocks in
a typed, RAM-only projection. It adds no source route, source request, vote
observation, method weighting, winner authority or numerical likelihood.

## Owned producer and cache

`VirginiaOfficialHouseSource.parse()` keeps its original default output. The
collector's original full-versus-selected reparse comparison therefore remains
unchanged. Only the cache opts into `typedUsage:true`.

Before its first integrity-hash await, `VirginiaOfficialCache.parse()` owns one
deep cloned and frozen `{record,reference}`. The selected-body serialization,
SHA-256 check, native parse and typed extraction all read that same owned
snapshot. A caller mutation during the digest cannot change the parsed cells
after hashing. Missing or failed ownership support fails closed.

The native parser emits `native_usage` before its individual candidate/method
cells and native election/locality clocks are discarded. The cache removes that
intermediate field and attaches `snapshot.typed_usage`, with schema
`already-admitted-va02-typed-usage-v2`. It includes the actual selected election,
jurisdiction, contest, candidate, method and locality identities; the four global
native clocks; each locality's report clock; receipt time; and verified selected
hash. Candidate-to-D/R/other mapping comes from the existing pinned native
roster. It is not inferred from an aggregate, a surname or an assumed party.

`VirginiaOfficialUsage.matchesSnapshot()` independently reaggregates those cells
to the accepted snapshot and requires matching identities, receipt, selected
hash, source flags and surviving clocks. Unknown aggregate-method keys fail
closed. The projection is not authentication of arbitrary caller-supplied
objects or of the original HTTP response. The original-response hash remains an
unrecomputed collector claim.

Browser dependency order is poll-close rules, `virginia_official_usage.js`,
`virginia_official_house_source.js`, then `virginia_official_cache.js`.

## Current eligibility and last-completed calculations

The extracted pure helpers reuse the original predicates. Native clocks retain
the original explicit-ISO, 180-minute age, 15-minute future and publication-order
rules, including the original positive-count post-close checks. Positive
localities retain their report-age rule; zero localities retain their existing
age exception while still needing a valid clock within the original future
allowance. Collector receipts
retain the 15-minute limit before November 4 at 17:00 UTC, the 30-minute limit
from that boundary, and the existing 60-second future allowance.

Every CURRENT frame checks both typed-to-aggregate binding and those original
native/receipt predicates at its actual calculation time. The page binds the
three helpers only when each has one correctly fingerprinted script reference
and the required pure APIs. Missing helpers or invalid projections exclude the
Virginia envelope. A completed Virginia CURRENT frame also uses the existing
one-second validity watcher, so a stalled collector does not keep an expired
receipt or an omitted native clock alive.

The narrower ASOF exception may retain a visibly labeled **Last completed
calculation** while compatible newer returns compute. Both old and incoming
envelopes must pass the installed county compiler and the typed current/binding
checks at explicit NOW. Basis, private/public context, settings, calls, model
revision, source identities, geography and method contract must match.

Every individual candidate and method cell must be nondecreasing. Changed cells
require a strictly newer affected-locality report clock, all four global clocks
and collector receipt, plus a different selected hash. An unchanged selected-content refetch may
advance its receipt. Unexplained source-only clock/hash/metadata changes keep
the hard-refresh path. Corrections, retractions, new calls, context/settings
changes, hidden/archive transitions and expired inputs invalidate retained work.
This does not broaden winner or celebration eligibility.

## RAM and output boundaries

The owned raw record is transient parser input. Typed cells can travel with the
immutable worker request, but they remain input metadata in page/worker RAM.
Neither projection is a public forecast result, a second likelihood, history
data, an audit export or a persisted recovery body.

Worker, coordinator and inline fallback guards recursively reject the keys
`typed_usage` and `native_usage`, and the schemas
`validated-va02-native-usage-v1` and
`already-admitted-va02-typed-usage-v2`, including under another property name.
The worker checks its entire output before a MAIN return or Worker message,
including primary/public diagnostics and optional variants. Optional malformed
research output is quarantined; invalid final output is withheld.

Existing history and admission audit retain only their bounded whitelists of
derived results, aggregate evidence, source hashes and clocks. The compact AR2
recorded component preserves all sixteen public asset roles and exact stamps
within the original 600-character limit. It does not hash private inputs or
replace the full worker identity or numerical model revision. Its component is
captured once with the frame and reused by both history and audit. Missing or
invalid codec metadata disables those new records without disabling a valid
forecast. Older AR1/legacy omissions are not retroactively assigned hashes or
treated as proof that a script was absent.

## Evidence and remaining gates

Portable producer checks cover forty groups, thirty-two native clock boundary
cases, nine receipt-switch cases, real-digest ownership controls, hidden
candidate/method corrections, lost-clock expiry, UMD loading and selected-body
integrity. The original source, cache, collector and national-bridge suites pass.
Policy checks retain the original sixty-one civic and thirty-eight Washington
cases and add sixty-three Virginia whole-frame cases. Focused independent
counterexamples exposed and closed a diagnostics output leak and a missing-codec
audit-lineage gap. These are component proofs; page/browser and protected release
acceptance remain separate gates for this candidate.

The numerical target, seed, draw budget, hard support floor, source cadence and
request budgets remain unchanged. This does not establish positive 2026 source
delivery, comparative publication speed, reuse rights, independent chronological
calibration, physical-phone performance or human acceptance. The approved
encrypted first-night originals archive remains OFF until its separate fresh
capacity and hard no-paid-usage requirements are satisfied.
