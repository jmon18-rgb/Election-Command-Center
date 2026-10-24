# Ohio official results XML — resolving the actual scripted link

As of October 23, 2026, Ohio's official 2026 results page offers an NIST
1500-100 XML export. Unlike a static download, the link invokes
`downloadReport('VSSC1622XmlFileBlob')`, an in-page JavaScript action.
That is **not a verified HTTP XML endpoint**. The site presently warns that
pre-election displayed totals are MOCK votes.

The read-only source trace limits requests to the official Ohio results
landing page and that host's JavaScript assets, with bounded payloads.
It captures short code excerpts around `downloadReport` and the
`VSSC1622XmlFileBlob` object identifier, without executing JavaScript,
calling the report download, or parsing election totals.

The workflow publishes source evidence in a diagnostic Actions artifact.
A future PR can use the proven download flow to verify a real 2026 source,
but must first ensure the pre-election mock/test dataset is replaced with
genuine election-night returns and verify the contest/election identity,
timestamps, 15 House districts, Ohio governor and Ohio special Senate
results. This trace alone cannot certify any ballot counts or professional
calls, and never updates JackStradamus odds.
