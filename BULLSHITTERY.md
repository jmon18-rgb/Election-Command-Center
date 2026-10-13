# Bullshittery Index: what the numbers mean

Updated October 13, 2026. This is a deliberately conservative, provisional **monitoring-priority index**, not a probability of election fraud, a forecast of election results, or a calibrated estimate of votes that will go uncounted. Its purpose is to distinguish documented operational issues from ordinary litigation while stronger evidence is collected.

## Version 1: deterministic 0–100 signal

- Documented voter-list disclosure litigation without evidence of voter-access effects: **4**.
- Documented changes to voting-access schedules: **18**, plus **2** when at least 10 counties are identified.
- Documented registration-system transmission or processing failures: **25**; deduct **4** when the transfer defect is officially reported fixed but downstream processing is not yet verified.
- Completely resolved cases are **0**; cases lacking the required outcome and source review should not be labeled resolved.
- Unverified reports cannot increase the index.
- One state's score is the **maximum score** among distinct documented unresolved cases, not the sum of news articles or overlapping issues.
- No tracked case means **Not assessed**, not zero.

Under today's source records, that puts **Texas at 21**, **North Carolina at 20**, and the voter-list disclosure litigation entries at **4**. The choices of starter weights are a review-priority heuristic, **not calibrated probabilities**, and could change through an explicitly versioned methodology review. Use 0–100 labels without presenting them as precise statistical estimates. The code that displays these scores is in `index.html`.

## Version 2: scenario-specific voter risk (in progress)

Each incident must define a specific adverse outcome and keep three different quantities distinct:

1. **Documented footprint**: e.g., delayed registration records, affected counties, removed voting hours, or documented incident reports. These units cannot be mixed.
2. **Worst-case distinct eligible voters materially affected**: a defensible plausible upper-bound estimate, with a reproducible population and evidence. This is **not** all records or residents in an affected county.
3. **Probability of the explicitly defined worst-case outcome**, including an uncertainty range and documented basis. P(at least one eligible voter affected) is not the same as P(10,000 affected) or a per-voter risk.

For an expected number of affected voters, do **not** simply multiply the maximum exposure by P(the worst case): that generally underestimates or misstates the intermediate possibilities. Estimate the full distribution of outcomes or a justified per-voter probability conditional on exposure.

### Texas
The documented transfer backlog includes at least 500,000 registration/update **records**, not verified unique voters or lost ballots. Officials reported that the transfer problem was corrected; county processing and subsequent voter consequences require continuing review. We would need de-duplicated new vs update transactions, jurisdiction-by-jurisdiction processing completion, outstanding valid registrations and missed ballots before quoting a worst-case unique-voter estimate. Probability of the defined adverse outcome is currently **not estimated**.

### North Carolina
Sunday early-voting options were removed in ten named counties relative to the 2022 general election. A worst-case estimate should consider 2022 Sunday turnout, 2026 site and total-hour changes, turnout timing, and documented inability to vote via other methods. Neither 10 counties' populations nor 2022 Sunday turnout alone equals voters disenfranchised. Probability is currently **not estimated**.

### Legal-dispute entries
A filed lawsuit is real, but without an implemented election-administration change or demonstrated access consequence, no affected-voter estimate or outcome probability is established by the case's existence.

## Sources and confidence

Every numerical impact must preserve its precise unit, source link, date, and remediation status. Unknown exposure and probability are `null` in `data/integrity_impact.json`. `scripts/validate_integrity_impact.py` rejects unsupported numeric entries.

Current Texas source includes the Secretary of State's September 22 directive: https://content.govdelivery.com/accounts/TXSOS/bulletins/42c0759 . North Carolina Sunday-hour decision reported at https://ncnewsline.com/2026/08/21/republicans-on-the-nc-elections-board-agree-to-drop-sunday-early-voting-hours-in-10-more-counties/ . The evidence ledger includes the full source list and official review dates.

**Next priorities:** determine county-level outstanding Texas registration processing; quantify 2022 and 2026 Sunday-access changes in the named North Carolina counties; then produce and backtest bounded scenario estimates rather than assigning arbitrary odds.
