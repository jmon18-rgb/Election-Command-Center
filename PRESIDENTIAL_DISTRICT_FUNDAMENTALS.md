# Silver-inspired geography-safe presidential district fundamentals (2026 House)

## Goal

Create a meaningful **House partisan lean shadow** rather than copying Nate Silver/FLIPR percentages. FLIPR describes a model in which polling, candidate fundamentals and national conditions contribute together. Our previous House baseline used recorded 2024 House election results and an exchangeable statewide district-margin distribution for states with 2026 redrawn districts. That cannot adequately capture new district-specific partisan geography.

**New shadow (NOT HEADLINE):** 2024 Harris and Trump election totals mapped to each of the **435 congressional districts used for 2026**, combined with observed 2024 House votes where the map is genuinely comparable.

## Provenance and geographic safeguards

- Staged source: [ElectIndex historical.csv](https://github.com/ElectIndex/26_us_forecast_data/blob/main/historical.csv) (a separate public forecasting project's historical election input); the staged file contains **only 2024 D/R presidential vote counts**, normalized to our race codes, with its source blob SHA. This is **not** Silver proprietary data and **not** a provider win probability.
- Independent reasonableness checks: [The Downballot 2026 district calculations](https://www.the-downballot.com/p/the-downballot-releases-presidential), including [their district tables](https://www.the-downballot.com/p/the-downballots-calculations-of-presidential). Historical election totals are not forecasts. A sample of districts (VA-01, AZ-01, CA-01 and TX-28) is checked within two margin points of published rounded figures.
- Boundary authority: [Census 120th Congressional Districts](https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.html), listing **nine changed states** as of October 14, 2026. **Missouri must use its unchanged 2024 boundaries**, despite superseded 2026-map planning files. A full independent precinct-to-boundary reconciliation remains to be done.
- Covers exactly 435 different House codes in the seat universe. Invalid fields, duplicate/missing seats, inconsistent vote-derived margins or an inappropriate map year cause the shadow to fail closed. *No such optional-source failure may disable the primary probability model.*
- The national 2024 reference is derived by adding up the staged district D/R votes into a **two-party** margin, rather than silently applying a national all-candidate margin with a different denominator.

## Experimental model specification (provisional, NOT Silver coefficients)

For an **unchanged 2024→2026 district with D and R recorded in 2024**, the district fundamentals proxy is

```
base = 0.65 × district_2024_presidential_two_party_margin
     + 0.35 × district_2024_house_two_party_margin
```

For **uncontested unchanged districts and redrawn districts**, use the 2024 presidential margin measured under the actual 2026 geography. The 2024 House district-number match is never used for a 2026-redrawn district. Polls still contribute via the existing uncertainty and poll-blend process; redrawn districts remain assigned broad error assumptions and statewide shared error.

The modeled House national shift remains provisional:

```
house_shift = 0.68 × (current_2026_generic_ballot_D_minus_R
                     − reconstructed_2024_national_presidential_two_party_D_minus_R)
```

**Important warning:** A generic congressional poll and the presidential vote describe different elections and electorates. The coefficient 0.68 and 65/35 district blend have **not** been trained on historical election results. These are sensitivity assumptions only. No candidate quality, fundraising, ballot mechanics, or posterior historical out-of-sample calibration is implied.

Senate and gubernatorial race means, starting assumptions and poll error priors are **identical** in the main and presidential House shadow. The new structure permits us to test the role of correct geography without claiming this is a finished fundamentals model.

## Run

```sh
node scripts/test_chamber_control_model.cjs
node scripts/audit_presidential_lean_shadow.cjs
node scripts/audit_presidential_lean_shadow.cjs --json
node scripts/test_dashboard_runtime.cjs
```

A collapsible research section on both the home and election-night panels compares the live 2024 House baseline, the existing paired-2022/2024 House shadow, and this new presidential district partisan-lean shadow. The shadow simulations run only while the research drawer is expanded; they do not replace the original probabilities.

## Next steps to qualify promotion

1. Independently reconcile all 435 district presidential returns with The Downballot/official precinct and Census 2026 boundaries, especially redrawn TX/FL/NC/CA districts and Missouri.
2. Build a retrospective House election result training set with **presidential district leans in historical district geometries known before those elections**, along with incumbency, open seat and campaign finance data.
3. Fit poll/fundamentals weight, partisan vote-to-House swing, variance and geographic correlations using historical-year holdouts; compare against the original and paired-House shadow on actual House results.
4. Revisit Senate and governor national/state partisan fundamentals, specialist election types and the four-ending probabilities separately.
5. Promote only if held-out Brier/log scores, margin MAE and seat-count tail coverage improve; retain the 90%-Silver, 10%-Jack experimental shadow as a separate comparison.

Reference: [Silver Bulletin FLIPR methodology (August 2026)](https://www.natesilver.net/p/flipr-midterms-model-methodology). Our implementation is original.
