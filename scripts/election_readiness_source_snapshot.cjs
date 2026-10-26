'use strict';
// A checked-in identity audit is evidence of discovery, never live delivery.
function summarizeSourceAudit(ledger, now = Date.now()) {
  if (ledger?.status !== 'SOURCE_IDENTITY_AUDIT_NOT_LIVE_RESULTS_COVERAGE' ||
      ledger.election !== '2026-11-03' || !Array.isArray(ledger.races))
    throw Error('Missing November 3 source identity audit');
  const stamp = Date.parse(ledger.generated_at);
  if (!Number.isFinite(stamp) || !Number.isFinite(now) || stamp > now + 15 * 60000)
    throw Error('Invalid source audit publication clock');
  const totals = {House: 0, Senate: 0, Governor: 0};
  const gaps = {House: [], Senate: [], Governor: []};
  const identities = new Set(), reasons = {};
  const gapStates = new Set(['PRIMARY_SCOPE_NOT_LIVE_VERIFIED',
    'PINNED_ID_NOT_LIVE_VERIFIED', 'SCOPED_ADAPTER_NOT_LIVE_VERIFIED',
    'RECENT_EXACT_PROBE_NOT_LIVE_VERIFIED', 'UNRESOLVED_SOURCE_GAP']);
  const allowedReasons = new Set(['INDEX_CANDIDATE_IDENTITY_REJECTED',
    'DETAIL_CONTRACT_REJECTED', 'PRE_POLL_CLOSE_POSITIVE_VOTES']);
  for (const row of ledger.races) {
    if (!Object.hasOwn(totals, row?.office) || typeof row.id !== 'string' ||
        !row.id.startsWith(row.office + '|') || identities.has(row.id) ||
        !gapStates.has(row.gap_status))
      throw Error('Invalid or duplicate source audit race');
    identities.add(row.id); totals[row.office]++;
    if (row.gap_status === 'UNRESOLVED_SOURCE_GAP') gaps[row.office].push(row.id);
    if (row.last_probe?.status === 'INVALID_DETAIL' && allowedReasons.has(row.last_probe.reason))
      reasons[row.last_probe.reason] = (reasons[row.last_probe.reason] || 0) + 1;
  }
  if (totals.House !== 435 || totals.Senate !== 35 || totals.Governor !== 36)
    throw Error('Incomplete 435/35/36 source audit inventory');
  return {status: ledger.status, audited_at: ledger.generated_at,
    age_minutes: Math.max(0, Math.floor((now - stamp) / 60000)),
    totals, unresolved_by_office: gaps, rejected_detail_reasons: reasons,
    interpretation: 'Identity discovery snapshot only. Human references and verified IDs do not establish live votes, source availability, reuse rights or professional calls.'};
}
module.exports = {summarizeSourceAudit};
