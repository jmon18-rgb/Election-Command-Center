# SHA-pinned 2022 NC Senate county baseline

The reviewed, original North Carolina State Board of Elections November 8, 2022 precinct ZIP is pinned at:

- Original official ZIP: `https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2022_11_08/results_pct_20221108.zip`
- SHA-256: `2024bf67243ef173f54e625c3bace4c8b6f80947fa7d67df26796c2c85d3e9f1`
- Exact official contest: `US SENATE`, group `1378`
- Census county crosswalk SHA-256: `de3e129ef1eb3a1c950260eab3b712bf76823a000347099a327539cfd6ff0fd0`
- Independently published official totals: Democratic 1,784,049; Republican 1,905,786

These values were first observed in the original-source discovery replay and are now separately pinned in code. The [pinned-source workflow](.github/workflows/nc-2022-senate-pinned-baseline.yml) **downloads the real ZIP again**, verifies its exact digest, candidate/contest group, 100 census-mapped counties and certified statewide totals, and then compares every published `data/nc_2022_senate_county_verified.csv` row to the official ZIP (not merely matching the sum). All changes in the original source require code review, not automatic acceptance.

This is a *same-office historical Senate baseline*, meaning a stronger starting point for comparing 2026 NC Senate returns than just the 2024 presidential election. It is **not enough to estimate ballots remaining or bias-correct early vote reporting**. Different nominees, overall national environment, voting methods, turnout and reporting order can still distort observed swings. The output does not affect JackStradamus probabilities, race calls, or a geographic needle.

Before any predictive calibration, the next steps are historical county/method-aware replay testing, 2026 ballot denomination verification and backtested uncertainty. County comparisons remain labeled descriptive.
