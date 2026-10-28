'use strict';
// Data-only writer. Never writes or merges the default/code branch.
const fs=require('node:fs');
const nativeArchive=require('./official_native_archive.cjs');
const {collect}=require('./collect_virginia_official_results.cjs');
const cache=require('./virginia_official_cache.js');
const REPO='jmon18-rgb/Election-Command-Center',START=Date.parse('2026-11-04T00:00:00Z'),FAST_END=Date.parse('2026-11-04T17:00:00Z'),END=Date.parse('2026-11-25T08:00:00Z');
const inWindow=now=>Number.isFinite(now)&&now>=START&&now<END;
const healthWindow=now=>Number.isFinite(now)&&now>=Date.parse('2026-10-26T00:00:00Z')&&now<START;
async function publish({request,record,reference,now=Date.now(),healthOnly=false}){
 const parsed=await cache.parse(record,reference,{now});
 if(healthOnly&&inWindow(now))throw Error('Health-only publication cannot interrupt the election stream');
 if(!inWindow(now)&&(!healthOnly||!healthWindow(now)||parsed.live_votes_accepted||record.payload!==null))throw Error('Outside fixed VA publication window; health-only null payload required');
 const repo=await request('GET','');
 if(repo.full_name!==REPO||!repo.default_branch||repo.default_branch===cache.BRANCH)throw Error('Default-branch publication forbidden');
 try{await request('GET','/git/ref/heads/'+cache.BRANCH);}catch(e){
  if(e.status!==404)throw e;
  const base=await request('GET','/git/ref/heads/'+encodeURIComponent(repo.default_branch));
  await request('POST','/git/refs',{ref:'refs/heads/'+cache.BRANCH,sha:base.object.sha});
 }
 let previous=null,watermark=null;
 try{previous=await request('GET','/contents/'+cache.PATH+'?ref='+cache.BRANCH);}catch(e){if(e.status!==404)throw e;}
 if(previous?.content){
  let old;try{old=JSON.parse(Buffer.from(previous.content,'base64').toString());}catch{}
  if(old&&Date.parse(old.fetched_at)>Date.parse(record.fetched_at))throw Error('Late collector cannot overwrite newer receipt');
  if(old?.schema===record.schema&&old.source_url===record.source_url){
   watermark=old.revision_watermark||(old.payload?{as_of:old.snapshot_updated_at,published_at:old.source_published_at}:null);
   if(watermark&&(!Number.isFinite(Date.parse(watermark.as_of))||!Number.isFinite(Date.parse(watermark.published_at))))throw Error('Invalid stored official revision marker');
  }
  if(record.payload&&watermark&&(Date.parse(record.snapshot_updated_at)<Date.parse(watermark.as_of)||Date.parse(record.source_published_at)<Date.parse(watermark.published_at)))
   throw Error('Out-of-order official snapshot cannot replace newer counts or zero withdrawal');
  if(old&&old.status===record.status&&old.selected_payload_sha256===record.selected_payload_sha256&&old.error===record.error&&now-Date.parse(old.fetched_at)<5*60000)
   return {changed:false,branch:cache.BRANCH};
 }
 if(record.payload)watermark={as_of:record.snapshot_updated_at,published_at:record.source_published_at};
 record={...record,revision_watermark:watermark};
 const content=Buffer.from(JSON.stringify(record,null,2)+'\n').toString('base64');
 const result=await request('PUT','/contents/'+cache.PATH,{message:'Refresh official VA-02 source cache',branch:cache.BRANCH,content,...(previous?.sha?{sha:previous.sha}:{})});
 return {changed:true,branch:cache.BRANCH,commit:result.commit.sha};
}
async function main(){
 if(process.argv.includes('--bootstrap')&&healthWindow(Date.now())){console.log('Pre-election source contracts pinned; automatic bootstrap makes no native request');return;}
 const archive=nativeArchive.createForWorkflow({source:'va02'});
 console.log('Original-body archive: '+(archive.enabled?'first-night capture eligible':archive.reason));
 const publishing=process.argv.includes('--publish'),healthOnly=process.argv.includes('--health-only')||(process.argv.includes('--bootstrap')&&healthWindow(Date.now()));
 if(healthOnly&&!healthWindow(Date.now()))throw Error('Outside fixed pre-election health-check window');
 if(process.argv.includes('--loop'))throw Error('VA02 collector allows one fixed request per job');
 const count=1;
 if(!publishing&&!process.argv.includes('--observe'))throw Error('Choose explicit --observe or --publish');
 if(count>1&&(!publishing||healthOnly))throw Error('Loop restricted to scheduled post-close publication');
 const reference=JSON.parse(fs.readFileSync('data/virginia_house_02_county_fips_reference.json','utf8'));
 const request=async(method,suffix,data)=>{
  if(!process.env.GITHUB_TOKEN)throw Error('Repository writer token unavailable');
  const r=await fetch('https://api.github.com/repos/'+REPO+suffix,{method,signal:AbortSignal.timeout(20000),headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28',...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
  if(!r.ok){const error=Error('Repository data request HTTP '+r.status);error.status=r.status;throw error;}return r.json();
 };
 for(let i=0;i<count;i++){
  const now=Date.now();if(!inWindow(now)&&!healthOnly){console.log('Outside2026VA post-close collection window; no source request');return;}
  const record=await collect({reference,now,evidenceSink:archive.enabled?archive.record:undefined});
  if(healthOnly){record.status='SOURCE_UNAVAILABLE';record.payload=null;record.error='Pre-election transport health check; no votes admitted';delete record.selected_payload_sha256;}
  let result;try{result=publishing?await publish({request,record,reference,now:Date.now(),healthOnly}):{observe_only:true};archive.publication(result);}
  catch(error){archive.publication({error:error.message});throw error;}
  console.log(JSON.stringify({status:record.status,fetched_at:record.fetched_at,source_stamp:record.observed_source_stamp||record.snapshot_updated_at||null,...result,live_delivery:'UNPROVEN_UNTIL_ACTUAL_VALIDATED_POST_CLOSE_COUNTS'}));
  if(i+1<count)await new Promise(resolve=>setTimeout(resolve,60000));
 }
}
module.exports={publish,inWindow,healthWindow,REPO,main};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
