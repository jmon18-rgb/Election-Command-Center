// Durable ordering metadata for already validated county inputs, never a vote
// source. Cached values are only compared; they never generate a forecast.
(function(root,factory){const api=factory(root,typeof module!=='undefined'&&module.exports?
 require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.CompetitiveSourceRevision=api;
})(typeof window!=='undefined'?window:globalThis,function(root,closes){
 'use strict';
 const scopes={'IA-SEN':{n:99,prefix:'19',id:87151},'KS-SEN':{n:105,prefix:'20',id:87162},'TX-SEN':{n:254,prefix:'48',id:87438},'WI-01':{n:5,prefix:'55',id:87483},'WI-03':{n:19,prefix:'55',id:87485},'MI-04':{n:6,prefix:'26',id:87204},'PA-10':{n:3,prefix:'42',id:87385},'NY-17':{n:4,prefix:'36',id:87319},'WA-03':{n:7,prefix:'53',url:'https://results.votewa.gov/results/public/api/elections/washington/20261103/data/ballot-item/54c40000-9064-bbec-4779-08df15c0a82a'}};
 const schema='competitive-county-source-revision-2026-v1';
 function create(code,{storage,now=()=>Date.now()}={}){
  const scope=Object.hasOwn(scopes,code)?scopes[code]:null;if(!scope)throw Error('Unsupported competitive revision scope');
  const url=scope.url||'https://civicapi.org/api/v2/race/'+scope.id,key='ecc:county-source-revision:2026:'+code+':v1';
  if(storage===undefined){try{storage=root.localStorage;}catch{storage=null;}}
  let memory=null,durable=false;
  function read(){
   try{
    const raw=storage?.getItem(key);if(!raw||raw.length>70000)return null;
    const record=JSON.parse(raw);
    if(record.schema!==schema||record.code!==code||record.source_url!==url||
      !Number.isSafeInteger(record.time)||record.time<=0||
      typeof record.signature!=='string'||!record.signature.length||record.signature.length>65536)return null;
    return record;
   }catch{return null;}
  }
  function accept(parsed){
   const clock=now(),time=Date.parse(parsed?.snapshot_updated_at||'');
   if(!Number.isFinite(clock)||!Number.isFinite(time)||time>clock+15*60000||clock-time>180*60000||
     !/(?:Z|[+-]\d\d:\d\d)$/.test(parsed?.snapshot_updated_at||'')||
     parsed?.source_url!==url||parsed.race_code!==code||parsed.county_identities_matched!==scope.n||
     !['NO_REPORTED_VOTES','VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED'].includes(parsed.status)||
     !Array.isArray(parsed.counties)||parsed.counties.length!==scope.n)
    throw Error('Unvalidated county publication cannot set a source revision');
   const seen=new Set();let total=0;
   const vector=parsed.counties.map(c=>{
    if(typeof c.county_fips!=='string'||!new RegExp('^'+scope.prefix+'\\d{3}$').test(c.county_fips)||seen.has(c.county_fips)||
      ![c.dem_votes,c.rep_votes,c.other_votes].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('Invalid revision county vector');
    seen.add(c.county_fips);total+=c.dem_votes+c.rep_votes+c.other_votes;
    return [c.county_fips,c.dem_votes,c.rep_votes,c.other_votes];
   }).sort((a,b)=>a[0].localeCompare(b[0]));
   if(!Number.isSafeInteger(total)||(total>0)!==parsed.live_votes_accepted||
      (total===0)!==(parsed.status==='NO_REPORTED_VOTES')||!closes?.allowed(code,total,parsed.snapshot_updated_at,clock))
    throw Error('Unvalidated vote publication cannot set a source revision');
   const signature=JSON.stringify(vector);
   if(signature.length>65536)throw Error('Revision vector exceeds bounded storage');
   // A browser-clock rollback must not erase a previously valid publication.
   // Re-read on every observation so a second tab's newer correction also wins.
   for(const previous of [memory,read()]){
    if(previous&&(time<previous.time||time===previous.time&&signature!==previous.signature))
     throw Error('County revision requires a newer publication time');
   }
   memory={schema,code,source_url:url,time,signature};durable=false;
   try{if(storage){storage.setItem(key,JSON.stringify(memory));durable=true;}}catch{}
   return Object.freeze({time,durable});
  }
  return Object.freeze({accept,status:()=>({has_revision:memory!==null,durable}),key});
 }
 return Object.freeze({create});
});
