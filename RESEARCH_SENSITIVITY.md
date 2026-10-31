# Research sensitivities and active input explanations

This research UI compares explicit assumptions using the existing correlated model. It does not estimate demographic behavior, fit turnout, collect source data, change live forecasts or validate predictive accuracy.

## Active input explanations

A small pure projection describes the actual House or Senate basis row captured with an accepted race-odds snapshot. Explanations are kept in a RAM-only WeakMap keyed by that snapshot. They are not added to forecast records, worker messages, history, audit, exports or browser storage. Later changes to the active basis cannot silently rewrite an older snapshot's explanation. Missing helper, source mismatch or missing components withholds the explanation while preserving the forecast.

When an imported anchor is active, show the actual imported anchor and active polling weight, distinguishing repository CSV context from a local override. Public geographic context is a comparison, not a mislabeled active imported anchor. Public House basis does not expose an exact anchor; it stays unavailable rather than being recovered from a clipped posterior or guessed. The displayed modeled prior is distinct from the same-draw projected margin.

The source coefficients and forecast mean remain unchanged. Where all components are present, the projection checks the existing weighted blend and documented input clipping. Imported anchor metadata is rounded to .001 points, so .003 points is a display-reconciliation tolerance, not a fitted model assumption. A mismatch is labeled, never repaired by changing inputs or odds. These are our experimental weights, not Silver's proprietary formula or final forecast.

## Hypothetical modes

Legacy preference-only mode retains two disjoint assumed voter shares and D-minus-R preference changes. Its default arithmetic and all existing tests remain. Scope can be one state, the existing clusters, or the complete actual 50-state House roster. National scope applies one uniform assumed shift to eligible D/R priors; it does not imply measured state-specific group shares.

Participation-composition mode requires three explicit groups: non-Hispanic White voters without a four-year degree, Hispanic voters, and everyone else. Shares are hypothetical, nonoverlapping and exhaustive. Each group needs an assumed baseline D-minus-R preference, a nonnegative participation multiplier relative to its own baseline voters, and a preference change. A multiplier is not an eligible-population turnout rate.

For baseline shares s_i, baseline preferences m_i, participation multipliers t_i and preference changes d_i:

- Baseline assumed margin M = sum(s_i * m_i).
- New shares are s_i * t_i / sum(s_j * t_j); the denominator must be positive.
- Scenario assumed margin M' = sum(new_share_i * (m_i + d_i)).
- The conditional margin shift is M' minus M.

Modest/base/large scales are explicitly half/one/one-and-a-half of the user's changes. Participation scales around the unchanged multiplier one. Invalid negative participation, nonfinite inputs, impossible preference margins, nonexhaustive shares or an overall shift outside the existing ±12-point sensitivity bound reject. No probability clipping or missing data default is introduced.

Independent/non-Republican Senate axes identified by the actual basis flag are held unchanged and listed. A Democratic cohort assumption does not become support for Osborn or another independent, and caucus accounting remains unchanged.

Both elections use the existing full simulator with identical samples, seed and shared-error options. Only eligible selected-state prior means change. The research page retains 2,000 matched draws; production 3,000-draw/ESS/30-second contracts, sources, county likelihoods and source-call admission are untouched. Results compare House/Senate/both control, expected House and Senate seats, affected-race odds and prior margins, plus assumed composition where supplied. Reset clears only research controls/results.

## Tests and remaining evidence

The original electorate test file is copied byte-for-byte and is not reexecuted during this ignored candidate preparation. The new pure controls use a fictional complete-roster fixture and a deterministic simulator seam, not actual model draws or an empirical dataset. A focused VM control extracts the candidate's exact snapshot producer and verifies captured House/Senate explanations, missing-helper behavior, source matching, no diagnostic fields in result records and marker inversion.

On repository promotion, the tests use actual repository modules and the actual index. Exact marker operations apply only the research changes; root retains unrelated audio work and recomputes canonical script stamps/owned ID registration.

Measured demographic joins, credible district/state turnout denominators, historical frozen predictors, independent whole-election heldouts, empirical comparative skill and national transfer remain separate evidence gates. No human/device/listening or calibration acceptance follows from research mechanics.

The promoted original electorate test,113core checks, complete actual DOM suite and targeted Chrome1366/390 research controls pass locally. First fixture failures and their narrow independently reviewed module-load/native-compositor observer corrections remain saved; every original case, assertion, sample count and deadline is retained. Exact-head CI and verified publication are still required.
