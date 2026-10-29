/* One display-only early watch. No source requests, probability adjustment,
 * vote/winner inference, persistence, or earned-celebration eligibility. */
(function(root,factory){const node=typeof module!=='undefined'&&module.exports;
 const api=factory(node?require('./election_night_early_signals.js'):root?.ElectionNightEarlySignals,
  node?require('./house_early_watch_reference.js'):root?.HouseEarlyWatchReference,
  node?require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026);
 if(node)module.exports=api;if(root)root.ElectionNightIndicatorStatus=api;
})(typeof window!=='undefined'?window:null,function(EARLY,WATCH,CLOSES){
 'use strict';
 const VERSION='early-indicator-status-v1',finite=n=>typeof n==='number'&&Number.isFinite(n);
 const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 const policy=freeze({noticeable_margin_points:3,strong_margin_points:5,
  minimum_matched_two_party_votes:10000,minimum_reporting_units:3,
  minimum_historical_reference_fraction:.005,storm_states:2,strong_states:3,
  scope:'EDITORIAL_HEURISTIC_NOT_FITTED_NOT_A_CONFIDENCE_LEVEL',calibrated:false});
 // These are the EXISTING kernel scope identities, not new data adapters.
 const admitted=freeze({'SC-SEN':87409,'MI-07':87207,'PA-08':87383,
  'VA-02':'https://enr.elections.virginia.gov/results/public/api/elections/virginia/2026-November-General/data/ballot-item/01000000-f030-c43d-fd71-08df1fee52e7',
  'AZ-06':86922,'PA-07':87382,'OH-SEN':87527,'ME-SEN':87188,'IA-SEN':87151,
  'KS-SEN':87162,'TX-SEN':87438,'WI-01':87483,'WI-03':87485,'MI-04':87204,
  'PA-10':87385,'NY-17':87319,'NE-SEN':87254,
  'WA-03':'https://results.votewa.gov/results/public/api/elections/washington/20261103/data/ballot-item/54c40000-9064-bbec-4779-08df15c0a82a'});
 const map=new Map();
 for(const e of EARLY?.records||[])map.set(e.code,{code:e.code,office:e.office,
  groups:['EARLY_CLOSINGS'],why:e.why,county_watch:[...(e.counties||[])]});
 for(const w of WATCH?.districts||[]){const row=map.get(w.code)||{code:w.code,office:'House',groups:[],why:'Owner reference watch',county_watch:[]};
  row.groups.push('OWNER_HOUSE_REFERENCE');row.reference={cook:w.cook,flipr:w.flipr,
   rep_win_pct:w.rep_win_pct,margin_side:w.margin_side,margin_points:w.margin_points,
   publisher_as_of:WATCH.publisher_as_of??null,independently_verified:WATCH.independently_verified===true};map.set(w.code,row);}
 map.set('FL-SEN',{code:'FL-SEN',office:'Senate',groups:['OWNER_REQUESTED_EARLY'],
  why:'Owner-requested early Florida Senate special-election comparison',county_watch:[]});
 const records=freeze([...map.values()].map(row=>({...row,state:row.code.slice(0,2),
  key:row.office==='House'?row.code:row.code.slice(0,2)+(['FL-SEN','OH-SEN'].includes(row.code)?'-special':''),
  matched_route: Object.hasOwn(admitted,row.code),
  missing_inputs:Object.hasOwn(admitted,row.code)?[]:[
   'CURRENT_EXACT_RACE_MATCHED_AREA_COUNTS','INDEPENDENT_MATCHED_HISTORICAL_AREA_BASELINE',
   'REVIEWED_2024_TO_2026_AREA_GEOGRAPHY','REPORTING_METHOD_OR_SELECTION_SCENARIOS']
 })).sort((a,b)=>(CLOSES?.floorFor(a.key)||Infinity)-(CLOSES?.floorFor(b.key)||Infinity)||a.code.localeCompare(b.code)));
 const canonical=new Map(records.map(row=>[row.code,row]));
 function timeCurrent(stamp,now,code,total){const at=Date.parse(stamp||'');return typeof stamp==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(stamp)&&
  finite(at)&&at<=now+15*60000&&now-at<=180*60000&&CLOSES?.allowed(code,total,stamp,now)===true;}
 const empty=(code,status,message)=>({schema:VERSION,code,status,message,raw:null,matched:null,
  calledParty:null,raw_source_unavailable:false,provisional_direction:null,noticeable:false,strong:false,
  canMoveNationalNeedle:false,canTriggerEarnedCelebration:false,calibrated:false});
 function rawObservation(code,o,now){
  if(!o)return null;
  if(o.verified!==true||!['Open America','civicAPI'].includes(o.provider)||o.stale===true||
   ![o.d,o.r,o.total].every(Number.isSafeInteger)||o.d<0||o.r<0||o.d+o.r<=0||o.total<o.d+o.r||
   !timeCurrent(o.asOf,now,code,o.total)||o.precincts!=null&&(!finite(o.precincts)||o.precincts<0||o.precincts>100))return false;
  return {provider:o.provider,source_at:o.asOf,counted_votes:o.total,
   counted_two_party_votes:o.d+o.r,raw_margin_points:100*(o.d-o.r)/(o.d+o.r),
   precincts:finite(o.precincts)?o.precincts:null,
   scope:'RAW_PARTIAL_RACE_TOTAL_NOT_MATCHED_PERFORMANCE_NOT_BALLOT_SHARE'};
 }
 function matchedPerformance(code,m,now){
  if(!m)return null;
  const id=admitted[code],expectedURL=typeof id==='number'?'https://civicapi.org/api/v2/race/'+id:id,p=m.matched_performance;
  // The coordinator must supply a row from a CURRENTLY re-admitted kernel
  // input. This structural check does not authenticate arbitrary provider JSON.
  if(!id||m.code!==code||m.schema!=='national-county-likelihood-v1'||
   m.source_url!==expectedURL||m.independence!=='COUNTS_ONLY_NO_POLL_PRIOR_OR_RACE_POSTERIOR'||
   !Number.isSafeInteger(m.counted_two_party_votes)||m.counted_two_party_votes<policy.minimum_matched_two_party_votes||
   !Number.isSafeInteger(m.reporting_counties)||m.reporting_counties<policy.minimum_reporting_units||
   !finite(m.reference_turnout_fraction)||m.reference_turnout_fraction<policy.minimum_historical_reference_fraction||
   !timeCurrent(m.as_of,now,code,m.counted_two_party_votes)||!p||p.calibrated!==false||
   p.expectation_scope!=='PRE_RESULTS_RACE_MEAN_PLUS_DECLARED_SHIFT'||
   !finite(p.expectation_margin_points)||Math.abs(p.expectation_margin_points)>100||
   !finite(p.observed_margin_points)||Math.abs(p.observed_margin_points)>100||
   !Number.isSafeInteger(p.baseline_year)||p.baseline_year>=2026||p.baseline_year<2000||
   p.reporting_units!==m.reporting_counties||typeof p.scope!=='string'||
   !p.scope.startsWith('Matched reporting areas only;')||
   ['expected_margin_scenarios','difference_margin_scenarios'].some(key=>!Array.isArray(p[key])||p[key].length!==2||p[key].some(v=>!finite(v))||p[key][0]>p[key][1])||
   p.expected_margin_scenarios.some(v=>Math.abs(v)>100)||
   Math.abs(p.difference_margin_scenarios[0]-(p.observed_margin_points-p.expected_margin_scenarios[1]))>1e-7||
   Math.abs(p.difference_margin_scenarios[1]-(p.observed_margin_points-p.expected_margin_scenarios[0]))>1e-7||
   !Array.isArray(p.largest_reporting_units)||p.largest_reporting_units.length<1||p.largest_reporting_units.length>6)return false;
  if(code==='NE-SEN'&&(m.candidate_contrast!=='NE_OSBORN_RICKETTS_V1'||p.candidate_contrast!=='NE_OSBORN_RICKETTS_V1'))return false;
  const units=p.largest_reporting_units,ids=new Set();let subtotal=0;
  for(const u of units){if(typeof u.county!=='string'||!u.county||!/^\d{5}$/.test(u.county_fips||'')||ids.has(u.county_fips)||
    !Number.isSafeInteger(u.counted_two_party_votes)||u.counted_two_party_votes<=0)return false;
   ids.add(u.county_fips);subtotal+=u.counted_two_party_votes;}
  if(subtotal>m.counted_two_party_votes||units.length>m.reporting_counties)return false;
  return {source_at:m.as_of,source_url:m.source_url,counted_two_party_votes:m.counted_two_party_votes,
   reporting_units:m.reporting_counties,historical_reference_turnout_fraction:m.reference_turnout_fraction,
   largest_reporting_area_vote_fraction:Math.max(...units.map(u=>u.counted_two_party_votes))/m.counted_two_party_votes,
   baseline_year:p.baseline_year,expectation_margin_points:p.expectation_margin_points,
   observed_margin_points:p.observed_margin_points,expected_margin_scenarios:[...p.expected_margin_scenarios],
   difference_margin_scenarios:[...p.difference_margin_scenarios],
   candidate_axis:code==='NE-SEN'?'OSBORN_MINUS_RICKETTS_NOT_D_MINUS_R':'D_MINUS_R',
   uncertainty:'METHOD_SCENARIOS_NOT_CONFIDENCE_INTERVALS; PARTIAL_BATCH_SELECTION_TURNOUT_SOURCE_ERROR_UNRESOLVED',
   coverage:'MATCHED_REPORTING_AREAS_ONLY; HISTORICAL_REFERENCE_TURNOUT_IS_NOT_PERCENT_BALLOTS_COUNTED',calibrated:false};
 }
 function assess(code,{now=Date.now(),active=true,error=false,observation=null,matched=null,matchedCurrent=false,calledParty=null}={}){
  const record=canonical.get(code);if(!record)return freeze(empty(code,'INVALID','Unknown early-watch race'));
  const out=empty(code,'AWAITING_SOURCE','Waiting for fresh validated returns');
  if(!finite(now)||!active)return freeze({...out,status:'INACTIVE',message:'Live early signals inactive'});
  if(now<(CLOSES?.floorFor(record.key)||Infinity))return freeze({...out,status:'WAITING_FOR_POLLS',message:'Waiting for the existing local poll-close gate'});
  // Required coordinator assertion: accepted CURRENT frame, not pending or
  // ASOF, with existing source admission rechecked at NOW and its native
  // clock/input/basis/options/revision/context bound to this exact row.
  // A diagnostic's native clock cannot prove a collector receipt is current.
  const recheckRequired=Boolean(matched)&&matchedCurrent!==true;
  const performance=recheckRequired?null:matchedPerformance(code,matched,now);
  // A broad-provider outage does not revoke a DIFFERENT official count
  // source which the coordinator has independently re-admitted at NOW.
  // This exception never trusts a caller's arbitrary source URL or raw JSON.
  const independentOfficial=(code==='VA-02'||code==='WA-03')&&matchedCurrent===true&&Boolean(performance);
  if(error&&!independentOfficial)return freeze({...out,status:'SOURCE_ERROR',message:'Source unavailable; earlier signals withdrawn'});
  const raw=error?null:rawObservation(code,observation,now);
  out.raw=raw||null;
  out.raw_source_unavailable=Boolean(error);
  // A call is only passed by the existing validated call coordinator. This
  // module cannot derive a call from totals, a scenario, or a model chance.
  if(['D','R'].includes(calledParty)&&!(code==='NE-SEN'&&calledParty==='D'))out.calledParty=calledParty;
  if(matched&&!recheckRequired&&performance===false)return freeze({...out,status:'INVALID_MATCHED_EVIDENCE',message:'Matched evidence is unavailable or inconsistent; no overperformance inference'});
  if(recheckRequired){out.status='MATCHED_RECHECK_REQUIRED';out.message='Matched frame awaiting current source re-admission; no current overperformance inference';}
  else if(performance){out.matched=performance;
   const [lo,hi]=performance.difference_margin_scenarios,positive=lo>=policy.noticeable_margin_points,
    negative=hi<=-policy.noticeable_margin_points;
   out.provisional_direction=positive?'POSITIVE':negative?'NEGATIVE':null;
   out.noticeable=positive||negative;
   out.strong=positive?lo>=policy.strong_margin_points:negative?hi<=-policy.strong_margin_points:false;
   out.status=out.noticeable?'PROVISIONAL_MATCHED_OVERPERFORMANCE':'MATCHED_WITHIN_METHOD_RANGE';
   out.message=out.noticeable?'Provisional local performance across every supplied method scenario; race can remain uncalled':'No noticeable same-direction performance across every supplied method scenario';
  }else if(raw===false){out.status='INVALID_SOURCE';out.message='Raw source counts or clock are invalid; no inferred returns';}
  else if(raw){out.status='RAW_RETURNS_ONLY';out.message='Fresh raw returns; matched-area expectation or method coverage is pending';}
  else if(!record.matched_route){out.status='MATCHED_INPUTS_PENDING';out.message='Matched count, geography, baseline and reporting-method contract pending';}
  if(out.calledParty){out.status='VALIDATED_CALL';out.message='Existing validated source call; matched performance, if available, remains separate';}
  return freeze(out);
 }
 function summarize(rows){
  // Conflicting duplicates fail closed; never pick a favorable revision.
  const unique=new Map(),conflicts=new Set();
  for(const row of Array.isArray(rows)?rows:[]){if(row?.schema!==VERSION||!canonical.has(row.code))continue;
   if(unique.has(row.code)&&JSON.stringify(unique.get(row.code))!==JSON.stringify(row))conflicts.add(row.code);else unique.set(row.code,row);}
  const qualified=[...unique.values()].filter(row=>!conflicts.has(row.code)&&['PROVISIONAL_MATCHED_OVERPERFORMANCE','VALIDATED_CALL'].includes(row.status)&&row.noticeable&&row.matched&&row.matched.candidate_axis==='D_MINUS_R');
  const positive=qualified.filter(row=>row.provisional_direction==='POSITIVE'),negative=qualified.filter(row=>row.provisional_direction==='NEGATIVE');
  const states=items=>[...new Set(items.map(row=>row.code.slice(0,2)))].sort(),d=states(positive),r=states(negative),strong=states(positive.filter(row=>row.strong));
  const stage=d.length&&r.length?'MIXED_LOCAL_SIGNALS':strong.length>=policy.strong_states?'STRONGER_PATTERN':d.length>=policy.storm_states?'STORM_BREWING':d.length?'LOCAL_OVERPERFORMANCE':r.length?'OPPOSING_LOCAL_PERFORMANCE':'AWAITING_MATCHED_SIGNALS';
  return freeze({schema:VERSION,stage,positive_races:positive.map(row=>row.code).sort(),negative_races:negative.map(row=>row.code).sort(),positive_states:d,negative_states:r,strong_positive_states:strong,
   conflicts:[...conflicts].sort(),scope:'PROVISIONAL_EDITORIAL_PATTERN_NOT_NATIONAL_PROBABILITY_OR_RACE_WIN',
   canMoveNationalNeedle:false,canTriggerEarnedCelebration:false,calibrated:false});
 }
 return freeze({VERSION,policy,records,assess,summarize});
});
