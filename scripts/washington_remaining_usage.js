/* Eligibility for already-admitted frozen used cells. This cannot admit an
 * estimate, authenticate a raw body, or create a new count observation. */
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?
 require('./washington_remaining_source.js'):root?.WashingtonRemainingSource);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.WashingtonRemainingUsage=api;
})(typeof window!=='undefined'?window:null,function(source){
 'use strict';
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
 const sameKeys=(x,keys)=>plain(x)&&Object.keys(x).sort().join('|')===[...keys].sort().join('|');
 const ready=()=>Array.isArray(source?.whole)&&Array.isArray(source?.identities)&&typeof source?.countyCurrent==='function';
 const pin=fips=>source.identities.find(row=>row.county_fips===fips);
 const validRow=row=>sameKeys(row,['county_fips','county','estimated_ballots_left','reported_at'])&&
  source.whole.includes(row.county_fips)&&row.county===pin(row.county_fips)?.name&&
  Number.isSafeInteger(row.estimated_ballots_left)&&row.estimated_ballots_left>=0&&row.estimated_ballots_left<=10000000;
 function capture(revision,usedFips,countsStamp){
  try{
   if(!ready()||!sameKeys(revision,['source_url','fetched_at','status','counties'])||revision.source_url!==source.URL||
    revision.status!=='VALIDATED_WHOLE_COUNTY_ESTIMATES'||!Array.isArray(revision.counties)||revision.counties.length>6||
    revision.counties.some(row=>!validRow(row))||new Set(revision.counties.map(row=>row.county_fips)).size!==revision.counties.length||
    !Array.isArray(usedFips)||!usedFips.length||usedFips.length>6||new Set(usedFips).size!==usedFips.length||
    usedFips.some(fips=>!source.whole.includes(fips)))return null;
   const rows=usedFips.map(fips=>revision.counties.find(row=>row.county_fips===fips));if(rows.some(row=>!row))return null;
   return {schema:'already-admitted-wa-used-remaining-v1',source_url:source.URL,fetched_at:revision.fetched_at,
    counts_stamp:countsStamp,used_counties:rows.map(row=>({...row}))};
  }catch{return null;}
 }
 function current(projection,now){
  try{return ready()&&Number.isFinite(now)&&sameKeys(projection,['schema','source_url','fetched_at','counts_stamp','used_counties'])&&
   projection.schema==='already-admitted-wa-used-remaining-v1'&&projection.source_url===source.URL&&
   Array.isArray(projection.used_counties)&&projection.used_counties.length>0&&projection.used_counties.length<=6&&
   new Set(projection.used_counties.map(row=>row.county_fips)).size===projection.used_counties.length&&
   projection.used_counties.every(row=>validRow(row)&&source.countyCurrent(row.reported_at,
    {now,fetched_at:projection.fetched_at,counts_stamp:projection.counts_stamp}));
  }catch{return false;}
 }
 return Object.freeze({capture,current});
});
