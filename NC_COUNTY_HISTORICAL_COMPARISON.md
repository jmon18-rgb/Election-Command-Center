# NC county historical comparison — source verified, nonpredictive

A county-level 2024 baseline is a prerequisite for the geographic Election Night needle, but it is **not** a calibrated 2026 Senate forecast. This pipeline produces a consistent, independently source-attributed 100-county 2024 presidential comparison based on the official NCSBE November 5 precinct ZIP and the pinned NC county-FIPS crosswalk.

The real replay verifies the known official ZIP SHA-256, exact general presidential contest identity, all 100 county keys, and certified statewide major-party votes (Democrats 2,715,375; Republicans 2,898,423). `scripts/build_nc_2024_presidential_county_baseline.py` then exports county D/R totals and two-party presidential margins with the original archive provenance attached.

Run `python3 scripts/test_build_nc_2024_presidential_county_baseline.py` for offline tampering tests or trigger the [historical county baseline workflow](.github/workflows/nc-2024-county-presidential-baseline.yml) to replay the actual official ZIP end to end. The verified JSON is available as a workflow artifact.

**Comparability limits:** the baseline is 2024 **presidential** voting, not 2026 Senate voting. A descriptive shift of a county against the presidential baseline combines candidate differences, turnout, ballot composition and political environment; it cannot be applied directly as a national error adjustment or a 2026 Senate win probability. This artifact does not estimate ballots remaining, precinct reporting, a winner, or chamber control. The production geographic needle still requires verified real 2026 county updates, expected county-vote denominators, normalization for candidate/office difference, and historical calibration.
