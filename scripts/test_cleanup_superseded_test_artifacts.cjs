'use strict';
// Fictional artifact/run metadata only; no network, deletions or token access.
const assert=require('node:assert/strict'),fs=require('node:fs');
const cleanup=require('./cleanup_superseded_test_artifacts.cjs');
const NOW=Date.parse('2026-10-28T22:00:00Z'),ISO=n=>new Date(n).toISOString(),clone=structuredClone;
const SHA=c=>c.repeat(40),DIGEST=c=>'sha256:'+c.repeat(64),RID=cleanup.REPOSITORY_ID;
function pin(id,name,run,created,head,branch,bytes){return {id,name,size_in_bytes:bytes,digest:DIGEST(String(id%10)),created_at:created,expires_at:ISO(NOW+86400000),workflow_run:{id:run,repository_id:RID,head_repository_id:RID,head_branch:branch,head_sha:SHA(head)}};}
function fixture(){
 const keep1=pin(21,'election-readiness-core',201,ISO(NOW-2*3600000),'b','main',222);
 const keep2=pin(22,'github-pages',202,ISO(NOW-2*3600000),'d','main',444);
 const old1={...pin(11,'election-readiness-core',101,'2026-10-26T00:00:00Z','a','readiness/old-tests',111),policy:'synthetic-test-24h',retained_artifact_id:21};
 const old2={...pin(12,'github-pages',102,'2026-10-28T08:00:00Z','c','main',333),policy:'superseded-pages-6h',retained_artifact_id:22};
 return {schema:cleanup.SCHEMA,repository:cleanup.REPOSITORY,authorization:cleanup.AUTHORIZATION,plan_id:'20261028-fictional-test',created_at:ISO(NOW),expires_at:ISO(NOW+86400000),trusted_pages_workflow_id:382643858,trusted_pages_workflow_path:'dynamic/pages/pages-build-deployment',selection_before:{'synthetic-test-24h':ISO(NOW-86400000),'superseded-pages-6h':ISO(NOW-6*3600000)},protected_artifact_ids:[21,22,999],protected_run_ids:[201,202,901],protected_head_shas:[SHA('b'),SHA('d'),SHA('f')],retained_artifacts:[keep1,keep2],artifacts:[old1,old2],expected_total_bytes:444};
}
const env={GITHUB_REPOSITORY:cleanup.REPOSITORY,GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'9999',GITHUB_SHA:SHA('e'),GITHUB_WORKFLOW_REF:cleanup.WORKFLOW,GITHUB_SERVER_URL:'https://github.com',GITHUB_API_URL:'https://api.github.com',GITHUB_TOKEN:'FICTIONAL_NOT_A_CREDENTIAL'};
function fake(plan=fixture()){
 const artifacts=new Map([...plan.retained_artifacts,...plan.artifacts].map(p=>[p.id,{...clone(p),expired:false}]));
 const runs=new Map([...plan.retained_artifacts,...plan.artifacts].map(p=>[p.workflow_run.id,{id:p.workflow_run.id,repository:{id:RID},head_repository:{id:RID},head_sha:p.workflow_run.head_sha,head_branch:p.workflow_run.head_branch,workflow_id:p.name==='github-pages'?382643858:701,path:p.name==='github-pages'?'dynamic/pages/pages-build-deployment':'.github/workflows/fictional-tests.yml',status:'completed',conclusion:'success',updated_at:p.created_at,head_commit:{message:'Update sourced election briefing\n\nFictional scheduled data update.'}}]));
 const jobs=new Map([...runs.keys()].map(id=>[id,[{name:'build',status:'completed',conclusion:'success'},{name:'deploy',status:'completed',conclusion:'success'}]]));
 const state={artifacts,runs,jobs,deletes:[],deleteTimes:[],reads:[],artifactReads:new Map(),runReads:new Map(),clock:NOW,sleeps:[],main:SHA('e'),pulls:[],fault:null};
 state.api={
  getMain:async()=>{state.reads.push('main');return {commit:{sha:state.main}};},
  listOpenPulls:async page=>{state.reads.push('pulls:'+page);return clone(state.pulls);},
  getArtifact:async id=>{state.reads.push('artifact:'+id);const nth=(state.artifactReads.get(id)||0)+1;state.artifactReads.set(id,nth);const data=clone(state.artifacts.get(id)||null);return state.onArtifact?state.onArtifact(id,nth,data):data;},
  getRun:async id=>{state.reads.push('run:'+id);const nth=(state.runReads.get(id)||0)+1;state.runReads.set(id,nth);const data=clone(state.runs.get(id)||null);return state.onRun?state.onRun(id,nth,data):data;},
  getRunJobs:async id=>{state.reads.push('jobs:'+id);return clone(state.jobs.get(id)||[]);},
  deleteArtifact:async id=>{state.deletes.push(id);state.deleteTimes.push(state.clock);if(state.fault?.id===id)throw Error(state.fault.error);state.artifacts.delete(id);return true;}
 };
 state.options={api:state.api,env:clone(env),now:NOW,clock:()=>state.clock,sleep:async ms=>{state.sleeps.push(ms);state.clock+=ms;}};
 return state;
}
async function rejected(plan,change,expected,apply=true){const state=fake(plan);if(change)change(state);let error;try{await cleanup.cleanup(plan,{...state.options,apply});}catch(e){error=e;}assert(error,'Expected fail-closed rejection');assert.match(error.message,expected);assert.deepEqual(state.deletes,[],'A preflight rejection must happen before every DELETE');return {state,error};}
(async()=>{
 let plan=fixture(),state=fake(plan);assert.equal(cleanup.validateManifest(plan).bytes,444);
 const dry=await cleanup.cleanup(plan,{...state.options,env:{}});assert.equal(dry.status,'DRY_RUN_COMPLETE');assert.equal(dry.entries.filter(x=>x.status==='WOULD_DELETE').length,2);assert.deepEqual(state.deletes,[]);
 await assert.rejects(cleanup.cleanup(plan,{...fake(plan).options,apply:'false'}),/INVALID_APPLY_MODE/);
 state=fake(plan);const applied=await cleanup.cleanup(plan,{...state.options,apply:true});assert.equal(applied.status,'APPLY_COMPLETE');assert.deepEqual(state.deletes,[11,12]);assert.equal(applied.deleted_bytes,444);assert.equal(state.deleteTimes[1]-state.deleteTimes[0],500);assert.deepEqual(state.sleeps,[500]);assert(state.artifactReads.get(11)>=2,'Re-fetch exact candidate immediately before deletion');assert(state.artifacts.has(21)&&state.artifacts.has(22),'Both retained copies survive');
 const guards=[e=>e.GITHUB_REPOSITORY='other/repo',e=>e.GITHUB_REF='refs/heads/feature',e=>e.GITHUB_EVENT_NAME='workflow_dispatch',e=>e.GITHUB_RUN_ATTEMPT='2',e=>e.GITHUB_RUN_ID='0',e=>e.GITHUB_SHA='unknown',e=>e.GITHUB_WORKFLOW_REF='another-workflow',e=>e.GITHUB_SERVER_URL='https://other.invalid',e=>e.GITHUB_API_URL='https://other.invalid',e=>e.GITHUB_TOKEN=''];
 for(const mutate of guards){const s=fake(plan);mutate(s.options.env);await assert.rejects(cleanup.cleanup(plan,{...s.options,apply:true}),/APPLY_REQUIRES|MISSING_EPHEMERAL/);assert.deepEqual(s.reads,[]);assert.deepEqual(s.deletes,[]);}
 const malformed=[
  p=>p.repository='other/repo',p=>p.authorization='unapproved',p=>p.expires_at=ISO(NOW+25*3600000),p=>p.selection_before['synthetic-test-24h']=ISO(NOW-3600000),p=>p.selection_before['superseded-pages-6h']=ISO(NOW-3600000),p=>p.trusted_pages_workflow_id++,p=>p.trusted_pages_workflow_path='another-path',
  p=>p.protected_artifact_ids=[],p=>p.protected_run_ids=[],p=>p.protected_head_shas=[],p=>p.artifacts[0].name='official-native-va02-123-1',p=>p.artifacts[0].name='actual-competitive-source-evidence',p=>p.artifacts[0].digest=null,
  p=>p.artifacts[0].created_at=ISO(NOW-23*3600000),p=>p.artifacts[1].created_at=ISO(NOW-5*3600000),p=>p.artifacts[1].workflow_run.head_branch='feature/old',p=>p.artifacts[0].policy='anything-goes',p=>p.expected_total_bytes++,
  p=>p.artifacts.push(clone(p.artifacts[0])),p=>p.artifacts[0].id=21,p=>p.protected_artifact_ids.push(11),p=>p.protected_run_ids.push(101),p=>p.protected_head_shas.push(SHA('a')),p=>p.artifacts[0].retained_artifact_id=22,p=>p.retained_artifacts[0].created_at=p.artifacts[0].created_at
 ];
 for(const mutate of malformed){const p=fixture();mutate(p);assert.throws(()=>cleanup.validateManifest(p));}
 const oversized=fixture();oversized.artifacts=Array.from({length:51},()=>clone(oversized.artifacts[0]));assert.throws(()=>cleanup.validateManifest(oversized),/INVALID_PLAN_SIZE/);
 await assert.rejects(cleanup.cleanup(plan,{...fake(plan).options,now:NOW-1}),/PLAN_NOT_CURRENT/);
 await assert.rejects(cleanup.cleanup(plan,{...fake(plan).options,now:NOW+86400001}),/PLAN_NOT_CURRENT/);
 // Revalidation is transactional before the first mutation: corrupting even
 // the second candidate prevents deletion of the already inspected first one.
 for(const mutate of [a=>a.id=999,a=>a.name='github-pages-renamed',a=>a.size_in_bytes++,a=>a.digest=DIGEST('f'),a=>a.created_at=ISO(NOW-5*3600000),a=>a.expires_at=ISO(NOW+3600000),a=>a.workflow_run.head_sha=SHA('9'),a=>a.workflow_run.repository_id=1]){
  await rejected(plan,s=>mutate(s.artifacts.get(12)),/CANDIDATE_METADATA_CHANGED/);
 }
 for(const change of [s=>s.artifacts.delete(21),s=>s.artifacts.get(21).expired=true,s=>s.artifacts.get(21).digest=DIGEST('a'),s=>s.runs.get(201).conclusion='failure',s=>s.runs.get(201).status='in_progress',s=>s.runs.get(201).head_sha=SHA('9')])await rejected(plan,change,/RETAINED_/);
 await rejected(plan,s=>s.runs.get(101).workflow_id=999,/RETAINED_COPY_DIFFERENT_WORKFLOW/);
 await rejected(plan,s=>s.runs.get(101).head_branch='changed-branch',/CANDIDATE_RUN_IDENTITY_CHANGED/);
 await rejected(plan,s=>s.runs.get(101).conclusion=null,/CANDIDATE_RUN_CONCLUSION_UNKNOWN/);
 await rejected(plan,s=>s.runs.get(201).updated_at='2026-10-25T00:00:00Z',/RETAINED_RUN_NOT_NEWER/);
 await rejected(plan,s=>s.runs.get(101).updated_at=null,/INVALID_TIMESTAMP/);
 const skips=[
  [s=>s.artifacts.delete(11),'SKIP_MISSING'],[s=>s.artifacts.get(11).expired=true,'SKIP_EXPIRED'],
  [s=>s.runs.delete(101),'SKIP_MISSING_RUN'],[s=>s.runs.get(101).status='in_progress','SKIP_RUN_NOT_COMPLETED'],
  [s=>s.runs.get(101).updated_at=ISO(NOW-3600000),'SKIP_RUN_TOO_RECENT'],
  [s=>s.main=SHA('a'),'SKIP_CURRENT_OR_OPEN_PR'],[s=>s.pulls=[{head:{sha:SHA('9'),ref:'readiness/old-tests',repo:{id:RID}}}],'SKIP_CURRENT_OR_OPEN_PR']
 ];
 for(const [change,reason] of skips){const s=fake(plan);change(s);const result=await cleanup.cleanup(plan,{...s.options,apply:true});assert.equal(result.entries[0].status,reason);assert.deepEqual(s.deletes,[12]);}
 // Pages requires the known production workflow AND a successful deployment,
 // not merely a similarly named upload or a successful build step.
 for(const change of [s=>s.runs.get(102).workflow_id=999,s=>s.runs.get(102).path='fake-pages.yml',s=>s.runs.get(102).conclusion='cancelled',s=>s.jobs.set(102,[{name:'build',status:'completed',conclusion:'success'}]),s=>s.jobs.get(102)[1].conclusion='failure']){
  const s=fake(plan);change(s);const result=await cleanup.cleanup(plan,{...s.options,apply:true});assert.equal(result.entries[1].status,'SKIP_PAGES_RUN_NOT_DEPLOYED');assert.deepEqual(s.deletes,[11]);
 }
 await rejected(plan,s=>s.jobs.set(202,[{name:'build',status:'completed',conclusion:'success'}]),/RETAINED_PAGES_NOT_DEPLOYED/);
 await rejected(plan,s=>s.runs.get(202).workflow_id=999,/RETAINED_PAGES_NOT_DEPLOYED/);
 const recentPage=fake(plan);recentPage.runs.get(102).updated_at=ISO(NOW-3600000);const recentResult=await cleanup.cleanup(plan,{...recentPage.options,apply:true});assert.equal(recentResult.entries[1].status,'SKIP_RUN_TOO_RECENT');assert.deepEqual(recentPage.deletes,[11],'Old upload age cannot authorize deleting a recently redeployed run');
 for(const message of ['Merge pull request #999 from owner/release','Update sourced election briefing ','Revert Update sourced election briefing','Release app\nUpdate sourced election briefing']){const s=fake(plan);s.runs.get(102).head_commit.message=message;const result=await cleanup.cleanup(plan,{...s.options,apply:true});assert.equal(result.entries[1].status,'SKIP_PAGES_NOT_ROUTINE_BRIEFING');assert.deepEqual(s.deletes,[11],'A deployed merge/release package must survive even if omitted from the protection registry');}
 const retainedRelease=fake(plan);retainedRelease.runs.get(202).head_commit.message='Merge pull request #1000 from owner/release';assert.equal((await cleanup.cleanup(plan,{...retainedRelease.options,apply:true})).deleted_artifacts,2,'A successful newer release deployment is valid to retain');
 // A rollback/new main after initial inspection stops Pages deletion even
 // when its artifact metadata remains unchanged.
 const changedMain=fake(plan);let mainReads=0;changedMain.api.getMain=async()=>({commit:{sha:++mainReads===1?SHA('e'):SHA('9')}});
 let mainError;try{await cleanup.cleanup(plan,{...changedMain.options,apply:true});}catch(e){mainError=e;}
 assert.match(mainError.message,/MAIN_CHANGED_DURING_CLEANUP/);assert.deepEqual(changedMain.deletes,[]);assert.equal(mainError.receipt.deleted_bytes,0);
 const laterMain=fake(plan);let laterMainReads=0;laterMain.api.getMain=async()=>({commit:{sha:++laterMainReads<=2?SHA('e'):SHA('9')}});let laterMainError;try{await cleanup.cleanup(plan,{...laterMain.options,apply:true});}catch(e){laterMainError=e;}assert.match(laterMainError.message,/MAIN_CHANGED_DURING_CLEANUP/);assert.deepEqual(laterMain.deletes,[11]);
 const opened=fake(plan);let prReads=0;opened.api.listOpenPulls=async()=>++prReads===1?[]:[{head:{sha:SHA('e'),ref:'readiness/new-active-pr',repo:{id:RID}}}];let openedError;try{await cleanup.cleanup(plan,{...opened.options,apply:true});}catch(e){openedError=e;}assert.match(openedError.message,/OPEN_PR_PROTECTION_CHANGED_DURING_CLEANUP/);assert.deepEqual(opened.deletes,[],'A newly active PR aborts mutation even when its head was already in the protected head set');
 await rejected(plan,s=>s.onArtifact=(id,n,a)=>{if(id===11&&n===2)a.size_in_bytes++;return a;},/CANDIDATE_CHANGED_BEFORE_DELETE/);
 await rejected(plan,s=>s.onArtifact=(id,n,a)=>id===21&&n===2?null:a,/RETAINED_COPY_CHANGED_BEFORE_DELETE/);
 await rejected(plan,s=>s.onRun=(id,n,r)=>{if(id===201&&n===2)r.status='in_progress';return r;},/RETAINED_COPY_CHANGED_BEFORE_DELETE/);
 await rejected(plan,s=>s.onRun=(id,n,r)=>{if(id===101&&n===2)r.updated_at=ISO(NOW-3600000);return r;},/CANDIDATE_RUN_CHANGED_BEFORE_DELETE/);
 // No automatic retry or continuation after a mutation error; only confirmed
 // 204 deletions earn storage credit and the uncertain request stays explicit.
 const three=fixture();three.artifacts.push({...clone(three.artifacts[0]),id:13,digest:DIGEST('3')});three.expected_total_bytes+=111;
 const partial=fake(three);partial.fault={id:12,error:'ARTIFACT_DELETE_HTTP_429'};let partialError;
 try{await cleanup.cleanup(three,{...partial.options,apply:true});}catch(e){partialError=e;}
 assert.deepEqual(partial.deletes,[11,12]);assert.equal(partialError.receipt.status,'PARTIAL_FAILURE');assert.equal(partialError.receipt.deleted_artifacts,1);assert.equal(partialError.receipt.deleted_bytes,111);assert.equal(partialError.receipt.entries[1].status,'DELETE_REQUEST_UNCONFIRMED');assert.equal(partialError.receipt.entries[2].status,'READY');
 const secretError=fake(plan);secretError.fault={id:11,error:'FICTIONAL_NOT_A_CREDENTIAL'};let sanitized;
 try{await cleanup.cleanup(plan,{...secretError.options,apply:true});}catch(e){sanitized=e;}
 assert.equal(sanitized.receipt.status,'UNCONFIRMED_DELETE_FAILURE');assert(!JSON.stringify(sanitized.receipt).includes(env.GITHUB_TOKEN));
 const expiring=fixture();expiring.expires_at=ISO(NOW+200);const expires=fake(expiring);let expiryError;
 try{await cleanup.cleanup(expiring,{...expires.options,apply:true});}catch(e){expiryError=e;}assert.match(expiryError.message,/PLAN_EXPIRED_DURING_APPLY/);assert.deepEqual(expires.deletes,[11]);
 // Actual API adapter is limited to metadata and the exact DELETE endpoint,
 // refuses redirects/errors and does not retry a rate-limited mutation.
 const requests=[];const fetchImpl=async(url,options)=>{requests.push({url,options});return {status:options.method==='DELETE'?204:200,json:async()=>({jobs:[]})};};
 const api=cleanup.apiClient({token:'FICTIONAL_SECRET',fetchImpl});await api.getArtifact(123);await api.getRun(456);await api.getMain();await api.listOpenPulls(1);await api.getRunJobs(456);await api.deleteArtifact(123);
 assert(requests.every(r=>r.url.startsWith('https://api.github.com/repos/jmon18-rgb/Election-Command-Center/')&&r.options.redirect==='error'));
 assert.deepEqual(requests.filter(r=>r.options.method==='DELETE').map(r=>r.url),['https://api.github.com/repos/jmon18-rgb/Election-Command-Center/actions/artifacts/123']);
 const beforeInvalid=requests.length;assert.throws(()=>api.deleteArtifact('../runs/123'),/INVALID_API_ID/);assert.throws(()=>api.getArtifact(0),/INVALID_API_ID/);assert.throws(()=>api.listOpenPulls(21),/INVALID_API_PAGE/);assert.equal(requests.length,beforeInvalid,'Invalid identifiers cannot alter the fixed artifact endpoint');
 let attempts=0;const limited=cleanup.apiClient({fetchImpl:async()=>{attempts++;return {status:429};}});await assert.rejects(limited.deleteArtifact(123),/ARTIFACT_DELETE_HTTP_429/);assert.equal(attempts,1);
 // Bounded plan model: all50 candidates are separate runs, with8deployed
 // routine Pages packages and42synthetic copies. No metadata cache-sharing
 // between candidates is assumed; only their retained counterpart is shared.
 const fifty=fixture();fifty.artifacts=[...Array.from({length:42},(_,i)=>({...clone(fifty.artifacts[0]),id:1001+i,workflow_run:{...fifty.artifacts[0].workflow_run,id:3001+i}})),...Array.from({length:8},(_,i)=>({...clone(fifty.artifacts[1]),id:2001+i,workflow_run:{...fifty.artifacts[1].workflow_run,id:4001+i}}))];fifty.expected_total_bytes=fifty.artifacts.reduce((n,a)=>n+a.size_in_bytes,0);const bounded=fake(fifty);await cleanup.cleanup(fifty,{...bounded.options,apply:true});const modeledRequests=bounded.reads.length+bounded.deletes.length;assert.equal(bounded.deletes.length,50);assert(modeledRequests<500,'The reviewed8Pages/42synthetic plan remains below500 mocked GitHub requests');
 const workflow=fs.readFileSync('.github/workflows/cleanup-superseded-test-artifacts.yml','utf8');assert(!/\bschedule:|upload-artifact|upload-pages-artifact/.test(workflow));assert.match(workflow,/actions: write/);assert.match(workflow,/github\.event_name == 'push'/);assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);assert.match(workflow,/--validate-manifest/);assert.match(workflow,/if: github.event_name == 'pull_request' \|\| github.event_name == 'workflow_dispatch'/);assert(!/actions: write/.test(workflow.split('  cleanup:')[0]),'Validation and live read-only preflight must never obtain deletion permission');
 console.log('Reviewed Actions artifact cleanup PASS: fixed age/name/repository/workflow pins, preserved retained/current/open/release data, dry-run, preflight transaction, deploy proof, paced exact DELETE, expiry and partial-failure boundaries.50entry8Pages/42synthetic modeled requests='+modeledRequests+'. No network or mutation performed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
