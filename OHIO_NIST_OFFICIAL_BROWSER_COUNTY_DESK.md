# Ohio official NIST approved source: Election Night browser desk

A new Ohio section in the Election Night screen can display
source-attributed candidate totals from Ohio's official NIST/XML result
export, if and **only if** a genuine November 3 publication, complete 88
county map, party IDs and race IDs are independently approved after polls
close.

It reads:
- `data/ohio_nist_source_approval_2026.json` — committed disabled today;
- `data/ohio_nist_candidate_votes_2026.json` — produced only by the
  approved five-minute source refresh workflow.

The browser verifies source URL, actual 2026 election date, post-poll
source approval, SHA-256, original provider-generated timestamp freshness,
exact Ohio Senate/Governor/House race IDs, 88 county IDs and positive
candidate-only totals. It does not invent percent counted, ballots
remaining, source-certified winners, or chamber-control changes.

A static laptop tab rechecks deployed snapshots every two minutes while
the page is visible and again when it gains focus. A real desktop and
mobile Chromium drill injects **synthetic** approved/count, invalid SHA,
stale, 404/offline source, disabled approval and recovery responses.
The pre-election official Ohio site still explicitly displays **mock**
totals, so the actual source remains disabled.

**This PR does not yet promote Ohio candidate-only counts into the
506-race national source reconciliation or JackStradamus live needle.**
The Ohio desk keeps them visibly separate until the independent source
and chamber-control accounting contracts are updated and verified.
That integration is the next priority after this browser path is green.

## Merge and browser release checks

The reviewed Ohio results drawer is visible only in 2026 mode; 2024
archive mode never displays partial 2026 Ohio candidate counts. The
Chromium rehearsal runs on desktop and iPhone-size screens with purely
synthetic intercepted results and verifies the initial disabled state,
independently reviewed enablement, invalid SHA, stale source, network
outage, approval revocation and recovery. The national control and
forecast models are not updated by this separate candidate-only drawer.
