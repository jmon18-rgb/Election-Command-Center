#!/usr/bin/env node
'use strict';
/* A real Chromium tab soak needs observable POST-resume data refresh,
 * elapsed active-tab time, and provider health—not just a screenshot that
 * retained the previously rendered DOM. Never claims votes or call authority.
 */
function assess(report, minutes, interval) {
  if(!Number.isInteger(minutes)||minutes<5||minutes>180||
     !Number.isInteger(interval)||interval<30||interval>300||
     !report||typeof report!=='object')
    throw Error('Invalid real browser-soak result parameters');
  const minRequests=Math.max(2,Math.floor(minutes/10));
  const checks=Object.freeze({
    actual_tab_elapsed: Number.isFinite(report.actual_elapsed_seconds)&&
      report.actual_elapsed_seconds>=minutes*60-1,
    expected_time_checkpoints: Number.isSafeInteger(report.checkpoints)&&
      report.checkpoints>=Math.floor(minutes*60/interval),
    all_on_screen_checkpoints_healthy: report.checkpoints>0&&
      report.healthy_checkpoints===report.checkpoints,
    background_tab_was_actually_hidden: report.background_visibility_confirmed===true,
    foreground_visibility_recovered: report.background_resume_observed===true&&
      report.resumed_tab_visible===true,
    refresh_trigger_honestly_attributed: [
      'MANUAL_OWNER_CONTROL_PRE_ELECTION','AUTONOMOUS_ELECTION_DAY_FOCUS'
    ].includes(report.post_resume_refresh_trigger),
    background_resume_triggered_new_primary_fetch: Number.isSafeInteger(
      report.post_resume_primary_requests)&&report.post_resume_primary_requests>=1,
    post_resume_primary_response_was_healthy: Number.isSafeInteger(
      report.post_resume_primary_healthy_responses)&&
      report.post_resume_primary_healthy_responses>=1,
    primary_source_refresh_continued: Number.isSafeInteger(
      report.source_requests?.primary)&&report.source_requests.primary>=minRequests,
    primary_source_successful_replies: Number.isSafeInteger(
      report.primary_healthy_responses)&&report.primary_healthy_responses>=minRequests,
    no_transport_or_http_source_failures:
      report.source_request_failures===0&&report.source_http_errors===0,
    no_browser_or_identity_audit_errors:
      report.page_script_errors===0&&report.audit_errors===0&&
      Array.isArray(report.errors)&&report.errors.length===0,
  });
  return Object.freeze({passed:Object.values(checks).every(Boolean),checks});
}
module.exports={assess};
