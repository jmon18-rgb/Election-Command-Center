/* Fictional rehearsal counts over official historical geography. Never live inputs. */
(function(root){
 'use strict';
 const specs=[['IA-SEN','iowa',87151,2022],['KS-SEN','kansas',87162,2020],['TX-SEN','texas',87438,2024]];
 async function load(fetchJSON){return Promise.all(specs.map(async([code,state,id,year])=>{
  const [history,reference]=await Promise.all([fetchJSON('data/'+(state==='iowa'?'iowa_senate_county_modes_official':state==='kansas'?'kansas_senate_county_facts_official':'texas_senate_2024_county_baseline_official')+'.json'),fetchJSON('data/'+state+'_county_fips_reference.json')]);
  const rows=state==='iowa'?history.years['2022'].counties:state==='kansas'?history.years['2020'].counties:history.counties;
  const baseline=state==='iowa'?history.years['2022']:{counties:rows.map(c=>({county:c.county,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}}))};
  return {code,id,baseline,reference,baseline_year:year};
 }));}
 const total=c=>c.records.total||{dem_votes:c.records.absentee.dem_votes+c.records.election_day.dem_votes,rep_votes:c.records.absentee.rep_votes+c.records.election_day.rep_votes};
 function stage(inputs,step){
  if(step===0||step===4)return [];
  return inputs.map(({code,id,baseline,reference,baseline_year})=>{
   const all=baseline.counties.map(c=>({...c,...total(c)}));
   const baseN=all.reduce((s,c)=>s+c.dem_votes+c.rep_votes,0),baseD=all.reduce((s,c)=>s+c.dem_votes,0);
   const target=step===1?0:step===2?8:2,shift=(target-100*(2*baseD/baseN-1))/200;
   const rural=new Set([...all].sort((a,b)=>a.dem_votes/(a.dem_votes+a.rep_votes)-b.dem_votes/(b.dem_votes+b.rep_votes)).slice(0,Math.ceil(all.length*.35)).map(c=>c.county));
   const fips=new Map(reference.counties.map(c=>[c.county,c.fips]));
   const counties=all.map(c=>{const n=step===1&&!rural.has(c.county)?0:Math.floor((c.dem_votes+c.rep_votes)*(step===1?.3:.65));
    const d=Math.floor(n*Math.max(.001,Math.min(.999,c.dem_votes/(c.dem_votes+c.rep_votes)+shift)));
    return {county:c.county,county_fips:fips.get(c.county),dem_votes:d,rep_votes:n-d,other_votes:0};});
   return {rehearsal:true,baseline,reference,baseline_year,snapshot:{race_code:code,source_url:'https://civicapi.org/api/v2/race/'+id,
    status:'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',live_votes_accepted:true,county_identities_matched:counties.length,
    snapshot_updated_at:'2026-11-04T03:'+String(10+step*5)+':00Z',counties}};
  });
 }
 root.NationalNeedleRehearsal=Object.freeze({load,stage,now:Date.parse('2026-11-04T04:00:00Z'),labels:[
  'Before counting · polling baseline','Rural counties arrive first · fictional counts','Broader returns favor Democrats · fictional counts',
  'Corrected returns reduce the blue signal · fictional counts','Sources withdrawn · return to the polling baseline']});
})(window);
