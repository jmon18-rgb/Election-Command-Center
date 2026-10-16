/* Research-only 2024 election-clock replay. Use ONLY independently licensed,
 * contemporaneous timestamped snapshots, never final 2024 precinct aggregates
 * re-labeled as early returns. No use in production 2026 probability draws.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.HistoricalElectionClockReplay=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const START=Date.parse('2024-11-05T05:00:00Z');
 const END=Date.parse('2024-11-15T05:00:00Z');
 const buckets=[
  {id:'under_10',min:0,max:.10},
  {id:'10_to_25',min:.10,max:.25},
  {id:'25_to_50',min:.25,max:.50},
  {id:'50_to_75',min:.50,max:.75},
  {id:'75_to_95',min:.75,max:.95},
  {id:'95_plus',min:.95,max:1.03}
 ];
 const safeVotes=x=>Number.isSafeInteger(x)&&x>=0;
 const https=u=>typeof u==='string'&&/^https:\/\/[^ \t\r\n]+$/.test(u);
 const fail=reason=>Object.freeze({eligible:false,reason,
  can_revise_2026_forecast:false,geography_reporting_order_calibrated:false});
 const rounded=n=>Math.round(n*100)/100;
 function evaluate(input){
  if(!input||input.election_date!=='2024-11-05'||
    !['house','senate','governor','president'].includes(input.office)||
    !/^[A-Z]{2}-(?:\d{2}|SEN|GOV|PRES)$/.test(input.race_code||''))
   return fail('2024_election_or_race_identity_invalid');
  const source=input.archive_source,final=input.certified_final;
  if(!source||source.kind!=='archived_contemporaneous_results'||
   source.verified_capture_provenance!==true||
   source.rights_cleared_for_internal_research!==true||
   !https(source.url)||!https(source.capture_method_url)||
   !final||final.year!==2024||final.certified!==true||
   !https(final.official_source_url))
   return fail('original_capture_or_certification_not_verified');
  if(!safeVotes(final.dem_votes)||!safeVotes(final.rep_votes)||
     final.dem_votes+final.rep_votes<1000)
   return fail('certified_major_party_total_invalid');
  const records=input.snapshots;
  if(!Array.isArray(records)||records.length<4||records.length>30000)
   return fail('insufficient_or_unbounded_true_clock_snapshots');
  const certifiedTwo=final.dem_votes+final.rep_votes;
  const certifiedMargin=100*(final.dem_votes-final.rep_votes)/certifiedTwo;
  let earlier=0,priorTotal=0,corrections=0,changes=0,lastLeader=null,
   earlyCount=0,lateCount=0;
  const rows=[],groups=new Map(buckets.map(b=>[b.id,[]]));
  for(const x of records){
   if(!x||x.election_date!=='2024-11-05'||
      x.race_code!==input.race_code||x.office!==input.office||
      !safeVotes(x.dem_votes)||!safeVotes(x.rep_votes))
    return fail('archive_snapshot_race_or_vote_mismatch');
   const at=Date.parse(x.as_of||'');
   if(!Number.isFinite(at)||at<START||at>END||at<=earlier)
    return fail('nonchronological_or_wrong_cycle_snapshot');
   earlier=at;
   const total=x.dem_votes+x.rep_votes;
   if(total<1||total>certifiedTwo*1.03||
      x.dem_votes>final.dem_votes*1.05||
      x.rep_votes>final.rep_votes*1.05)
    return fail('snapshot_exceeds_verified_final_major_party_counts');
   if(total<priorTotal)corrections++;
   priorTotal=total;
   const fraction=total/certifiedTwo;
   const margin=100*(x.dem_votes-x.rep_votes)/total;
   const winner=x.dem_votes>x.rep_votes?'D':
    x.dem_votes<x.rep_votes?'R':'TIE';
   if(lastLeader&&winner!=='TIE'&&lastLeader!==winner)changes++;
   if(winner!=='TIE')lastLeader=winner;
   if(fraction<.5)earlyCount++;
   if(fraction>=.95)lateCount++;
   const entry=Object.freeze({as_of:x.as_of,
    observed_two_party_ballots:total,
    historical_final_fraction:rounded(fraction),
    observed_dem_minus_rep_points:rounded(margin),
    final_dem_minus_rep_points:rounded(certifiedMargin),
    absolute_margin_error_points:rounded(Math.abs(margin-certifiedMargin)),
    observed_leader:winner,
    ballot_progress_basis:'fraction_of_later_certified_two_party_votes_NOT_precincts'
   });
   rows.push(entry);
   const bin=buckets.find(b=>fraction>=b.min&&fraction<b.max);
   if(!bin)return fail('snapshot_progress_unclassifiable');
   groups.get(bin.id).push(entry);
  }
  const distinctProgress=new Set(rows.map(x=>Math.floor(x.historical_final_fraction*20))).size;
  // A single final-result file stamped four different times is NOT an
  // election-night replay; reject it even if the timestamps appear valid.
  if(distinctProgress<3||earlyCount===0||lateCount===0)
   return fail('not_a_useful_election_clock_reporting_sequence');
  const perStage=buckets.map(b=>{
   const r=groups.get(b.id);
   return Object.freeze({stage:b.id,n:r.length,
    mean_absolute_margin_error_points:r.length?
     rounded(r.reduce((a,x)=>a+x.absolute_margin_error_points,0)/r.length):null});
  });
  const elapsed=(Date.parse(rows[rows.length-1].as_of)-Date.parse(rows[0].as_of))/60000;
  return Object.freeze({
   eligible:true,
   status:'2024_HISTORICAL_SINGLE_RACE_REPORTING_ORDER_REPLAY_ONLY',
   office:input.office,race_code:input.race_code,
   source_name:source.name||'verified archived capture',
   source_url:source.url,
   certified_reference_url:final.official_source_url,
   first_snapshot:rows[0].as_of,last_snapshot:rows[rows.length-1].as_of,
   elapsed_minutes:rounded(elapsed),
   snapshots:rows.length,upward_or_equal_steps:rows.length-1-corrections,
   downward_vote_corrections:corrections,observed_leader_changes:changes,
   history_snapshot_errors:perStage,
   raw_replay_snapshots:rows,
   can_revise_2026_forecast:false,
   geography_reporting_order_calibrated:false,
   future_work:'Independent verified 2024 county/mode histories and cross-cycle model calibration required; one race is not a national needle.'
  });
 }
 return Object.freeze({START,END,evaluate});
});
