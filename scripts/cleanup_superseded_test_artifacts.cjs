'use strict';
// One reviewed list of disposable Actions uploads. No discovery-based deletion,
// downloads, billing access, source requests, caches, runs or log deletion.
const fs=require('node:fs'),path=require('node:path');
const REPOSITORY='jmon18-rgb/Election-Command-Center',REPOSITORY_ID=1416220455;
const SCHEMA='superseded-test-artifact-cleanup-v1';
const AUTHORIZATION='OWNER_DELETE_UNNEEDED_TEST_ARTIFACTS_20261028';
const WORKFLOW=REPOSITORY+'/.github/workflows/cleanup-superseded-test-artifacts.yml@refs/heads/main';
const PAGES_WORKFLOW_ID=382643858,PAGES_WORKFLOW_PATH='dynamic/pages/pages-build-deployment';
const PAGES_ROUTINE_SUBJECT='Update sourced election briefing';
const MANIFEST='data/test_artifact_cleanup_manifest_20261028.json',HOUR=3600000;
const POLICIES=Object.freeze({
 'synthetic-test-24h':Object.freeze({hours:24,names:Object.freeze([
  'election-readiness-core','source-recovery-browser','texas-house-watch-browser',
  'celebration-browser-previews','election-night-hierarchy-tasks','iowa-needle-desktop-mobile'])}),
 'superseded-pages-6h':Object.freeze({hours:6,names:Object.freeze(['github-pages'])})
});
const COMPLETED_CONCLUSIONS=Object.freeze(['success','failure','cancelled','timed_out','action_required','neutral','skipped','stale','startup_failure']);
const integer=n=>Number.isSafeInteger(n)&&n>0;
const sha=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const fail=code=>{const error=Error(code);error.cleanupCode=code;throw error;};
function time(s){
 if(typeof s!=='string')fail('INVALID_TIMESTAMP');const n=Date.parse(s);
 if(!Number.isFinite(n)||![new Date(n).toISOString(),new Date(n).toISOString().replace('.000Z','Z')].includes(s))fail('INVALID_TIMESTAMP');
 return n;
}
function pinValid(p){
 const r=p?.workflow_run;
 if(!p||!integer(p.id)||typeof p.name!=='string'||!integer(p.size_in_bytes)||
  !/^sha256:[a-f0-9]{64}$/.test(p.digest||'')||!r||!integer(r.id)||
  r.repository_id!==REPOSITORY_ID||r.head_repository_id!==REPOSITORY_ID||
  typeof r.head_branch!=='string'||!r.head_branch||r.head_branch.length>200||!sha(r.head_sha))fail('INVALID_ARTIFACT_PIN');
 if(time(p.expires_at)<=time(p.created_at))fail('INVALID_ARTIFACT_EXPIRY');
 if(!Object.values(POLICIES).some(x=>x.names.includes(p.name)))fail('UNAPPROVED_ARTIFACT_NAME');
}
function validateManifest(plan){
 if(!plan||plan.schema!==SCHEMA||plan.repository!==REPOSITORY||plan.authorization!==AUTHORIZATION||
  typeof plan.plan_id!=='string'||!/^20261028-[a-z0-9-]{1,80}$/.test(plan.plan_id))fail('UNAPPROVED_PLAN');
 const created=time(plan.created_at),expires=time(plan.expires_at);
 if(expires<=created||expires-created>24*HOUR)fail('INVALID_PLAN_EXPIRY');
 if(plan.trusted_pages_workflow_id!==PAGES_WORKFLOW_ID||plan.trusted_pages_workflow_path!==PAGES_WORKFLOW_PATH)fail('UNTRUSTED_PAGES_WORKFLOW');
 if(!plan.selection_before||Object.keys(POLICIES).some(k=>time(plan.selection_before[k])>created-POLICIES[k].hours*HOUR))fail('UNSAFE_SELECTION_CUTOFF');
 if(!Array.isArray(plan.protected_artifact_ids)||!plan.protected_artifact_ids.length||!plan.protected_artifact_ids.every(integer)||
  new Set(plan.protected_artifact_ids).size!==plan.protected_artifact_ids.length||
  !Array.isArray(plan.protected_run_ids)||!plan.protected_run_ids.length||!plan.protected_run_ids.every(integer)||
  new Set(plan.protected_run_ids).size!==plan.protected_run_ids.length||
  !Array.isArray(plan.protected_head_shas)||!plan.protected_head_shas.length||!plan.protected_head_shas.every(sha)||
  new Set(plan.protected_head_shas).size!==plan.protected_head_shas.length)fail('MISSING_PROTECTED_RELEASES');
 if(!Array.isArray(plan.artifacts)||!plan.artifacts.length||plan.artifacts.length>50||
  !Array.isArray(plan.retained_artifacts)||!plan.retained_artifacts.length||plan.retained_artifacts.length>100)fail('INVALID_PLAN_SIZE');
 const retained=new Map();
 for(const p of plan.retained_artifacts){pinValid(p);if(retained.has(p.id))fail('DUPLICATE_RETAINED_ID');if(p.name==='github-pages'&&p.workflow_run.head_branch!=='main')fail('RETAINED_PAGES_NOT_MAIN');retained.set(p.id,p);}
 const ids=new Set();let bytes=0;
 for(const p of plan.artifacts){
  pinValid(p);const policy=POLICIES[p.policy],keep=retained.get(p.retained_artifact_id);
  if(!policy||!policy.names.includes(p.name)||time(p.created_at)>time(plan.selection_before[p.policy]))fail('ARTIFACT_OUTSIDE_FIXED_POLICY');
  if(ids.has(p.id)||retained.has(p.id)||plan.protected_artifact_ids.includes(p.id))fail('DUPLICATE_OR_RETAINED_DELETE_ID');ids.add(p.id);
  if(plan.protected_run_ids.includes(p.workflow_run.id)||plan.protected_head_shas.includes(p.workflow_run.head_sha))fail('PROTECTED_RELEASE_IN_PLAN');
  if(p.policy==='superseded-pages-6h'&&p.workflow_run.head_branch!=='main')fail('PAGES_NOT_MAIN');
  if(!keep||keep.id===p.id||keep.name!==p.name||time(keep.created_at)<=time(p.created_at))fail('MISSING_NEWER_RETAINED_COPY');
  bytes+=p.size_in_bytes;if(!Number.isSafeInteger(bytes))fail('INVALID_BYTE_SUM');
 }
 if(plan.expected_total_bytes!==bytes)fail('REVIEWED_BYTE_SUM_MISMATCH');
 return {created,expires,bytes,retained};
}
function applyAllowed(env){
 if(env.GITHUB_REPOSITORY!==REPOSITORY||env.GITHUB_REF!=='refs/heads/main'||
  env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_RUN_ATTEMPT!=='1'||
  !integer(Number(env.GITHUB_RUN_ID))||!sha(env.GITHUB_SHA)||
  env.GITHUB_WORKFLOW_REF!==WORKFLOW||env.GITHUB_SERVER_URL!=='https://github.com'||
  env.GITHUB_API_URL!=='https://api.github.com')fail('APPLY_REQUIRES_FIRST_PROTECTED_MAIN_PUSH');
 if(typeof env.GITHUB_TOKEN!=='string'||!env.GITHUB_TOKEN)fail('MISSING_EPHEMERAL_ACTIONS_TOKEN');
}
function samePin(actual,pin){
 return actual&&['id','name','size_in_bytes','digest','created_at','expires_at'].every(k=>actual[k]===pin[k])&&
  ['id','repository_id','head_repository_id','head_branch','head_sha'].every(k=>actual.workflow_run?.[k]===pin.workflow_run[k]);
}
function runMatches(run,pin){
 return run?.id===pin.workflow_run.id&&run.repository?.id===REPOSITORY_ID&&
  run.head_repository?.id===REPOSITORY_ID&&run.head_sha===pin.workflow_run.head_sha&&
  run.head_branch===pin.workflow_run.head_branch&&integer(run.workflow_id);
}
function pagesRunValid(run){return run?.workflow_id===PAGES_WORKFLOW_ID&&run.path===PAGES_WORKFLOW_PATH&&run.head_branch==='main'&&run.status==='completed'&&run.conclusion==='success';}
function routinePagesCandidate(run){return typeof run?.head_commit?.message==='string'&&run.head_commit.message.split(/\r?\n/)[0]===PAGES_ROUTINE_SUBJECT;}
function apiClient({token,fetchImpl=fetch}={}){
 const root='https://api.github.com/repos/'+REPOSITORY;
 const id=n=>{if(!integer(n))fail('INVALID_API_ID');return n;};
 async function request(suffix,method='GET'){
  const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Election-Command-Center-reviewed-artifact-cleanup'};
  if(token)headers.Authorization='Bearer '+token;
  let response;try{response=await fetchImpl(root+suffix,{method,headers,redirect:'error',signal:AbortSignal.timeout(20000)});}catch{fail('GITHUB_REQUEST_FAILED');}
  if(response.status===404)return null;
  if(method==='DELETE'){if(response.status!==204)fail('ARTIFACT_DELETE_HTTP_'+response.status);return true;}
  if(response.status!==200)fail('ARTIFACT_READ_HTTP_'+response.status);
  try{return await response.json();}catch{fail('INVALID_GITHUB_METADATA');}
 }
 async function getRunJobs(runId){id(runId);const jobs=[];for(let page=1;page<=20;page++){const data=await request('/actions/runs/'+runId+'/jobs?filter=latest&per_page=100&page='+page);if(!data||!Array.isArray(data.jobs)||data.jobs.length>100)fail('PAGES_JOBS_UNAVAILABLE');jobs.push(...data.jobs);if(data.jobs.length<100)return jobs;}fail('PAGES_JOBS_PAGINATION_LIMIT');}
 return Object.freeze({
  getArtifact:n=>request('/actions/artifacts/'+id(n)),getRun:n=>request('/actions/runs/'+id(n)),
  getMain:()=>request('/branches/main'),listOpenPulls:page=>{if(!integer(page)||page>20)fail('INVALID_API_PAGE');return request('/pulls?state=open&per_page=100&page='+page);},getRunJobs,
  deleteArtifact:n=>request('/actions/artifacts/'+id(n),'DELETE')
 });
}
async function protectedNow(api,env){
 const main=await api.getMain();if(!sha(main?.commit?.sha))fail('MAIN_IDENTITY_UNAVAILABLE');
 const heads=new Set([main.commit.sha]),branches=new Set();if(sha(env.GITHUB_SHA))heads.add(env.GITHUB_SHA);
 for(let page=1;page<=20;page++){
  const rows=await api.listOpenPulls(page);if(!Array.isArray(rows)||rows.length>100)fail('OPEN_PR_PROTECTION_UNAVAILABLE');
  for(const p of rows){if(!p.head||!sha(p.head.sha)||typeof p.head.ref!=='string'||!integer(p.head.repo?.id))fail('OPEN_PR_IDENTITY_UNAVAILABLE');
   if(p.head.repo.id===REPOSITORY_ID){heads.add(p.head.sha);branches.add(p.head.ref);}}
  if(rows.length<100)return {heads,branches,main:main.commit.sha};
 }
 fail('OPEN_PR_PROTECTION_PAGINATION_LIMIT');
}
async function cleanup(plan,{apply=false,api,env=process.env,now=Date.now(),clock=Date.now,
 sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),onReceipt=()=>{},onEvent=()=>{}}={}){
 if(typeof apply!=='boolean')fail('INVALID_APPLY_MODE');
 const checked=validateManifest(plan);if(!Number.isFinite(now)||checked.created>now||checked.expires<now)fail('PLAN_NOT_CURRENT');
 if(apply)applyAllowed(env);if(!api)api=apiClient({token:env.GITHUB_TOKEN});
 const receipt={schema:'reviewed-actions-artifact-cleanup-receipt-v1',repository:REPOSITORY,plan_id:plan.plan_id,
  mode:apply?'APPLY':'DRY_RUN',at:new Date(now).toISOString(),status:'PREFLIGHT',reviewed_artifacts:plan.artifacts.length,
  reviewed_bytes:checked.bytes,deleted_artifacts:0,deleted_bytes:0,mutation_requests:0,entries:[],limits:'Artifact metadata bytes are not account allowance or accrued billing. No billing/source/archive activation change.'};
 const emit=()=>onReceipt(JSON.parse(JSON.stringify(receipt)));
 const event=entry=>onEvent({schema:'reviewed-actions-artifact-cleanup-event-v1',plan_id:plan.plan_id,
  entry:{...entry},deleted_artifacts:receipt.deleted_artifacts,deleted_bytes:receipt.deleted_bytes});
 const cacheRuns=new Map(),cacheKeeps=new Map(),cacheJobs=new Map(),eligible=[];
 const getRun=async id=>{if(!cacheRuns.has(id))cacheRuns.set(id,await api.getRun(id));return cacheRuns.get(id);};
 const deployed=async(run,fresh=false)=>{if(!pagesRunValid(run))return false;if(fresh||!cacheJobs.has(run.id))cacheJobs.set(run.id,await api.getRunJobs(run.id));const jobs=cacheJobs.get(run.id);if(!Array.isArray(jobs))return false;const matches=jobs.filter(j=>j.name==='deploy');return matches.length===1&&matches[0].status==='completed'&&matches[0].conclusion==='success';};
 try{
  const dynamic=await protectedNow(api,env);
  for(const p of plan.retained_artifacts){
   const a=await api.getArtifact(p.id);if(!a||a.expired||time(a.expires_at)<=now)fail('RETAINED_ARTIFACT_UNAVAILABLE');
   if(!samePin(a,p))fail('RETAINED_METADATA_CHANGED');const run=await getRun(p.workflow_run.id);
   if(!runMatches(run,p)||run.status!=='completed'||run.conclusion!=='success')fail('RETAINED_RUN_NOT_SUCCESSFUL');
   if(p.name==='github-pages'&&!await deployed(run))fail('RETAINED_PAGES_NOT_DEPLOYED');
   cacheKeeps.set(p.id,{a,run});
  }
  for(const p of plan.artifacts){
   const entry={id:p.id,name:p.name,policy:p.policy,run_id:p.workflow_run.id,bytes:p.size_in_bytes,status:'PREFLIGHT'};receipt.entries.push(entry);
   if(dynamic.heads.has(p.workflow_run.head_sha)||dynamic.branches.has(p.workflow_run.head_branch)||Number(env.GITHUB_RUN_ID)===p.workflow_run.id){entry.status='SKIP_CURRENT_OR_OPEN_PR';continue;}
   const a=await api.getArtifact(p.id);if(!a){entry.status='SKIP_MISSING';continue;}
   if(!samePin(a,p))fail('CANDIDATE_METADATA_CHANGED');if(a.expired||time(a.expires_at)<=now){entry.status='SKIP_EXPIRED';continue;}
   if(now-time(a.created_at)<POLICIES[p.policy].hours*HOUR)fail('CANDIDATE_TOO_RECENT');
   const run=await getRun(p.workflow_run.id);if(!run){entry.status='SKIP_MISSING_RUN';continue;}
   if(!runMatches(run,p))fail('CANDIDATE_RUN_IDENTITY_CHANGED');
   if(run.status!=='completed'){entry.status='SKIP_RUN_NOT_COMPLETED';continue;}
   if(!COMPLETED_CONCLUSIONS.includes(run.conclusion))fail('CANDIDATE_RUN_CONCLUSION_UNKNOWN');
   if(time(run.updated_at)>time(plan.selection_before[p.policy])){entry.status='SKIP_RUN_TOO_RECENT';continue;}
   if(p.policy==='superseded-pages-6h'&&!await deployed(run)){entry.status='SKIP_PAGES_RUN_NOT_DEPLOYED';continue;}
   if(p.policy==='superseded-pages-6h'&&!routinePagesCandidate(run)){entry.status='SKIP_PAGES_NOT_ROUTINE_BRIEFING';continue;}
   const keep=cacheKeeps.get(p.retained_artifact_id);
   if(run.workflow_id!==keep.run.workflow_id)fail('RETAINED_COPY_DIFFERENT_WORKFLOW');
   if(time(keep.run.updated_at)<=time(run.updated_at))fail('RETAINED_RUN_NOT_NEWER');
   entry.status=apply?'READY':'WOULD_DELETE';eligible.push({p,entry});
  }
  // Every reviewed entry passes preflight before any deletion. A changed pin
  // or missing required retained copy therefore prevents the whole mutation.
  receipt.status=apply?'APPLYING':'DRY_RUN_COMPLETE';emit();
  let previousDeleteStart=null;
  if(apply)for(const {p,entry} of eligible){
   if(previousDeleteStart!==null){const delay=Math.max(0,previousDeleteStart+500-clock());if(delay)await sleep(delay);}
   const a=await api.getArtifact(p.id);if(!a){entry.status='SKIP_MISSING_BEFORE_DELETE';event(entry);continue;}
   if(!samePin(a,p))fail('CANDIDATE_CHANGED_BEFORE_DELETE');
   if(a.expired||time(a.expires_at)<=clock()){entry.status='SKIP_EXPIRED_BEFORE_DELETE';event(entry);continue;}
   const run=await api.getRun(p.workflow_run.id);if(!runMatches(run,p)||run.status!=='completed'||
    !COMPLETED_CONCLUSIONS.includes(run.conclusion)||
    time(run.updated_at)>time(plan.selection_before[p.policy])||
    p.policy==='superseded-pages-6h'&&(!await deployed(run,true)||!routinePagesCandidate(run)))fail('CANDIDATE_RUN_CHANGED_BEFORE_DELETE');
   const keepPin=checked.retained.get(p.retained_artifact_id),[keepArtifact,keepRun]=await Promise.all([api.getArtifact(keepPin.id),api.getRun(keepPin.workflow_run.id)]);
   if(!keepArtifact||keepArtifact.expired||time(keepArtifact.expires_at)<=clock()||!samePin(keepArtifact,keepPin)||
    !runMatches(keepRun,keepPin)||keepRun.status!=='completed'||keepRun.conclusion!=='success'||
    keepRun.workflow_id!==run.workflow_id||time(keepRun.updated_at)<=time(run.updated_at)||
    keepPin.name==='github-pages'&&!await deployed(keepRun,true))fail('RETAINED_COPY_CHANGED_BEFORE_DELETE');
   const current=await protectedNow(api,env);
   if(current.main!==dynamic.main)fail('MAIN_CHANGED_DURING_CLEANUP');
   const sameSet=(a,b)=>a.size===b.size&&[...a].every(x=>b.has(x));
   if(!sameSet(current.heads,dynamic.heads)||!sameSet(current.branches,dynamic.branches))fail('OPEN_PR_PROTECTION_CHANGED_DURING_CLEANUP');
   const deletionAt=clock();if(!Number.isFinite(deletionAt)||deletionAt<checked.created||deletionAt>checked.expires)fail('PLAN_EXPIRED_DURING_APPLY');
   if(previousDeleteStart!==null&&deletionAt-previousDeleteStart<500)fail('MUTATION_PACING_CLOCK_DID_NOT_ADVANCE');
   previousDeleteStart=deletionAt;receipt.mutation_requests++;entry.status='DELETE_REQUEST_UNCONFIRMED';event(entry);
   const result=await api.deleteArtifact(p.id);
   if(result===null){entry.status='SKIP_MISSING_AT_DELETE';event(entry);continue;}
   if(result!==true)fail('DELETE_NOT_CONFIRMED');
   entry.status='DELETED';receipt.deleted_artifacts++;receipt.deleted_bytes+=p.size_in_bytes;event(entry);
  }
  if(apply)receipt.status='APPLY_COMPLETE';emit();return receipt;
 }catch(error){
  receipt.status=receipt.deleted_artifacts?'PARTIAL_FAILURE':receipt.mutation_requests?'UNCONFIRMED_DELETE_FAILURE':'BLOCKED';
  receipt.error=/^[A-Z0-9_]+$/.test(error?.cleanupCode||'')?error.cleanupCode:'CLEANUP_REQUEST_FAILED';emit();
  const stopped=Error(receipt.error);stopped.cleanupCode=receipt.error;stopped.receipt=receipt;throw stopped;
 }
}
function summary(r){return ['## Reviewed artifact cleanup',
 '- Mode: '+r.mode+'; status: '+r.status,
 '- Reviewed exact artifacts: '+r.reviewed_artifacts+' ('+r.reviewed_bytes+' metadata bytes)',
 '- Confirmed deleted: '+r.deleted_artifacts+' ('+r.deleted_bytes+' metadata bytes)',
 '- Billing allowance/paid protection remain unverified; no archive activation.',
 '- No source originals, caches, workflow runs or logs are deleted.',
 ...(r.error?['- Stop: '+r.error]:[]),''].join('\n');}
