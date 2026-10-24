/* Historical two-party geographic comparison, advisory until verified live
 * county observations and a same-boundary baseline are connected. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.CountySwing2026=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 function calculate(observation,baseline){
  if(!observation||!baseline||observation.verified_source!==true||
     observation.is_test!==false||observation.election_date!=='2026-11-03'||
     typeof observation.county_id!=='string'||
     observation.county_id!==baseline.county_id||
     observation.race_key!==baseline.race_key||
     baseline.boundary_version!=='2026'||
     baseline.election_date!=='2024-11-05'||
     baseline.verified_source!==true)return null;
  const candidates=observation.candidates;
  if(!Array.isArray(candidates)||candidates.length<2)return null;
  // Third-party or write-in candidates are legitimate observations, not
  // grounds to discard a verified county swing. Count ALL their votes for
  // arithmetic validation but calculate the explicitly TWO-party D/R swing
  // using only one uniquely identified D and one uniquely identified R.
  if(!Number.isSafeInteger(observation.ballots_reported)||
     observation.ballots_reported<0)return null;
  const n={D:null,R:null},names=new Set();
  let total=0,other=0;
  for(const c of candidates){
   if(!c||typeof c.name!=='string'||!c.name.trim()||
      typeof c.party!=='string'||!c.party.trim()||
      !Number.isSafeInteger(c.votes)||c.votes<0||
      names.has(c.name.trim().toLowerCase()))return null;
   names.add(c.name.trim().toLowerCase());
   total+=c.votes;
   if(!Number.isSafeInteger(total)||total>observation.ballots_reported)
    return null;
   if(c.party==='D'||c.party==='R'){
    if(n[c.party]!==null)return null;
    n[c.party]=c.votes;
   }else other+=c.votes;
  }
  const b=baseline.votes;
  if(!Number.isSafeInteger(n.D)||!Number.isSafeInteger(n.R)||
     !b||!Number.isSafeInteger(b.D)||!Number.isSafeInteger(b.R)||
     b.D<0||b.R<0||!Number.isSafeInteger(b.D+b.R)||
     b.D+b.R===0||!Number.isSafeInteger(n.D+n.R)||
     n.D+n.R===0)return null;
  const currentMargin=(n.D-n.R)/(n.D+n.R);
  const baselineMargin=(b.D-b.R)/(b.D+b.R);
  return Object.freeze({county_id:observation.county_id,race_key:observation.race_key,
   current_margin:currentMargin,baseline_margin:baselineMargin,
   swing:currentMargin-baselineMargin,two_party_votes:n.D+n.R,
   other_party_votes:other,reported_ballots:observation.ballots_reported,
   source_updated_at:observation.updated_at,mode:'VERIFIED_COUNTY_SWING_ONLY'});
 }
 return Object.freeze({calculate});
});
