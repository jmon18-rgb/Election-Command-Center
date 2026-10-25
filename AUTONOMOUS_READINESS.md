# Election Night production-readiness assignment

Owner-authorized October 25, 2026. Target: dependable November 3 laptop operation.
Feature freeze: October 31, America/New_York. November 1 onward: defects,
acceptance testing and recovery only. Stop unattended changes November 4 at noon Eastern.

## Work order

1. Run the consolidated readiness checks immediately; fix failures before features.
2. Verify a single-screen laptop experience: model, observed results, decisive races,
   attributed calls, source health and supported geographic comparisons.
3. Exercise existing integrations under outages, delayed updates, corrections,
   withdrawn calls, background tabs and recovery. Reuse adapters and tests.
4. Check deployed bytes and real desktop/mobile behavior. Keep real-provider soak
   evidence separate from simulated elapsed time and synthetic fixtures.
5. Pursue chronological historical replay only where timestamped, usable archives
   exist. Preserve explicit gaps; final totals are not a reporting-order archive.

Use ELECTION_NIGHT_ACCEPTANCE.md as the acceptance authority and the current
competitive-race-first priorities in ROADMAP.md. Owner clarification: the needle
and celebrations are high-priority deliverables alongside core reliability.
Do not defer them behind unrelated roadmap research or optional polishing.

## Needle and celebration delivery targets

- Needle: start with one supported race/state and an end-to-end source-to-display
  update, including freshness, comparison baseline and an uncertainty explanation.
  Keep the existing national joint model separate unless geographic updates have
  validated calibration. A descriptive comparison does not satisfy the predictive
  needle request; record the distinction and any remaining data blocker plainly.
- By October 27, target an evidence-based decision on a scoped predictive version:
  identify usable chronological historical returns, comparable live source data
  and held-out evaluation. If missing, report the exact gap and supported fallback;
  do not spend every subsequent run rediscovering the same blocked archive.
- Celebrations: reuse the existing event roster, posters and validated call gates.
  Build a shared timed animation player with distinct event storyboards, local
  assets, skip/replay, sound controls and reduced-motion behavior. Preview mode
  must exercise the same player while staying isolated from earned live events.
- Target a complete celebration preview roster by October 29; use October 30–31
  for desktop/mobile, duplicate-event, queue and call-retraction verification.
  Begin with local SVG/CSS animation and existing audio; optional art/audio upgrades
  must not block working sequences. These dates are targets, not proven delivery.

## Execution and evidence

Inspect working changes and open PRs before starting; never overwrite another run.
Choose a bounded task, implement it, run relevant checks, repair failures, and make
small coherent commits on a development branch. Open/update a reviewable PR.
Routine engineering decisions do not require approval. Preserve branch protections;
The owner authorized merging and deploying routine tested readiness improvements
after applicable checks pass. Verify the deployed result and preserve required
protections. Never publish private source material.

Run `node scripts/run_election_readiness.cjs` for the dependency-free core suite.
Add `--remote` to include the existing deployed-site smoke. Reports go to
`artifacts/readiness/`; JSON includes each command's status, elapsed time and log.
The scheduled Election readiness report workflow also runs actual Chromium drills.
Its artifacts and job summary are evidence for the tested commit, not blanket
proof of live coverage or calibrated forecasts.

Update readiness-progress.md after substantive work: tested revision, commands,
pass/fail, evidence URLs, unresolved acceptance gates and the next concrete task.
Do not call a skipped, stale, failed or unrun check a pass. Mock tests never prove
actual November 3 vote delivery, source rights, or forecast calibration.

Scheduled continuation is every 15 minutes in this chat, subject to local app and
computer availability. One daily report on the first run after 9 a.m. Eastern:
completed changes, test evidence, open risks and next priority. Record the last
daily report date. Notify sooner for failures needing human action or a material
readiness milestone; keep unchanged monitoring quiet.

The interval is a continuation opportunity, not a time limit on active work.
Continue implementing, testing and repairing the next useful readiness task
within each run. Avoid overlapping edits. Triage the remaining roadmap by
November 3 operational acceptance and explicitly defer optional features.
