/* Fictional rehearsal counts over verified historical geography. Never live inputs. */
(function(root){
 'use strict';
 const specs=[['IA-SEN','iowa',87151,2022],['KS-SEN','kansas',87162,2020],['TX-SEN','texas',87438,2024],['WI-01','wisconsin_house_01',87483,2024],['WI-03','wisconsin_house_03',87485,2024],['MI-04','michigan_house_04',87204,2024],['PA-10','pennsylvania_house_10',87385,2024],['NY-17','new_york_house_17',87319,2024]];
 async function load(fetchJSON){const loaded=await Promise.all(specs.map(async([code,state,id,year])=>{
  const [history,reference]=await Promise.all([fetchJSON('data/'+(state==='iowa'?'iowa_senate_county_modes_official':state==='kansas'?'kansas_senate_county_facts_official':state==='texas'?'texas_senate_2024_county_baseline_official':state+(state==='michigan_house_04'?'_2024_county_baseline_processed':'_2024_county_baseline_official'))+'.json'),fetchJSON('data/'+state+'_county_fips_reference.json')]);
  const rows=state==='iowa'?history.years['2022'].counties:state==='kansas'?history.years['2020'].counties:history.counties;
  const baseline=state==='iowa'?history.years['2022']:{...(/^(?:WI-|MI-04$|PA-10$|NY-17$)/.test(code)?{race_code:code,geography_scope:'district_parts'}:{}),counties:rows.map(c=>({county:c.county,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}}))};
  return {code,id,baseline,reference,baseline_year:year};
 }));
 const [baseline,reference]=await Promise.all([fetchJSON('data/nebraska_senate_2024_candidate_reference.json'),fetchJSON('data/nebraska_county_fips_reference.json')]);
 return loaded.concat({code:'NE-SEN',id:87254,baseline,reference,baseline_year:2024});}
 const total=c=>c.records.total||{dem_votes:c.records.absentee.dem_votes+c.records.election_day.dem_votes,rep_votes:c.records.absentee.rep_votes+c.records.election_day.rep_votes};
 function stage(inputs,step,basis){
  if(step===0||step===4)return [];
  return inputs.map(({code,id,baseline,reference,baseline_year})=>{
   if(code==='NE-SEN'){
    const expected=basis?.senate?.find(r=>r.code===code)?.mean;if(!Number.isFinite(expected))throw Error('Missing current race expectation for rehearsal '+code);
    const all=baseline.counties,baseN=all.reduce((s,c)=>s+c.dan_osborn+c.deb_fischer,0),baseSupport=all.reduce((s,c)=>s+c.dan_osborn,0),shift=(expected+(step===2?3:0)-100*(2*baseSupport/baseN-1))/200;
    const first=new Set([...all].sort((a,b)=>b.dan_osborn/(b.dan_osborn+b.deb_fischer)-a.dan_osborn/(a.dan_osborn+a.deb_fischer)).slice(0,33).map(c=>c.fips));
    const counties=all.map(c=>{const n=step===1&&!first.has(c.fips)?0:Math.floor((c.dan_osborn+c.deb_fischer)*(step===1?.3:.65)),support=Math.round(n*Math.max(.001,Math.min(.999,c.dan_osborn/(c.dan_osborn+c.deb_fischer)+shift)));
     return {county:c.county,county_fips:c.fips,osborn_votes:support,ricketts_votes:n-support,other_votes:0,other_candidates:[220703,220704,220705].map(provider_id=>({provider_id,votes:0}))};});
    return {rehearsal:true,baseline,reference,baseline_year,baseline_scenario:'EXPERIMENTAL_OSBORN_2024_TO_2026_DIFFERENT_SEAT',snapshot:{race_code:code,source_url:'https://civicapi.org/api/v2/race/'+id,status:'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',live_votes_accepted:true,county_identities_matched:93,candidate_contrast:'NE_OSBORN_RICKETTS_V1',contrast_supported:true,caucus_credit_assumed:false,snapshot_updated_at:'2026-11-04T03:'+String(10+step*5)+':00Z',counties}};
   }
   const all=baseline.counties.map(c=>({...c,...total(c)}));
   const baseN=all.reduce((s,c)=>s+c.dem_votes+c.rep_votes,0),baseD=all.reduce((s,c)=>s+c.dem_votes,0);
   const expected=basis?.house?.concat(basis?.senate||[]).find(r=>r.code===code)?.mean;
   if(!Number.isFinite(expected))throw Error('Missing current race expectation for rehearsal '+code);
   // Match the live likelihood's historical-county + current-race swing assumption.
   // A blue county arriving is expected; only step 2 adds an explicit D+3-point
   // performance surprise. These are fictional margins, never county polling.
   const target=expected+(step===2?3:0),shift=(target-100*(2*baseD/baseN-1))/200;
   const blueFirst=new Set([...all].sort((a,b)=>b.dem_votes/(b.dem_votes+b.rep_votes)-a.dem_votes/(a.dem_votes+a.rep_votes)).slice(0,Math.ceil(all.length*.35)).map(c=>c.county));
   const fips=new Map(reference.counties.map(c=>[c.county,c.fips]));
   const counties=all.map(c=>{const n=step===1&&!blueFirst.has(c.county)?0:Math.floor((c.dem_votes+c.rep_votes)*(step===1?.3:.65));
    const d=Math.round(n*Math.max(.001,Math.min(.999,c.dem_votes/(c.dem_votes+c.rep_votes)+shift)));
    return {county:c.county,county_fips:fips.get(c.county),dem_votes:d,rep_votes:n-d,other_votes:0};});
   return {rehearsal:true,baseline,reference,baseline_year,snapshot:{race_code:code,source_url:'https://civicapi.org/api/v2/race/'+id,
    status:'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',live_votes_accepted:true,county_identities_matched:counties.length,
    snapshot_updated_at:'2026-11-04T03:'+String(10+step*5)+':00Z',counties}};
  });
 }
 root.NationalNeedleRehearsal=Object.freeze({load,stage,now:Date.parse('2026-11-04T04:00:00Z'),labels:[
  'Before counting · polling baseline','High-support counties arrive as expected (D / Osborn) · no added performance surprise',
  'Broader returns outperform each race expectation by 3 margin points · fictional counts',
  'Correction removes the added surprise · back to expected county performance',
  'Sources withdrawn · return to the polling baseline']});
})(window);
