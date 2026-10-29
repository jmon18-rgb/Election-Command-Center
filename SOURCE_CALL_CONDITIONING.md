# Validated winner events and the shared election model

This change lets existing validated race calls inform related races through the
model's existing national, office and state factors. It adds no source, fitted
coefficient, county route or call eligibility. A partial lead is not a winner
event. Nebraska remains Osborn versus Ricketts with no assumed Democratic caucus
credit. Unsupported Independent-to-Democratic flags are excluded.

The implementation remains experimental and uncalibrated. Numerical correctness
does not establish predictive accuracy, interval coverage or real 2026 delivery.

## Conditional election law

The starting law is the existing correlated Gaussian election model plus each
state's original without-replacement redrawn-seat allocation. A winner event
restricts its race's latent margin to the corresponding sign. Given the shared
factors and allocation, its local Gaussian is sampled from that truncated law.

The sampler proposes relevant shared factors near the conditional mode, with
full-support Gaussian variation and an exact density correction. Allocations use
the same indexed finite population, including duplicates; their sequential
proposal is corrected by the original uniform without-replacement probability.
Uncalled local residuals retain their original law and random-number ordering.
Unused called-local margins may be integrated out analytically while retaining
the same winner-event normalizer and consuming the original local random draw.
Every requested county margin and House margin needed by the optional vote-seat
consumer is materialized from its truncated law. Unmaterialized private entries
never become public numeric margins or county-likelihood inputs. Repeated numeric
redraw values share a per-seat score calculation while their indexed slots and
allocation probabilities remain distinct.

The allocation proposal also looks ahead to the remaining D-called, R-called
and uncalled rows in a bag. A positive coefficient calculation and its
leave-one-index derivatives account for the finite supply of indexed values.
It tracks the two smaller category counts and treats the third as the base.
Duplicate numeric values retain their separate slots. The current row uses its
actual winner-event probability; future rows use a moment summary of their
known conditional Gaussian mixture as proposal guidance. Uncalled remaining
slots stay uniform, and the same original n-minus-one allocation uniforms are
consumed. The original uniform-allocation probability corrects this proposal
exactly. The approximation changes where particles are proposed, never the
winner-event likelihood or the model's prior.

The shared Gaussian proposal uses the corresponding resource partition rather
than treating all called redraw rows as independent bags of unlimited values.
Its derivative step follows floating-point precision and existing scales;
there is no fitted model coefficient. Unsupported guide calculations retain
the original Gaussian guide or explicit withholding. All original Gaussian
density, indexed-allocation and exact per-race event corrections remain in the
weight below. Neither guide can soften a verified winner or change the target.

Each complete election receives this log weight:

```
log original_shared_density - log proposed_shared_density
+ log original_allocation_probability - log proposed_allocation_probability
+ sum log P(validated winner event | shared factors, allocation)
+ frozen_count_likelihood_power * one_fixed_count_log_likelihood
```

Verified-call evidence is never weakened to meet a sampling threshold. The final
combined weights must have effective sample size at least half the original
particle count. Only then does one deterministic whole-election resample feed
race odds, chamber seats, Four Endings, margin ranges and optional attribution
or vote-seat consumers. These consumers never resample or weight separately.

## County evidence is included once

The original no-call county coordinator supplies its unchanged reference
population, source exclusions, fixed state shares, contamination normalizers
and count-only tempering power. Calls do not enter that reference baseline.

The new proposal can reach margins outside the old reference population. Its
county continuation is therefore explicitly fixed and bounded:

```
factor(margin) = .05 + .95 * exp(min(0, raw_log_likelihood(margin) - frozen_max))
```

This is a **frozen-reference capped continuation**, not a newly claimed exact
continuous version of the old sampled likelihood. It agrees on the original
reference support and keeps the existing 20x maximum state likelihood ratio.
It retains the globally aligned .125-point curve grid, 10,000-node cap, 61 shared
reporting-error nodes, source-specific shares and all existing input bounds.
The proposal never refits its own normalizer or a second county tempering power.

