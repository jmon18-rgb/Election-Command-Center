#!/usr/bin/env node
'use strict';
/* Prove that the ACTUALLY SERVED GitHub Pages Ohio source, not just GitHub
 * Actions' committed candidate file, is coherent and source-reviewed.
 * Does not use or create 2026 returns, winners or forecast adjustments.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const candidate=require('./ohio_official_candidate_votes.js');
const ROOT=path.resolve(__dirname,'..');
const SITE=(process.env.DASHBOARD_SITE_URL||
 'https://jmon18-rgb.github.io/Election-Command-Center/').replace(/\/?$/,'/');
const LIVE=Date.parse('2026-11-04T00:30:00Z');
const MONITOR_END=Date.parse('2026-11-04T12:00:00Z');
const ARCHIVE_CUTOFF=Date.parse('2026-11-06T06:00:00Z');
const MODULES=[
 'scripts/ohio_official_candidate_votes.js',
 'scripts/ohio_official_county_startup.js'
];
function blobRevision(source){
 const value=Buffer.from(source);
 return crypto.createHash('sha1').update(Buffer.from('blob '+value.length+'\0'))
  .update(value).digest('hex').slice(0,12);
}
function checkScripts(html,modules){
 assert.match(html,/id=["']enOhioOfficialCountyDesk["']/,
  'Deployed Ohio results drawer missing');
 assert.match(html,/id=["']enOhioOfficialCountyResults["']/,
  'Deployed Ohio reviewed result region missing');
 const tags=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)]
  .map(x=>x[1]);
 for(const f of MODULES){
  const found=tags.filter(tag=>tag.startsWith('./'+f+'?'));
  assert.equal(found.length,1,'Missing or duplicated Ohio source JS '+f);
  assert.match(found[0],/\?v=[a-f0-9]{12}$/,'Unversioned JS '+f);
  assert.equal(blobRevision(modules[f]),found[0].slice(-12),
   'Ohio page references a mismatched/stale JS asset '+f);
 }
 return MODULES.length;
}
function checkApproved(config,snapshot,now=Date.now()){
 assert.equal(config?.schema,'ohio-nist-2026-live-approval-v1',
  'Missing independent Ohio NIST approval contract');
 if(config.enabled===false){
  assert.equal(config.real_results_publication_reviewed,false,
   'Disabled Ohio publication may not claim approved real votes');
  return {status:'OHIO_SOURCE_DISABLED_MOCK_VOTES_BLOCKED',
   candidate_races:0,may_move_national_needle:false};
 }
 assert.equal(config.enabled,true,'Ambiguous source approval status');
 assert.equal(config.real_results_publication_reviewed,true,
  'Ohio source was activated without independent real vote review');
 assert(snapshot&&snapshot.source,'Approved Ohio candidate snapshot missing');
 const generated=Date.parse(snapshot.source.generated_at);
 assert(Number.isFinite(generated)&&generated>=LIVE-5*60000&&generated<ARCHIVE_CUTOFF+
  30*60000&&generated<=now+5*60000,
  'Ohio source original generation date outside independently reviewed election');
 const archived=now>MONITOR_END;
 const reviewedAt=Date.parse(config.source_reviewed_at||'');
 assert(Number.isFinite(reviewedAt),'Approved Ohio source review timestamp missing');
 const validationTime=archived?Math.max(generated,reviewedAt)+60000:now;
 const prepared=candidate.prepare(snapshot,config,validationTime);
 assert.equal(prepared.ready,true,prepared.reason||'Ohio published source rejected');
 assert.equal(prepared.may_move_national_needle,false,'Ohio source promoted to model');
 assert(prepared.races.length>=1&&prepared.races.length<=17);
 if(!archived){
  assert(now-generated<=30*60000,'Deployed Ohio official source stopped updating');
 }
 return {status:archived?'OHIO_ARCHIVED_UNOFFICIAL_COUNTS_NOT_LIVE':
  'OHIO_VERIFIED_APPROVED_CANDIDATE_COUNTS_PUBLISHED',
  candidate_races:prepared.races.length,
  source_generated_at:snapshot.source.generated_at,
  source_xml_sha256:snapshot.source.xml_sha256,
  may_move_national_needle:false};
}
/* A Pages publish is only equivalent to the reviewed source if the whole
 * identity manifest agrees, not merely its approval timestamp. In particular
 * county/party/contest mappings must never drift behind unchanged totals.
 */
