# House 2026-map geography gap-fill shadow

**October 14, 2026: research only; no headline forecast change.**

The October 2026 House audit exposed a severe failure of the 2024-raw, exchangeable-state model: an unpolled 2026 district can receive the same state-average baseline as every other redrawn district, even if one is safely Democratic and another safely Republican. If the MIT historical party parser fails to recognize the winning party, an otherwise unchanged district is assigned a fictional ±38-point 'uncontested' placeholder. Neither assumption represents a defensible district forecast.

Run `node scripts/audit_house_geography_gapfill.cjs` to test a specific alternative without changing the website. `--json` exports reproducible model sensitivity results.

## Exact permitted replacement

- **238 House districts** with unchanged 2024–26 boundaries and separately recorded valid votes for both major parties: retain the existing 2024 House election margin, poll weighting, sigma, disagreement calculations and *House-to-generic-ballot* swing **exactly**. This preserves recent candidate-specific and downballot information.
- **24 otherwise unchanged districts** with one or more major-party records missing: use 2024 two-party presidential vote margin on the exact 2026 geometry, with the *presidential-to-generic-ballot* provisional swing. The model does not incorrectly treat a missing vote as zero electorate support.
- **173 redrawn 2026 districts**: use the 2024 presidential vote margin mapped to the new 2026 district, with broad variance and existing qualified-poll blending. Never assign a 2024 district's votes to a redrawn district by number or uniformly distribute the old state seat-margin histogram across every district.

Those figures come from the current staged source; they **will change after fixing the upstream historical party parser**. The mode is deliberately source-driven and hard-fails if the independent presidential 2026-map source is missing, incomplete, duplicated, or outside validated geographic checks.

The two distinct national reference years and their swing coefficients are **not historically calibrated to 2026**, and the geographic signal is candidate-neutral. This is an explicit research alternative, not a claim that a presidential margin equals a future House race margin.

## Why not blindly follow another forecast?

The private side-by-side comparison with Silver Bulletin identifies a big improvement in *cross-forecast agreement* when we use the mapped presidential reference, but that is **not the same as accuracy**. This PR doesn't contain paid Silver source rows or probabilities. The stronger reasons for the change are logical geographic validity, correcting missing-party candidate data, and retaining authentic recorded district election results where they exist.

Before promoting the gap-fill to production, upstream MIT historical data must correctly classify DFL, Democratic-NPL and fusion ballot lines; dependent geography, two-cycle candidate identity and incumbency staging must then be regenerated coherently. A cross-cycle held-out check is still necessary for the national swing and local uncertainty. The final winner probabilities will continue to be calculated from the same correlated House/Senate election draws.

Use `prepare(s,{fundamentalsMode:'presidential_2024_gap_fill'})` for the explicit alternate House basis; the default `prepare(s)` remains untouched. The helper audit verifies that all 238 comparable districts are bit-for-bit identical to the current basis on key race fields, and all 197 missing/remapped districts match the existing verified presidential-geography research baseline.
