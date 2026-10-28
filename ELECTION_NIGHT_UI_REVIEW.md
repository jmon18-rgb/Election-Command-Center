# Election-night usability and visual review


Geographic visual pass503 RELEASED: finalmainae99e66f / Pages40606318882SUCCESS /
350published files matched00:05:22.341Z (October28UTC, October27Eastern). National
outlook/all4 and real50state outlines now share the laptop view; phone stacks
them. Larger personal odds/compact needles/clean separators are published.
OrdinaryIAB27 confirms RI picker, IA model navigation and retained selection,
source-summary focus below the toolbar,18cards and no overflow. Exact-head33
parents/42applicablejobs passed,3deployed-only skips/noexternalstatuses. Actual
Edge1366/390 tasks and national correction/withdrawal/outage/rehearsal passed.
Proof: published-geographic-integrity-20261028.json and
published-geographic-visual-pass-20261028.json/png in artifacts/readiness.
Candidate language below is historical; its release gate is satisfied. FullR8
review remains OPEN. Next work contract: ui-review/remaining-ux-work-contract.json
(duplicate prototypes/secondary roster/mobile toolbar), plus review NEIndependent
and AKbaseline/finalRCV map labeling consistency. No new results admission.

October27 late owner request: deeper visual implementation is ACTIVE now, not
deferred to Oct30. Current candidate pairs the national outlook/all4 probabilities
with a real50-state Census-outline map on laptop, stacks them on mobile, and
redesigns the personal cards with larger odds and clearer mini-needles/time/status.
Native state picker/arrow navigation and tile fallback preserve access to small
states. The map remains forecast navigation, not counted results or full House
district coverage. Source-snapshot details are disclosed rather than repeated.
Broken personal-card/history separators are repaired.

Actual Edge1366/390 operator tasks, personal same-draw/lifecycle tests and full
smoke pass. Geometry pins and reproducible builder pass. Evidence is under
artifacts/readiness/ui-review: hierarchy-browser-tasks.json, hierarchy-outcomes-*,
hierarchy-map-*, visual-personal-*. This candidate is not yet deployed. The prior
published500 screenshots/receipt below supply the before state. Full Oct30
workflow review still must address duplicate prototype/research surfaces, mobile
toolbar density, missing-source impact, meaningful admitted-change/correction/
withdrawal/outage tasks and owner handoff. Screenshots alone do not close R8.

October27 hierarchy slice RELEASED in PR499/500: finalmain2a81f443,
Pages40599401034SUCCESS,334published files matched23:05:00.522Z. The national
map now follows the outlook/all4percentages and precedes personal races. Detailed
model-input/source desks start closed; reconciled compact health remains visible,
including archive mode. Ordinary publishedIAB27 confirms direct inspection keeps
SUMMARY focus below the sticky toolbar and Tab continues into House drilldown.
Map selection/navigation, source recovery and laptop/mobile acceptance passed.
Evidence: published-source-focus-20261027.json/png and
published-hierarchy-ready-20261027.png under artifacts/readiness/.
This completes that engineering slice, not the full October30 owner-task/visual
review. Personal-card separator mojibake, duplication/spacing, map legibility,
missing-source impact and complete laptop/mobile task flow remain to review.

Owner requirement, October 27. This is a release acceptance task, not optional
decoration. Keep the personal race/source implementation moving; complete the
focused layout review on October 30 and required repairs before the October 31
feature freeze. Make all four outcome percentages clearly visible before the
October 29 owner rehearsal.

October 27 released slice (PR492, main9128ba98/Pages40573641201,306checked files matched and ordinary published UI verified): the display reuses the needle's existing four
labels as readable probability cells (four across on desktop, two by two on
mobile). Exact joint-model values and simulated-scenario values are unchanged;
unavailable values clear to dashes. Actual Edge1366/390 acceptance passes. This
release does not
complete the map/source hierarchy review or the October 30 task-based review.

## October 27 rendered reference tasks — partial comparison, not acceptance

