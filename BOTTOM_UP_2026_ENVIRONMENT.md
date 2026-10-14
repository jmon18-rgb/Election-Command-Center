# 2026 bottom-up national environment (research only)

Nate Silver's published FLIPR methodology describes a national political environment that uses both the generic congressional ballot and a *bottom-up* comparison of contemporary Senate/House polls to geographically comparable partisan leans.

This original implementation reproduces **the research question**, not Silver's proprietary formula. It uses October 2026 qualified independent polling with the 2024 presidential two-party vote in the 2026 district map (and 2024 statewide presidential vote for Senate races).

Only races with at least 2 independent firms, at least 3 contributing firms, last poll age <= 21 days, and district/state 2024 presidential partisan lean within 20 points of the national presidential average qualify. It limits each state to equal weight, caps individual race implied national swing at ±22 points, gives Senate a full research weight and House 70%, and trims extreme state estimates. The numerical cutoffs are provisional sensitivity assumptions, **not calibrated coefficients**.

The source snapshot produced **15 qualifying races in 14 states**. Their adjusted presidential-to-congressional swing implied a **D+6.62** national margin against the **D+7.88** current generic ballot: a **−1.26-point difference**. This is a legitimate data-comparison result, **not a validated national forecast**, especially given non-random battleground polling coverage and candidate-specific performances. It would be erroneous to automatically pull every 2026 race toward D+6.6.

To reproduce:

```sh
node scripts/audit_bottom_up_national_environment.cjs --check --json
node scripts/test_bottom_up_national_environment.cjs
```

Data in `data/bottom_up_2026_environment_shadow.json` is recomputed from `data/polling_estimates.json` and `data/presidential_2024_by_2026_district_staging.json`. No pre-2022 congressional results are used. The module does not edit forecast outputs, standings, or polling estimates. All inputs are validated; duplicate geography, stale or insufficient poll evidence fail closed.

**Next requirements:** adjust individual race candidate quality and state-specific incumbency effects before treating a bottom-up national gap as a macro signal; stress-test weighting/selection; estimate error correlation and volatility with recent election data; only then promote a conservatively regularized national-environment blend. This follows the user's focus on contemporary political realignment and avoids mechanically fitting 2012-era assumptions to 2026.

Reference: https://www.natesilver.net/p/flipr-midterms-model-methodology
