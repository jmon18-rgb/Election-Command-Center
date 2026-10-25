#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts', 'readiness');
fs.mkdirSync(out, {recursive: true});
const checks = [
  ['Published bundle and forecast consistency', 'test_published_dashboard.cjs', '--local'],
  ['Race and source reconciliation', 'test_election_night_reconciliation.cjs'],
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
report.status = report.checks.every(x => x.status === 'PASS') ? 'CORE_CHECKS_PASS_ACCEPTANCE_OPEN' : 'CHECKS_FAILED';
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const markdown = ['# Election readiness report', '', `Revision: ${report.revision || 'unknown'}`,
  `Generated: ${report.generated_at}`, `Status: ${report.status}`, '', report.scope, '',
  '| Check | Result | Seconds |', '| --- | --- | --- |',
  ...report.checks.map(x => `| ${x.name} | ${x.status} | ${(x.elapsed_ms / 1000).toFixed(1)} |`),
  '', 'Acceptance still open:', ...report.unproven_gates.map(x => `- ${x}`),
  '', 'See ELECTION_NIGHT_ACCEPTANCE.md. Browser jobs have separate logs and artifacts.', ''].join('\n');
fs.writeFileSync(path.join(out, 'report.md'), markdown);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
process.exitCode = report.status === 'CHECKS_FAILED' ? 1 : 0;
