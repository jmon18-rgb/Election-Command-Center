/* Independent, nonpartisan candidate-fundamentals FEATURE EXTRACTION.
 * Never silently converts approval, officeholding or campaign receipts into
 * votes. Explicit experimental assumptions are necessary for a sensitivity.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.JackIncumbencyFeatures=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const VERSION='candidate-fundamentals-staging-v1';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const between=(x,lo,hi)=>finite(x)&&x>=lo&&x<=hi;
 const integer=x=>Number.isSafeInteger(x);
 const limit=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
 function validate(doc){
  if(!doc||doc.schema_version!==VERSION||
     doc.status!=='source_derived_facts_not_calibrated_model'||
     doc.generated_for_election!=='2026-11-03'||
     !Array.isArray(doc.records)||doc.records.length!==506||
     doc.coverage?.house!==435||doc.coverage?.senate!==35||
     doc.coverage?.governor!==36||
     !doc.source_files?.races?.blob_sha||!doc.source_files?.candidates?.blob_sha||
     !doc.source_files?.fundraising?.blob_sha)
   throw Error('Incomplete candidate context provenance');
  const codes=new Set(),map=new Map(),counts={house:0,senate:0,governor:0};
  for(const r of doc.records){
   const code=r?.race_code;
   if(typeof code!=='string'||codes.has(code)||
      !['house','senate','governor'].includes(r.office)||
      r.state!==code.slice(0,2)||!code.match(/^[A-Z]{2}-(?:\d\d|SEN|GOV)$/))
    throw Error('Invalid or duplicate candidate race '+String(code));
   codes.add(code);counts[r.office]++;
   for(const party of ['dem','rep']){
    const c=r[party],sym=party.toUpperCase();
    if(!c||c.party!==sym||typeof c.name!=='string'||!c.name.trim()||
       typeof c.source_candidate_identity_verified!=='boolean'||
       (c.incumbent_supplier_flag!==null&&typeof c.incumbent_supplier_flag!=='boolean')||
       typeof c.incumbent_same_seat_candidate!=='boolean'||
       typeof c.incumbent_identity_conflict!=='boolean'||
       !finite(c.source_total_receipts_usd)||c.source_total_receipts_usd<0||
       !finite(c.source_small_dollar_usd)||c.source_small_dollar_usd<0||
       c.individual_home_state_receipts_usd!==null&&
        (!finite(c.individual_home_state_receipts_usd)||c.individual_home_state_receipts_usd<0)||
       ![true,false,'unknown'].includes(c.first_term)||
       !['elected','appointed','unverified'].includes(c.elected_vs_appointed)||
       (c.incumbent_last_race_overperformance_points!==null&&
        !between(c.incumbent_last_race_overperformance_points,-100,100))||
       (c.verified_old_new_district_overlap_fraction!==null&&
        !between(c.verified_old_new_district_overlap_fraction,0,1)))
     throw Error('Invalid candidate data '+code+' '+party);
    if(c.incumbent_same_seat_candidate &&
       (!c.source_candidate_identity_verified||
        !c.incumbent_supplier_flag||c.incumbent_identity_conflict||
        r.source_incumbent_party!==sym))
     throw Error('Unsupported incumbency claim '+code+' '+party);
   }
   const incumbent=r.dem.incumbent_same_seat_candidate?'DEM':
     r.rep.incumbent_same_seat_candidate?'REP':null;
   if(r.incumbent_candidate_party!==incumbent||
      r.is_open_seat_no_same_office_incumbent!==(incumbent===null))
    throw Error('Candidate incumbency mismatch '+code);
   if(!Array.isArray(r.administration_links))
    throw Error('Invalid administration links '+code);
   for(const link of r.administration_links){
    const candidate=link.candidate_party==='DEM'?r.dem:
      link.candidate_party==='REP'?r.rep:null;
    if(!candidate||candidate.name!==link.candidate_name||
       typeof link.personal_administration_member!=='boolean'||
       !/^https:\/\//.test(link.source_url||'')||
       link.administration_transfer_coefficient!==null)
     throw Error('Unverified administration link '+code);
   }
   const a=r.executive_approval_context;
   if(a&&(typeof a.person!=='string'||!/^https:\/\//.test(a.source_url||'')||
      !between(a.approve_pct,0,100)||!between(a.disapprove_pct,0,100)||
      !between(a.undecided_pct,0,100)||
      Math.abs(a.approve_pct+a.disapprove_pct+a.undecided_pct-100)>.1||
      !/^\d{4}-\d{2}-\d{2}$/.test(a.poll_end_date)||
      a.sample_population!=='Minnesota likely voters'))
    throw Error('Invalid executive approval evidence '+code);
   map.set(code,r);
  }
  if(counts.house!==435||counts.senate!==35||counts.governor!==36)
   throw Error('Incomplete candidate race universe');
  // Hard safeguards: neither office switch nor party affiliation qualifies
  // as a personal incumbency advantage or a gubernatorial approval transfer.
  const sen=map.get('MN-SEN'),gov=map.get('MN-GOV');
  if(!sen||!gov||sen.dem.name!=='Peggy Flanagan'||
     gov.dem.name!=='Amy Klobuchar'||sen.incumbent_candidate_party!==null||
     gov.incumbent_candidate_party!==null||
     !sen.administration_links.some(x=>x.personal_administration_member&&
      x.candidate_name==='Peggy Flanagan')||
     gov.administration_links.some(x=>x.personal_administration_member))
   throw Error('Invalid MN governor/Senate administration distinction');
  return {map,counts,source_sha:doc.source_files.races.blob_sha};
 }
 function explain(row){
  if(!row)throw Error('Candidate race missing');
  const candidates=['dem','rep'].map(key=>{
   const c=row[key];
   const officeIncumbent=c.incumbent_same_seat_candidate;
   const eligible=officeIncumbent&&c.source_candidate_identity_verified&&
    c.elected_vs_appointed==='elected'&&
    (row.office!=='house'||c.verified_old_new_district_overlap_fraction!==null);
   return {
    party:c.party,name:c.name,
    same_office_incumbent:officeIncumbent,
    personal_incumbency_eligible:eligible,
    incumbency_exclusion_reason:!officeIncumbent?'not_same_seat_incumbent':
     !c.source_candidate_identity_verified?'identity_unverified':
     c.elected_vs_appointed!=='elected'?'appointment_or_election_status_unverified':
     row.office==='house'&&c.verified_old_new_district_overlap_fraction===null?
      'district_overlap_not_verified':null,
    first_term:c.first_term,
    elected_vs_appointed:c.elected_vs_appointed,
    last_race_overperformance_points:c.incumbent_last_race_overperformance_points,
    district_overlap_fraction:c.verified_old_new_district_overlap_fraction,
    public_office_experience:c.state_office_experience,
    individual_home_state_receipts_usd:c.individual_home_state_receipts_usd,
    source_total_receipts_usd:c.source_total_receipts_usd,
    donor_scope:'unverified_individual_home_state_fundraising'
   };
  });
  const approval=row.executive_approval_context;
  return {
   race_code:row.race_code,office:row.office,
   open_seat:row.is_open_seat_no_same_office_incumbent,
   candidates,
   executive_approval:approval?{
    officeholder:approval.person,
    approve_pct:approval.approve_pct,disapprove_pct:approval.disapprove_pct,
    net_approval_points:approval.approve_pct-approval.disapprove_pct,
    population:approval.sample_population,date:approval.poll_end_date,
    source_url:approval.source_url
   }:null,
   administration_links:row.administration_links.map(x=>({
    candidate_name:x.candidate_name,party:x.candidate_party,
    relationship:x.relationship,
    personal_administration_member:x.personal_administration_member,
    source_url:x.source_url,
    coefficient_status:'not_historically_calibrated'
   }))
  };
 }
 // Scenario-only: no default shifts, no statistical validity implied.
 // Expose signed margin contributions to compare assumptions, NOT electoral
 // outcome predictions. A coefficient must be supplied intentionally.
 function sensitivity(row,coefficients={}){
  const permitted=['same_office_incumbent_points',
   'first_term_increment_points','prior_race_residual_weight',
   'administration_approval_transfer_per_net_point'];
  if(!coefficients||typeof coefficients!=='object'||
     Object.keys(coefficients).some(k=>!permitted.includes(k)))
   throw Error('Unsupported sensitivity coefficient');
  for(const [key,value] of Object.entries(coefficients))
   if(!between(value,0,4))
    throw Error('Invalid experimental coefficient '+key);
  const c={same_office_incumbent_points:0,first_term_increment_points:0,
   prior_race_residual_weight:0,
   administration_approval_transfer_per_net_point:0,...coefficients};
  const report=explain(row),components=[],missing=[];
  for(const candidate of report.candidates){
   const sign=candidate.party==='DEM'?1:-1;
   if(!candidate.personal_incumbency_eligible){
    if(candidate.same_office_incumbent)
     missing.push(candidate.name+': '+candidate.incumbency_exclusion_reason);
   }else{
    const overlap=row.office==='house'?candidate.district_overlap_fraction:1;
    const personal=sign*c.same_office_incumbent_points*overlap;
    components.push({candidate:candidate.name,component:'personal_incumbency',
     margin_points:personal,provenance:'experimental_not_fitted'});
    if(candidate.first_term===true)
     components.push({candidate:candidate.name,component:'first_term_addition',
      margin_points:sign*c.first_term_increment_points*overlap,
      provenance:'experimental_not_fitted'});
    if(finite(candidate.last_race_overperformance_points))
     components.push({candidate:candidate.name,component:'prior_competitive_election_residual',
      margin_points:sign*limit(candidate.last_race_overperformance_points,-12,12)*
       c.prior_race_residual_weight,
      provenance:'experimental_not_fitted'});
   }
  }
  for(const link of report.administration_links){
   if(!link.personal_administration_member)continue;
   if(!report.executive_approval){missing.push('administration_approval_missing');continue}
   // This is a HYPOTHETICAL effect from the outgoing executive only on
   // a candidate personally linked to that administration. It must not
   // propagate to all same-party candidates, or be added twice to polls.
   const net=report.executive_approval.net_approval_points;
   const sign=link.party==='DEM'?1:-1;
   components.push({candidate:link.candidate_name,
    component:'outgoing_administration_approval_transfer_hypothesis',
    margin_points:sign*limit(net,-30,30)*c.administration_approval_transfer_per_net_point,
    provenance:'experimental_transfer_coefficient_not_measured'});
  }
  const gross=components.reduce((n,x)=>n+x.margin_points,0);
  return {race_code:row.race_code,
   status:'COUNTERFACTUAL_FEATURE_SENSITIVITY_NOT_ELECTION_FORECAST',
   raw_prior_margin_adjustment_points:Math.round(gross*1000)/1000,
   components,missing_fields:missing,coefficients:c,
   must_apply_before_poll_blend:true,
   warning:'No coefficients are trained; these effects do not belong in headline odds without held-out testing.'};
 }
 return Object.freeze({VERSION,validate,explain,sensitivity});
});
