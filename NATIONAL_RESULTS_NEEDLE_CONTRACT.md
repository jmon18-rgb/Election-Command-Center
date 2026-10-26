# Experimental national results-to-outlook contract

The primary product is one national Four Endings outlook. Iowa, Kansas and
Texas Senate race panels are supporting diagnostics. Their polling-informed
posterior probabilities never become inputs to the national likelihood.

## What changes the outlook

The bridge accepts only the strict full county source parsers' current validated
counts, an independent complete county/FIPS reference and the pinned official
historical baseline. Each race contributes one current snapshot. Repeated polls
replace evidence; they do not accumulate evidence. Zero withdrawals, test flags,
outages, archive mode and stale sources remove the relevant observation.
Publication ordering uses the existing durable source-revision guard.

For each original correlated national election draw, the bridge evaluates the
county counts conditional on that draw's latent final margin for that Senate
race. It uses historical county voting shares and turnout, conditional on at
least the votes already counted. Iowa integrates three assumed voting-method
orders; Kansas and Texas lack that split. A 25% turnout scale, 6-point county
margin scale, 8-point shared batch-selection scale and incomplete-count selection
variance express uncertainty. These are declared assumptions, not fitted or
independently calibrated parameters. Early county bias can remain unidentified.

The likelihood contains no polling prior. Candidate-specific and state residuals
remain in each existing complete national draw, alongside the declared shared
national errors. A candidate-specific Senate surprise is therefore not copied
uniformly into House races. House changes occur only through the existing model's
shared-error covariance; this path has **zero observed House vote sources**.
Three Senate states are limited national coverage and cannot establish a measured
nationwide House swing.

Each race's relative likelihood is mixed with a 5% contamination floor, bounding
its ratio at 20:1. Combined evidence is tempered when necessary to preserve at
least half the original particles' effective sample size. Deterministic systematic
resampling selects whole original correlated election draws. Exact RNG-state
replay uses the existing summarizer for every race, chamber, interval and ending.
Repeated particles are not independent new elections or extra precision.

The polling-only path's random draws and numeric outputs are unchanged. The four
owner thresholds are unchanged and remain mutually exclusive and exhaustive:
Tsunami >=235 House and >=52 D-aligned Senate; Wave >=218 House and >=51 Senate
but below Tsunami; Shrug one chamber; Red Dawn neither. A likelihood never creates
a race call. Existing verified calls stay locked until their source retracts them.

## Attribution and demonstration

The national view shows the pre-count baseline marker, current source coverage,
counted D/R votes and changes in the coherent probabilities. Race-probability
changes are diagnostics, not an additive causal decomposition of chamber control.
Race prior readers keep the unconditioned polling model, preventing feedback.

The separate five-stage national rehearsal uses fictional counts over official
historical county geography. It runs the same bridge with an explicit rehearsal
marker, a fixed simulated clock and no live calls. Production rejects rehearsal
marked envelopes. The preview never changes live state, stored revisions,
alerts, national counters or the main model. These are functional stress fixtures,
not historical publication-clock replay or probability calibration.

## Evidence limits

Actual Civic endpoints 87151/87162/87438 currently publish TEST DATA. HTTP success
and synthetic tests do not prove actual post-close delivery. Independent
chronological competitive-race calibration remains unavailable. Texas's 2024
reference is a different Senate matchup/class and a presidential turnout cycle;
Iowa and Kansas reference years also need turnout and candidate-context caution.
The UI must retain experimental labeling while these gaps remain.
