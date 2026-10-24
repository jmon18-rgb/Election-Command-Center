# Ohio NIST XML schema shape, without leaking pre-election mock vote data

The previous bounded GET probe confirmed the official Ohio Secretary of
State **root export** `/Api/v1/download?filename=VSSC1622XmlFileBlob`
responds HTTP 200 and the first 8192 bytes begin as an ElectionReport XML.
The document-relative `/Home/Api/v1/download` path is HTTP 404.
A HEAD request to the correct root route returned 405. These real
public-source observations resolve the download URL without inventing one.

This follow-on diagnostic requests at most 192 KiB and records **only XML
element paths and namespace identifiers**. It does not log text nodes,
candidate names, vote counts, XML candidate attributes or the raw response.
It rejects DTD/entity declarations and refuses any activation of a live
election vote feed. The Ohio website explicitly calls currently displayed
votes **mock election totals** until actual November 3 results are published.

This research is for designing a future safe NIST schema parser. Even a
valid root element is not proof of 2026 date, Senate race identity, official
candidate totals, precinct geography, update timestamp or actual live
results. This workflow never changes JackStradamus odds or any source
approval configuration.

A trustworthy importer still requires end-to-end NIST field mapping,
genuine election-date and source verification, county/senate reconciliation,
outage and revision tests, and a post-election-publication approval gate.
