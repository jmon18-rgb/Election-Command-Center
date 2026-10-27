// SYNTHETIC counts and release scenarios, never historical reporting chronology.
const fs=require('node:fs'),path=require('node:path');
const load=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/'+n+'.json'),'utf8'));
function fixture({stamp='2026-11-04T03:05:00Z',swing=12,zero=false,round=1}={}){
 const h=load('ohio_senate_2024_county_baseline_official');
 const candidates=load('ohio_senate_source_assessment').provider.candidate_contract.map(
  c=>({name:c.name,party:c.party,candidate_id:c.native_id,votes:0}));
 const region_results=Object.fromEntries(h.counties.map(c=>{
  const n=zero?0:Math.floor((c.dem_votes+c.rep_votes)*.6),share=c.dem_votes/(c.dem_votes+c.rep_votes)+swing/200;
  const d=Math.round(n*Math.max(.001,Math.min(.999,share)));
  const rows=candidates.map((person,i)=>{const votes=zero?0:i===0?d:i===3?n-d:i;
   candidates[i].votes+=votes;return {...person,votes};});
  return [c.fips,{name:c.county,type:'County',fips:c.fips,candidates:rows}];
 }));
 return {country:'US',province:'OH',district:null,municipality:null,election_scope:'General',
  election_type:'US Senate',election_name:'Ohio US Senate Special General',
  election_date:'2026-11-03T05:00:00Z',test_data:false,round,last_updated:stamp,candidates,region_results};
}
function envelope(swing=12,now=Date.parse('2026-11-04T03:06:00Z')){
 const h=load('ohio_senate_2024_county_baseline_official'),reference=load('ohio_county_fips_reference');
 return {reference,baseline_year:2024,baseline:{counties:h.counties.map(c=>({county:c.county,records:{total:c}}))},
  snapshot:require('./ohio_civic_county_source.js').parse(fixture({swing}),reference,{now})};
}
module.exports={load,fixture,envelope};
