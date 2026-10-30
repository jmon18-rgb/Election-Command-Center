'use strict';
// Offline structural preflight ONLY. Reviewed evidence still needs independent admission.
const crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const stamp=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const text=x=>typeof x==='string'&&x.trim().length>0;
const sameSet=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a).size===a.length&&a.every(x=>b.includes(x));
function inspect(manifest,{readBytes}={}){
 const missing=[],checks=[];const need=(ok,code)=>{(ok?checks:missing).push(code);return !!ok;};
 const finish=()=>Object.freeze({status:missing.length?'BLOCKED_MISSING_OR_CONTRADICTORY_EVIDENCE':'STRUCTURAL_PREFLIGHT_PASS_REQUIRES_INDEPENDENT_ADMISSION',requirements_met:checks,blocking_fields:missing,admitted_independent_datasets:0,admitted_heldout_elections:0,metrics:{margin_MAE:null,margin_bias:null,interval_coverage:null,Brier:null,log_loss:null,baseline_skill:null,national_transfer_skill:null},may_claim_calibration:false,may_change_forecast:false});
 let m;try{m=structuredClone(manifest);}catch{need(false,'manifest.owned_snapshot');return finish();}
 if(!need(m?.schema==='empirical-package-intake-v1','manifest.schema'))return finish();
 const artifacts=m.artifacts||{},verified=new Set();
 need(typeof readBytes==='function','offline_original_byte_reader');
 for(const [id,a]of Object.entries(artifacts)){
  const safe=text(id)&&a&&text(a.path)&&!a.path.startsWith('/')&&!/^[a-zA-Z]:/.test(a.path)&&!a.path.includes('\\')&&!a.path.split('/').some(p=>!p||p==='..'||p==='.')&&/^[a-f0-9]{64}$/.test(a.sha256||'');
  if(!need(safe,'artifact.'+id+'.safe_local_path_and_sha256'))continue;
  try{const b=readBytes(a.path);if(need(Buffer.isBuffer(b)&&hash(b)===a.sha256,'artifact.'+id+'.retained_byte_hash'))verified.add(id);}catch{need(false,'artifact.'+id+'.retained_byte_hash');}
 }
 const has=id=>verified.has(id),review=(r,field)=>need(r?.approved===true&&text(r.reviewer)&&has(r.evidence_artifact),field);
 need(text(m.package_id),'package_id');need(text(m.election?.id)&&/^\d{4}-\d\d-\d\d$/.test(m.election?.date||'')&&Number.isFinite(stamp(m.election?.final_poll_close_at)),'exact_election_identity_and_declared_close');
 const race=m.race||{},units=race.reporting_unit_ids,candidates=race.candidate_ids;
 need(text(race.id)&&text(race.office)&&Array.isArray(candidates)&&candidates.length>=2&&candidates.every(text)&&new Set(candidates).size===candidates.length,'exact_race_office_and_native_candidate_ids');
 need(Array.isArray(units)&&units.length>0&&units.every(text)&&new Set(units).size===units.length,'complete_native_reporting_unit_roster');
 review(m.reviews?.rights,'review.established_internal_research_reuse');
 review(m.reviews?.geography,'review.independently_matched_complete_geography');need(sameSet(m.reviews?.geography?.reporting_unit_ids,units),'review.geography_exact_roster');
 review(m.reviews?.capture,'review.independent_availability_and_capture');need(m.reviews?.capture?.kind==='independent_original_capture_not_printed_generation_or_imported_git_date','review.capture_independent_kind');
 review(m.reviews?.normalization,'review.original_to_normalized_identity_and_count_binding');need(/^[a-f0-9]{64}$/.test(m.reviews?.normalization?.parser_sha256||''),'review.normalization_parser_version');
 review(m.reviews?.corrections,'review.complete_correction_retraction_chain');review(m.reviews?.final_truth,'review.final_truth');need(has(m.final_truth_artifact),'retained_final_truth');
 const close=stamp(m.election?.final_poll_close_at);need(Number.isFinite(stamp(m.evaluation_started_at))&&close<stamp(m.evaluation_started_at),'evaluation_after_declared_historical_election_close');
 const protocol=m.expectation_protocol||{},cutoff=stamp(protocol.pre_election_cutoff_at),earliest=stamp(protocol.earliest_usable_returns_available_at);
 review(protocol.review,'expectation_protocol.independent_cutoff_and_earliest_availability_review');
 need(protocol.election_id===m.election?.id&&has(protocol.cutoff_evidence_artifact)&&has(protocol.earliest_returns_evidence_artifact),'expectation_protocol.same_election_documented_cutoff_and_earliest_returns');
 need(Number.isFinite(cutoff)&&Number.isFinite(earliest)&&cutoff<=close&&cutoff<earliest,'expectation_protocol.pre_election_cutoff_before_usable_returns');
 for(const name of ['model','polling_only']){const p=m.frozen_expectations?.[name];review(p?.review,'frozen_expectation.'+name+'.independent_vintage_review');need(p&&has(p.body_artifact)&&has(p.freeze_receipt_artifact)&&Number.isFinite(stamp(p.available_at))&&Number.isFinite(stamp(p.frozen_at))&&stamp(p.available_at)<=stamp(p.frozen_at)&&stamp(p.frozen_at)<close,'frozen_expectation.'+name+'.original_available_and_frozen_before_election_close');need(p?.election_id===m.election?.id&&p?.race_id===race.id&&stamp(p?.frozen_at)<=cutoff&&stamp(p?.frozen_at)<earliest,'frozen_expectation.'+name+'.same_election_race_before_documented_cutoff_and_usable_returns');}
 const split=m.holdout||{};review(split.review,'holdout.independent_no_fit_or_tune_review');need(has(split.lock_artifact)&&Number.isFinite(stamp(split.locked_at))&&stamp(split.locked_at)<=stamp(m.evaluation_started_at),'holdout.lock_before_evaluation');
 need(Array.isArray(split.development_election_ids)&&Array.isArray(split.heldout_election_ids)&&split.heldout_election_ids.includes(m.election?.id)&&new Set(split.heldout_election_ids).size===split.heldout_election_ids.length&&!split.heldout_election_ids.some(id=>split.development_election_ids.includes(id))&&split.used_for_fitting_or_tuning===false,'holdout.entire_election_disjoint_from_development');need(split.election_id===m.election?.id&&split.election_id===protocol.election_id,'holdout.same_election_as_vintage_protocol');
 const rows=m.snapshots;need(Array.isArray(rows)&&rows.length>0,'retained_real_snapshot_sequence');let prior=null;const ids=new Set(),stages=new Set();
 for(const r of Array.isArray(rows)?rows:[]){const key='snapshot.'+(r?.id||'MISSING');need(text(r?.id)&&!ids.has(r.id),key+'.unique_identity');ids.add(r?.id);need(has(r?.original_artifact)&&has(r?.normalized_artifact)&&has(r?.capture_receipt_artifact),key+'.original_normalized_and_independent_receipt_bytes');
  need(r?.election_id===m.election?.id&&r?.race_id===race.id&&sameSet(r?.candidate_ids,candidates)&&sameSet(r?.reporting_unit_ids,units),key+'.exact_full_race_candidate_geography');
  need(Number.isFinite(stamp(r?.source_as_of))&&Number.isFinite(stamp(r?.available_at))&&Number.isFinite(stamp(r?.captured_at))&&stamp(r.source_as_of)<=stamp(r.available_at)&&stamp(r.available_at)<=stamp(r.captured_at)&&(!prior||stamp(r.captured_at)>stamp(prior.captured_at)),key+'.source_availability_capture_chronology');
  need(r?.previous_snapshot_id===(prior?.id||null)&&['initial','update','correction','retraction','recovery'].includes(r?.change_kind)&&(prior?r.change_kind!=='initial':r.change_kind==='initial'),key+'.explicit_previous_and_change_kind');
  if(['early','middle','late'].includes(r?.evaluation_stage))stages.add(r.evaluation_stage);prior=r;
 }
 need(Array.isArray(rows)&&rows.length>0&&rows.every(r=>Number.isFinite(stamp(r?.available_at))&&earliest<=stamp(r.available_at)),'expectation_protocol.earliest_not_after_observed_usable_returns');
 need(stages.size===3,'real_early_middle_late_coverage');need(m.final_fraction_is_scoring_label_only===true&&m.predictor_inputs==='captured_originals_and_frozen_expectations_only','no_final_truth_or_known_completion_in_predictor');
 need(m.scope==='single_race_preflight_national_transfer_separate','national_transfer_separate');
 return finish();
}
module.exports=Object.freeze({inspect});