function canonicalApproval(config){
 const fields=['schema','enabled','real_results_publication_reviewed',
  'source_url','source_reviewed_at','expected_report_status',
  'approved_county_unit_type','approved_total_votes_type',
  'county_gpunit_to_fips','party_object_id_to_party','approved_contests'];
 const normalized=value=>Array.isArray(value)?value.map(normalized):
  value&&typeof value==='object'?
   Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalized(value[k])])):value;
 return JSON.stringify(normalized(Object.fromEntries(fields.map(
  key=>[key,config?.[key]??null]))));
}
function compareHead(localConfig,localSnapshot,remoteConfig,remoteSnapshot,now=Date.now()){
 if(localConfig?.enabled!==true){
  assert.equal(remoteConfig?.enabled,false,
   'Pages unexpectedly activated Ohio without local independent approval');
  assert.equal(remoteConfig?.real_results_publication_reviewed,false,
   'Pages claims reviewed Ohio votes while local source is disabled');
  assert.equal(canonicalApproval(remoteConfig),canonicalApproval(localConfig),
   'Disabled Ohio source manifest on Pages differs from reviewed main');
  return 'SOURCE_NOT_APPROVED';
 }
 const approvalTime=Date.parse(localConfig.source_reviewed_at);
 assert(Number.isFinite(approvalTime)&&approvalTime>=LIVE);
 const localObserved=Date.parse(localSnapshot?.source?.generated_at);
 const remoteObserved=Date.parse(remoteSnapshot?.source?.generated_at);
 const agreement=remoteConfig?.enabled===true&&
  remoteConfig.real_results_publication_reviewed===true&&
  remoteConfig.source_reviewed_at===localConfig.source_reviewed_at&&
  canonicalApproval(remoteConfig)===canonicalApproval(localConfig)&&
  !!localSnapshot&&!!remoteSnapshot&&
  remoteSnapshot.source.xml_sha256===localSnapshot.source.xml_sha256&&
  remoteObserved>=localObserved;
 if(agreement)return 'PUBLISHED_APPROVED_SOURCE_REVISION';
 const since=Math.max(0,now-(Number.isFinite(localObserved)?localObserved:approvalTime));
 assert(since<20*60000,
  'GitHub Pages failed to publish the approved Ohio source within 20 minutes');
 return 'APPROVED_OHIO_REVISION_WAITING_FOR_PAGES';
}
async function download(url){
 let lastError;
 for(let i=0;i<3;i++){
  try{
   const response=await fetch(url,{cache:'no-store',
    signal:AbortSignal.timeout(12000),
    headers:{'Cache-Control':'no-cache'}});
   if(!response.ok)throw Error('HTTP '+response.status+' '+url);
   return await response.text();
  }catch(err){lastError=err;if(i<2)await new Promise(r=>setTimeout(r,500*(i+1)))}
 }
 throw Error('Ohio Pages public endpoint read failed: '+lastError.message);
}
async function textFile(f,remote){
 return remote?download(new URL(f,SITE).toString()):
  fs.readFileSync(path.join(ROOT,f),'utf8');
}
async function audit(remote){
 const html=await textFile('index.html',remote);
 const config=JSON.parse(await textFile('data/ohio_nist_source_approval_2026.json',remote));
 const files={};await Promise.all(MODULES.map(async f=>{files[f]=await textFile(f,remote)}));
 const modules=checkScripts(html,files);
 let snapshot=null;
 if(config.enabled===true)
  snapshot=JSON.parse(await textFile('data/ohio_nist_candidate_votes_2026.json',remote));
 const result=checkApproved(config,snapshot);
 let parity='LOCAL_CHECKOUT_ONLY';
 if(remote){
  const approved=JSON.parse(fs.readFileSync(path.join(ROOT,
   'data/ohio_nist_source_approval_2026.json'),'utf8'));
  const local=approved.enabled===true&&fs.existsSync(path.join(ROOT,
   'data/ohio_nist_candidate_votes_2026.json'))?
   JSON.parse(fs.readFileSync(path.join(ROOT,
    'data/ohio_nist_candidate_votes_2026.json'),'utf8')):null;
  parity=compareHead(approved,local,config,snapshot);
 }
 return {checked_at:new Date().toISOString(),scope:remote?'DEPLOYED_GITHUB_PAGES':'LOCAL',
  ...result,modules_verified:modules,source_publication_parity:parity,
  site:remote?SITE:undefined};
}
if(require.main===module){
 audit(process.argv.includes('--remote')).then(x=>console.log(JSON.stringify(x,null,2)))
  .catch(e=>{console.error('OHIO PAGES SOURCE AUDIT FAILED',e.stack||e.message);process.exitCode=1});
}
module.exports={blobRevision,checkScripts,checkApproved,compareHead,audit,MODULES};
