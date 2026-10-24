# Ohio Election Night official XML route — bounded GET identity check

Ohio's Secretary of State exposes a NIST 1500-100 result export button.
Its official JavaScript resolves the button to the export object
`VSSC1622XmlFileBlob`, and prior HTTP **HEAD** checks showed the root route
returned **405 Method Not Allowed**, while the incorrectly document-relative
variant returned 404. Neither response rules out GET, and neither verifies an
Election Night results feed.

The diagnostic now issues a **GET with Range bytes=0-8191** to the two
exact, allowlisted official HTTPS paths. It caps all reads at 8192 bytes
even if the server ignores Range, blocks redirects, and records only
HTTP status, content type, first-byte SHA, superficial XML root shape,
and HTML/DOCTYPE warnings. The body is NEVER logged or published, no
candidate vote totals are parsed, and neither route is automatically approved.
A discovered XML-looking response is still **not** proof of genuine 2026 votes.

Until November 3 results publication is independently verified, the Ohio
site's banner identifies displayed results as pre-election **MOCK** data.
The presence or absence of a mock banner is not sufficient to override
the review and source identity gate. No output of this workflow may
enter JackStradamus candidate vote tables or the national needle.

After an official real-results feed is published, next steps are: full
origin-verified XML acquisition, explicit 2026 date/state/contest identity
and generation-time validation, NIST structural parsing, independent totals
crosscheck, source-regression handling and the deployed JS refresh path.
