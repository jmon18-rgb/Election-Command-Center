/* A display-only warning about connected-county matched performance. This never
 * estimates a winner, chamber outcome, probability or national model update. */
(function(root,factory){
 const node=typeof module!=='undefined'&&module.exports;
 const api=factory(node?require('./election_night_indicator_status.js'):root?.ElectionNightIndicatorStatus);
 if(node)module.exports=api;if(root)root.ElectionNightPoopMeter=api;
})(typeof window!=='undefined'?window:null,function(INDICATORS){
 'use strict';
 const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const VERSION='election-night-poop-meter-v1';
 const TITLE='Poop Meter · connected-county performance against expectations';
 const STAGES=freeze([
  {stage:'CLEAN_UNDIES',index:0,label:'Clean undies'},
  {stage:'SKID_MARKS',index:1,label:'Skid marks'},
  {stage:'TURTLING',index:2,label:'Turtling'},
  {stage:'FULL_BLOWN_SHIT',index:3,label:'Full-blown shit'}
 ]);
 const UNRATED=freeze({stage:'UNRATED',index:null,label:'Waiting for usable returns'});
 const rules=freeze({editorial:true,calibrated:false,minimum_distinct_matched_states:2,
  noticeable_margin_points:INDICATORS?.policy?.noticeable_margin_points??null,
  strong_margin_points:INDICATORS?.policy?.strong_margin_points??null,
  minimum_matched_two_party_votes:INDICATORS?.policy?.minimum_matched_two_party_votes??null,
  minimum_reporting_units:INDICATORS?.policy?.minimum_reporting_units??null,
  minimum_historical_reference_fraction:INDICATORS?.policy?.minimum_historical_reference_fraction??null,
  source:'EXISTING_INDICATOR_STATUS_CURRENT_COUNTY_ROWS_ONLY',
  clean_meaning:'No qualified underperformance warning in the covered matched areas; this is not a Democratic-win or majority forecast.',
  scope:'CONNECTED_COUNTY_RELATIVE_PERFORMANCE_NOT_NATIONAL_PROBABILITY',
  canMoveNationalNeedle:false,canTriggerEarnedCelebration:false});
 const watchRecords=Array.isArray(INDICATORS?.records)?INDICATORS.records:[];
 const records=Array.isArray(INDICATORS?.COUNTY_RECORDS)?INDICATORS.COUNTY_RECORDS:[];
 const canonical=new Map(records.map(row=>[row.code,row]));
 const registryValid=records.length>0&&canonical.size===records.length&&records.every(row=>row&&typeof row.code==='string'&&
  row.state===row.code.slice(0,2)&&row.matched_route===true&&typeof row.source_url==='string'&&row.source_url&&
  row.candidate_axis===(row.code==='NE-SEN'?'OSBORN_MINUS_RICKETTS_NOT_D_MINUS_R':'D_MINUS_R'));
 const eligible=records.filter(row=>row.candidate_axis==='D_MINUS_R');
 const finite=value=>typeof value==='number'&&Number.isFinite(value);
 const range=value=>Array.isArray(value)&&value.length===2&&value.every(finite)&&value[0]<=value[1];
 const contexts=new Set(['PUBLIC','LOCAL_RESEARCH_VARIANT']);
 const statuses=new Set(['AWAITING_SOURCE','INACTIVE','WAITING_FOR_POLLS','SOURCE_ERROR',
  'INVALID_MATCHED_EVIDENCE','MATCHED_RECHECK_REQUIRED','PROVISIONAL_MATCHED_OVERPERFORMANCE',
  'MATCHED_WITHIN_METHOD_RANGE','INVALID_SOURCE','RAW_RETURNS_ONLY','MATCHED_INPUTS_PENDING','VALIDATED_CALL']);

 // Key order cannot turn an identical duplicate into a conflicting revision.
 // Invalid or cyclic assessment data cannot be silently discarded to make a
 // negative warning disappear. Acyclic shared references remain valid.
 function signature(value,stack=new Set()){
  if(value===null)return 'null';
  if(typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'){if(!Number.isFinite(value))throw Error('MALFORMED');return JSON.stringify(value);}
  if(typeof value!=='object'||stack.has(value))throw Error('MALFORMED');
  stack.add(value);
  let result;
  if(Array.isArray(value))result='['+value.map(item=>signature(item,stack)).join(',')+']';
  else{if(Object.prototype.toString.call(value)!=='[object Object]')throw Error('MALFORMED');
   result='{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+signature(value[key],stack)).join(',')+'}';}
  stack.delete(value);return result;
 }
 function validRow(row){
  if(!row||row.schema!==INDICATORS?.VERSION||!canonical.has(row.code)||!statuses.has(row.status)||
   row.calibrated!==false||row.canMoveNationalNeedle!==false||row.canTriggerEarnedCelebration!==false||
   typeof row.noticeable!=='boolean'||typeof row.strong!=='boolean'||typeof row.raw_source_unavailable!=='boolean'||
   ![null,'POSITIVE','NEGATIVE'].includes(row.provisional_direction)||![null,'D','R'].includes(row.calledParty)||
   row.strong&&!row.noticeable||row.noticeable!==(row.provisional_direction!==null)||
   row.status==='VALIDATED_CALL'&&row.calledParty===null)return false;
  if(row.matched===null)return !row.noticeable&&!row.strong;
  if(!row.matched||canonical.get(row.code)?.matched_route!==true||!['PROVISIONAL_MATCHED_OVERPERFORMANCE','MATCHED_WITHIN_METHOD_RANGE','VALIDATED_CALL'].includes(row.status)||
   row.matched.calibrated!==false||!['D_MINUS_R','OSBORN_MINUS_RICKETTS_NOT_D_MINUS_R'].includes(row.matched.candidate_axis))return false;
  const m=row.matched,p=INDICATORS.policy;
  // Validate the already-assessed projection against its original policy. This
  // is not a new source admission, clock rule, threshold or performance score.
  if(!Number.isSafeInteger(m.counted_two_party_votes)||m.counted_two_party_votes<p.minimum_matched_two_party_votes||
   !Number.isSafeInteger(m.reporting_units)||m.reporting_units<p.minimum_reporting_units||
   !finite(m.historical_reference_turnout_fraction)||m.historical_reference_turnout_fraction<p.minimum_historical_reference_fraction||
   !finite(m.largest_reporting_area_vote_fraction)||m.largest_reporting_area_vote_fraction<=0||m.largest_reporting_area_vote_fraction>1||
   typeof m.source_at!=='string'||!Number.isFinite(Date.parse(m.source_at))||!/(?:Z|[+-]\d\d:\d\d)$/.test(m.source_at)||
   m.source_url!==canonical.get(row.code).source_url||!Number.isSafeInteger(m.baseline_year)||m.baseline_year<2000||m.baseline_year>=2026||
   !finite(m.expectation_margin_points)||Math.abs(m.expectation_margin_points)>100||
   !finite(m.observed_margin_points)||Math.abs(m.observed_margin_points)>100||
   !range(m.expected_margin_scenarios)||m.expected_margin_scenarios.some(v=>Math.abs(v)>100)||
   !range(m.difference_margin_scenarios)||
   Math.abs(m.difference_margin_scenarios[0]-(m.observed_margin_points-m.expected_margin_scenarios[1]))>1e-7||
   Math.abs(m.difference_margin_scenarios[1]-(m.observed_margin_points-m.expected_margin_scenarios[0]))>1e-7||
   typeof m.coverage!=='string'||!m.coverage.startsWith('MATCHED_REPORTING_AREAS_ONLY;')||
   typeof m.uncertainty!=='string'||!m.uncertainty.includes('NOT_CONFIDENCE_INTERVALS'))return false;
  const positive=m.difference_margin_scenarios[0]>=p.noticeable_margin_points,
   negative=m.difference_margin_scenarios[1]<=-p.noticeable_margin_points,
   direction=positive?'POSITIVE':negative?'NEGATIVE':null,
   strong=positive?m.difference_margin_scenarios[0]>=p.strong_margin_points:negative?m.difference_margin_scenarios[1]<=-p.strong_margin_points:false;
  if(row.noticeable!==(positive||negative)||row.provisional_direction!==direction||row.strong!==strong)return false;
  if(row.matched.candidate_axis!==canonical.get(row.code).candidate_axis)return false;
  if(row.status==='PROVISIONAL_MATCHED_OVERPERFORMANCE'&&!row.noticeable)return false;
  if(row.status==='MATCHED_WITHIN_METHOD_RANGE'&&row.noticeable)return false;
  return true;
 }
 const states=rows=>[...new Set(rows.map(row=>row.code.slice(0,2)))].sort();
 function result(stage,reason,reason_code,matched=[]){
  const matched_races=matched.map(row=>row.code).sort(),matched_states=states(matched);
  return freeze({schema:VERSION,...stage,title:TITLE,reason,reason_code,
   matched_races,matched_states,watch_size:watchRecords.length,
   connected_route_count:canonical.size,eligible_route_count:eligible.length,
   source_scope:'EXISTING_ADMITTED_COUNTY_ROUTE_COHORT',
   coverage:{available_watch_races:watchRecords.length,connected_routes:canonical.size,d_vs_r_eligible_routes:eligible.length,matched_races:matched_races.length,matched_states:matched_states.length},
   coverage_scope:'MATCHED_REPORTING_AREAS_IN_CONNECTED_COUNTY_ROUTES_ONLY',editorial:true,
   calibrated:false,canMoveNationalNeedle:false,canTriggerEarnedCelebration:false});
 }
 function rate(view){
  if(!INDICATORS||!registryValid)return result(UNRATED,'The complete connected-county assessment registry is unavailable.','COUNTY_REGISTRY_UNAVAILABLE');
  if(!view||typeof view.active!=='boolean'||typeof view.current!=='boolean')return result(UNRATED,'Current live-view status could not be verified.','INVALID_CURRENTNESS_FLAGS');
  if(!view.active)return result(UNRATED,'The live connected-county assessment is inactive.','INACTIVE');
  if(!view.current)return result(UNRATED,'Waiting for current matched assessments; pending or older calculations cannot set this meter.','NOT_CURRENT');
  if(!contexts.has(view.context))return result(UNRATED,'The connected-county comparison context could not be verified.','UNKNOWN_CONTEXT');
  if(!Array.isArray(view.county_rows))return result(UNRATED,'The complete connected-county assessment cohort is unavailable.','INVALID_COUNTY_ROWS');
  const unique=new Map(),signatures=new Map();
  for(const row of view.county_rows){
   let valid=false;try{valid=validRow(row);}catch{}
   if(!valid)return result(UNRATED,'A connected-county assessment is malformed; no warning level is inferred.','MALFORMED_ASSESSED_ROW');
   let value;try{value=signature(row);}catch{return result(UNRATED,'A connected-county assessment is malformed; no warning level is inferred.','MALFORMED_ASSESSED_ROW');}
   if(signatures.has(row.code)&&signatures.get(row.code)!==value)return result(UNRATED,'Conflicting revisions for the same race need a current reassessment.','CONFLICTING_DUPLICATES');
   signatures.set(row.code,value);unique.set(row.code,row);
  }
  if(unique.size!==canonical.size)return result(UNRATED,'The connected-county assessment cohort is incomplete; missing routes cannot be treated as favorable returns.','INCOMPLETE_COUNTY_COHORT');
  const matched=[...unique.values()].filter(row=>row.matched?.candidate_axis==='D_MINUS_R'&&
   ['PROVISIONAL_MATCHED_OVERPERFORMANCE','MATCHED_WITHIN_METHOD_RANGE','VALIDATED_CALL'].includes(row.status));
  if(states(matched).length<2)return result(UNRATED,'Need current matched comparisons from at least two distinct states. Raw returns and calls alone do not qualify.','INSUFFICIENT_MATCHED_STATES',matched);
  // Direction and strength were already assessed against every supplied method
  // scenario by IndicatorStatus. No raw lead, prior, odds or second threshold
  // calculation supplies a vote to this presentation rule.
  const positive=matched.filter(row=>row.noticeable&&row.provisional_direction==='POSITIVE');
  const negative=matched.filter(row=>row.noticeable&&row.provisional_direction==='NEGATIVE');
  const negativeStates=states(negative),strongNegativeStates=states(negative.filter(row=>row.strong));
  if(!negative.length)return result(STAGES[0],'At least two states have current matched comparisons, with no qualified underperformance warning in their covered areas. This does not imply a Democratic win.','NO_QUALIFIED_UNDERPERFORMANCE',matched);
  if(positive.length||negativeStates.length===1)return result(STAGES[1],positive.length?
   'Qualified positive and negative local comparisons are mixed across the connected county routes.':'Qualified underperformance is present in one covered state; other covered states do not yet form the broader warning pattern.',
   positive.length?'MIXED_QUALIFIED_DIRECTIONS':'ONE_NEGATIVE_STATE',matched);
  if(strongNegativeStates.length>=3)return result(STAGES[3],'At least three distinct states have strong qualified underperformance across every supplied method scenario, with no qualified positive comparison. This is a connected-county warning, not national odds.','THREE_STRONG_NEGATIVE_STATES',matched);
  return result(STAGES[2],'At least two distinct states have qualified underperformance across every supplied method scenario, with no qualified positive comparison.','TWO_NEGATIVE_STATES',matched);
 }
 return freeze({VERSION,TITLE,STAGES,UNRATED,rules,rate});
});
