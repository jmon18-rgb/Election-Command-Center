'use strict';
// SYNTHETIC test returns only. Never used by collectors or browser production.
const fs=require('node:fs'),zlib=require('node:zlib');
const {collect}=require('./collect_washington_official_results.cjs');
const load=n=>JSON.parse(fs.readFileSync('data/'+n+'.json','utf8'));
async function fixture({stamp='2026-11-04T04:05:00Z',margin=12,zero=false,correction=0}={}){
 const original=JSON.parse(zlib.gunzipSync(fs.readFileSync('data/washington_historical_sources/2026-official-wa03-preclose-sample.json.gz')));
 original.election.asOf=stamp;original.election.publishDate=stamp;
 const baseline=load('washington_house_03_2024_county_baseline_official'),reference=load('washington_house_03_county_fips_reference');
 const n=baseline.counties.reduce((s,c)=>s+c.dem_votes+c.rep_votes,0),d=baseline.counties.reduce((s,c)=>s+c.dem_votes,0),shift=(margin-100*(2*d/n-1))/200;
 const b=original.ballotItemWithBreakdown;
 for(const [i,c] of b.breakdownResults.entries()){
  const h=baseline.counties.find(r=>r.county+' County'===c.locality.name[0].text),total=zero?0:Math.floor((h.dem_votes+h.rep_votes)*.65);
  const D=Math.floor(total*Math.max(.001,Math.min(.999,h.dem_votes/(h.dem_votes+h.rep_votes)+shift)))-(i===0?correction:0),R=total-(D+(i===0?correction:0));
  for(const x of c.ballotOptions)x.voteCount=x.nativeId==='1601892'?D:x.nativeId==='1601893'?R:0;
  c.voteTotal=D+R;
 }
 for(const x of b.summaryResults.ballotOptions)x.voteCount=b.breakdownResults.reduce((s,c)=>s+c.ballotOptions.find(r=>r.nativeId===x.nativeId).voteCount,0);
 b.voteTotal=b.summaryResults.ballotOptions.reduce((s,x)=>s+x.voteCount,0);
 const overview=original.ballotItems.find(r=>r.id===b.id);overview.voteTotal=b.voteTotal;overview.summaryResults=structuredClone(b.summaryResults);
 return collect({reference,now:Date.parse(stamp)+1000,fetchImpl:async()=>new Response(JSON.stringify(original),{headers:{'content-type':'application/json'}})});
}
module.exports={fixture,load};
