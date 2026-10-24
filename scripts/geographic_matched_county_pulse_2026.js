/* Race-local matched-county Election Night comparison. NOT a national needle.
 * Compare current and historical margins across the SAME observed counties.
 * This avoids weighting small counties equally or treating missing counties
 * as zero. Incomplete geography CANNOT establish statewide turnout/swing.
 */
(function(root,factory){
 const api=factory(
  typeof module!=='undefined'&&module.exports?
   require('./geographic_returns_2026.js'):root?.GeographicReturns2026,
  typeof module!=='undefined'&&module.exports?
   require('./county_swing_2026.js'):root?.CountySwing2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.GeographicMatchedCountyPulse2026=api;
})(typeof window!=='undefined'?window:null,function(returns,swing){
 'use strict';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const whole=x=>Number.isSafeInteger(x)&&x>=0;
 // The county source validator blocks pre-close timestamps but is not
 // clock-aware. Positive reports must ALSO wait until the viewer clock
 // passes local poll closing; a future-stamped result is not live evidence.
 function localVoteClockAllowed(row,now){
  if(!row||row.ballots_reported===0)return true;
  const closes=typeof window!=='undefined'?
   window.ElectionNightPollClosings2026:
   typeof require==='function'?require('./election_night_poll_closings_2026.js'):null;
  return Boolean(closes&&typeof closes.allowed==='function'&&
   closes.allowed(row.race_key,row.ballots_reported,row.updated_at,now));
 }
 const NOMODEL=Object.freeze({may_move_national_needle:false,
  may_infer_statewide_swing:false,may_call_races:false,
  calibrated_probability:false});
 function summarize(rows,baselines,raceKey,now=Date.now()){
  if(!returns||!swing||!rows||typeof rows!=='object'||
     Array.isArray(rows)||!baselines||typeof baselines!=='object'||
     Array.isArray(baselines)||typeof raceKey!=='string'||
     !/^[A-Z]{2}-(?:SEN|GOV|\d{2})$/.test(raceKey)||
     !Number.isFinite(now))return {status:'INVALID_INPUT',...NOMODEL};
  const prefix=raceKey+'|',ids=Object.keys(rows).filter(k=>k.startsWith(prefix)).sort();
  if(ids.length>2000)return {status:'OVERSIZED_COUNTY_SAMPLE',...NOMODEL};
  let observed=0,matched=0,missingBaseline=0,rejected=0;
  let liveD=0,liveR=0,oldD=0,oldR=0,other=0;
  let reference=null,latest=-Infinity,providers=new Set();
  for(const id of ids){
   const row=rows[id];
   if(!row||id!==row.race_key+'|'+row.county_id||
      row.race_key!==raceKey||!returns.validate(row)){
    rejected++;continue;
   }
   const when=Date.parse(row.updated_at||'');
   // Enforce both local poll closure and source publication clock.
   // A trusted source carrying a plausible future time is not a real
   // observed vote before this race's first polls have closed.
   if(!Number.isFinite(when)||when>now+15*60000||
      now-when>180*60000||!localVoteClockAllowed(row,now)){
    rejected++;continue;
   }
   observed++;
   const baseline=own(baselines,id)?baselines[id]:null;
   const comparison=swing.calculate(row,baseline);
   if(!comparison){missingBaseline++;continue;}
   const major={D:null,R:null};
   for(const c of row.candidates){
    if(c.party==='D'||c.party==='R')major[c.party]=c.votes;
   }
   const old=baseline.votes;
   const additions=[major.D,major.R,old.D,old.R,comparison.other_party_votes];
   if(additions.some(v=>!whole(v))||
      ![liveD+major.D,liveR+major.R,oldD+old.D,oldR+old.R,
       other+comparison.other_party_votes].every(Number.isSafeInteger)){
    rejected++;missingBaseline++;continue;
   }
   const origin=row.provider+'|'+row.provider_race_id;
   if(reference!==null&&origin!==reference)
    providers.add(origin);
   if(reference===null)reference=origin;
   matched++;
   latest=Math.max(latest,when);
   liveD+=major.D;liveR+=major.R;
   oldD+=old.D;oldR+=old.R;other+=comparison.other_party_votes;
  }
  // Multiple independent county providers could overlap or use incompatible
  // candidate identities. Never blend their totals into a fabricated swing.
  const mixed=providers.size>0;
  const liveTotal=liveD+liveR,oldTotal=oldD+oldR;
  const safe=!mixed&&matched>=2&&liveTotal>0&&oldTotal>0&&
   [liveTotal,oldTotal,other].every(Number.isSafeInteger);
  const margin=total=>total===0?null:100*(liveD-liveR)/total;
  const oldMargin=oldTotal?100*(oldD-oldR)/oldTotal:null;
  const liveMargin=safe?margin(liveTotal):null;
  return Object.freeze({
   schema:'matched-county-race-swing-advisory-v1',race_key:raceKey,
   status:mixed?'MIXED_PROVIDER_PROVENANCE':
    rejected?'REJECTED_INVALID_COUNTY_OBSERVATIONS':
    safe?'MATCHED_COUNTIES_DESCRIPTIVE_ONLY':'INSUFFICIENT_MATCHED_COUNTIES',
   observed_counties:observed,matched_counties:matched,
   missing_comparable_baseline:missingBaseline,rejected_observations:rejected,
   source_county_records:ids.length,
   // No total-county, expected-ballot or precinct denominator exists here.
   // This is NEVER claimed to measure percent statewide vote reporting.
   reporting_percent:null,estimated_votes_remaining:null,
   matched_2026_two_party_votes:safe?liveTotal:null,
   matched_2024_two_party_votes:safe?oldTotal:null,
   matched_2026_other_party_votes:safe?other:null,
   matched_2026_margin_points:liveMargin,
   matched_2024_margin_points:safe?oldMargin:null,
   matched_county_swing_points:safe?liveMargin-oldMargin:null,
   most_recent_source_at:safe?new Date(latest).toISOString():null,
   ...NOMODEL
  });
 }
 return Object.freeze({summarize});
});
