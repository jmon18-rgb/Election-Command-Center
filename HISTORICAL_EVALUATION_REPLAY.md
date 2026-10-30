# Offline chronological replay and research scoring

This document specifies the integrated offline research utility and its 16
mechanical controls. Release state is recorded separately: source integration or
passing these controls is not publication, independent dataset admission or an
empirical evaluation. No actual dataset or model draws are part of these controls.

This utility fills an execution gap between the existing historical-package
preflight and an eventual empirical evaluation. It does not supply the missing
independent chronology, rights, contemporary frozen expectation, historical model
adapter or whole-election heldout. The formal calibrated-national-acceptance
NO-GO and zero-admitted-case decision remain unchanged.

## Input and execution contract

`scripts/historical_evaluation_replay.cjs` is a Node library with no browser
integration, downloads, CLI loader or automatic discovery. Existing preflight
behavior is reused unchanged. An explicit trusted offline caller supplies:

- The package manifest and a confined local `readBytes` implementation.
- Reviewed `decodeExpectations`, `decodeSnapshot` and `decodeTruth` callbacks.
- All three frozen predictors: `model`, `polling_only` and `naive_count`.
- A predeclared scoring protocol, including interval levels and target units.

No callback implementation or probability is invented when one is unavailable.
Reusing current2026 county eligibility or priors on historical maps is not an
approved historical adapter. Code/parameter vintage, normalized-original binding
and external independence must be reviewed separately. A supplied SHA declaration
or the structural preflight's review booleans cannot establish those facts.

`replayRetainedPackage({manifest,readBytes,decodeExpectations,decodeSnapshot,predictors})`
owns the manifest, retained artifact bytes and predictor slots before its first
await. The existing preflight reads and hashes **all** retained artifacts,
including final truth. That initial hashing is distinct from truth interpretation.

The expectations decoder returns frozen expectations and an `identity` containing
`election_id`, `race_id`, `positive_candidate_ids` and `negative_candidate_ids`.
The snapshot decoder receives only that snapshot's original/normalized bytes and
declared native roster metadata. It returns `observation`, `counted_positive` and
`counted_negative`. Each predictor receives its own immutable copy of only
`{identity,frozen_expectations,history}` through the current snapshot. Final truth,
future snapshots, final fractions, evaluation stages, artifact readers and scoring
callbacks are not in that packet.

These callbacks are **trusted research code**, not an untrusted-code sandbox.
Their closures could obtain future data or perform operations outside the packet.
Independent code/source review and a controlled offline caller remain necessary;
input ownership alone does not prove causally valid or authentic predictions.
The history packet carries the normalized `observation`; the separately retained
`counted_positive`/`counted_negative` scalars are scoring metadata. Actual decoders
must put sufficient contemporaneous count information in the observation for a
genuine model or naive predictor. Method names alone do not prove that a
`polling_only` callback ignores count history or implements a genuine baseline.

## Target and output

The retained-package entry point supports only a complete native roster containing
exactly two candidates, one in each explicit axis. A third candidate fails before
any predictor executes. There is no implicit D/R, candidate-name, geography or
caucus reconstruction. Broader candidate rosters need a separate full-roster target.

Each predictor must return either `WITHHELD` with a reason or a complete
`PREDICTED` record: `margin_points`, `positive_win_probability`, `margin_interval`
and `remaining_interval`. Intervals require `level`, `lower`, and `upper`. Unknown
output keys are rejected. Retractions and recovery remain in the frozen trace.
The trace contains projected outputs and hashes, not copied original/prior bodies.

`scoreRetainedTrace({replayResult,manifest,readBytes,decodeTruth,protocol})` is a
separate second phase. It checks the exact manifest and final-byte hash before
decoding final truth. Only then are retrospective stage labels introduced.
The truth decoder supplies the same identity and the two candidate vote totals.

The required protocol is retained on every race and aggregate report:

```js
{
  margin_level: marginLevel, // from the predeclared protocol
  remaining_level: remainingLevel, // from the predeclared protocol
  target: 'EXHAUSTIVE_TWO_CANDIDATE_CONTEST',
  observation_selection: 'CONSECUTIVE_OBSERVATION_LIFECYCLE_AND_PREDICTION_V1',
  remaining_unit: 'UNREPORTED_VALID_TWO_CANDIDATE_CONTEST_VOTES'
}
```

