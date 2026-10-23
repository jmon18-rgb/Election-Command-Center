# 2022 North Carolina U.S. Senate — same-office historical county baseline

North Carolina's official historical ZIP includes the November 8, 2022 U.S. Senate contest between Cheri Beasley and Ted Budd. The official statewide election dashboard records **1,784,049 DEM** and **1,905,786 REP** votes. These are **2022 Senate results**, making them a more directly comparable *office* than the current 2024 presidential baseline, although 2022 and 2026 candidate, political environment, turnout and voting method distributions still differ.

The initial GitHub Actions job downloads only the NCSBE archive at:
`https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2022_11_08/results_pct_20221108.zip`

It verifies file structure, date, contest uniqueness, group ID, 100 explicitly mapped counties, and agreement with the independently published official statewide Senate totals. This discovery job records the observed archive SHA-256 and original contest identity as a downloadable artifact. **A digest computed from its own download does not constitute an independently approved immutable source pin.** A separate code review must pin that observed SHA and run the replay again before the baseline is accepted into the Election Night comparison.

Until then, `PINNED_SHA256 = None` and `--discover` is mandatory. It never creates model probabilities, current 2026 votes, ballots remaining, or a national needle adjustment.
