# Ohio Election Night XML: script action to real endpoint

The official Ohio election website exposes an XML export through a
JavaScript action `downloadReport('VSSC1622XmlFileBlob')`, not a stable
direct link. The previous official-site discovery was unable to identify
a vetted URL suitable for an election-night machine reader.

This workflow inventories bounded script references from the official
Ohio-hosted page, then scans official-hosted JavaScript for inert context
surrounding the `downloadReport` function and
`VSSC1622XmlFileBlob` object key. It stores the context as an Actions
artifact for source review. It **never executes site JavaScript or fetches
the XML export** and rejects non-Ohio script hosts.

Even if a URL can be inferred from the script, it is not approved for
production until its real post-November-3 source, exact election/office,
NIST format, candidate accounting, fresh updates and browser or Pages
delivery have been checked. Pre-election test/mock votes must never
enter the Election Command Center's live totals or forecast.

The immediate next implementation step after review is a sandboxed
XML parser and independent Office-of-the-Secretary-of-State release
check, followed by a test of delayed, revised and missing feed data.
No winning calls or nationwide needle adjustments are implied.
