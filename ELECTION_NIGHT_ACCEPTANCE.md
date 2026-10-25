# November 3 Election Night: operator acceptance and recovery

**Status: NOT YET ACCEPTED.** This is the final operational checklist, not proof that source gaps, nationwide race calls, or the geographic needle have been solved. See [ROADMAP.md](ROADMAP.md) and [DEPLOYMENT.md](DEPLOYMENT.md). Do not replace an unmet gate with a synthetic test pass.

## The four independent gates

| Gate | Evidence required | Must remain unproven until |
| --- | --- | --- |
| **Published-site integrity** | GitHub Pages HTML and all release-critical JS match current `main`; production smoke green; fresh desktop and mobile render | Published bytes and runtime are checked, not just PR/Actions build |
| **2026 result delivery** | Each visible positive count has a verified Nov 3 2026 exact race, office and district, provider-published timestamp and source ID; browser CORS works; no zeroes inferred from missing records | Genuine post-close 2026 provider results exist |
| **Nationwide source coverage** | All 435 House, 35 Senate and 36 governor contests independently classified; missing source identities and missing live data separately displayed; licensed source rights checked | Every outstanding source gap is resolved with a genuinely usable source, not merely a human landing page |
| **Geographic needle** | Time-sequenced historical replay with matched 2026 county/precinct geography, vote method and reporting order; held-out error and interval coverage; outage/correction replay | Those chronological benchmarks actually pass; otherwise show experimental/ineligible, never a calibrated national needle |

A green polling refresh, historical replay with static final totals, successful source-ID lookup, or a passing mock outage test **does not** clear any other gate.

## Before polls close — laptop drill

1. On the same laptop/browser intended for Election Night, load https://jmon18-rgb.github.io/Election-Command-Center/ and verify Election Night opens from a new tab and from a long-running tab. Verify published revision parity on `main`, current refresh timestamps, no JavaScript errors, and no phantom 2026 vote totals.
2. Check GitHub Actions: *Refresh election briefing*, *pages build and deployment*, *Production deployment health*, source-preflight/coverage workflows, and the scheduled real-browser endurance workflow. Record each run's actual conclusion and timestamps. A scheduled future run is not evidence of a past pass.
3. Inspect `data/election_night_source_coverage.json` and the on-page 506-race desk. Identify each *not-indexed*, *unprobed*, *provider-outage*, *invalid source*, *stale* and *manually linked only* contest. Escalate NH-01, NH-02, remaining seven outside-primary House exceptions and Massachusetts Senate first; do not count Boston municipal returns as statewide Massachusetts returns.
4. Confirm the 18 Senate supplemental sources rotate through all identities over four consecutive Election Night hourly windows. A single green hourly job establishes at most the sources that job actually checked.
5. Open the dashboard on a second device for a mobile cropping/accessibility check. Verify the Fish Head mouth is visible, modal dismiss/replay and muted state work, and critical source ages are legible.
6. Keep a list of independently accessible official results pages as **human fallback only**. Note original election year and scope in the list. Never paste a manual page number into an automated tally.

## After first real polls close — live acceptance

- A positive result must identify the exact 2026 general-election contest and original provider publish time. Compare the displayed Senate, House and governor *independent* latest-positive-vote clocks; a fresh House update must not conceal a stale Senate office.
- In at least one live exact-match race per available provider, compare total candidates, two-party vote shares and source timestamps with the original provider. Record discrepancies without automatically averaging incompatible snapshots.
- Confirm the Senate tally includes the correct 65 holdover seats **only in control math**, never as new 2026 races; House denominator is 435 and governor contests are 36. An incomplete source tally cannot independently establish chamber control.
- For any winner marker or celebration, inspect explicit source-reported winner identity, correct race and source freshness; an early lead or model probability cannot trigger an earned win. On a corrected/retracted winner flag, the UI must revoke the earned state.
- Let the real Chromium tab run through the 120-minute scheduled job; inspect actual report artifacts, request successes, tab background/restore behavior, console errors, timestamps and sustained updates. Do not interpret a successful CLI/syntax smoke as a real two-hour pass.

## Failure playbook

| Symptom | Operator action | Safety invariant |
| --- | --- | --- |
| Primary Open America unavailable or outdated | Check request status and source freshness; keep scope-limited races clearly stale/unavailable; use independent verified supplement where its race is exact-matched | Do not reuse old votes as current, manufacture zeros, or claim complete national coverage |
| civicAPI 429/502/503/504 | Respect shared circuit-breaker cooldown; inspect source preflight; wait for a fresh validated recovery response before trusting any cached winner flag | Cooldown expiry alone is **not** recovery |
| Provider conflict/candidate correction | Log source ID, original publish time, candidate totals and conflict; revalidate canonical race before reporting | Do not combine incompatible vote snapshots or lock control odds from disputed counts |
| Pages or JS revision mismatch | Confirm deployed bytes against current `main`, Actions deploy completion and versioned script URLs; avoid relying on stale tab state | Do not mark green because old HTML matches old JS |
| Senate stale but House fresh | Check the Senate-specific provider-published clock and audit affected source IDs | A globally fresh clock cannot clear office-specific stale data |
| Missing geographic baselines / sparse returns | Display observed counted vote with explicit incomplete-source status; suppress national precision claims | Never turn raw early county anecdotes into calibrated needle confidence |
| Historical/preview celebration fires | Switch to live 2026 validated source mode; distinguish simulated preview and revoke any false-earned state | No real win celebration without fresh source-reported call |

## Release decision log

For every check, record *UTC timestamp, workflow URL or original source URL, race/office scope, tested device, result (PASS/FAIL/UNKNOWN), and the specific evidence*. Unknown is not pass. Keep the data-provider permissions decision separate from whether the HTTP endpoint happens to return 200.

**Go for read-only monitoring:** published app renders correctly, clearly labels missing/stale races, and live positive totals that exist pass exact-race/source checks.

**No-go for “complete nationwide live results”:** any source-identity gap, unverified outside-primary 2026 result availability, or unresolved provider rights remains.

**No-go for “calibrated predictive needle”:** chronological time-slice ground truth, geography/method reconciliation and out-of-sample calibration evidence remain absent.

The dashboard may still be useful on November 3 while specific gates are open. Its labels must describe what is genuinely verified.
