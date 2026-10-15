# Silver Bulletin fundamental CSV context in JackStradamus

**October 15 owner update:** The repository now publicly contains `ZqBdM (1).csv` (28 Senate fundamentals rows) and `f3ome (1).csv` (98 House-district fundamentals rows). The dashboard automatically fetches and activates BOTH when they pass schema/coverage checks, on every device. An owner-published CSV is no longer private; the older below instructions describe manual and locally stored supplemental inputs, which still work as overrides. The source does NOT include Expert ratings, final Silver probabilities or all 435 House fundamentals. The site's headline becomes its own *experimentally CSV-augmented* correlated model, while the original model is separately computed for comparison. The original paid Silver data is publicly accessible in GitHub—the repository owner should only leave it there if they have the appropriate rights to publish it.


**Status: personal candidate-fundamentals input to the user's active forecast, with an explicit unvalidated-parameter warning.** The public version has no rights to automatically fetch these private subscriber estimates. Once imported, they become part of that browser's active JackStradamus probabilities (using our own polling blends, race error budgets, and joint simulation), while the source-independent forecast remains available for comparison. Subscriber-provided files and per-race paid source estimates MUST NOT be checked into the public GitHub repository or published as site data.

## How to use the actual CSVs

1. Open **JackStradamus → My private Silver CSV fundamentals** on the deployed dashboard.
2. Select the supplied `ZqBdM.csv` Senate Fundamentals and `AeKqD.csv` Senate Expert ratings together. Optionally select `f3ome.csv` House Fundamentals as well. The export filenames can change: files are recognized by their **header layout and race keys**, not by names.
3. Keep **Use imported fundamentals directly in my JackStradamus forecast** checked. The probabilities on that device switch to the user's own **PRIVATE CSV-AUGMENTED** estimate. The panel reports Democratic Senate control and Democrats winning both chambers **with and without** the private inputs using the same correlated simulation seed. The selected race's odds also display both alternatives.
4. The House export is optional and disabled by default: check **Also use imported House fundamentals** to enable its separate experimental 2026 House-district context. The **Remember these inputs privately on this device** checkbox is on by default; when enabled, the parsed values and their original import date are stored in this browser's same-origin storage and automatically reloaded with every new poll refresh/visit. A seven-day-old import triggers a visible warning; at 35 days, the saved fundamentals remain present but **are not automatically applied** until refreshed. Clear removes both the in-memory and saved inputs. Unchecking Remember deletes the saved copy without disrupting the current browser tab.

File parsing and model calculation happen in-browser using a user-selected File object. This feature does not request uploaded files from GitHub, make CSV upload POST requests or send subscriber rows to a server. By default it **does use localStorage on the same browser and domain**, which can be read by scripts running on that site; do not treat it as encrypted secret storage. The user may uncheck Remember for session-only operation. A public deployment necessarily serves the client JS module, but **does not contain or distribute the paid CSV values**.

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

These coefficients are provisional scenario assumptions, **not a reverse-engineering of Silver's proprietary formula and not out-of-sample fitted**. Expert ratings could overlap polling evidence, and the source may use third-party or differently timed inputs. The original public model is always separately recoverable with the toggle. The user's locally augmented model is the default for that device while the private inputs are fresh and enabled. Candidate-specific deltas must not be treated as evidence of objectively improved accuracy.

## Testing and source isolation

Run `node scripts/test_private_senate_fundamentals.cjs`. All fixtures are invented. The tests assert CSV schema guards; distinction between `Blended` fundamentals and actual end-to-end forecasts; no influence from `Polls`, `FLIPR Classic`, `FLIPR Deluxe`; unaffected public House/governor priors when Senator-only data is imported; unchanged shared covariance and forecast counts; correct same-device save/restore, warning/expiry, privacy opt-out, and safe reset to baseline.

**Source license / ownership:** This research option is designed for a user's own subscriber exports. The public source repo contains the parser but intentionally does not contain the original Silver CSV values, a public cache of transformed rows, or a CSV re-export endpoint. If the source data are updated later, a new local import is needed.
