# Minnesota official 2026 county data — source-review-gated adapter

The Minnesota Secretary of State's November 3, 2026 [downloadable result-file layout](https://electionresults.sos.mn.gov/Results/MediaFileLayout/Index?erselectionId=201) describes semicolon-delimited candidate-by-geography records with **16 fields**. The SOS provides a [U.S. Senator by County](https://electionresultsfiles.sos.mn.gov/20261103/ussenatecty.txt) file and an [official export index](https://electionresults.sos.mn.gov/Select/MediaFiles/Index?ersElectionId=201). As of October 24 it still displays TEST RESULTS with fabricated vote-like figures. **Do not use the live file as 2026 voting data until independently approved after polling closes.**

`scripts/mn_2026_official_senate_county_advisory.py` implements an **offline, candidate-only schema parser**. It deliberately does **not** fetch candidate vote files, activate the dashboard or calculate probabilities.

For any parsed data to be eligible even for an advisory county display, an external operator must have obtained a post-close, source-reported timestamp, reviewed real production mode (no test banner), verified original source URLs and attribution/rights, and supplied a reviewed Minnesota two-digit county ID → Census 5-digit FIPS map. Retrieval time is not source time. Until then the adapter fails closed and returns no candidate votes.

If those independent requirements eventually pass, it can report individual county candidate counts but never treats number of precincts as percentage of votes, county candidate totals as ballots cast, or partial Minnesota counties as a complete statewide result. `may_update_model` and `may_move_national_needle` remain **false** by design: extrapolating remaining counties, historical comparable modes and calibrated errors requires separate source development and archived historical reporting-order replay.

All tests use deliberately synthetic fixtures, not the 2026 test returns.
