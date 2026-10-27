const fs=require('fs'),path=require('path');
const load=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/'+n+'.json'),'utf8'));
function fixture({stamp='2026-11-04T03:05:00Z',swing=12,zero=false,round=1}={}){
 const history=load('maine_senate_2020_county_baseline_official');let d=0,r=0;
 const regions=Object.fromEntries(history.counties.map(c=>{const h=c.records.total,n=zero?0:Math.floor((h.dem_votes+h.rep_votes)*.6),share=h.dem_votes/(h.dem_votes+h.rep_votes)+swing/200;
 const dv=Math.round(n*share),rv=n-dv;d+=dv;r+=rv;return [c.county_fips,{name:c.county,type:'County',fips:c.county_fips,candidates:[{name:'Susan Collins',party:'Republican',votes:rv},{name:'Troy Jackson',party:'Democratic',votes:dv}]}]}));
 regions.nested={type:'Township',name:'Ignored nested town',candidates:[{votes:999999}]};
 return {country:'US',province:'ME',district:null,municipality:null,election_scope:'General',election_type:'US Senate',election_name:'Maine US Senate',election_date:'2026-11-03T05:00:00Z',test_data:false,round,last_updated:stamp,candidates:[{name:'Susan Collins',party:'Republican',candidate_id:220470,votes:r},{name:'Troy Jackson',party:'Democratic',candidate_id:220471,votes:d}],region_results:regions};
}
module.exports={load,fixture};
