# Deployment and runtime readiness

## Architecture and scope

This is a static GitHub Pages app at
`https://jmon18-rgb.github.io/Election-Command-Center/`. There is no backend
that can push polling continuously: GitHub Actions ingests polls approximately
hourly, publishes coherent JSON files to `main`, GitHub Pages rebuilds, and an
already-open tab checks for new published snapshots every two minutes and on
tab refocus. This is **near-live published polling**, not a second-by-second
provider connection. Election-night vote feeds have their own refresh cadence.

Individual race odds, both chambers' control chances, and the mutually
exclusive Four Endings use the SAME correlated Monte Carlo draws. The model
is experimental, assumptions-dependent and **not independently calibrated** to
past comparable election-night outcomes. Headline race odds are not the
standalone poll-only diagnostic in `data/race_probabilities.json`.

## Release checklist

1. Ensure the pull request has both green **validation** and **browser**
   checks. The browser job uses jsdom and tests actual DOM updates, including
   new-poll arrival, partial-publication rejection, Four Endings, and Mississippi.
2. Merge to `main`; never commit incomplete `data/*.json` snapshots manually.
3. Verify **Refresh election briefing** and **pages build and deployment**
   Actions runs are green on `main`.
4. Verify **Verify deployed election dashboard** is green. This fetches the
   public GitHub Pages HTML, every first-party JavaScript asset, source JSON,
   and runs an independent 1,200-draw live forecast from the published data.
5. Check the page in a fresh browser/private window as well as one open tab.
   Verify the source timestamp, all four ending percentages, Mississippi's Senate
   card, and the JackStradamus Texas/Ohio/Iowa margins. Check Election Night
   for feed **source attribution**, not fabricated zeroes for missing states.
6. On mobile, check the surfer hero, horizontally scrollable tabs, new polls
   and the House/Senate detail views. Browser DOM CI cannot replace real-device
   visual inspection.

### Repeatable checks

```bash
python3 scripts/check_dashboard.py
node scripts/test_published_dashboard.cjs --local
node scripts/test_published_dashboard.cjs --remote
```

The local smoke requires Node 22 but **no npm dependencies**. Remote mode
requires outbound HTTPS from the runner. To target a different deployment,
set `DASHBOARD_SITE_URL=https://<host>/<base>/`. The full UI integration job
installs `jsdom@26.1.0` and runs
`node scripts/test_dashboard_runtime.cjs`.

Every external JavaScript URL in `index.html` must carry a `?v=<12-digit
Git-blob-SHA-prefix>` query token equal to the file **bytes**. The production
smoke enforces this. When changing any JS module, update its index URL
revision as part of the same PR. This avoids shipping the new HTML with a
browser-cached old forecasting engine or election-night adapter.

## Health signals and troubleshooting

- **Poll Wire has a new study, but odds don't:** verify its office, exact
  candidate names, sample population (LV vs RV), fieldwork end date, source
  link, and inclusion status. Two samples from one survey are *not* two
  independent polls. Review `data/pollresults_recent.json`,
  `data/polls.json`, `data/polling_estimates.json` and
  `data/race_probabilities.json`, in that order.
- **Four Endings differs from the race page:** check that
  `polling_estimates.generated_at` matches the odds publication reference,
  and `seat_universe.polling_source_snapshot`. The front end keeps the last
  validated snapshot during partial publication and retries in an open tab.
  A true full version switch must update all four outcomes and race
  probabilities together.
- **Hard refresh still shows old odds:** compare the loaded
  `chamber_control_model.js?v=...` against the fingerprint in `index.html`.
  A stale CDN asset or mismatched version fails the deployment smoke.
- **Hourly data is stale:** inspect the refresh workflow's unsuccessful
  ingestion and validation steps, source outages, and GitHub Actions
  scheduling delay. The deployment monitor fails after **six hours** of
  source staleness, even if the HTML itself still loads.
- **Pages build green but content wrong:** inspect the independent deployed
  smoke run. A green GitHub Pages upload alone does not prove correct
  in-browser source/model connectivity.
- **Votes disappear on Election Night:** check the upstream results provider
  and adapter coverage. A missing state or an unavailable source must remain
  unknown/stale rather than being treated as 0 votes, a finished race or an
  actual race call.

## Ongoing checks

- `refresh-briefing.yml`: hourly source/model rebuild; blocks publication
  if independent data/model readiness checks fail.
- `pr-tests.yml`: full synthetic and browser integration tests plus the
  source-independent production readiness smoke.
- `production-health.yml`: public-site verification after completed Pages
  deployments, every two hours and on manual workflow dispatch. Failed jobs
  are visible in Actions; this project does not claim an out-of-band paging
  system unless email notifications are actually configured.
- Static polling and candidate fundamentals do **not** by themselves assure
  reliable election-night coverage. Confirm provider contracts, jurisdiction
  support, and source-reported vote totals before Nov 3.

## GitHub Actions notification sanity (October 15)

The deployed-site workflow intentionally **does not run on a main push**, because
GitHub Pages may not yet have deployed that commit. It checks after a successful
Pages deployment and on the independent two-hour schedule. The production
smoke compares every served script to the content fingerprint in the **served**
HTML, not the checkout's potentially newer HEAD. The latter is reported as a
revision-lag diagnostic, not an incident. Run `--remote --require-head` only
when explicitly verifying that a particular checkout revision has reached the CDN.

Do not turn off genuine failure alerts: a missing model asset, invalid polling
snapshot, broken simulation, or data older than six hours still fails production
health. GitHub Actions failure notifications are not the poll-alert emails
controlled by `POLL_ALERT_TO`; those are separate systems. Red deployment-health
emails without a failing live source should no longer be generated by normal
asynchronous deployment lag.

The Iowa Marist October 15 release contains two questions from one survey:
likely voters D+3 (the **one** counted model observation) and registered voters
D+7 (visible in Poll Wire but not an independent extra sample). The Senate tide
card now displays the selected wave and its actual weight so that no change or
small change in full correlated odds is explainable without opening source files.
