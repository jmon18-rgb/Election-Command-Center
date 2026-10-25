# National 2026 Election Night race cartogram (October 25)

The Election Night tab now includes a **50-state tile cartogram** ahead of the more granular North Carolina county map. It is an interactive geographical navigation layer for **the same linked correlated House/Senate model** as JackStradamus and Four Endings.

## What appears

- **Senate:** only states holding a 2026 U.S. Senate contest are colored, from the race's current linked-model Democratic-versus-Republican win chance; other states are gray, **not inferred Republican or Democratic holds**.
- **House:** each state's tile shows the **single most competitive district** by model probability distance from 50%. This does *not* describe which party will win more House seats in the state. Clicking shows that district plus the next three closest.
- **Winning percentages are probabilities**, never vote-share estimates or county/district leads. North Carolina's separately sourced **100-county shape map** remains historical/descriptive until a strictly approved official 2026 county result is available.
- **✓ appears only when the same model race row carries a normalized, source-reported D/R winner call**. Call changes/withdrawals rerun the linked model; the UI uses the resulting rows, does not elevate a newsroom link or social-media report to a call, and labels every accepted call *unofficial*.
- **Mode switch, buttons, scrolling and selection** are keyboard-accessible; small-screen cartogram can scroll horizontally. A state selection opens the corresponding race in the detailed model on request.

## Integrity

The view intentionally receives only `jointLastResult.race_probabilities` from the current `jointBasis.generated_from_sources.model_polling_at === latestSenateEstimates.generated_at` source match. Missing/mismatched snapshots render gray placeholder tiles and no numeric forecast. No separate probabilistic calculation, raw precinct-share inference, social feed, hypothetical House state-winner aggregation, or simulated call is allowed.

This is **visual milestone 2 (national geographic navigation)**, not the probabilistic geographic estimator. Predictive live partial-return geography still needs exact same-seat timestamps, county/precinct/method joins, documented ballots outstanding, historical reporting-order calibration, held-out errors and an uncertainty transfer into the *same correlated* simulation. National-source gaps also remain separately visible.

## Tests

`node scripts/test_national_needle_cartogram.cjs` validates 50 unique cartogram coordinates, exact 2026 Senate and House keys, the at-large model seat bridge, most-competitive House selection, source-call separation, bad probabilities, unknown districts, mobile-safe button DOM, switching/selection, and fail-closed stale-model placeholders.

The dedicated `national-needle-cartogram.yml` workflow runs only this fast isolated suite and validates the dashboard mounts the module, keeping CI short and avoiding the extensive live-source tests in unrelated workflow groups.
