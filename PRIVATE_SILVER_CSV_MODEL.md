# Private Silver Bulletin CSV context in JackStradamus

**Status: experimental, user-local research variant.** The original JackStradamus joint forecast remains the public default. Subscriber-provided files and their per-race source estimates MUST NOT be checked into the public GitHub repository or published as site data.

## How to use the actual CSVs

1. Open **JackStradamus → My private Silver CSV fundamentals** on the deployed dashboard.
2. Select the supplied `ZqBdM.csv` Senate Fundamentals and `AeKqD.csv` Senate Expert ratings together. Optionally select `f3ome.csv` House Fundamentals as well. The export filenames can change: files are recognized by their **header layout and race keys**, not by names.
3. Keep **Use imported Senate context** checked. The probabilities in the currently open browser tab change to a conspicuously labeled **PRIVATE CSV-AUGMENTED** estimate. The panel reports Democratic Senate control and Democrats winning both chambers **with and without** the private inputs using the same correlated simulation seed. The selected race's odds also display both alternatives.
4. The House export is optional and disabled by default: check **Also use imported House fundamentals** to enable its separate experimental 2026 House-district context. Click **Clear private CSV context** to return to the public model. Reloading the page clears the imported data automatically.

File parsing and model calculation happen in-browser using a user-selected File object. This feature does not request uploaded files from GitHub, make CSV upload POST requests, use localStorage or send subscriber rows to a server. A public deployment necessarily serves the client JS module, but **does not contain or distribute the paid CSV values**.

## Exact meaning of the source columns

**Senate `ZqBdM`:** `Polls` is excluded; `Simple`, `Fancy` and **`Blended`** belong to the `~~~Fundamentals~~~` section. Unlike the finished race forecast, **Blended is a fundamentals-only model estimate**. It is the candidate-context anchor in the local experimental forecast (and is NOT a Silver win probability). The other two fundamental estimates are retained in browser memory for comparison.

**Senate `AeKqD`:** `Unadjusted` and `Adjusted` belong to the **expert ratings** section; the local model includes a small contribution from `Unadjusted` and retains `Adjusted` as a comparator. `FLIPR Classic`, `FLIPR Deluxe` and all candidate win probabilities are excluded from fitted inputs.

**House `f3ome`:** selected 2026 congressional districts with analogous fundamentals-only columns. Districts are normalized to the stable two-digit state–district keys. Only districts actually present in the uploaded CSV can receive private House context.

Other user-provided CSVs including seat-control conditional distributions, history, forecasted House candidate odds, margin distributions, tipping-point/VPI/elasticity, and finished probability outputs are **not imported into the candidate-fundamentals simulator**. These may be legitimate validation diagnostics separately, but must never become targets used to manufacture a better fit to Silver's forecast probabilities.

## Explicit formula (not claimed to replicate Silver)

For a regular Senate contest with named polling, the public model sets its own poll weight `w_public` (usually 0.90 for three or more independent pollsters or 0.83 for two), with a candidate-neutral geographic prior. In the opt-in local context model only:

- Imported fundamentals anchor `F = 0.8 × Blended fundamentals margin + 0.2 × Unadjusted expert margin` when both are present. When just one source is present, use that available estimate.
- Imported model poll weight `w_private = 0.75` when `w_public >= 0.90`, or `0.68` when `w_public >= 0.83`, otherwise `0.60`.
- Alternative margin `margin_private = w_private × current JackStradamus poll margin + (1 - w_private) × F`.
- For races without qualifying polling, the alternative margin uses `F` directly, when present.
- **Uncertainty, national/state/chamber error components, Monte Carlo seed, Senate seat arithmetic, third-party caveats and independent-caucus conventions remain unchanged.** House fundamentals can be opted into separately with a 75% maximum House poll weight.

These coefficients are provisional scenario assumptions, **not a reverse-engineering of Silver's proprietary formula and not out-of-sample fitted**. Expert ratings could overlap polling evidence, and the source may use third-party or differently timed inputs. The original public model is always separately recoverable with the toggle. Candidate-specific deltas must not be treated as evidence of objectively improved accuracy.

## Testing and source isolation

Run `node scripts/test_private_senate_fundamentals.cjs`. All fixtures are invented. The tests assert CSV schema guards; distinction between `Blended` fundamentals and actual end-to-end forecasts; no influence from `Polls`, `FLIPR Classic`, `FLIPR Deluxe`; unaffected public House/governor priors when Senator-only data is imported; unchanged shared covariance and forecast counts; and safe reset to baseline.

**Source license / ownership:** This research option is designed for a user's own subscriber exports. The public source repo contains the parser but intentionally does not contain the original Silver CSV values, a public cache of transformed rows, or a CSV re-export endpoint. If the source data are updated later, a new local import is needed.
