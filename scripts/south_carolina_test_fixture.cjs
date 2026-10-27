// SYNTHETIC counts only. Never reporting chronology, actual votes or calibrated expectations.
const fs=require('node:fs'),path=require('node:path');
const load=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/'+n+'.json'),'utf8'));
function fixture({stamp='2026-11-04T03:05:00Z',swing=12,zero=false,round=1}={}){
 const history=load('south_carolina_senate_2020_county_baseline_official'),ref=load('south_carolina_county_fips_reference');
 const candidates=load('south_carolina_senate_source_contract').candidates.map(c=>({name:c.name,party:c.party,candidate_id:c.provider_id,votes:0}));
 const region_results=Object.fromEntries(history.counties.map(c=>{
  const r=ref.counties.find(r=>r.fips===c.fips),n=zero?0:Math.floor((c.dem_votes+c.rep_votes)*.6),d=Math.round(n*Math.max(.001,Math.min(.999,c.dem_votes/(c.dem_votes+c.rep_votes)+swing/200)));
  const rows=candidates.map((p,i)=>{const votes=zero?0:p.party==='Democratic'?d:p.party==='Republican'?n-d:i+1;candidates[i].votes+=votes;return {...p,votes};});
  return [r.native_key,{name:r.native_name,type:'County',...(!r.native_fips_optional?{fips:r.fips}:{}),candidates:rows}];
 }));
 return {country:'US',province:'SC',district:null,municipality:null,election_scope:'General',election_type:'US Senate',election_name:'South Carolina US Senate',election_date:'2026-11-03T05:00:00.000Z',test_data:false,round,last_updated:stamp,candidates,region_results};
}
function envelope(swing=12,now=Date.parse('2026-11-04T03:06:00Z')){
 const h=load('south_carolina_senate_2020_county_baseline_official'),reference=load('south_carolina_county_fips_reference');
 return {reference,baseline_year:2020,baseline:{counties:h.counties.map(c=>({county:c.county,records:{total:c}}))},snapshot:require('./south_carolina_civic_county_source.js').parse(fixture({swing}),reference,{now})};
}
module.exports={load,fixture,envelope};
