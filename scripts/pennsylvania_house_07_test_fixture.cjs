// SYNTHETIC partial-count scenarios; no actual release sequence is implied.
const fs=require('node:fs'),path=require('node:path');
const load=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/'+n+'.json'),'utf8'));
function fixture({stamp='2026-11-04T03:05:00Z',swing=12,zero=false,round=1}={}){
 const h=load('pennsylvania_house_07_2024_county_baseline_official');
 const candidates=[{name:'Bob Brooks',party:'Democratic',candidate_id:221027,votes:0},
  {name:'Ryan Mackenzie',party:'Republican',candidate_id:221028,votes:0}];
 const region_results=Object.fromEntries(h.counties.map(c=>{
  const n=zero?0:Math.floor((c.dem_votes+c.rep_votes)*.6);
  const d=Math.round(n*Math.max(.001,Math.min(.999,c.dem_votes/(c.dem_votes+c.rep_votes)+swing/200)));
  const rows=candidates.map((person,i)=>{const votes=i===0?d:n-d;candidates[i].votes+=votes;return {...person,votes};});
  return [c.county_fips,{name:c.county,type:'County',fips:c.county_fips,candidates:rows}];
 }));
 return {country:'US',province:'PA',district:'PA-07',municipality:null,election_scope:'General',
  election_type:'House of Representatives',election_name:'Pennsylvania US House 7',
  election_date:'2026-11-03T05:00:00Z',test_data:false,round,last_updated:stamp,candidates,region_results};
}
function envelope(swing=12,now=Date.parse('2026-11-04T03:06:00Z')){
 const h=load('pennsylvania_house_07_2024_county_baseline_official'),reference=load('pennsylvania_house_07_county_fips_reference');
 return {reference,baseline_year:2024,baseline:{race_code:'PA-07',geography_scope:'district_parts',counties:h.counties.map(c=>({county:c.county,records:{total:c}}))},
  snapshot:require('./wisconsin_house_county_source.js').forRace('PA-07').parse(fixture({swing}),reference,{now})};
}
module.exports={load,fixture,envelope};