At about22:15UTC, reviewed ordinary rendered 2024 historical Senate pages at
[270toWin](https://www.270towin.com/2024-election-results-live/senate/) and
[ABC News](https://abcnews.com/Elections/2024-us-senate-election-results-live-map/),
each at1265x720 CSS pixels. No publisher vote data, imagery or forecast rules were
imported into this app. CNN's previously denied retrieval was not retried.

- 270toWin: the election hub exposes office choices; one U.S.Senate click opens
  a chamber view with an explicit Forecast/Live Results distinction and map
  before the long candidate table. Selecting the visible MI tile opens Michigan
  candidate context in place. Large advertising/intro regions push the map below
  the first fold; that spacing does not serve this owner's task. Pointer selection
  was tested; keyboard behavior was not evaluated there.
- ABC: office choice, historical year/update/projection context precede the
  chamber bar and geographic map; recent projections and tables follow. Actual
  keyboard task: ArrowRight on the focusable map announced Idaho, another
  ArrowRight announced Wyoming, Enter opened Wyoming's state map/candidate
  table, and Escape closed it while retaining Wyoming map focus/context. Idaho's
  lack of a Senate contest did not open a state view. Visible arrow-key guidance
  and in-place return are useful patterns to test in our existing map. ABC's
  expected-vote reporting and winner labels are publisher-specific, not adopted.

Screenshots and the task receipt are under artifacts/readiness/ui-review/:
270-hub-20261027.png,270-senate-20261027.png,
270-map-michigan-20261027.png,abc-senate-20261027.png,
abc-keyboard-state-20261027.png,publisher-rendered-tasks-20261027.json.
This advances the formerly text-only comparison. It does not complete mobile
comparison, this app's laptop/mobile task acceptance, or the October30 review.
Next implementation: extract the national forecast map from the source desk,
preserve a compact consequential freshness/coverage notice, and place detailed
source investigation behind a named disclosure. Preserve callbacks, source IDs,
all four probabilities and forecast-versus-counted-result distinctions.

## The evening's main questions

The page should answer, in order:

1. What are the chances of each national ending now?
2. What changed, and is it actual performance against expectation or a correction?
3. Which of my races matter now, and what closes or is likely to become informative next?
4. Where is that happening? Let the map lead directly to the relevant race.
5. Are the inputs current, missing or disputed? Where can I inspect the evidence?

The primary audience is the owner following the evening on a laptop, sometimes
checking a phone. The default view is a decision dashboard, not a source-audit
console. Full provenance remains accessible and critical failures remain visible.

## Initial findings from the source review (repaired items recorded above)

- The needle's model and accessible description contain all four probabilities.
  Its visible footer foregrounds the largest ending, with a thin distribution bar
  and labels that do not expose all four numbers. This is a presentation gap,
  not a missing forecast calculation.
- Numerous per-source status paragraphs precede the personal race view.
- The national cartogram and the NC historical county map are nested in the
  large all-office source desk. Collapsing that entire section would make the
  map less discoverable, so extract the primary map first.
- The national map is forecast navigation; the NC county map is a separate
  historical/descriptive tool. Their meanings must stay explicit.
- Multiple prototype, research, source and race views repeat information.
  Consolidate the owner's primary path rather than adding another competing panel.

## Proposed default hierarchy to test

| Position | Purpose | Presentation |
| --- | --- | --- |
| First screen | National outlook | Needle plus equally readable Red Dawn, Shrug, Blue Wave and Blue Tsunami percentages; compact update/mode/uncertainty context. |
| Same laptop region / next mobile block | Geographic context | Promote the national race map with a clear legend and direct race selection; evaluate the existing cartogram against a compact geographic alternative using approved geometry. |
| Next | What matters now | Personal Senate/House needles, fresh meaningful changes, poll-close windows and the next useful races. Preserve manual navigation and stable focus. |
| Compact status | Is the display trustworthy? | A concise freshness/coverage warning with impact stated in plain language; expand Data & sources for details. |
| On demand | Investigation/research | Detailed source desk, provenance, provider identity gaps, historical NC lab, methodology and sensitivity controls. |

This is a proposed information hierarchy, not a completed redesign. Choose the
smallest layout changes that pass the tasks below; no new map service or broad
visual-system rewrite is required by this review.

## Required changes and guardrails

- Show all four mutually exclusive ending probabilities at once, with text labels
  and readable numbers. Reuse the exact current result, thresholds and private/public
  context; do not renormalize, alter forecasts or confuse a probability-point
  change with vote-margin outperformance. Clear unavailable values rather than
  leaving old numbers or inserting zeros. Keep simulated results visibly separate.
- Reduce the source desk's default footprint. Keep consequential stale/conflicting
  input warnings visible; put detailed diagnostics behind one discoverable control.
  Preserve source-status element IDs, keyboard access and source attribution.
- Put the primary map above diagnostic material. Improve label legibility, contrast,
  selection feedback and race navigation. Do not imply the one-district-per-state
  view is a complete 435-district map or color forecasts as actual counted results.
- Remove duplicated primary information and excessive technical paragraphs from
  the glance path. Preserve detailed evidence in the expandable layer.
- Reorganizing/collapsing UI must not alter source polling, hidden-tab behavior,
  model admissions, correction/retraction, call gates or independent-candidate credit.
- Respect reduced motion, keyboard focus, readable type and non-color cues.

## Comparative references and limits

Inspect a small set of primary publisher examples for hierarchy, map placement,
race navigation, result-versus-forecast labels and progressive disclosure:

- [ABC's Senate results page](https://www-cdn.abcnews.com/Elections/2024-us-senate-election-results-live-map/): the accessible page presents chamber outcome/totals, office switching and map navigation before deeper state/rating lists. Useful hierarchy and keyboard-navigation reference; its historical figures are not our inputs.
- [270toWin's results hub](https://www.270towin.com/2024-election-results-live/): office/state entry points and map-oriented navigation are visible in the fetched page. Assess the rendered experience before borrowing a spatial treatment.
- [AP's results hub](https://apnews.com/projects/election-results-2024/): public page inspected, but the fetched shell does not establish the embedded map's visual layout. A normal visual check is still required; no AP vote-data harvesting.
- [NYT graphics editor interview](https://reutersinstitute.politics.ox.ac.uk/news/moving-needle-how-new-york-times-aims-guide-readers-through-americas-most-uncertain-election): explanatory context for helping readers interpret incomplete returns against expectations, not proprietary model/layout specifications.

CNN's referenced results page denied automated retrieval; do not retry or bypass.
The rendered270toWin/ABC reference tasks above advance the source/text inspection;
a full side-by-side app workflow/visual evaluation remains open. Do not copy publisher assets or adopt their call,
reporting-percentage or forecast claims without our own evidence.

## Acceptance drill and evidence

On the owner's laptop and at 390px mobile, test pre-close, first admitted results,
contradictory evidence/correction, source withdrawal and outage/recovery. Reuse
existing scenarios rather than inventing reporting chronology.

- In roughly five seconds, identify all four national chances and whether the view
  is polling-only, results-informed or simulated.
- Find the next important closing window and the race that changed; distinguish
  movement from the baseline, raw votes and performance versus expectation.
- Find and use the primary map without opening a source-audit section. Reach a
  selected race in one action and return without losing the prior selection.
- Read a meaningful stale/source warning immediately and reach detailed evidence
  in one disclosure, while keeping the main outlook understandable.
- Verify no horizontal overflow, clipped labels, surprise scroll/focus resets,
  inaccessible controls or motion dependence. Preserve the same model numbers
  and all existing source/transport/call invariants before and after.

Record before/after screenshots, exact revision, viewports, actual task outcomes
and any remaining usability defects. Do not call the review complete on the basis
of a screenshot alone. Required failures block final engineering acceptance;
optional decorative upgrades can be explicitly deferred.
