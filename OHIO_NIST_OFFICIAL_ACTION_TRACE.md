# Ohio's NIST 1500-100 XML export button: verified action tracing

The official Ohio Election Night website offers a NIST-format XML download
behind a JavaScript action:
`javascript:downloadReport('VSSC1622XmlFileBlob')`.

This is NOT a download URL. The bounded [source-tracing
workflow](.github/workflows/ohio-nist-action-trace.yml) downloads only
public first-party HTML and HTTPS JavaScript from the official
`liveresults.ohiosos.gov` site, then saves short excerpts explaining the
observed button's implementation. It never executes downloaded JavaScript,
doesn't follow third-party hosts or fetch the XML result body, and doesn't
read candidate vote counts. Any discovered resource remains an unapproved
*potential* result-source route until its own XML origin and result election
identity have been verified.

Ohio's official pre-election result testing means an XML response obtained
before November 3 is NOT verified real 2026 voting. Discovering the button
is not sufficient for an active feed, a 3-minute refresh SLA, a race call,
a national needle calculation or confidence in any ballot count.

The next step is to validate the true export resource's origin, HTTPS
transport, content type, NIST election date/state/office, mock/test status,
candidate identity and totals; only then plan an approval-gated static
election-night adapter.
