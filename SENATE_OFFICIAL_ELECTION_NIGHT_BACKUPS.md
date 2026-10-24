# Official results pages: Election Night human backstops

The browser provides direct links to **state election authorities** for
source-identity gaps and a handful of the highest-value Senate races outside
the Open America 22-state footprint: Alaska, Maine, Nebraska, New Hampshire
and the Ohio special Senate race.

Critically, these manual result sources are **not** treated as automated
vote data. A civicAPI race ID can be known and tested yet the provider might
still fail on Election Night, so the relevant state office link remains
available without relying on a nonexistent machine-source identity gap.

Verified office pages:

- Minnesota: `https://electionresults.sos.mn.gov/201` — the official November 3, 2026 general-election page was independently probed on October 24 and still displays **TEST RESULTS**. This manual Senate|MN check is **MOCK/TEST source; DO NOT use as votes** until the state changes status and exact contest, production timestamps, machine source provenance and licensing are separately approved. The metadata-only monitor is `.github/workflows/mn-2026-mock-status-watch.yml`; no source votes flow from the page into the model.
- Maine: `https://www.maine.gov/sos/elections-voting/election-results-data`
  — the general November 2026 returns were not published as of the source check.
- Ohio: `https://liveresults.ohiosos.gov/Home/Index`
  — the site explicitly warns that pre-election vote tallies are **MOCK**
  and says its NIST 1500-100 election-result XML feed will update on Election Night.
- Nebraska: `https://electionresults.nebraska.gov/`
  — pre-election pages display test/zero results, not real November votes.
  The state describes unofficial results beginning after poll closure.
- New Hampshire: `https://www.sos.nh.gov/2026-general-election-results`
  — linked results may be posted as town clerk returns come in.
- Alaska: `https://www.elections.alaska.gov/election-results/`
  — the Division of Elections publishes election-night and later certified reports.

Caveats are shown next to the links on the actual Election Night screen,
including prominent MOCK/TEST warnings for Ohio and Nebraska. This prevents
false confidence from a practice feed or an as-yet unpublished results page.
Sources are manual-click official backup pages; they do not become
JackStradamus results, winner calls, county adjustment, or remaining-vote
estimates without an additional independently verified machine ingestion.
