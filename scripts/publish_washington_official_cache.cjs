'use strict';
// Data-only writer. Never writes or merges the default/code branch.
const fs=require('node:fs');
const {collect,collectRemaining}=require('./collect_washington_official_results.cjs');
const cache=require('./washington_official_cache.js');
const remaining=require('./washington_remaining_source.js'),crypto=require('node:crypto');
const REPO='jmon18-rgb/Election-Command-Center',START=Date.parse('2026-11-04T04:00:00Z'),FAST_END=Date.parse('2026-11-04T17:00:00Z'),END=Date.parse('2026-11-25T08:00:00Z');
const inWindow=now=>Number.isFinite(now)&&now>=START&&now<END;
const healthWindow=now=>Number.isFinite(now)&&now>=Date.parse('2026-10-26T00:00:00Z')&&now<START;
async function publish({request,record,reference,now=Date.now(),healthOnly=false}){
 const parsed=await cache.parse(record,reference,{now});
 if(healthOnly&&inWindow(now))throw Error('Health-only publication cannot interrupt the election stream');
 if(!inWindow(now)&&(!healthOnly||!healthWindow(now)||parsed.live_votes_accepted||record.payload!==null))throw Error('Outside fixed WA publication window; health-only null payload required');
 if(healthOnly){record={...record};delete record.official_remaining;}
 const repo=await request('GET','');
 if(repo.full_name!==REPO||!repo.default_branch||repo.default_branch===cache.BRANCH)throw Error('Default-branch publication forbidden');
 try{await request('GET','/git/ref/heads/'+cache.BRANCH);}catch(e){
  if(e.status!==404)throw e;
  const base=await request('GET','/git/ref/heads/'+encodeURIComponent(repo.default_branch));
  await request('POST','/git/refs',{ref:'refs/heads/'+cache.BRANCH,sha:base.object.sha});
 }
 let previous=null,watermark=null,remainingWatermark={};
 try{previous=await request('GET','/contents/'+cache.PATH+'?ref='+cache.BRANCH);}catch(e){if(e.status!==404)throw e;}
 if(previous?.content){
  let old;try{old=JSON.parse(Buffer.from(previous.content,'base64').toString());}catch{}
  remainingWatermark=healthOnly?{}:old?.remaining_revision_watermark||{};
  if(!healthOnly&&record.official_remaining===undefined&&old?.official_remaining)record={...record,official_remaining:old.official_remaining};
  if(record.official_remaining&&old?.official_remaining&&Date.parse(record.official_remaining.fetched_at)<Date.parse(old.official_remaining.fetched_at))record={...record,official_remaining:{schema:'official-wa-remaining-collection-v1',source_url:remaining.URL,fetched_at:new Date(now).toISOString(),status:'SOURCE_UNAVAILABLE',payload:null,error:'Older remaining receipt rejected'}};
  if(old&&Date.parse(old.fetched_at)>Date.parse(record.fetched_at))throw Error('Late collector cannot overwrite newer receipt');
  if(old?.schema===record.schema&&old.source_url===record.source_url){
   watermark=old.revision_watermark||(old.payload?{as_of:old.snapshot_updated_at,published_at:old.source_published_at}:null);
   if(watermark&&(!Number.isFinite(Date.parse(watermark.as_of))||!Number.isFinite(Date.parse(watermark.published_at))))throw Error('Invalid stored official revision marker');
  }
  if(record.payload&&watermark&&(Date.parse(record.snapshot_updated_at)<Date.parse(watermark.as_of)||Date.parse(record.source_published_at)<Date.parse(watermark.published_at)))
   throw Error('Out-of-order official snapshot cannot replace newer counts or zero withdrawal');
  if(old&&old.status===record.status&&old.selected_payload_sha256===record.selected_payload_sha256&&old.error===record.error&&JSON.stringify(old.official_remaining)===JSON.stringify(record.official_remaining)&&now-Date.parse(old.fetched_at)<5*60000)
   return {changed:false,branch:cache.BRANCH};
 }
 if(record.official_remaining){try{
  const r=record.official_remaining,text=JSON.stringify(r.payload);
  if(text.length>48000||r.payload&&crypto.createHash('sha256').update(text).digest('hex')!==r.selected_payload_sha256)throw Error('Remaining integrity/body limit');
  const reviewed=remaining.parse(r,{now,counts_stamp:record.snapshot_updated_at});
  const next={...remainingWatermark};
  for(const c of reviewed.counties){const old=remainingWatermark[c.county_fips],t=remaining.time(c.reported_at),prior=remaining.time(old?.reported_at);
   if(old&&(!Number.isFinite(prior)||t<prior||t===prior&&c.estimated_ballots_left!==old.estimated_ballots_left))throw Error('Old remaining estimate cannot restore after correction/withdrawal');
   next[c.county_fips]={reported_at:c.reported_at,estimated_ballots_left:c.estimated_ballots_left};
  }
  remainingWatermark=next;
 }catch(error){record={...record,official_remaining:{schema:'official-wa-remaining-collection-v1',source_url:remaining.URL,fetched_at:new Date(now).toISOString(),status:'SOURCE_UNAVAILABLE',payload:null,error:String(error.message).slice(0,240)}};}}
 if(record.payload)watermark={as_of:record.snapshot_updated_at,published_at:record.source_published_at};
 record={...record,revision_watermark:watermark,remaining_revision_watermark:remainingWatermark};
 if(JSON.stringify(record,null,2).length>256000&&record.official_remaining)record={...record,official_remaining:{schema:'official-wa-remaining-collection-v1',source_url:remaining.URL,fetched_at:new Date(now).toISOString(),status:'SOURCE_UNAVAILABLE',payload:null,error:'Supplement excluded to preserve existing cache body bound'}};
 const content=Buffer.from(JSON.stringify(record,null,2)+'\n').toString('base64');
 const result=await request('PUT','/contents/'+cache.PATH,{message:'Refresh official WA-03 source cache',branch:cache.BRANCH,content,...(previous?.sha?{sha:previous.sha}:{})});
 return {changed:true,branch:cache.BRANCH,commit:result.commit.sha};
}
async function main(){
 if(process.argv.includes('--bootstrap')&&healthWindow(Date.now())){console.log('Pre-election source contracts pinned; automatic bootstrap makes no native request');return;}
 const publishing=process.argv.includes('--publish'),healthOnly=process.argv.includes('--health-only')||(process.argv.includes('--bootstrap')&&healthWindow(Date.now()));
 if(healthOnly&&!healthWindow(Date.now()))throw Error('Outside fixed pre-election health-check window');
 const count=process.argv.includes('--loop')&&Date.now()<FAST_END?4:1;
 if(!publishing&&!process.argv.includes('--observe'))throw Error('Choose explicit --observe or --publish');
 if(count>1&&(!publishing||healthOnly))throw Error('Loop restricted to scheduled post-close publication');
 const reference=JSON.parse(fs.readFileSync('data/washington_house_03_county_fips_reference.json','utf8'));
 const request=async(method,suffix,data)=>{
  if(!process.env.GITHUB_TOKEN)throw Error('Repository writer token unavailable');
  const r=await fetch('https://api.github.com/repos/'+REPO+suffix,{method,signal:AbortSignal.timeout(20000),headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28',...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
  if(!r.ok){const error=Error('Repository data request HTTP '+r.status);error.status=r.status;throw error;}return r.json();
 };
 let lastRecord=null;
 for(let i=0;i<count;i++){
  const now=Date.now();if(!inWindow(now)&&!healthOnly){console.log('Outside2026WA post-close collection window; no source request');return;}
  // Replace ONE of the existing four first-night requests, never add a fifth.
  // There is still a >=60s completion floor between every native request.
  const stats=sourceKindForSlot(i,count,lastRecord)==='remaining';
  const record=stats?{...lastRecord,official_remaining:await collectRemaining({now,countsStamp:lastRecord.snapshot_updated_at})}:await collect({reference,now});
  lastRecord=record;
  if(healthOnly){record.status='SOURCE_UNAVAILABLE';record.payload=null;record.error='Pre-election transport health check; no votes admitted';delete record.selected_payload_sha256;}
  const result=publishing?await publish({request,record,reference,now:Date.now(),healthOnly}):{observe_only:true};
  console.log(JSON.stringify({status:record.status,fetched_at:record.fetched_at,source_stamp:record.observed_source_stamp||record.snapshot_updated_at||null,...result,live_delivery:'UNPROVEN_UNTIL_ACTUAL_VALIDATED_POST_CLOSE_COUNTS'}));
  if(i+1<count)await new Promise(resolve=>setTimeout(resolve,60000));
 }
}
function sourceKindForSlot(slot,count,record){return count===4&&slot===1&&record?.status==='VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED'?'remaining':'counts';}
module.exports={publish,inWindow,healthWindow,REPO,sourceKindForSlot,main};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
