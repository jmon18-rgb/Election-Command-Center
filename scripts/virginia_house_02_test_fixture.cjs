// SYNTHETIC partial counts over a preserved official zero template; no release chronology implied.
const fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path');
const load=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/'+n+'.json'),'utf8'));
const original=()=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../data/virginia_house_02_sources/2026-official-zero-response.json.gz'))));
function fixture({stamp='2026-11-04T03:05:00Z',swing=12,zero=false,laterRound=false}={}){
 const raw=original(),h=load('virginia_house_02_2024_county_baseline_official'),b=raw.ballotItemWithBreakdown;
 raw.election.asOf=raw.election.lastUpdated=raw.election.publishDate=stamp;b.reportingStatus.asOf=stamp;
 if(laterRound)b.rankedChoiceSummaryResults={unexpected:true};
 for(const row of b.breakdownResults){
  row.precinctReportingStatus.asOf=stamp;
  const c=h.counties.find(c=>c.county_fips==='51'+row.locality.mapFeatureId.padStart(3,'0'));
  const n=zero?0:Math.floor((c.dem_votes+c.rep_votes)*.6),d=Math.round(n*Math.max(.001,Math.min(.999,c.dem_votes/(c.dem_votes+c.rep_votes)+swing/200)));
  row.voteTotal=n;
  for(const candidate of row.ballotOptions){
   const votes=candidate.nativeId==='cs268'?d:candidate.nativeId==='cs269'?n-d:0;candidate.voteCount=votes;
   let remaining=votes;candidate.groupResults.forEach((g,i)=>{g.voteCount=i===4?remaining:Math.floor(votes*.2);remaining-=g.voteCount;});
  }
 }
 for(const c of b.summaryResults.ballotOptions){
  c.voteCount=b.breakdownResults.reduce((n,r)=>n+r.ballotOptions.find(x=>x.nativeId===c.nativeId).voteCount,0);
  for(const g of c.groupResults)g.voteCount=b.breakdownResults.reduce((n,r)=>n+r.ballotOptions.find(x=>x.nativeId===c.nativeId).groupResults.find(x=>x.groupId===g.groupId).voteCount,0);
 }
 b.voteTotal=b.breakdownResults.reduce((n,r)=>n+r.voteTotal,0);
 const overview=raw.ballotItems.find(x=>x.id===b.id);overview.summaryResults=structuredClone(b.summaryResults);overview.voteTotal=b.voteTotal;
 return raw;
}
function envelope(swing=12,now=Date.parse('2026-11-04T03:06:00Z')){
 const h=load('virginia_house_02_2024_county_baseline_official'),reference=load('virginia_house_02_county_fips_reference');
 return {reference,baseline_year:2024,baseline:{race_code:'VA-02',geography_scope:'district_parts',counties:h.counties.map(c=>({county:c.county,records:{total:c}}))},snapshot:require('./virginia_official_house_source.js').parse(fixture({swing}),reference,{now})};
}
function cacheFixture(options={}){const original=fixture(options),raw={jurisdiction:Object.fromEntries(['id','shortName'].map(k=>[k,original.jurisdiction[k]])),election:Object.fromEntries(['id','name','electionDate','isPrimary','isProduction','isOfficialResults','asOf','lastUpdated','publishDate'].map(k=>[k,original.election[k]])),ballotItems:original.ballotItems.filter(x=>x.id===original.ballotItemWithBreakdown.id),ballotItemWithBreakdown:original.ballotItemWithBreakdown},stamp=raw.election.asOf;return {schema:'official-va02-collection-v1',source_url:require('./virginia_official_house_source.js').URL,fetched_at:stamp,status:options.zero?'NO_REPORTED_VOTES':'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',http_status:200,source_test_data:false,payload:raw,selected_payload_sha256:require('node:crypto').createHash('sha256').update(JSON.stringify(raw)).digest('hex'),snapshot_updated_at:stamp,source_published_at:stamp,may_move_national_needle:false};}
module.exports={load,original,fixture,envelope,cacheFixture};
