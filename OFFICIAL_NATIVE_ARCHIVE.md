# First-night exact-original preparation

The owner approved first-night originals for 30 days, with verified capacity and
no paid storage. The capture implementation is prepared; **cloud capture/upload
is disabled until account capacity and spending protection are verified**.
No repository variables or billing settings have been enabled by this change.

## Scope and bounds

Only bodies already received by the existing WA03 counts/remaining and VA02 counts
collectors are eligible. There is no extra source GET, alternate URL, increased
cadence, new model input, call permission or client-cache payload.

| Source | Eligible request start and completed body receipt (UTC) | Existing per-job bounds |
| --- | --- | --- |
| WA03 counts and remaining | Nov4,2026 04:00 through strictly before17:00 | Four native requests; one existing slot may be remaining estimates after positive counts; counts2,097,152 bytes, estimates1,000,000 bytes; at most8,388,608 raw bytes |
| VA02 counts | Nov4,2026 00:00 through strictly before17:00 | One fixed native request; at most2,500,000 raw bytes |

Capture is restricted to the first attempt of scheduled jobs. Dispatches, health
checks, reruns, bootstrap and later collection do not create raw archives. Both
automatic pre-election bootstraps make zero native requests. Existing later
data-only collection continues unchanged.

The saved scheduled worst-case is1,818,622,848 raw bytes. The free-capacity gate
requires that amount plus16MiB for metadata/encryption/container overhead:
**1,835,400,064 bytes**. No positive-results compression ratio is assumed.
Manual/rerun captures and the speculative29GB whole-window design are excluded.

## Exact bytes and privacy

The retained original is the completed bounded Buffer returned by the existing
Fetch stream, before JSON parsing or reserialization. Fetch may already have
decoded HTTP content encoding. This is not a TLS/wire-header archive.

Bodies are losslessly gzipped, then encrypted with AES-256-GCM. Each body has a
fresh key/nonce; RSA-OAEP-SHA256 seals the key to the committed RSA3072 public key.
The private key stays in ignored `.official-native-archive-key/private.pem`,
outside all CI artifact-upload directories. Key generation refuses to run in
GitHub Actions. Keep a secure local backup: losing the private key prevents
decryption of retained bodies. Never commit or upload it.

The public repository's artifacts contain encrypted bodies and bounded receipts,
not plaintext original vote objects. Receipt metadata includes exact source/kind,
request and body-completion clocks, allowlisted HTTP headers, original body hash
and size, existing selected-payload hash, validation status, workflow/code identity
and a separate publisher outcome. Cookies, credentials and private model CSVs are
not captured. A saved zero, invalid JSON or schema-rejected complete body remains
rejected evidence; retention does not admit its votes. Incomplete/oversized streams
never receive a complete-body hash. A late body is excluded at the cutoff.

Deduplication is by verified original-body hash within one job only. Every native
request retains its own receipt. Equal selected contest hashes cannot deduplicate
different original bodies. Storage failure is reported separately and cannot
turn valid counts into an outage or trigger a source retry.

## Activation requires verified free capacity

GitHub documents artifact storage separately from public-repository runner time:
[Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
Account allowance, current shared usage, retention availability and an effective
block on paid usage must be checked; public visibility alone is insufficient.
No billing limits, payment methods or paid allowance may be increased.

Only after that check, the repository Actions variables are:

- `OFFICIAL_NATIVE_ARCHIVE_APPROVED=true`
- `OFFICIAL_NATIVE_ARCHIVE_NO_PAID_STORAGE=true`
- `OFFICIAL_NATIVE_ARCHIVE_FREE_BYTES` at least1,835,400,064
- `OFFICIAL_NATIVE_ARCHIVE_CAPACITY_AT`, the actual verification ISO time

Verification must be no older than24hours for every captured body. Renew it on
Nov3 after17:00UTC to cover the whole first-night window; today's allowance
cannot be assumed still available on election night. Missing, stale or inadequate
capacity leaves capture off. Uploads additionally require the scheduled/first-run
approval gates and use explicit30-day retention, fixed directories and unique
run/attempt names. They never overwrite an existing artifact. Upload failure or
expiry must be observed; this code does not claim an artifact exists merely
because a body hash was computed.

## Recovery and verification

Generate a key pair locally once, preserving an existing matching pair:

```powershell
node scripts/manage_official_native_archive_keys.cjs --init
```

After downloading and extracting a retained artifact, recover into a new ignored
directory. The decoder checks member paths, key identity, authentication,
encrypted/original hashes, byte bounds and request clocks before writing output:

```powershell
node scripts/decrypt_official_native_archive.cjs --artifact-dir artifacts/readiness/downloaded-native --private-key .official-native-archive-key/private.pem --output artifacts/readiness/verified-native
```

Original files retain their exact bytes; no reconstruction from selected JSON is
accepted. Verify the downloaded artifact's GitHub run/code identity and artifact
digest separately. Public-key encryption protects confidentiality; it does not
authenticate a publisher or certify votes. Finite retention ends after30days. Export approved evidence before it
expires. Actual positive delivery, complete publication chronology, post-cutoff
raw retention and predictive calibration remain separate unproven gates.

Tests use saved originals and explicitly synthetic responses, with zero native
requests: `test_official_native_archive.cjs`,
`test_virginia_native_archive_wiring.cjs` and the expanded existing Washington
collection-loop test. They cover both actual publisher paths, direct collector
hooks, encrypted round trips, invalid/incomplete bodies, same-job deduplication,
storage failures, strict windows/capacity flags and unchanged request bounds.
