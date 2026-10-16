# Senate holdovers: verified 2026 starting ledger

As of **October 16, 2026**, the dashboard's Senate simulation starts from **65 noncontested seats**, without treating those seats as 2026 race calls.

| Source | Noncontested seats | Democratic | Independent, caucuses D | Republican |
|---|---:|---:|---:|---:|
| [Official Senate Class I](https://www.senate.gov/senators/Class_I.htm) (terms to 2031) | 33 | 17 | 2 | 14 |
| [Official Senate Class III](https://www.senate.gov/senators/Class_III.htm) (terms to 2029) | 32 | 15 | 0 | 17 |
| **Total 2026 holdovers** | **65** | **32** | **2** | **31** |

Class III has **34 current seats**; **Florida (Ashley Moody) and Ohio (Jon Husted)** are excluded from the holdovers because their seats are **2026 special election contests**. The other **33 regular elections** are Class II. Thus 65 noncontested + 33 Class II + 2 Class III special = 100 total Senate seats.

The two independents are **Angus King (ME)** and **Bernie Sanders (VT)**, who caucus with the Democrats. The [Senate Daily Press party lineup](https://www.dailypress.senate.gov/on-the-floor/senate-facts/) confirms that affiliation.

The resulting **34 Democratic-caucus/31 Republican holdover starting point** is independently checked against `data/seat_universe.json` and the *actual* `ChamberControlModel.prepare()` assumptions in CI. Every individual seat, class, party, caucus, and name is recorded in `data/senate_2026_holdovers.json`. Incorrect class/special exclusions or count drift fail a regression.

**Limitations:** These are static 119th Congress affiliations as of the source date, not 2026 projected election winners, certified post-election seats, licensed professional calls, or a guarantee of how independents would vote in the next Congress. It must never silently override the published model's coefficients. A genuine caucus switch, vacancy, special election, or later official update requires reconciling the ledger and model with an explicit review.
