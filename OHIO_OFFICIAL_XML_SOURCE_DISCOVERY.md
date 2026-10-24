# Ohio Secretary of State Election Night XML source discovery

Ohio's official live-results site
(`https://liveresults.ohiosos.gov/Home/Index`) publicly advertises an
election-results feed based on **NIST 1500-100 XML**, updated every
three minutes during Election Night. That would be valuable for verifying
the Ohio special U.S. Senate, Ohio governor and congressional returns outside
our 22-state primary provider.

**Important:** as of the October 2026 source check, the site explicitly
warns that its visible vote totals are **MOCK election tests** in preparation
for November 3. They must never be published or interpreted as real 2026 votes.

The automated discovery workflow is read-only. It fetches up to 1.5MB
from the official landing page, extracts links labeled as official XML
feeds, and records verified official hostnames and page mock/test status.
It does **not** fetch candidate counts, parse live ballots, call elections,
supply polling data, or update JackStradamus probabilities. Cross-domain
links are marked for review without returning a usable URL.

Before using this as an actual production provider, the exact endpoint must
be independently verified on and after Election Day, its **real-vs-mock**
publication gate checked, a bounded XML schema/contest mapping implemented,
county/precinct denominators and revisions tested, and a deployed browser
source/refresh route verified. Even an XML source updated every three
minutes does not automatically solve browser CORS or site deployment delays.

This job is a source-discovery prerequisite and deliberately keeps
`ready_for_automatic_2026_ingestion=false` in every output.
