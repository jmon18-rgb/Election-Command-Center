// SYNTHETIC partial-count scenarios; no actual release sequence is implied.
const fs=require('node:fs'),path=require('node:path');
const load=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/'+n+'.json'),'utf8'));
function fixture({stamp='2026-11-04T03:05:00Z',swing=12,zero=false,round=1}={}){
 const h=load('arizona_house_06_2024_county_baseline_official');
 const candidates=[{name:'JoAnna Mendoza',party:'Democratic',candidate_id:219782,votes:0},
  {name:'Juan Ciscomani',party:'Republican',candidate_id:219783,votes:0},
 {name:'Gary Swing',party:'Green',candidate_id:219784,votes:0},{name:'Jereme Peters',party:'Libertarian',candidate_id:219785,votes:0},{name:'Michael Dorland',party:'Independent',candidate_id:219786,votes:0}];
 const region_results=Object.fromEntries(h.counties.map(c=>{
  const n=zero?0:Math.floor((c.dem_votes+c.rep_votes)*.6);
  const d=Math.round(n*Math.max(.001,Math.min(.999,c.dem_votes/(c.dem_votes+c.rep_votes)+swing/200)));
  const rows=candidates.map((person,i)=>{const votes=i===0?d:i===1?n-d:0;candidates[i].votes+=votes;return {...person,votes};});
  return [c.county_fips,{name:c.county,type:'County',fips:c.county_fips,candidates:rows}];
 }));
 return {country:'US',province:'AZ',district:'AZ-06',municipality:null,election_scope:'General',
  election_type:'House of Representatives',election_name:'Arizona US House 6',
  election_date:'2026-11-03T05:00:00Z',test_data:false,round,last_updated:stamp,candidates,region_results};
}
function envelope(swing=12,now=Date.parse('2026-11-04T03:06:00Z')){
 const h=load('arizona_house_06_2024_county_baseline_official'),reference=load('arizona_house_06_county_fips_reference');
 return {reference,baseline_year:2024,baseline:{race_code:'AZ-06',geography_scope:'district_parts',counties:h.counties.map(c=>({county:c.county,records:{total:c}}))},
  snapshot:require('./wisconsin_house_county_source.js').forRace('AZ-06').parse(fixture({swing}),reference,{now})};
}
module.exports={load,fixture,envelope};
