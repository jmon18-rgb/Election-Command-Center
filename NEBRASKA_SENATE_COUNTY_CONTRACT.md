# Nebraska Senate: named-candidate county evidence

This connection compares Dan Osborn with Pete Ricketts. Independent ballots stay
in `osborn_votes`; they never become Democratic ballots or automatic caucus seats.
The displayed chance is Osborn versus Ricketts, not a five-candidate win forecast.
All three other named candidates remain individually accounted for. A leading
other candidate withholds this paired likelihood. Unreported write-ins remain
unknown; a source winner flag or reporting percentage supplies no call/completion.

## Original evidence and historical assumption

The pinned official 2024 canvass, page 16, reconciles all 93 counties to Fischer
499124, Osborn 436493 and write-in scatterings 2719. Its decoded SHA256 is
4887fb1caab820ab737adaaff9b73ee601e37a707fb0002d8901fd674e8efbe9.
The reproducible importer and independent Census crosswalk are in scripts/data.
The factual reference alone is marked runtime-ineligible: it describes a different
Senate seat/class and opponent. Page 17 Ricketts totals are never mixed into it.

The runtime envelope explicitly declares
`EXPERIMENTAL_OSBORN_2024_TO_2026_DIFFERENT_SEAT`: historical Osborn county support
shape is anchored to current whole-race Osborn-versus-Ricketts expectations.
This unfitted transfer assumes some local support pattern persists. It is neither
same-seat evidence nor calibration. Shared batch uncertainty, the existing joint
covariance and bounded state budget remain; expected friendly counties are not a
surprise. Broader directional transfer is an explicit experimental assumption,
not Democratic affiliation or uniform Senate-to-House transfer.

The exact 2026 roster and source pins are in
`data/nebraska_senate_source_contract.json`. Official By Petition qualification
and provider Independent remain distinct. The official roster PDF contains public
contact fields and remains local research; it is not included in the repository.
The source's incumbent discrepancy is nonoperative for fundamentals and calls.

## Current source contract

Only civicAPI race 87254, General US Senate, Nebraska, November 3 2026, round 1,
five exact IDs/names/parties and all 93 independently matched counties are accepted.
The saved JSON is a browser serialization, not original HTTP bytes. Its stale zero
payload is excluded. No fresh source request was needed for this implementation.

Missing/extra/duplicate candidates or counties, conflicting identities/FIPS,
unsafe/noninteger/negative counts, state/county candidate-sum disagreement,
test/mock flags, disputed/other-round scope, missing/preclose/stale/future clocks
fail closed. The bounded native response reader limits decoded bytes to 256 KiB
and rejects invalid UTF-8/JSON. All-other support and correction watermarks are
retained even when the paired likelihood must be withheld.

One additional slow route shares the existing transport pool: at most one full
request per minute after completion, including queued/manual work; automatic
pre-election cadence is ten minutes. Hidden/archive/generation/backoff/revision
guards and correction, withdrawal, rollback exclusion and recovery are preserved.
The eight fast routes and pool bounds do not expand. Winner/call/celebration
readers are unchanged.

## Shared model and evidence limits

NE receives one fixed state member. MI2, PA3 and WI2 memberships/budgets stay.
The kernel, capture allowlist, revision/history envelope limits move together to
18 inputs (506 live races plus 18 evidence/seen slots). Conditioning requires
explicit `no_credit`. Personal diagnostics/history use Osborn/Ricketts labels.
The shared five-stage rehearsal now includes typed fictional Nebraska evidence;
it cannot enter live evidence or history.

Tests compare absent/rejected NE outputs numerically with a pinned released
17-input kernel, exercise all 18 simultaneous inputs, coherent Four Endings,
ESS floor, expected versus surprise performance, all-other accounting, corrections,
withdrawal/recovery and browser isolation/cooldowns. Quadrature convergence is a
numerical check, not predictive accuracy. Real positive post-close production
delivery, independent chronological validation and calibration remain unproven.