## Failure and provenance

The raw proposal API returns typed research particles with no headline odds.
The engine retains private original weights, seeds, basis and context. Its
finalizer validates packet ownership and mutation, combines the one optional
county target, assesses support, resamples and replays internally. There is no
public replay API that can relabel arbitrary selected proposal seeds as a
conditioned forecast. Numeric private inputs remain in memory.

An engine-private transport buffer can retain a raw particle's margins through
its owning finalizer, avoiding a second expensive allocation calculation.
Selected original particle indices must match the private seeds; basis, context,
options, weights, buffer integrity and materialization masks remain checked.
Every original random draw is still consumed. Cached and uncached replay retain
the exact called/uncalled margins, including private unused-entry masks and all
county, quantile, vote-seat and attribution consumers. No buffer or cache API
is added to the public packet or headline result.

Transport capacity is reserved before allocation. The 64 MiB bound covers
reachable reserved and retained transport buffers, with eviction falling back
to exact recomputation. It excludes metadata, other workspaces, deferred garbage
collection and total process memory. The owning finalizer releases its buffer
reference on success, low support or error; an intentionally retained raw packet
can later recompute. Unfinalized raw packets, including a kernel failure before
the finalizer is reached, remain subject to the bounded LRU lifetime. Completed
finalizers do not retain matrix history, and immediate physical-memory
zeroization is not claimed. The separate coefficient workspace cache has a 16 MiB bound
and rejects unsupported allocation sizes before allocating them.

If the conditional law is unsupported or final sampling support is insufficient,
the result explicitly withholds call covariance transfer. Existing validated
winners stay fixed, alongside the available polling/count context. No error
floor, softened winner event or unweighted proposal substitutes for that result.
A missing optional helper leaves the original no-call model usable and uses the
same explicit withholding for calls. Retraction restores the exact no-call path.

The helper, engine and county-kernel fingerprints appear in model/history/audit
revision identity. Context and basis changes invalidate prepared numeric plans.
The owner display distinguishes an uncalled race reacting to broader validated
calls from a race with its own admitted county returns; a shared move never earns
a victory label.

Background computation and current-frame admission follow
JOINT_MODEL_WORKER.md. Both worker and compatibility results must pass the same
recursive public-bundle guard before current claims, history or audit change.
Nonfinite values, raw research fields, typed buffers and cyclic output are
rejected; normal acyclic aliases are allowed. An invalid county bundle can use
the unchanged engine fallback, which must also pass the guard. A malformed final
bundle is withheld, including when optional worker assets are missing.
Malformed optional research results are quarantined before assembly; they do
not replace a valid primary result or public comparison. Private transport
buffers and derived cache metadata are forbidden public fields in every path.

## Evidence and limits

Tests use explicitly fictional complete elections, independently computed normal
identities, exact small indexed-allocation laws and preserved original no-call
whole-output hashes. They cover rare/mixed calls, realistic 28/38/52-seat redraw
bags, duplicate values, count overlap, final support failure, packet mutation,
context changes, retraction, all same-election consumers and Independent guards.

Desktop and phone-size isolated browser tests check actual rendering, normal
controls, corrections, withdrawal, unsupported-transfer copy, history lineage,
live/rehearsal isolation and the production 3,000-particle calculation. A phone
viewport on a desktop host does not measure physical phone speed. No synthetic
test supplies the independent historical chronologies or held-out elections
required by NATIONAL_NEEDLE_ACCEPTANCE.md.

The resource guide meets the unchanged support floor in the fixed fictional
200-call tests that defeated the earlier proposal. Separate concentrated-count
and unsupported cases still withhold; no full-night guarantee of conditional
learning is established. A complete synthetic private/public/two-House-research
worker frame is timed against the existing 30-second deadline, including final
replay and county conditioning. Moving work off the controls or meeting this
desktop deadline does not establish physical-phone speed or empirical accuracy.
