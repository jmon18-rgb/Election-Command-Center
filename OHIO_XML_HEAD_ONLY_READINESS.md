# Ohio XML export — HTTP metadata identity check, not a vote feed

The script trace on the official Ohio results site established:

`downloadReport('VSSC1622XmlFileBlob')` calls
`window.open('Api/v1/download?filename='+key, '_blank')`.

The relative URL from the `/Home/Index` page points to
`/Home/Api/v1/download?filename=VSSC1622XmlFileBlob`, while an
alternative site-root interpretation points to
`/Api/v1/download?filename=VSSC1622XmlFileBlob`.
The endpoint metadata check tests both using **HTTP HEAD only** and records
status codes, content type, length, and safe redirect hostname for
review. It does not follow redirects to other domains.

Regardless of which endpoint responds, the output deliberately marks
`source_approved_for_election_night=false` and
`candidate_votes_ingested=false`. The Ohio official site is serving mock
election data before Nov. 3; a successful HTTP response or XML MIME type
does not prove that any votes are genuine.

Live use still requires human verification of the true endpoint,
freshness and post-election production-status transition, strict
NIST 1500-100 XML schema parsing, 2026 race/contest identities,
candidate vote arithmetic, revision/outage recovery and a browser-safe
publishing route. Until that approval, no Ohio XML values can enter the
results screen or JackStradamus forecast.
