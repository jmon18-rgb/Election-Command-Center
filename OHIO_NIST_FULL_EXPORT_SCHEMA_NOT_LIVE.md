# Ohio official NIST export full structural scan (mock data only)

The Ohio Secretary of State's official election reporting site exposes its
NIST 1500-100-compatible report at
`https://liveresults.ohiosos.gov/Api/v1/download?filename=VSSC1622XmlFileBlob`.

Previous real checks confirmed GET HTTP 200 with an `ElectionReport` XML root
and an IEEE 1622 namespace. The first 192 KiB contains person, party and
geography collections, but **not the later contest/result hierarchy**, which
we need to map precisely before a trustworthy import can be written.

The [full structure probe](.github/workflows/ohio-nist-full-schema-only.yml)
streams up to 32 MiB through an incremental parser and retains only the
element hierarchy and **attribute names**. It clears parsed nodes; neither
raw XML nor element/attribute values, candidate names or mock vote counts
are saved or emitted. It rejects DTD/entity content, invalid roots and
oversized/nested structural input.

This is **schema research, not a live vote feed**. The Ohio website calls
all vote totals pre-election MOCK results until genuine November 3
publication. Even a completely parsed XML export cannot be promoted to
JackStradamus results before verifying the source generation time, election
date, state and race identity, county/precinct mapping, candidate totals,
official mock-status reversal and independent crosschecks.

Next: use this evidence to implement a typed, strict, revision-safe parser,
with historical/synthetic tests and an explicit **approval gate**. Do not
change the model's odds based on experimental parsing.