Different protocols cannot be aggregated. Consecutive selection compares the
serialized normalized observation hash, lifecycle kind, both counted totals and
the complete validated prediction projection. Only an identical consecutive state
receives no additional score weight. Same-count retractions, withheld predictions,
recoveries and changed remaining targets remain represented. These correlated
state records are never relabeled as independent races.

Research arithmetic includes margin MAE/bias, interval coverage/width, Brier/log
loss and remaining-vote interval coverage. Incorrect probability0 yields infinite
log loss rather than a clipped favorable value. Tied final outcomes lack a binary
outcome score. A negative final-minus-observed total is not silently clamped into
physical remaining votes. Remaining units cover valid votes in this binary
contest, not all ballots, undervotes or overvotes.

`aggregate` weights usable races equally within each election and usable elections
equally. It retains predicted/withheld and usable race/election denominators.
Separate method summaries are not a paired baseline skill estimate:
the unpaired aggregate's `paired_baseline_skill` remains null. Subtracting its
means could favor a model that withholds the difficult observations. The separate
paired APIs below compute descriptive comparisons on explicitly shared cohorts.
Actual independently admitted comparative predictive skill and national
chamber/Four-Endings transfer evaluation remain unestablished.

## Explicit paired baseline arithmetic

`scorePaired(trace,truth,scoringProtocol,comparisonProtocol)` requires the exact
predeclared `PAIRED_PROTOCOL` exported by the module. It compares `model` against
**each** fixed baseline separately: `polling_only` and `naive_count`. It reuses
the same private selected-state rows as the unpaired scorer. A pair requires both
methods to be `PREDICTED` on the identical selected event IDs; it does not require
the other baseline to predict, and it never substitutes zero loss for withholding.

Reports retain each pair's selected IDs, both-predicted IDs, model-only withheld,
baseline-only withheld and both-withheld IDs/counts. Final ties exclude only binary
probability losses; negative final-minus-observed totals exclude only remaining
interval comparisons. Every metric carries its exact event cohort and matching
model/baseline cohort hashes. Different interval levels, target/count units,
selection rules or comparison protocols cannot be pooled.

MAE, Brier and log-loss gains are **baseline loss minus model loss** on that same
cohort. There are no relative ratios, epsilon denominators or probability clips.
Bias, coverage and width appear side by side, without an invented interval-skill
score. Empty cohorts have explicit no-usable-data records, never a zero estimate.

Loss means and gains use JSON tags for finite, positive/negative infinite and
undefined values. If both extended log-loss means are infinite, their difference
is undefined. This remains true when the two methods have infinite losses on
different events or races. Such observations are counted and retained; they are
not dropped, cancelled against each other or silently converted to zero.

`aggregatePaired(reports)` first averages usable shared races equally within each
election, then usable shared elections equally. Both method means use the same
per-metric race/election IDs. Extended means are formed **before** their gain is
calculated. Reports include unused and undefined race/election identities,
infinite-loss identities, and all usable/withheld denominators. Selected states
remain correlated observations rather than independent races. Different pairs
can have different usable cohorts; their conditional results do not support an
unqualified ranking across baselines or an abstention/coverage acceptance claim.

`scoreRetainedPairedTrace` uses the same original manifest/final-byte checks and
post-trace truth-decoding phase as `scoreRetainedTrace`, with the explicit
`comparisonProtocol` argument. It does not invoke predictors again, grant dataset
admission, authenticate callback information sets or add a source request.

All outputs grant zero dataset/heldout admission and set
`may_claim_calibration:false` and `may_change_forecast:false`. Independent admission
and calibration acceptance belong to separate evidence review, not this library.

## Verification and release scope

The focused test retains the existing metadata/hash fixture constructor and all
16 reviewed mechanics controls. Named additional controls cover the demonstrated
asymmetric-withholding error, shared pair/event/stage/metric identities, common
race/election weights, explicit tie/overcount/empty denominators, finite and
infinite proper losses, protocol/cohort drift, and the retained paired wrapper.
It does not run the old test suite, actual model or a historical corpus. Tiny
callback values exercise transport/scoring mechanics; no empirical metric values
are retained in its proof. Per-run immutable proof/failure reports belong under
`artifacts/readiness`, never beside source files.

The existing readiness runner registers this one pure test after the package
preflight entry. No new browser benchmark, source route, draw count, workflow job
or deadline is introduced. Production index, live source rules, collector cadence, model target,
probabilities, human ledger and operator guide are outside this change.
