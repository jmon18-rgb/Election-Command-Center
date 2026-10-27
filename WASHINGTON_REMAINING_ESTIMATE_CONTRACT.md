# Washington remaining-estimate extension

This experimental extension uses the existing WA-03 input to the national model.
It adds no race panel, call, independent likelihood or national source count.
The actual pre-election statistic has 39 zeros and null update clocks. None of
those values is an admitted remaining-ballot observation.

## Source and geography

The official application declares the 2026 Washington `/stats` endpoint. Native
statistic/group IDs and all 39 county IDs/names are pinned against Census.
The original 119th Congress Census map is preserved with its hash; the existing
2026 Census bridge must also say the district is unchanged. Clark, Cowlitz,
Lewis, Pacific, Skamania and Wahkiakum are whole counties. Thurston is split and
always keeps the historical turnout scenario. No county estimate is allocated
by population, historic votes or a guessed district share.

Estimates require a fresh collection receipt, a valid post-close county reporting
clock no older than 30 minutes, and a reporting clock within 15 minutes of the
validated positive WA-03 returns. Five minutes of future-clock tolerance is an
engineering choice, not a measured accuracy claim. Missing, stale, mismatched,
test/pre-close or corrupt observations cannot replace the historical scenario.
The official estimate is neither an exact count nor a physical hard bound.
No separate live/test flag was present in the observed statistics response.
Positive production counts from the verified election are therefore required
alongside it; any explicit negative production/test flag is rejected. Actual
post-close statistics delivery and semantics remain evidence requirements.

## Reviewable, uncalibrated assumptions

For each eligible whole county, let `E` be the official estimated ballots left
and `H` its historical two-party vote reference. The assumed remaining two-party
center is `0.95 E`. Its sensitivity scale is

`sqrt(max(0.5 E, 0.05 H, 1000)^2 + (0.1 E)^2)`.

These choices allow estimate error, undervotes/other candidates and a nonzero
uncertainty floor even when the official estimate is zero. They are not fitted
to fixtures, historical outcomes or actual reporting batches.

Half the mixture weight retains the original historical-turnout likelihood.
The other half evaluates errors at `-2, -1, 0, 1, 2` sensitivity scales with
relative weights `0.05, 0.25, 0.4, 0.25, 0.05`. Negative remaining scenarios stop
at zero. A shared error sign across counties avoids treating the provider's
estimates as six independent observations. Existing county/batch uncertainty,
state likelihood budget, ESS floor, baseline draws and Four Endings thresholds
remain unchanged.

The mixture replaces the turnout/selection component inside the SAME counts
likelihood. It never multiplies another race posterior or results likelihood.
The displayed remaining-vote range is the outer sensitivity envelope of the
historical range and estimate scenarios; it has no calibrated coverage claim.
Counts without eligible estimates reproduce the original numerical path.

## Collection, integrity and recovery

The first-night job retains at most four fixed native requests, at least 60
seconds apart after completion. Once positive official returns exist, its
second slot reads estimates instead of another counts copy: three counts reads
plus one estimate read. Without positive returns it retains four counts reads.
Later jobs retain the existing single counts request; supplementary estimates
expire and the model falls back to historical turnout. No native request budget
or client polling lane is added. Scheduling and cache delay can still add minutes.
Serialized publisher jobs wait one minute before their first native request,
including queued jobs after a failed predecessor. This protects the cross-job
request floor and adds one minute of scheduling latency; no timeout is raised.

Both objects travel in the same fixed data-only branch/file. Separate hashes,
strict reparsing and a supplementary body cap protect the existing counts path.
An invalid estimate cannot remove otherwise valid counts. Publisher rejection
retains the original retrieval time (or an unknown value) and records validation
rejection time separately; rejection never creates a new source receipt. Publisher and durable
browser metadata reject older receipts, older county publications and changed
values at the same reporting clock, including replay after a newer zero.
Valid no-estimate receipts withdraw the supplement without inventing a reporting
clock; a later verified fresh source can recover. Hidden-tab, archive, queue,
manual-refresh and existing count-correction gates remain in place.
The owned-cache refresh floor restarts after response completion, including
time spent queued; a long queued response cannot permit an immediate second read.

Automatic pre-election push bootstrap makes no native request. Explicit health
checks remain available but are not required for this release.

## Evidence and limits

Synthetic numerical and laptop/mobile browser tests demonstrate estimate-only
national movement, identical baseline draws, fixed state/ESS limits, correction,
withdrawal and recovery. The pinned actual null-clock source is excluded.
This does not establish positive 2026 delivery, estimate-error calibration,
chronological predictive skill or speed relative to major publications.
