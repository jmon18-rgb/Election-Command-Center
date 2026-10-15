# The Four Endings — actual chamber control and seat-based tsunami

Updated October 15, 2026. **Experimental correlated Monte Carlo, not historically calibrated probabilities.**

## Four exclusive outcomes (JackStradamus)

| Ending | Necessary result | Draw classification |
|---|---|---|
| **Blue Tsunami** | **235+ Democratic House and 52+ Democratic-aligned Senate seats** | Strong two-chamber Democratic performance |
| **Blue Wave** | **218+ House and 51+ Senate**, but not Tsunami | Democrats control both chambers, below the Tsunami threshold |
| **Shrug** | Democrats control exactly one of House or Senate | Split chamber control |
| **Red Dawn** | Democrats control neither | Republicans retain both chambers |

The **51-seat Senate minimum matters**. With the Republican vice president, a 50–50 Senate does not count as Democratic control. These four outcomes are mutually exclusive and collectively exhaustive. **Blue Wave + Blue Tsunami equals actual modeled Democratic control of both chambers** and must equal `actual_dem_both_control_pct`, never a separate relaxed market bet. Governors affect neither chamber.

## What the election prediction markets actually say

[Polymarket's Blue Wave prop](https://polymarket.com/event/blue-wave-in-2026) is **House >=218, Senate >=49**, even though 49 Senate seats are not control. [Its Blue Tsunami prop](https://polymarket.com/event/blue-tsunami-in-2026) is **House >=235, Senate >=51**. These are *different contractual bets*, not authoritative definitions of the political terms. Its [2026 Balance of Power market](https://polymarket.com/event/balance-of-power-2026-midterms) uses actual control of each chamber with vice-presidential tie-breaking for a 50–50 Senate. This personal dashboard deliberately adopts that **control** definition for Wave, and sets a **stronger 235/52** Tsunami to represent an even better-than-bare-majority result.

We do **not** feed prediction-market prices or finished Silver outcomes into the forecast. The classifications use only seat totals from the exact same seeded joint simulation as race probabilities, House/Senate control, 90% seat intervals and eligible November 3 source-informed updates.

## Model invariants and caveats

- `scripts/chamber_control_model.js` defines and exports `ENDING_THRESHOLDS` and `classifyFourEndings(houseSeats, senateSeats)`.
- **435 House seats** and **35 Senate contests plus 65 pre-election holdovers** are drawn coherently with national, chamber, state and race-specific uncertainty. The caucus treatment of nonmajor-party/independent Senate candidates remains a substantial explicitly documented assumption.
- The fixed 20-race battleground slate is descriptive and **does not determine the Blue Tsunami result**.
- Every draw belongs to one outcome. `Wave + Tsunami = P(D House control AND D Senate control)`, `Shrug = P(exactly one chamber)`, `Red Dawn = P(neither)`. These reconcile exactly before percentage rounding.
- The old property `blue_both_including_tsunami` is kept for compatible UI integrations, but after this correction its meaning is **the same as actual Democratic both-chamber control**, not the looser 218/49 event. The separate `senate_wave_gate_pct` is the 51-seat actual-control probability.
- Verified source winner calls can lock individual simulation outcomes; unverified leads and raw early vote leaders **never become calls**. County, precinct and voting-method vote-weight baselines are not independently validated, so early geographic evidence remains noisy.
- `scripts/test_chamber_control_model.cjs` asserts 218/49 **Shrug**, 218/50 **Shrug**, 218/51 **Wave**, 235/51 **Wave** and 235/52 **Tsunami**, together with exact chamber marginal identities.

The model still needs genuinely timestamped election-day historical backtests, stronger House geography, holdover and independent-caucus audits, and credible source coverage across all 50 states before these numbers can be treated as empirically calibrated win probabilities. See [POLLING_MODEL.md](POLLING_MODEL.md), [SEAT_MODEL.md](SEAT_MODEL.md) and [ELECTION_NIGHT_SOURCES.md](ELECTION_NIGHT_SOURCES.md).