async function main(){
 const args=process.argv.slice(2),allowed=new Set(['--apply','--dry-run','--validate-manifest','--manifest']);
 let file=MANIFEST;for(let i=0;i<args.length;i++){if(!allowed.has(args[i]))fail('UNKNOWN_ARGUMENT');if(args[i]==='--manifest'){file=args[++i];if(!file||file.startsWith('--'))fail('MISSING_MANIFEST_PATH');}}
 if(args.includes('--apply')&&(args.includes('--dry-run')||args.includes('--validate-manifest')))fail('CONFLICTING_MODE');
 let plan;try{plan=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));}catch{fail('MANIFEST_READ_FAILED');}
 if(args.includes('--validate-manifest')){validateManifest(plan);console.log('Reviewed artifact manifest schema and fixed-age policies passed; no requests or deletions.');return;}
 let last;try{const result=await cleanup(plan,{apply:args.includes('--apply'),onReceipt:r=>{last=r;console.log(JSON.stringify(r));},onEvent:r=>console.log(JSON.stringify(r))});last=result;}finally{if(last&&process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary(last));}
}
module.exports={REPOSITORY,REPOSITORY_ID,SCHEMA,AUTHORIZATION,WORKFLOW,MANIFEST,PAGES_WORKFLOW_ID,PAGES_WORKFLOW_PATH,PAGES_ROUTINE_SUBJECT,POLICIES,validateManifest,applyAllowed,samePin,runMatches,pagesRunValid,routinePagesCandidate,apiClient,cleanup,summary};
if(require.main===module)main().catch(error=>{console.error(/^[A-Z0-9_]+$/.test(error?.cleanupCode||'')?error.cleanupCode:'CLEANUP_FAILED');process.exitCode=1;});
