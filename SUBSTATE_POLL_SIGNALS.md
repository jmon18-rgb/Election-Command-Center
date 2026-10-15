# Geographically scoped 2026 ballot polling signals

This is a **curated, source-checked signal registry**, not a new statewide polling feed or an autonomous crawler.

The University of Houston Hobby School’s October 14, 2026 [TX-09 survey](https://www.uh.edu/hobby/congress2026/) (likely voters, October 3–7, n=677, MOE ±3.77%) asked congressional-district voters about statewide races.

| Target election | Local TX-09 result (Republican margin) | Model input? |
| --- | ---: | --- |
| Texas U.S. Senate | Paxton +1 vs Talarico **among TX-09 respondents** | **No** |
| Texas Governor | Abbott +4 vs Hinojosa **among TX-09 respondents** | **No** |

This is an interesting indication of relative competitiveness *in this district*. It is not a statewide Texas poll or a sample representative of statewide Texas voters. Even though the rebuilt TX-09 area favored Trump by about 20 points in 2024 according to the [Houston Chronicle's contemporary reconstruction](https://www.houstonchronicle.com/politics/article/texas-gop-redistricting-cd-9-alex-mealer-22468641.php), the difference between a presidential margin and a Senate race is **not an identified national or statewide uniform swing**.

`data/substate_poll_signals.json` carries independent question IDs, original source URL, release and fieldwork dates, 2026 sampling geography, LV classification, sample size, ballot candidates, office/race target and `model_eligible:false`. Poll Wire displays it in a **separate expandable section**. This source never enters the pipeline's `data/polls.json`, `polling_estimates.json`, `race_probabilities.json` or the correlated model inputs. `scripts/validate_substate_poll_signals.cjs` checks identity and rejects any attempt to mark a local electorate sample statewide-eligible.

For future substate data, require original pollster/academic report, a sampling frame and geographic vintage, question text, field dates, verified source link and exact locality. Do not reweight district samples into statewide estimates without independently calibrated geographic sampling/turnout weights and out-of-sample tests. A source-checked static registry cannot promise that all local polls will automatically be discovered.
