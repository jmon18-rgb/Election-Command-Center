'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {summarizeSourceAudit} = require('./election_readiness_source_snapshot.cjs');
const ledger = JSON.parse(fs.readFileSync(path.join(__dirname,
  '../data/election_night_source_coverage.json'), 'utf8'));
const now = Date.parse(ledger.generated_at) + 65 * 60000;
const snapshot = summarizeSourceAudit(ledger, now);
assert.equal(snapshot.age_minutes, 65);
assert.deepEqual(snapshot.totals, {House:435, Senate:35, Governor:36});
const altered = structuredClone(ledger);
// Summaries can be stale: report the actual rows, not a cached summary count.
altered.summary.house.unresolved_source_gaps = 999;
altered.races[0].gap_status = 'UNRESOLVED_SOURCE_GAP';
altered.races[0].last_probe = {status:'INVALID_DETAIL', reason:'PRE_POLL_CLOSE_POSITIVE_VOTES'};
altered.races[1].last_probe = {status:'INVALID_DETAIL', reason:'arbitrary upstream content'};
const summary = summarizeSourceAudit(altered, now);
assert(summary.unresolved_by_office.House.includes(altered.races[0].id));
assert.notEqual(summary.unresolved_by_office.House.length, 999);
assert(summary.rejected_detail_reasons.PRE_POLL_CLOSE_POSITIVE_VOTES >= 1);
assert(!Object.hasOwn(summary.rejected_detail_reasons, 'arbitrary upstream content'));
assert.equal(JSON.stringify(summary).includes('reported_votes'), false);
for (const corrupt of [
  {...ledger, races:ledger.races.slice(1)},
  {...ledger, races:[ledger.races[0], ...ledger.races.slice(0,-1)]},
  {...ledger, races:[{...ledger.races[0], gap_status:null}, ...ledger.races.slice(1)]},
  {...ledger, election:'2024-11-05'},
  {...ledger, generated_at:'invalid'},
  {...ledger, generated_at:new Date(now+16*60000).toISOString()}
]) assert.throws(() => summarizeSourceAudit(corrupt, now));
assert.match(summary.interpretation, /do not establish live votes/);
console.log('Source report: row-derived inventory/gaps, bounded rejection evidence, clock and incomplete-audit failures PASS');
