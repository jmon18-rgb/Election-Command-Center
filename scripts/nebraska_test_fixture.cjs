// SYNTHETIC only. No native request, real vote delivery or chronology.
const fs=require('node:fs'),path=require('node:path');
const load=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/'+n+'.json'),'utf8'));
function fixture({stamp='2026-11-04T04:05:00Z',swing=12,expectedMargin=null,zero=false,blueFirst=false,round=1}={}){
 const h=load('nebraska_senate_2024_candidate_reference'),ref=load('nebraska_county_fips_reference'),base=100*(2*h.totals.dan_osborn/h.totals.two_named_candidates-1),shift=((expectedMargin??base)+swing-base)/200;
 const selected=new Set([...h.counties].sort((a,b)=>b.dan_osborn/(b.dan_osborn+b.deb_fischer)-a.dan_osborn/(a.dan_osborn+a.deb_fischer)).slice(0,33).map(c=>c.fips));
 const candidates=load('nebraska_senate_source_contract').candidates.map(c=>({name:c.name,party:c.party,candidate_id:c.provider_id,votes:0}));
 const region_results=Object.fromEntries(h.counties.map(c=>{const r=ref.counties.find(r=>r.fips===c.fips),n=zero||(blueFirst&&!selected.has(c.fips))?0:Math.floor((c.dan_osborn+c.deb_fischer)*.6),support=Math.round(n*Math.max(.001,Math.min(.999,c.dan_osborn/(c.dan_osborn+c.deb_fischer)+shift)));
  const rows=candidates.map((p,i)=>{const votes=!n?0:p.candidate_id===220706?support:p.candidate_id===220702?n-support:i;candidates[i].votes+=votes;return {...p,votes};});
  return [r.native_key,{name:r.native_name,type:'County',fips:r.fips,candidates:rows}];
 }));
 return {country:'US',province:'NE',district:null,municipality:null,election_scope:'General',election_type:'US Senate',election_name:'Nebraska US Senate',election_date:'2026-11-03T05:00:00.000Z',test_data:false,round,last_updated:stamp,candidates,region_results};
}
function envelope(swing=12,now=Date.parse('2026-11-04T04:06:00Z'),extra={}){
 const baseline=load('nebraska_senate_2024_candidate_reference'),reference=load('nebraska_county_fips_reference');
 return {baseline_year:2024,baseline_scenario:'EXPERIMENTAL_OSBORN_2024_TO_2026_DIFFERENT_SEAT',baseline,reference,snapshot:require('./nebraska_civic_county_source.js').parse(fixture({swing,...extra}),reference,{now})};
}
module.exports={load,fixture,envelope};
