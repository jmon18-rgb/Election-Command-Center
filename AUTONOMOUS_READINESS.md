# Election Night production-readiness assignment

Owner-authorized October 25, 2026. Target: dependable November 3 laptop operation.
Feature freeze: October 31, America/New_York. November 1 onward: defects,
acceptance testing and recovery only. Stop unattended changes November 4 at noon Eastern.

## Work order

LATEST HUMAN CLARIFICATION (October 26): the primary deliverable is the
NATIONAL NYT-style results-informed Blue Wave / Blue Tsunami outlook. Individual
Iowa/Kansas/Texas race needles are supporting inputs and diagnostics. Their
completion does not complete the requested national needle. Reuse them; do not
expand race-panel production or generic hardening ahead of the missing bridge.

At the October 26 clarification, the correlated House/Senate Four Endings model
accepted verified calls but lacked the county-return connection. PR454 now
implements and deploys the scoped experimental connection; see
NATIONAL_RESULTS_NEEDLE_CONTRACT.md and readiness-progress.md for tested evidence
and remaining limits. PR455 also deploys WI-01 district-part county counts directly
to the same national model. One House district plus three Senate states remains
limited coverage, not national House assurance or independent calibration. Continue testing that explicit partial-return contract
within the same national model. Do not average race probabilities or count a
poll-informed race posterior as independent evidence against the same poll prior.
Distinguish local/candidate effects from shared national effects; three Senate
states provide limited national evidence and especially limited House evidence.
Preserve source/remaining-vote uncertainty, bounded influence, correction and
retraction behavior, and baseline-versus-results attribution. Keep the owner's
existing four outcome thresholds and coherent joint probabilities.

Build a scoped experimental national updating path for review and evaluation;
NYT-grade calibration is not a prerequisite for implementing it and must not be
claimed without evidence. Do not silently promote raw precinct percentages,
statewide margins or unsupported cross-race extrapolation. Provide an isolated,
clearly labeled national rehearsal so the owner can inspect results-driven
movement while real providers remain in test mode; fixtures never enter live
counts. Tests must demonstrate the NATIONAL outlook moving before race calls,
not merely individual race panels changing. Finish already queued critical
fixes with required checks, then concentrate subsequent work on this bridge.
This clarification supersedes older race-first task ordering below.

LATEST OWNER PRIORITY (October 25, after the source-progress review): deliver
LIVE RETURNS THAT INFORM A PROGRAMMED PREDICTIVE NEEDLE, primarily CLOSE RACES.
This supersedes the older task ordering below. Do not use source-gap counts,
manual links, maps, passing regression totals or provider winner flags as proxies
for this deliverable. Pause further UI, alert, celebration and generic reliability
expansion unless it directly unblocks the source-to-needle path or fixes a critical
production defect. Preserve queued work and required checks.

Start with Iowa Senate: the current linked model is approximately even and its
polling input has 14 contributing firms / 8 independent firms as of October 22.
Kansas Senate is the next Senate target. FL-09, CO-05 and TX-23 are close House
targets, with thinner polling. Re-rank using current linked odds AND actual
polling evidence; a missing-data/uncertain safe seat is not automatically a tossup.
Do not spend custom source-integration time on overwhelming favorites or races
expected to be called immediately after polls close; reuse existing broad feeds.

The next implementation milestone is one competitive race end to end: permitted
real source -> exact race/geography/method counts -> modeled remaining ballots
with uncertainty -> partial-return forecast -> visible updating race needle.
Program and evaluate the estimator; descriptive comparisons do not fulfill it.
Keep modeled outstanding votes distinct from counted votes and historical replay
distinct from live delivery. Use historical evaluation to assess uncertainty,
and label an unevaluated prototype honestly. Do not falsely claim calibration.
Keep any national correlated update disabled until its transfer is justified.
Report exact source/data/access blockers promptly and continue independent
estimator work; do not repeatedly monitor a blocked archive or build more polish.

Latest owner steering (October 25 evening): pause further celebration artwork,
music and expansion. Preserve deployed work and open reviews. Prioritize
competitive-race source gaps/fallbacks, verified calls/control accounting,
outage/correction recovery and the dependable single-screen laptop experience.
Continue scoped needle evidence work where it resolves a real data gap. This
overrides the celebration production targets below until the owner changes it.

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
  Follow CELEBRATION_CREATIVE_BRIEF.md for the owner's specific scenes, Fish Head
  announcement-before-music sequence, candidate distinctions and audio direction.
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
