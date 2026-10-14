# Geographically scoped polling signals

October 14, 2026: new **source-verified substate survey category**.

## Why this exists

The University of Houston Hobby School fielded a **TX-09 likely-voter survey** October 3–7 (677 respondents, reported ±3.77% MOE), published October 14. In addition to showing Republican Alex Mealer ahead 48–42 for the TX-09 House seat, it reports:
- Republican **Ken Paxton +1** over James Talarico in the *TX-09 electorate*, **not** across the state of Texas.
- Republican **Greg Abbott +4** over Gina Hinojosa among **TX-09 voters**, also not statewide.
- Trump would have won the redrawn TX-09 by roughly **20** in 2024, according to the Houston Chronicle's geographic reconstruction.

Primary sources:
- University of Houston [TX-09 survey report and methodology](https://www.uh.edu/hobby/congress2026/) and [release](https://www.uh.edu/news-events/stories/2026/october/10142026-hobby-ninth-district-race.php)
- Houston Chronicle [TX-09 presidential boundary comparison](https://www.houstonchronicle.com/politics/article/texas-gop-redistricting-cd-9-alex-mealer-22468641.php)

Thus a 2026 local Senate D-R margin of **D−1** is **19 points more Democratic** than the 2024 presidential comparison (D−20). **This is not a 19-point measured statewide electoral swing.** Candidate differences, turnout, political environment, the 2026 map, and district composition make it a descriptive *cross-office* signal, not an interchangeable election estimand.

## Capture route

`data/geographic_poll_signals.json` is a source-reviewed registry with separate `poll_id` and `question_id`, release date distinct from fieldwork dates, sample geography and map vintage, office/state target, electorate population, survey metadata, result provenance and current geographic partisan comparison. It explicitly flags `model_eligible:false`.

`scripts/validate_geographic_poll_signals.py` rejects: impossible dates, duplicate ballot questions, missing sources or candidate identities, nonexistent 2026 districts, mismatched statewide target, unsupported offices, invalid samples, attempts to designate a district survey as a statewide sample, or any attempt to make it eligible for model averaging.

The homepage New Polls panel and Poll Wire now show verified recent local questions in a separate, labeled section, with direct original-source and reference links. The TX-09 House matchup is still ingested normally as a TX-09 House poll through the primary source; the district-only Senate and governor findings are **not** added to TX-SEN/TX-GOV statewide polling averages or election-simulation odds. A direct link opens the current Texas Senate model *without substituting the district poll into it*.

The scope registry is extendable to new source-verified local crosstabs and poll questions, after someone (or a future trusted ingestion adapter) verifies their questionnaire population and original methodology. **It is currently a curated signal channel, not an internet-wide autonomous poll discovery system.** Automated feeds may still miss unindexed survey questions; never silently infer sampling geography from a district's headline.

## Safe future model research

A legitimate approach to quantitative use would estimate district-specific candidate-to-presidential residuals across multiple districts, account for district population and sample frames, and pool them with statewide survey data in a prevalidated hierarchical model. One district alone should be a signal to investigate other areas of Texas; it cannot simply replace the statewide Texas race mean.

The existing scheduled polling refresh runs this registry's integrity tests and preserves the feed; the first validated signal appears immediately from static GitHub Pages without waiting for a third-party indexer.

The 2026 Senate candidate model and the House correlated simulations are unchanged by this feature.
