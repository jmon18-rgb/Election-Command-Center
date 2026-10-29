# Same-joint race margin distributions

The separate conditional-call candidate adds explicit
`VALIDATED_CALL_IMPORTANCE_RESAMPLED` and `CALL_AND_COUNTY_IMPORTANCE_RESAMPLED`
provenance tags. Its uncalled ranges follow the same final weighted elections
as national outcomes; called races still have no invented final margin. The
display identifies broader validated-call context separately from own admitted
county returns and warns when covariance transfer is withheld. This does not
calibrate the ranges. See SOURCE_CALL_CONDITIONING.md for the fixed target and
sampling-support contract.

The personal needles can now show a median and middle50%/90% range from the
same complete-election draws that produce their win chances. These are model
scenarios, not a calibrated final-vote interval or an estimate of ballots left.

`marginSummaryCodes` explicitly selects at most64 existing race codes. The
simulator records its existing latent margins, including shared national/state/
chamber shocks, local uncertainty and any redraw mixture. It makes no extra
random draws. After county likelihood conditioning, whole-election replay
multiplicity supplies the empirical distribution; summaries do not reweight it.
Quantiles use the sorted lower index `floor((n-1)*p)`, and SD uses the population
variance of those draws. Repeated particles are disclosed separately from draw
count; neither count is an accuracy sample size or a calibration result.

The selected row's `margin_distribution` adds p05/p25/p50/p75/p95, mean, SD,
sample count, unique replay particles, axis, conditioning and explicit scope.
Baseline and conditioned summaries are distinguished. Existing probabilities,
draw seeds, likelihood budgets, ESS rules and non-summary output remain exact.

These Gaussian/mixture margins are unbounded latent two-party proxies. The UI
does not silently clamp them into physical vote shares: it withholds ranges
whose central scenarios exceed possible margin bounds or whose contract is
invalid. Alaska's unresolved identity/final-RCV display stays pending. Nebraska
uses Osborn-minus-Ricketts, with no Democratic or caucus conversion. A source
winner call suppresses the margin estimate because it does not establish a
winning margin. Withdrawal restores the current experimental distribution.

The strip labels its own symmetric scale and zero point. Its accessible text
states the median, both ranges and the uncalibrated scope. The explanation
retains keyboard focus across redraws, or returns to the same race heading if
a call removes it. Missing optional personal-display code does not block the
national simulation. Public/private/rehearsal contexts remain separate.

Validation includes exact full-output identity with summaries stripped,
deterministic non-Gaussian mixture quantiles, repeated-particle conditioning,
the actual synthetic county conditioner, call/retraction/Independent handling,
invalid-contract rejection and actual desktop/phone tasks. This is engineering
evidence. The independent historical-calibration gate remains unmet.
