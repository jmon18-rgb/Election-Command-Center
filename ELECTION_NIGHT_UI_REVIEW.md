# Election-night usability and visual review

Owner requirement, October 27. This is a release acceptance task, not optional
decoration. Keep the personal race/source implementation moving; complete the
focused layout review on October 30 and required repairs before the October 31
feature freeze. Make all four outcome percentages clearly visible before the
October 29 owner rehearsal.

October 27 implementation slice: a candidate reuses the needle's existing four
labels as readable probability cells (four across on desktop, two by two on
mobile). Exact joint-model values and simulated-scenario values are unchanged;
unavailable values clear to dashes. Actual Edge1366/390 acceptance passes. This
candidate still requires protected CI/merge/publication checks. It does not
complete the map/source hierarchy review or the October 30 task-based review.

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

## Current findings from the source review

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
The reference review so far is a bounded source/text inspection, not a completed
side-by-side visual evaluation. Do not copy publisher assets or adopt their call,
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
