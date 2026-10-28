# National needle acceptance decision — October 27, 2026

The pending Independent-control correction explicitly withholds Democratic caucus credit from uncommitted Independent winners, while retaining established holdovers and the existing seat thresholds. These are Democratic-majority threshold scenarios, not a resolved forecast of future coalition negotiations: neither D threshold does not establish a Republican majority. Individual race draws and likelihood inputs are unchanged. Protected release verification is still required.

## October 27 methodology reassessment after owner rehearsal review

The owner requested better expectation-based forecasting, not cosmetic smoothing.
The rehearsal previously imposed arbitrary race margins (0, D+8, D+2). PR487
replaces those with historical county composition adjusted to current race means,
then an explicitly declared three-point margin surprise. These are hypothetical
county expectations, not county polls. Expected reporting can narrow uncertainty;
the raw arrival of Democratic counties is not evidence of a Democratic wave.

Published methodological evidence supports local benchmarks, caution about
incomplete voting-method batches, and shared observation errors:

- [NYT graphics editor Wilson Andrews interview, Reuters Institute, Oct28 2024](https://reutersinstitute.politics.ox.ac.uk/news/moving-needle-how-new-york-times-aims-guide-readers-through-americas-most-uncertain-election): describes local pre-election expectations and learning about similar places from deviations. This interview establishes the broad approach, not NYT source code or parameters. Direct retrieval of the original NYT explainer was unavailable; no paywall bypass or proprietary reconstruction.
- [DDHQ authors, Harvard Data Science Review, Oct18 2024](https://doi.org/10.1162/99608f92.ccb395f0): published primary-election method uses geography/demographics and nearly complete reporting units, and cautions about early/late mail-vote differences. It is not a validated parameter prescription for our general-election House/Senate model. Their completeness thresholds must not be substituted for our unknown vote completion.
- [Andrew Gelman, Nov8 2016](https://statmodeling.stat.columbia.edu/2016/11/08/election-forecasting-updating-error-ignored-correlations-data-thus-producing-illusory-precision-inferences/): identifies correlated errors in early-vote estimates as a source of false national certainty.

Concrete candidate improvement: retain the existing eight-margin-point batch
error standard deviation but allocate half its variance to one shared reporting
error across admitted races and half to race-specific error. Integrate the same
shared nuisance after combining county likelihoods, using a normalized 61-node
normal-density grid over +/-6 standard deviations, before ESS tempering and same-draw replay. This distinguishes a
common early-batch artifact from independent confirmation in several states.
Fixed state likelihood budgets, the contamination floor, original correlated
prior draws and Four Endings thresholds remain unchanged. No visual moving
average, hysteresis or update delay is introduced; valid corrections still
change the estimate immediately.

Independent numerical review rejected the initial five-node integration as too
coarse for multiplied likelihoods. The replacement matches a closed-form
robust-likelihood integral through 16 factors (relative error below 1e-6), and
agrees with a finer 121-node reference on actual rehearsal inputs. A conditional
scalar log-likelihood lookup at 0.125-margin-point spacing avoids repeating all
county calculations at every node. Direct-versus-lookup and finer-grid checks
must allow one-draw headline rounding while assessing posterior-weight error;
the saved numerical review is not a historical forecast-accuracy evaluation.

The one-half variance allocation is an explicit, unfitted engineering assumption,
not a NYT/DDHQ parameter or empirically optimal value. This addresses a structural
independence weakness; it does not demonstrate improved accuracy. A common error
can resemble genuine national movement, so coherent multi-race performance must
still move the outlook and independent held-out chronological evaluation remains
the acceptance gate. Shared errors may not cover every regional/method-specific
bias; county demographics and verified method-level observations remain future
evidence requirements, never guessed inputs. No new source or polling posterior
is counted as result evidence. Candidate changes must pass all applicable checks
and publication verification before being described as deployed.

Decision: implementation is ready for experimental use; predictive validation is
not sufficient for a calibrated national forecasting claim. This is the bounded
October 27 source/calibration decision, prepared from existing evidence. It does
not change the owner's primary national-needle requirement or silently disable it.

| Acceptance question | Evidence | Decision |
| --- | --- | --- |
| Do incoming competitive returns change one coherent Four Endings forecast? | PR465/468/470/471/473/475/476/477 plus474caption/478provenance repair deployed; synthetic laptop/mobile WA-only, Maine-only, Ohio-only, PA07-only, AZ06-only VA02-only, PA08-only and MI07-only national movement before calls, corrections and withdrawals | Implemented; synthetic evidence only |
| Is an independent official path usable? | WA03 and VA02 official GET200; separate owned publications/CORS/readback verified; seven WA and eight VA district parts matched | Transport verified; no positive post-close delivery yet |
| Are live competitive inputs available now? | Actual sixteen-route published probe 2026-10-27T06:04:54.082Z on runtime3c02b913: fourteen zero-count civic routes (most stale) and two expired pre-election official health-only copies; final metadata-only47e correction does not change named counts/runtime | No accepted positive inputs |
| Does historical evaluation establish partial-return skill? | Iowa assumed-order experiment: partial margin MAE6.63points vs naive19.89; neutral prior, different Senate class | Useful stress experiment; not chronological validation or national calibration |
| Is genuine historical chronology complete? | Four verified Thurston2024 partial reports, one of seven WA03 county parts, approximately59%-97%of final two-party votes | Incomplete, especially early count; no statewide replay/calibration approval |
| Are probabilities/remaining-vote intervals calibrated? | No approved chronological multi-race calibration inputs; predeclared uncertainty and bounded influence are design choices | Unproven |
| Will results arrive as fast as major publications? | Request timings and source clocks exist, but no independently matched real vote batches | Unproven; official collection/cache may add minutes |
| Does coverage represent national House behavior? | Eleven supported House districts across seven states, plus five Senate states (IA/KS/TX/ME/OH) | Limited evidence; not a representative national sample |

## Exact outstanding evidence

### R2 admission and scoring specification (October 27 roadmap review)

The saved corpus contains **zero admitted chronological calibration datasets**.
Thurston has genuine partial reports but only one of seven WA03 parts, starts at
59.1% of eventual two-party votes and lacks independent publication/capture
clocks and a contemporaneous forecast. Iowa/Kansas assumed-order historical
experiments remain development stress tests. Reused close-governor outcomes are
not fresh holdouts. The AP archive still lacks established reuse rights and
independent capture provenance; Ohio registration/absentee administration is
not an admitted candidate-return sequence. No blocked-source retry is justified
by this inventory.

Before admitting an evaluation dataset, retain a manifest with exact race/year,
candidates and complete matched reporting geography; original bytes/hash and
source clock; independently established availability/capture time and correction
chain; final truth and permitted reuse. Freeze genuinely contemporaneous
pre-election expectations without using final outcomes to construct the prior.
Replay real early/middle/late snapshots. Retrospective final count fractions can
classify evaluation bins but cannot enter predictions as known completion.

Hold out entire races/elections, not snapshots from the same tuned case. Report
margin MAE/bias, interval coverage and width, Brier/log loss and remaining-vote
interval coverage against both polling-only and naive-count baselines. Stratify
by reporting order/method and check correction/retraction recovery. Keep the
independent-race sample count separate from the number of correlated snapshots.
National covariance transfer requires a separate held-out chamber/Four Endings
evaluation using contemporaneous inputs across races; race-level skill alone
cannot clear that gate.

The next useful evidence task is a prospective retention audit of existing WA/VA
collectors and client admission. Their data-only Git branches preserve selected
publication versions, but the original-body and client-admission chains must be
checked before claiming that future batches will support replay. Retention
repairs may not add native requests or change collection cadence. Future data
collection is preparation, not historical validation already achieved.

### R4 browser admission evidence candidate (October 27)

The candidate records only WA03/VA02 inputs actually listed in the national
model's `diagnostics.used`. Availability in a controller alone is not admission.
The existing activity CSV can export browser observation time, the original
source and collection clocks, the verified selected-payload hash, model/kernel
revision, polling lineage and public versus local research context. Original
full-response hashes are retained as collector claims; the browser does not
recompute a body it never received.

Corrections, withdrawals, recovery, model changes and admitted remaining-estimate
changes have separate events. Removing an input retains the last real source
receipt while recording the current decision's model lineage. Missing audit
metadata is explicitly distinct from model/source withdrawal. The optional audit
cannot modify the model, restore live inputs or add network requests.

This is a browser-local, bounded record: at most 120 events and 150,000 serialized
characters, retained for 72 hours. Export it while available. It is not a central
archive, an independent source publication clock or a complete record from
unopened/background clients. Simulations and pre-election observations are not
logged as real admissions. Full original HTTP-body retention in the scheduled
collectors is still a separate missing link; neither this candidate nor selected
Git history establishes chronological calibration or real positive delivery.

1. A chronological sequence spanning the supported race's county/district parts,
   with stable candidate/geography joins and early, middle and late counts. Final
   totals split into invented batches cannot substitute. Thurston alone cannot
   validate the seven-part WA03 forecast; do not expand its precinct-complete
   statistic into an estimate of all ballots counted.
2. Contemporaneous remaining-ballot information or a demonstrably evaluated
   turnout/selection uncertainty model. Historical final votes are a reference,
   not a count of outstanding2026ballots.
3. Held-out race/election evaluation using contemporaneous baseline expectations,
   reporting margin errors, interval coverage and probability scoring. Iowa's
   neutral prior and assumed ordering do not satisfy this criterion. National
   covariance transfer requires its own evaluation beyond a race-only backtest.
4. Real post-close batches observed through the deployed client and independently
   matched to official/publication batches before any comparative-lag claim.

## Bounded delivery work

Keep the deployed national needle explicitly experimental and its baseline versus
results attribution visible. Preserve the exact current thresholds, guards and
normal release checks. Do not spend more runs on unchanged pre-close probes or
optional expansion. The next source effort must address a pivotal missing race
or one of the evidence gaps above, with a bounded endpoint and a recorded outcome.

The saved owner-uploaded House tipping-order audit prioritizes PA10(rank1),
NC01(rank2), NY17(rank4) and AZ01(rank7) ahead of WA03(rank13); the saved linked
model competitiveness filter is dated15:20UTC and must not be called a fresh poll.
PA10 and NY17 already have civic inputs, but their independent fallback gaps
remain. NC01/AZ01 are coverage gaps; source availability alone cannot reorder
importance. Preserve queued NC research rather than duplicate or blindly merge it.

A dependable results dashboard as the primary fallback was recommended to the
owner, but has NOT been approved as a replacement for the national needle.
No assertion is made that85%remaining usage guarantees finishing or validation.

## Latest implementation evidence

PR475 passed all38 exact-head workflows and deployed the independent official
VA02 national path. Tested head dee048c5051cbaf28fd965e6f8a72240aa1d34fc;
final main878604d53e8a38dfcb073b1ea5903e8a2f5144b0; Pages40452988470 SUCCESS.
All232 expected published files matched05:05:08Z. Published laptop/mobile synthetic
VA02-only national movement during civicAPI503, correction/withdrawal/recovery,
request bounds and Virginia attribution passed. Real backend bootstrap40452957460
made one official GET200 and published health-only/null payload on the separate
data-only branch; raw readback/CORS/byte identity verified. Native source still
contains stale zeros; the separate actual14-route probe admitted no inputs,
projections or archives and produced no page errors. Calibrated predictive
acceptance and positive post-close delivery remain unmet.

VA direct cross-origin access succeeded04:00:48Z, then later real reads failed
missing CORS headers. The deployed path therefore uses a reviewed bounded owned
copy with additional scheduling/cache delay, not a direct-access or speed-parity
claim. Source reports five methods; the estimator retains combined historical
locality totals and method-mix uncertainty. Final historical totals and observed
source clocks are not independently captured chronological calibration inputs.

## Evidence references

- https://github.com/jmon18-rgb/Election-Command-Center/pull/475
- https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40452988470
- https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40452957460

- https://github.com/jmon18-rgb/Election-Command-Center/pull/473
- https://github.com/jmon18-rgb/Election-Command-Center/pull/474
- https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40447245079

- https://github.com/jmon18-rgb/Election-Command-Center/pull/471
- https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40441068110

- https://github.com/jmon18-rgb/Election-Command-Center/pull/470
- https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40435919243
- https://github.com/jmon18-rgb/Election-Command-Center/pull/465
- https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40399515539
- https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40399466905
- scripts/evaluate_iowa_senate_partial_forecast.cjs
- scripts/national_county_likelihood.js
- artifacts/readiness/iowa/historical-scenario-evaluation.json (local evidence)
- artifacts/readiness/competitive-live/report.json (local actual-source evidence)
- artifacts/readiness/competitive-house-next-source-priority.json (local audit)
- artifacts/readiness/washington-source-research/verified-thurston-partial-sequence-research.json (local research; zero approved calibration inputs)

## PA08 release evidence — 2026-10-27T05:38:15Z

PR476 exact-head36workflows/48jobs44success4nonapplicable skips passed; final Pages40456104805 and all244publishedfiles verified. PA08-only synthetic automatic national updating/correction/withdrawal passed at1366/390, with three predeclared Pennsylvania inputs sharing unchanged state budget20. Actual published15route check admitted zero inputs, projections or archives. This increases implementation coverage; it does not close delivery, chronology, comparative freshness or calibrated national predictive acceptance.

## MI07 final release evidence — 2026-10-27T06:25:04Z

Runtime477 and provenance478 passed all applicable exact-head checks. Final Pages40460536536/all259publishedfiles and published1366/390synthetic MI07national behavior verified. Ingham279write-ins remain explicitly unresolved; no named count/model changes. MI04/MI07 share fixedMI budget20; sixteen sources remain limited, experimental evidence. Eight selectedHouse seeds/four primarycloseSenate paths programmed, not actual live delivery or calibrated acceptance. Latest real sixteen-route receipt06:04:54Z predates metadata-only correction and admitted zero inputs; not repeated without a new source reason.

## Alaska contract safeguard — 2026-10-27T07:10:58Z

Original2026 general ballot/roster independently verified: four printed Senate candidates, two certified named write-ins, five rank columns. Actual provider219761Republican conflicts with officialUndeclared. PR479 exacthead37workflows/51jobs46success5nonapplicable skips passed; finalPage40465033302/all274publishedfiles and laptop/mobile guard behavior verified. Actual focused07:07:21Z singleAK request still stalezero/State-only/round1 and was rejected by publishedadapter. Alaska first-choice flags and older cached calls cannot award a Senate seat or create aggregate-party/national predictions. Sixteen predictive inputs unchanged; Alaska remains excluded pending source/geographic/remaining-vote/finalRCV contracts. This is not positive delivery, calibration or speed proof.

## Verified first-night official remaining-estimate extension

PR482 deployed the conditional WA03 extension after all37 exact-head workflows
passed on ac7f684c. Final main6b254e22/Pages40482275587 succeeded; all289
expected published files matched09:44:29.858Z. Published synthetic laptop/mobile
behavior passed with matching index and separate count/estimate clocks.
The extension It preserves half the
original historical-turnout likelihood and evaluates a wide, shared estimate-error
sensitivity mixture for six independently verified whole counties. Thurston is
never allocated from a whole-county estimate. Same-count estimate changes can
change the national outlook in synthetic laptop/mobile tests, with unchanged
baseline draws, state budgets and ESS floor. See
WASHINGTON_REMAINING_ESTIMATE_CONTRACT.md for the unfitted numerical assumptions.

The actual pinned statistic remains 39 zeros/null clocks, so none is usable.
No actual positive post-close estimate delivery, error calibration, chronological
skill or speed comparison is demonstrated. Receipt-provenance follow-up preserves the original retrieval time when stale
statistics are rejected, without a new source request. The October27 calibrated-acceptance decision remains unmet.

## October27 matched-area explanation candidate

The shared personal cards expose the same likelihood's matched reporting-area
expectation at the PRE-RESULTS race mean plus the declared national shift. Weight
historical local shares by the actually counted D/R votes in those same areas,
using existing absentee/election-day/combined scenarios. Show observed margin,
expected margin scenarios and their difference, separate from probability-point
changes. These are assumed benchmarks, not county polls. Method-order endpoints
are not confidence intervals: selection bias, turnout and source error remain.
Largest6 reporting counties/district parts are inspectable; missing/retracted
admission removes the explanation. This diagnostic does not change any simulated
forecast or feed a posterior back into the national likelihood. Five-stage exact
output/ESS/power comparison to1c0b11ba passes; no empirical calibration is claimed.

## October27 bounded outlook observation history candidate

History consumes the existing joint result and its actual admitted-source/call
decisions. It never feeds prior observations back into a forecast. Browser clocks,
source clocks, collection receipts and polling lineage are separate. Four outcome
percentages and existing matched-performance scenarios are copied, never averaged
or refitted. Ordinary updates group within five-minute observation windows;
corrections, withdrawal/retraction, recovery and baseline changes remain separate.
Public/research contexts and ephemeral rehearsal history are isolated. Reloads
restore only bounded local observations, never active evidence or forecast state.
The record is neither an exhaustive source archive nor independent publisher
capture chronology; it cannot turn the zero-admitted-calibration decision into a
pass. Actual2026 delivery and calibration still require their original evidence.
