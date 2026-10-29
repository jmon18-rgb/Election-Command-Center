#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {summarizeSourceAudit} = require('./election_readiness_source_snapshot.cjs');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts', 'readiness');
fs.mkdirSync(out, {recursive: true});
const checks = [
  ['Latest-snapshot model worker cancellation, immutable inputs and guarded fallback', 'test_joint_model_worker_controller.cjs'],
  ['Nested worker dependency revisions, fixed order and outer entry identity', 'test_joint_model_worker_assets.cjs'],
  ['Main-safe exact worker runner and missing-helper covariance withholding', 'test_joint_model_worker_main_api.cjs'],
  ['Validated-call numerical proposal, exact allocation and hard support guards', 'test_source_call_conditioning.cjs'],
  ['Resource-guided indexed call proposal preserves the exact original target and workspace bound', 'test_source_call_resource_law.cjs'],
  ['Private transport cache preserves every replay value and releases bounded packet buffers', 'test_chamber_private_transport_cache.cjs'],
  ['Validated-call whole-election transport, replay, baseline and consumer isolation', 'test_chamber_source_call_conditioning.cjs'],
  ['One frozen county target with validated calls, final support and fallback', 'test_national_call_conditioning.cjs'],
  ['Owner early House references, Texas shared needle and nonduplicated surprise signals', 'test_house_early_watch.cjs'],
  ['Encrypted first-night originals and free-capacity activation guards', 'test_official_native_archive.cjs'],
  ['VA exact-original sink in the actual publisher and zero-GET bootstrap', 'test_virginia_native_archive_wiring.cjs'],
  ['AK official ballot identity and unsupported-call exclusion', 'test_alaska_senate_ballot_guard.cjs'],
  ['Maine queued-response minute floor', 'test_maine_controller_budget.cjs'],
  ['VA02 bounded native collection', 'test_collect_virginia_official_results.cjs'],
  ['VA02 owned publication and integrity', 'test_virginia_official_cache.cjs'],
  ['VA02 official roster/geography/method contract', 'test_virginia_house_02_source.cjs'],
  ['VA02 independent bounded transport', 'test_virginia_official_transport.cjs'],
  ['VA02 national movement and baseline isolation', 'test_virginia_house_02_national_bridge.cjs'],
  ['VA02 queued transport and manual floor', 'test_virginia_house_02_controller_budget.cjs'],
  ['AZ-06 full district-part source contract', 'test_arizona_house_06_county_source.cjs'],
  ['AZ-06 national movement and baseline isolation', 'test_arizona_house_06_national_bridge.cjs'],
  ['AZ-06 queued transport and manual floor', 'test_arizona_house_06_controller_budget.cjs'],
  ['MI-07 full district-part source contract', 'test_michigan_house_07_county_source.cjs'],
  ['MI-07 national movement and baseline isolation', 'test_michigan_house_07_national_bridge.cjs'],
  ['MI-07 queued transport and manual floor', 'test_michigan_house_07_controller_budget.cjs'],
  ['PA-08 full district-part source contract', 'test_pennsylvania_house_08_county_source.cjs'],
  ['PA-08 national movement and baseline isolation', 'test_pennsylvania_house_08_national_bridge.cjs'],
  ['PA-08 queued transport and manual floor', 'test_pennsylvania_house_08_controller_budget.cjs'],
  ['PA-07 full district-part source contract', 'test_pennsylvania_house_07_county_source.cjs'],
  ['PA-07 national movement and baseline isolation', 'test_pennsylvania_house_07_national_bridge.cjs'],
  ['PA-07 queued transport and manual floor', 'test_pennsylvania_house_07_controller_budget.cjs'],
  ['SC exact county source and all-other candidate contract', 'test_south_carolina_county_source.cjs'],
  ['SC queued-response transport floor', 'test_south_carolina_controller_budget.cjs'],
  ['Ohio special-Senate exact county source and full candidate roster', 'test_ohio_civic_county_source.cjs'],
  ['Ohio counts-only national updating and baseline isolation', 'test_ohio_national_bridge.cjs'],
  ['Ohio queued-response and manual request spacing', 'test_ohio_controller_budget.cjs'],
  ['Official Washington exact source and county counts', 'test_washington_official_house_source.cjs'],
  ['Owned official source integrity and publication isolation', 'test_washington_official_cache.cjs'],
  ['Official Washington national counts-only updating', 'test_washington_national_bridge.cjs'],
  ['Atomic historical source provenance and independent candidate facts', 'test_house_history_migration.cjs'],
  ['New York competitive House county identity, fusion baseline and rejection gates', 'test_new_york_house_17_county_source.cjs'],
  ['Second competitive House district-part source contract', 'test_wisconsin_house_03_county_source.cjs'],
  ['Competitive House district-part source contract', 'test_wisconsin_house_county_source.cjs'],
  ['Actual source/national-update report safeguards', 'test_competitive_live_source_report.cjs'],
  ['Pennsylvania top-priority House county source identity and rejection gates', 'test_pennsylvania_house_10_county_source.cjs'],
  ['Michigan competitive House county source identity and rejection gates', 'test_michigan_house_04_county_source.cjs'],
  ['Competitive source polling deadlines and active-tab budget', 'test_competitive_source_cadence.cjs'],
  ['National county-return likelihood and coherent joint updates', 'test_national_county_likelihood.cjs'],
  ['Iowa competitive-race remaining-vote model', 'test_iowa_senate_partial_forecast.cjs'],
  ['Iowa full county-source input adapter', 'test_iowa_civic_county_source.cjs'],
  ['Iowa combined county predictive needle', 'test_iowa_county_needle.cjs'],
  ['Kansas strict county-source contract', 'test_kansas_civic_county_source.cjs'],
  ['Kansas experimental source-to-forecast path', 'test_kansas_county_needle.cjs'],
  ['Texas strict county-source contract', 'test_texas_civic_county_source.cjs'],
  ['Competitive race source request priority', 'test_election_night_transport.cjs'],
  ['Competitive source revision persistence', 'test_competitive_source_revision.cjs'],
  ['Linked competitive-race starting priors', 'test_competitive_needle_prior.cjs'],
  ['Source audit reporting safeguards', 'test_election_readiness_source_snapshot.cjs'],
  ['Celebration playback and revoked-call queue', 'test_election_night_celebration_player.cjs'],
  ['Original celebration music, bounded mix and cancellation', 'test_celebration_music.cjs'],
  ['Optional visible YouTube identity and local preferences', 'test_celebration_online.cjs'],
  ['Private ad-free audio persistence and asynchronous teardown', 'test_celebration_local.cjs'],
  ['Supplied Abbott artwork, exact bytes and safe scene fallback', 'test_celebration_owner_artwork.cjs'],
  ['Published bundle and forecast consistency', 'test_published_dashboard.cjs', '--local'],
  ['Race and source reconciliation', 'test_election_night_reconciliation.cjs'],
  ['Source publication identity during corrections', 'test_election_night_snapshot_revision.cjs'],
  ['Provider call withdrawal and bulletin queue', 'test_election_night_call_retraction.cjs'],
  ['Poll closing safeguards', 'test_election_night_poll_closings_2026.cjs'],
  ['Six simulated hours of reporting and recovery', 'test_election_night_six_hour_stress.cjs'],
  ['Provider backoff and recovery', 'test_election_night_source_backoff.cjs'],
  ['Fast lane request budget', 'test_election_night_fast_lane.cjs'],
  ['Rehearsal isolation', 'test_election_night_rehearsal.cjs'],
  ['Historical clock archive admissibility', 'test_historical_election_clock_replay.cjs'],
  ['Raw returns cannot calibrate national odds', 'test_joint_needle_raw_returns_gate.cjs'],
  ['Senate holdover accounting', 'test_senate_holdover_audit.cjs'],
  ['506 race gap desk', 'test_election_night_506_live_gap_desk.cjs']
];
if (process.argv.includes('--remote')) checks.push(['Actual deployed site', 'test_published_dashboard.cjs', '--remote']);
const revision = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'});
const report = {
  generated_at: new Date().toISOString(), revision: revision.status === 0 ? revision.stdout.trim() : null,
  scope: 'Core regression checks; synthetic replay is not real-provider acceptance.',
  unproven_gates: ['Genuine post-close 2026 vote delivery', 'Complete usable source coverage and rights',
    'Chronological historical and geographic calibration', 'Operator laptop acceptance'], checks: []
};
for (const [name, script, ...args] of checks) {
  const start = Date.now();
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args],
    {cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024});
  const status = result.status === 0 && !result.error ? 'PASS' : 'FAIL';
  const log = `${script}.log`;
  fs.writeFileSync(path.join(out, log), `${result.stdout || ''}\n${result.stderr || ''}\n${result.error || ''}`);
  report.checks.push({name, command: ['node', `scripts/${script}`, ...args], status,
    elapsed_ms: Date.now() - start, exit_code: result.status, signal: result.signal, log});
  console.log(`${status}: ${name}`);
}
try {
  report.source_audit = summarizeSourceAudit(JSON.parse(fs.readFileSync(
    path.join(root, 'data', 'election_night_source_coverage.json'), 'utf8')));
} catch (error) {
  report.source_audit = {status: 'UNAVAILABLE', error: error.message};
}
report.status = report.checks.every(x => x.status === 'PASS') && report.source_audit.status !== 'UNAVAILABLE' ?
  'CORE_CHECKS_PASS_ACCEPTANCE_OPEN' : 'CHECKS_FAILED';
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const markdown = ['# Election readiness report', '', `Revision: ${report.revision || 'unknown'}`,
  `Generated: ${report.generated_at}`, `Status: ${report.status}`, '', report.scope, '',
  '| Check | Result | Seconds |', '| --- | --- | --- |',
  ...report.checks.map(x => `| ${x.name} | ${x.status} | ${(x.elapsed_ms / 1000).toFixed(1)} |`),
  '', 'Source identity audit:',
  ...(report.source_audit.status === 'UNAVAILABLE' ? [`Unavailable: ${report.source_audit.error}`] : [
    `Audited: ${report.source_audit.audited_at} (${report.source_audit.age_minutes} minutes before this report)`,
    report.source_audit.interpretation,
    ...Object.entries(report.source_audit.unresolved_by_office).map(([office, ids]) =>
      `- ${office}: ${ids.length} unresolved source identities${ids.length ? ' — ' + ids.join(', ') : ''}`),
    ...Object.entries(report.source_audit.rejected_detail_reasons).map(([reason, count]) =>
      `- Rejected details: ${reason} (${count})`)]),
  '', 'Acceptance still open:', ...report.unproven_gates.map(x => `- ${x}`),
  '', 'See ELECTION_NIGHT_ACCEPTANCE.md. Browser jobs have separate logs and artifacts.', ''].join('\n');
fs.writeFileSync(path.join(out, 'report.md'), markdown);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
process.exitCode = report.status === 'CHECKS_FAILED' ? 1 : 0;
