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
