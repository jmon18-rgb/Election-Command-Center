#!/usr/bin/env node
'use strict';
/* Independently verify the actually DEPLOYED NC Election Night county desk.
 * A green GitHub source-commit action is NOT proof that Pages shipped it.
 * No polling probabilities, percent reporting, or winner calls are derived.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const candidate=require('./nc_official_candidate_votes.js');
const countyDesk=require('./election_night_county_results_desk.js');
const root=path.resolve(__dirname,'..');
const SITE=(process.env.DASHBOARD_SITE_URL||
 'https://jmon18-rgb.github.io/Election-Command-Center/').replace(/\/?$/,'/');
const INDEX_FILES=[
 'scripts/verified_county_source_contract_2026.js',
 'scripts/election_night_county_results_desk.js',
 'scripts/nc_official_candidate_votes.js',
 'scripts/nc_county_results_desk_startup.js'
];
const START=Date.parse('2026-11-03T05:00:00Z');
const END=Date.parse('2026-11-06T06:00:00Z');

function gitRevision(code){
 const body=Buffer.from(code,'utf8');
 return crypto.createHash('sha1').update(Buffer.from('blob '+body.length+'\0'))
  .update(body).digest('hex').slice(0,12);
}
function inspectScripts(html,scripts){
 assert.match(html,/id="enVerifiedCountyResults"/,
  'Deployed Election Night HTML has no county results container');
 const tags=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)]
  .map(x=>x[1]);
 const verified=[];
 for(const name of INDEX_FILES){
  const found=tags.filter(x=>x.startsWith('./'+name+'?'));
  assert.equal(found.length,1,'Missing/duplicate deployed county desk script '+name);
  const url=found[0];
  assert.match(url,/\?v=[0-9a-f]{12}$/,'Unversioned county script '+name);
  assert.equal(typeof scripts[name],'string','Missing deployed script bytes '+name);
  assert.equal(url.slice(-12),gitRevision(scripts[name]),
   'Deployed HTML references stale or incorrect county script '+name);
  verified.push(name);
 }
 return verified;
}
function inspectSource(config,snapshot,now=Date.now()){
 assert(config&&config.schema==='county-desk-config-v1',
  'Deployed county feed configuration missing or wrong schema');
 if(config.enabled!==true){
  assert.equal(config.enabled,false,'County approval must be explicitly enabled');
  assert.equal(config.snapshot_path,null,'Disabled feed cannot point at result rows');
  assert.equal(config.expected,null,'Disabled feed cannot carry an approval');
  return {status:'WAITING_FOR_REVIEWED_2026_OFFICIAL_SOURCE',
   published_counties:0,may_move_national_needle:false};
 }
 assert.equal(config.snapshot_path,'./data/nc_candidate_votes_2026.json',
  'Deployed candidate-only feed points to unexpected snapshot path');
 assert(config.expected&&config.expected.mode==='nc-candidate-only',
  'Deployed official ZIP approval missing independent candidate-only identity');
 const checked=Date.parse(snapshot?.archive_checked_at||'');
 assert(Number.isFinite(checked)&&checked>=START&&
  checked<=END+2*3600000&&checked<=now+15*60000,
  'Official ZIP observation must belong to the actual 2026 election window');
 const archived=now>=END+2*3600000;
 // The browser live feed deliberately expires after two hours. The
 // deployment auditor must still verify archived results after election
 // night without treating them as fresh live counts.
 const validationNow=archived?checked+60000:now;
 const gate=candidate.prepare(snapshot,config.expected,validationNow);
 assert.equal(gate.ready,true,gate.reason||'County candidate snapshot rejected');
 assert.equal(gate.may_move_national_needle,false,'County snapshot incorrectly promotes model');
 const votes=gate.rows.reduce((count,row)=>count+row.total,0);
 assert(Number.isSafeInteger(votes)&&votes>0,'Invalid county candidate totals');
 const age=now-checked;
 if(!archived&&now>=START)
  assert(age<=120*60000&&age>=-15*60000,
   'Election Night source snapshot has stopped refreshing');
 return {status:archived?'ARCHIVED_SOURCE_VERIFIED_NOT_LIVE':
  'VERIFIED_CANDIDATE_COUNTS_PUBLISHED',
  published_counties:gate.rows.length,
  votes_for_listed_candidates:votes,
  archive_retrieved_at:gate.checked_at,
  archive_age_minutes:Math.round(age/60000),
  archive_sha256:gate.sha256,
  may_move_national_needle:false};
}
/* Compare the deployed ZIP revision to the latest approved data on main.
 * Static Pages may legitimately lag a new source commit for a few minutes;
 * never silently accept a permanently stuck deployment.
 */
/* A published source must have the SAME independent approval on main,
 * including race, contest, original URL, ZIP SHA and revisions policy.
 * Key sorting prevents irrelevant JSON key order from hiding drift.
 */
