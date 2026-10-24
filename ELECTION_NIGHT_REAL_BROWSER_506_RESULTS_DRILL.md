# Actual-browser Election Night 506-race source recovery drill

This test opens the **actual static Election Command Center** in headless
Chromium (desktop and iPhone-sized viewport), sets a synthetic clock
after November 3, and intercepts HTTP to supply 2026 **FAKE, TEST-ONLY**
House, Senate and governor tallies from the configured Open America
provider URL. No synthetic votes are written to the repository, GitHub
Pages or the forecast service. All other external requests are blocked.

The browser verifies the new 506-race source dashboard counts ONE House
and ONE Senate race with positive source-reported votes, separately
tracks provider-recorded zero totals for two other races, and does NOT
impute votes for any of the others. The all-35 Senate source panel
includes Maine's pinned-but-not-observed race and Massachusetts /
Mississippi with no verified machine source identity.

It then simulates an outage across all three provider offices and
checks that cached results cease counting as current. Restoring the
source must recover the reported counts. Switching into the 2024
archive must clear all 2026 live source claims.

This test adds real-browser rendering and reconciliation coverage on
top of the existing 12-hour virtual transport simulation. It does not
establish real 2026 results coverage or verified chamber calls.
