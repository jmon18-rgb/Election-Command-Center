# Automatically refreshing approved official NC county counts

This is a **gated, source-attributed Election Night backstop**, not a guaranteed fast national provider. It is disabled on `main` by default.

Once a real November 3 NCSBE ZIP is published and a first archive fingerprint, exact contest group/name, race identity, and FIPS mapping have been independently reviewed, a PR can enable `data/nc_county_results_desk_config.json`. The configuration must select `./data/nc_candidate_votes_2026.json` and include the pinned initial official ZIP SHA-256 in `expected`.

The separate `allow_verified_revisions:true` flag permits later versions of the **same official HTTPS NCSBE URL** to be read and given a new recorded SHA, but only if the contest identity remains identical and every previously observed county/candidate count is nondecreasing. Unexpected changes, missing counties/candidates, identity changes, absent 2026 source, wrong election dates, and ZIP CRC/schema problems fail closed and require manual review. With revision opt-in absent, any changed ZIP fingerprint blocks publication.

Once enabled, GitHub Actions checks at an *attempted* ten-minute schedule across the evening of November 3 into November 4, 2026, as well as via a manual workflow dispatch. GitHub scheduled execution may be late and Pages deployment adds delay; this is not a subminute live feed. When a ZIP passes validation, the Action commits the candidate-vote snapshot and the updated approved SHA together in one commit to `main`. The job then explicitly requests a new Pages build using the Pages REST API because pushes using `GITHUB_TOKEN` do not themselves trigger branch-source Pages deployment. A failed rebuild request is an action failure rather than a silent claim that newer counts are on the site. It does not promote raw votes into polling, race calls, ballots remaining, percent reporting, or the geographic probability needle.

Unchanged ZIP fingerprints are rechecked without creating a new Pages deployment every ten minutes. After one hour, the workflow may refresh the archive *retrieved at* timestamp; that is deliberately not misrepresented as the election office's own last-update time.

Safety checks and expected fields are defined in `scripts/refresh_approved_nc_zip.py` and `scripts/build_nc_official_candidate_votes_2026.py`. All tests run offline with explicitly synthetic samples and do not enable production source approval.

**Operator action still required:** published 2026 ZIP verification; initial candidate/contest approval; review and merging of the enabling source config. This workflow must not be used as evidence that those steps have happened. If new source corrections reduce votes, review the revised archive manually rather than disabling the regression guard.