function canonicalApproval(config){
 const normalized=value=>Array.isArray(value)?value.map(normalized):
  value&&typeof value==='object'?
   Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalized(value[k])])):value;
 return JSON.stringify(normalized({
  schema:config?.schema??null,enabled:config?.enabled??null,
  snapshot_path:config?.snapshot_path??null,
  expected:config?.expected??null
 }));
}
function compareApprovedHead(localConfig,localSnapshot,remoteConfig,remoteSnapshot,now=Date.now()){
 assert(localConfig?.schema==='county-desk-config-v1',
  'Main county approval schema is invalid');
 if(localConfig.enabled!==true){
  assert.equal(localConfig.enabled,false,
   'Main county source must be explicitly enabled or disabled');
  assert.equal(localConfig.expected,null,
   'Main disabled NC source cannot carry a reviewed contest');
  assert.equal(localConfig.snapshot_path,null,
   'Main disabled NC source cannot point to candidate data');
  assert.equal(remoteConfig?.enabled,false,
   'Pages unexpectedly activated NC county counts while main approval disabled');
  assert.equal(canonicalApproval(remoteConfig),canonicalApproval(localConfig),
   'Disabled NC approval on Pages differs from main');
  return {status:'APPROVAL_NOT_ENABLED'};
 }
 assert(localSnapshot&&localConfig.expected?.mode==='nc-candidate-only',
  'Main has enabled NC county reporting without an approved candidate snapshot');
 const localTime=Date.parse(localSnapshot.archive_checked_at||'');
 assert(Number.isFinite(localTime),'Main approved snapshot timestamp absent');
 const remoteTime=Date.parse(remoteSnapshot?.archive_checked_at||'');
 const equalApproval=canonicalApproval(remoteConfig)===canonicalApproval(localConfig);
 const matching=remoteConfig?.enabled===true&&remoteSnapshot&&
  equalApproval&&Number.isFinite(remoteTime)&&remoteTime>=localTime&&
  remoteSnapshot.source?.sha256===localSnapshot.source?.sha256;
 if(matching)return {status:'PUBLISHED_APPROVED_HEAD',deployment_lag_minutes:0};
 // A source with equally fresh/later counts but different contest or
 // geographic approval cannot be explained by an ordinary Pages delay.
 if(remoteConfig?.enabled===true&&Number.isFinite(remoteTime)&&remoteTime>=localTime)
  assert(equalApproval,
   'Pages published an NC contest/source approval that differs from reviewed main');
 const age=now-localTime;
 assert(age>=-15*60000,'Approved local source timestamp is in the future');
 assert(age<20*60000,
  'GitHub Pages has not deployed the approved county ZIP revision after 20 minutes');
 return {status:'PAGES_CATCHING_UP',deployment_lag_minutes:Math.round(age/60000)};
}

async function networkLoad(url){
 let err;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(url,{cache:'no-store',
    signal:AbortSignal.timeout(12000),
    headers:{'Cache-Control':'no-cache','Pragma':'no-cache'}});
   if(!response.ok)throw Error('HTTP '+response.status+' '+url);
   return await response.text();
  }catch(e){
   err=e;
   if(attempt<2)await new Promise(r=>setTimeout(r,500*(attempt+1)));
  }
 }
 throw Error('Deployed county source inaccessible '+url+': '+err.message);
}
async function loadText(file,remote){
 if(!remote)return fs.readFileSync(path.join(root,file),'utf8');
 return networkLoad(new URL(file,SITE).toString());
}
async function auditDeployment(remote){
 const html=await loadText('index.html',remote);
 const config=JSON.parse(await loadText('data/nc_county_results_desk_config.json',remote));
 let snapshot=null;
 if(config.enabled===true){
  assert.equal(config.snapshot_path,'./data/nc_candidate_votes_2026.json',
   'Unexpected published candidate file');
  snapshot=JSON.parse(await loadText('data/nc_candidate_votes_2026.json',remote));
 }
 const scripts={};
 await Promise.all(INDEX_FILES.map(async f=>{scripts[f]=await loadText(f,remote)}));
 const scriptChecks=inspectScripts(html,scripts);
 const results=inspectSource(config,snapshot);
 let approvalRevision={status:'LOCAL_CHECKOUT_ONLY'};
 if(remote){
  const approvedConfig=JSON.parse(fs.readFileSync(path.join(root,
   'data/nc_county_results_desk_config.json'),'utf8'));
  const approvedSnapshot=approvedConfig.enabled===true?
   JSON.parse(fs.readFileSync(path.join(root,
    'data/nc_candidate_votes_2026.json'),'utf8')):null;
  approvalRevision=compareApprovedHead(approvedConfig,approvedSnapshot,
   config,snapshot);
 }
 return {checked_at:new Date().toISOString(),scope:remote?'PUBLISHED_GITHUB_PAGES':'LOCAL_CHECKOUT',
  ...results,approved_head_comparison:approvalRevision,script_checks:scriptChecks,
  site:remote?SITE:undefined};
}
if(require.main===module){
 auditDeployment(process.argv.includes('--remote')).then(report=>{
  console.log(JSON.stringify(report,null,2));
 }).catch(err=>{
  console.error('COUNTY PAGES DEPLOYMENT AUDIT FAILED:',err.stack||err.message);
  process.exitCode=1;
 });
}
module.exports={inspectScripts,inspectSource,compareApprovedHead,auditDeployment,gitRevision,INDEX_FILES};
