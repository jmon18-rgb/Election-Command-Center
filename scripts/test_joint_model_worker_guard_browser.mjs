// Isolated full-app public-output boundary regression. Malformed values are
// synthetic RAM-only changes after normal computation, never source inputs.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness/ui-review/model-worker-public-guard');mkdirSync(out,{recursive:true});
const files=['index.html','scripts/joint_model_worker.js','scripts/joint_model_worker_controller.js','scripts/joint_count_snapshot_policy.js','scripts/chamber_control_model.js','scripts/national_county_likelihood.js','scripts/source_call_conditioning.js'];
const dashboard=process.env.DASHBOARD_TEST_URL?new URL(process.env.DASHBOARD_TEST_URL):null;
if(dashboard){assert.equal(dashboard.origin,'https://jmon18-rgb.github.io');assert.equal(dashboard.pathname,'/Election-Command-Center/');assert.equal(dashboard.username,'');assert.equal(dashboard.password,'');assert.equal(dashboard.search,'');assert(['','#electionNight'].includes(dashboard.hash));}
const publishedMain=dashboard?execFileSync('git',['rev-parse','origin/main'],{cwd:root,encoding:'utf8'}).trim():null;
if(dashboard){assert.equal(process.env.DASHBOARD_TEST_MAIN,publishedMain,'Root must verify final CURRENT-main Pages and bytes before published execution');assert(/^\d+$/.test(process.env.DASHBOARD_TEST_PAGES_RUN||''),'Root must supply its verified final successful Pages run');}
const pinned=Object.fromEntries(files.map(file=>[file,dashboard?execFileSync('git',['show',publishedMain+':'+file],{cwd:root,maxBuffer:16*1024*1024}):readFileSync(resolve(root,file))]));
const reviewedTags=dashboard?Object.fromEntries(files.filter(file=>file!=='index.html').map(file=>{const tags=pinned['index.html'].toString('utf8').match(/<script[^>]+src="([^"]+)"[^>]*>/g)||[],tag=tags.find(tag=>tag.includes(file+'?'));assert(tag,'Published index references '+file);return [file,tag.match(/src="([^"]+)"/)[1]];})):null;
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=dashboard?null:createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,key=p==='/'?'index.html':decodeURIComponent(p).slice(1),file=resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile())return res.writeHead(404).end();res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'}).end(pinned[key]||readFileSync(file));});
if(server)await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;const proofs=[];
async function start(width,height,missing=[]){
 const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[],blocked=[],missingHits=[],staticResponses=[],responseTasks=[];
 if(dashboard)page.on('response',response=>{const url=new URL(response.url()),file=url.pathname===dashboard.pathname?'index.html':url.pathname.startsWith(dashboard.pathname)?url.pathname.slice(dashboard.pathname.length):null;if(url.origin===dashboard.origin&&files.includes(file)&&response.ok())responseTasks.push(response.body().then(bytes=>staticResponses.push([file,createHash('sha256').update(bytes).digest('hex')])));});
 page.on('pageerror',error=>errors.push(error.message));await page.clock.install({time:new Date('2026-10-28T19:00:00Z')});
 await page.addInitScript(()=>{window.Worker=undefined;});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(dashboard?url.origin===dashboard.origin&&url.pathname.startsWith(dashboard.pathname):url.hostname==='127.0.0.1'){
  if(missing.some(name=>url.pathname.endsWith('/scripts/'+name+'.js'))){missingHits.push(url.pathname);return route.abort();}return route.continue();}
  blocked.push(url.hostname);return route.abort();});
 await page.goto(dashboard?.href||'http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
 await page.waitForFunction(()=>jointBasis&&jointLastResult?.probabilities);await page.evaluate(()=>jointWhenIdle());
 if(dashboard){const actual=await page.evaluate(files=>Object.fromEntries(files.map(file=>[file,document.querySelector('script[src*="'+file+'?"]')?.getAttribute('src')||null])),Object.keys(reviewedTags));assert.deepEqual(actual,reviewedTags,'Actual published script identities match final origin/main');await Promise.all(responseTasks);for(const file of files.filter(file=>!missing.some(name=>file==='scripts/'+name+'.js'))){assert(staticResponses.some(([name,hash])=>name===file&&hash===createHash('sha256').update(pinned[file]).digest('hex')),'Actual published static bytes match final origin/main '+file);}}
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 await page.evaluate(async()=>{jointPrivateEnabled=false;jointPrivateActivate();await jointWhenIdle();window.__guardOriginalNCL=NationalCountyLikelihood;window.__guardOriginalWorker=Worker;window.__guardOriginalEngine=ChamberControlModel;window.__guardOriginalRunner=window.JointModelWorkerRunner;});
 return {context,page,errors,blocked,missingHits};
}
async function runFault(page,{fault,path='worker_unavailable',publicOnly=false,runnerOnly=false}){
 return page.evaluate(async({fault,path,publicOnly,runnerOnly})=>{
  window.__guardNCLCalls={total:0,private:0,public:0};
  const corrupt=bundle=>{const next=structuredClone(bundle);
   if(fault==='nonfinite_public_scalar')next.result.house_dem_control_pct=NaN;
   else if(fault==='typed_public_metadata')next.result.__synthetic_raw_proposal=new Float64Array([1,2]);
   else if(fault==='nonfinite_diagnostics')next.diagnostics.synthetic={nested:Infinity};
   else if(fault==='serialized_private_key')next.result.synthetic={seeds:[1,2]};
   else if(fault==='typed_usage_key')next.diagnostics.synthetic={typed_usage:{candidate_method_cells:[[1,2]]}};
   else if(fault==='native_usage_key')next.baseline.synthetic={native_usage:{locality_clocks:['FICTIONAL']}};
   else if(fault==='typed_usage_schema')next.diagnostics.arbitrary_alias={schema:'already-admitted-va02-typed-usage-v2',localities:[]};
   else if(fault==='native_usage_schema')next.baseline.arbitrary_alias={schema:'validated-va02-native-usage-v1',localities:[]};
   else if(fault==='count_guide_key')next.diagnostics.synthetic={countProposalGuide:{codes:['OH-SEN'],likelihoodPower:.5}};
   else if(fault==='count_guide_schema')next.baseline.arbitrary_alias={schema:'PROPOSAL_ONLY_MARGINAL_COUNT_GUIDE_V2',codes:['OH-SEN'],likelihoodPower:.5};
   else if(fault==='nonfinite_baseline')next.baseline.synthetic=NaN;
   return next;};
  window.NationalCountyLikelihood={...window.__guardOriginalNCL,condition(...args){const options=args[3];window.__guardNCLCalls.total++;window.__guardNCLCalls[options.contextKey==='PUBLIC'?'public':'private']++;
   if(fault==='throw')throw Error('SYNTHETIC_NCL_FAILURE');
   const bundle=window.__guardOriginalNCL.condition(...args);return runnerOnly||publicOnly&&options.contextKey!=='PUBLIC'?bundle:corrupt(bundle);}};
  if(runnerOnly)window.JointModelWorkerRunner={...window.__guardOriginalRunner,run(...args){return corrupt(window.__guardOriginalRunner.run(...args));}};
  window.Worker=path==='worker_unavailable'?undefined:function(){throw Error('SYNTHETIC_CONSTRUCTION_FAILURE');};
  const decision=await jointRender(true);await jointWhenIdle();
  const frame=jointFrameSnapshot(jointValidatedFrameInputs(),jointFrameKey(jointValidatedFrameInputs()));
  const current={result:jointLastResult,baseline:jointPulseBaseline,diagnostics:{used:[]},publicComparison:jointPublicResult?{result:jointPublicResult,baseline:jointPublicResult,diagnostics:{used:[]}}:null,variants:{}};
  const state={fault,path,public_only:publicOnly,runner_only:runnerOnly,disposition:decision.status,current_model_present:Boolean(jointLastResult),accepted_cache:Boolean(jointCacheKey)&&!jointModelPending,
   public_fields_valid:jointPublicBundleValid(current,{...frame.payload,variants:[]}),public_comparison_present:Boolean(jointPublicResult),private_context:jointUsesPrivateContext(),
   malformed_scalar_admitted:Boolean(jointLastResult)&&Number.isNaN(jointLastResult.house_dem_control_pct),typed_array_admitted:Boolean(jointLastResult)&&ArrayBuffer.isView(jointLastResult.__synthetic_raw_proposal),
   county_update_withheld:/County update unavailable/.test(document.querySelector('#jointRunStatus').textContent),ncl_calls:{...window.__guardNCLCalls}};
  window.NationalCountyLikelihood=window.__guardOriginalNCL;window.JointModelWorkerRunner=window.__guardOriginalRunner;window.Worker=window.__guardOriginalWorker;
  return state;
 },{fault,path,publicOnly,runnerOnly});
}
function assertSafe(state,{withheld=true,privateContext=false}={}){
 assert.equal(state.disposition,'READY');assert.equal(state.current_model_present,true);assert.equal(state.accepted_cache,true);assert.equal(state.public_fields_valid,true);
 assert.equal(state.malformed_scalar_admitted,false);assert.equal(state.typed_array_admitted,false);assert.equal(state.private_context,privateContext);assert.equal(state.public_comparison_present,privateContext);
 assert.equal(state.county_update_withheld,withheld);
}
async function optionalResearch(page,mode){
 const records=await page.evaluate(async mode=>{
  const old={basis:jointBasis,privateEnabled:jointPrivateEnabled,privateData:jointPrivateData,privateSource:jointPrivateSource,shadow:jointBasisShadow,compatible:jointComputeCompatible,runner:window.JointModelWorkerRunner},records=[];
  const correlation=document.querySelector('#jointNightCorrelationDetails'),shadow=document.querySelector('#jointNightShadow').parentElement;
  const oldDisclosure={correlation:correlation.open,shadow:shadow.open};
  jointPrivateEnabled=true;jointPrivateData={};jointPrivateSource='manual';jointBasis=structuredClone(jointBasisPublic);jointBasis.private_imported_context={matched_senate_races:1,matched_house_races:0};
  correlation.open=true;await jointRender(true);await jointWhenIdle();
  const expectedPrimary=JSON.stringify(jointLastResult),expectedPublic=JSON.stringify(jointPublicResult);
  window.__optionalBundle=null;
  if(mode==='compatible')jointComputeCompatible=payload=>{const output=old.compatible(payload);window.__optionalBundle=output;return output;};
  else window.JointModelWorkerRunner={...old.runner,run(...args){const output=old.runner.run(...args);window.__optionalBundle=output;return output;}};
  const faults=['nonfinite','arraybuffer','bigint','function','serialized_raw','private_transport_margins','private_transport_cache','typed_usage_key','native_usage_key','typed_usage_schema','native_usage_schema','count_guide_key','count_guide_schema','cycle','wrong_samples','alias_positive'];
  for(const fault of faults){
   window.ChamberControlModel={...window.__guardOriginalEngine,simulate(basis,options){const result=window.__guardOriginalEngine.simulate(basis,options);if(!options.senateCorrelationResearch)return result;const next=structuredClone(result);
    if(fault==='nonfinite')next.synthetic={number:NaN};else if(fault==='arraybuffer')next.synthetic=new ArrayBuffer(8);else if(fault==='bigint')next.synthetic=1n;else if(fault==='function')next.synthetic=()=>1;
    else if(fault==='serialized_raw')next.synthetic={basis:{}};else if(fault==='private_transport_margins')next.synthetic={transport_margins:[1,2]};else if(fault==='private_transport_cache')next.synthetic={transportCache:{}};else if(fault==='typed_usage_key')next.synthetic={typed_usage:{}};else if(fault==='native_usage_key')next.synthetic={native_usage:{}};else if(fault==='typed_usage_schema')next.synthetic={schema:'already-admitted-va02-typed-usage-v2',localities:[]};else if(fault==='native_usage_schema')next.synthetic={schema:'validated-va02-native-usage-v1',localities:[]};else if(fault==='count_guide_key')next.synthetic={countProposalGuide:{codes:['OH-SEN'],likelihoodPower:.5}};else if(fault==='count_guide_schema')next.synthetic={schema:'PROPOSAL_ONLY_MARGINAL_COUNT_GUIDE_V2',codes:['OH-SEN'],likelihoodPower:.5};else if(fault==='cycle')next.synthetic=next;else if(fault==='wrong_samples')next.samples=900;else{const shared={safe:true};next.synthetic={left:shared,right:shared};}return next;}};
   const decision=await jointRender(true);await jointWhenIdle();const bundle=window.__optionalBundle;
   records.push({mode,fault,disposition:decision.status,matching_private_public_preserved:JSON.stringify(jointLastResult)===expectedPrimary&&JSON.stringify(jointPublicResult)===expectedPublic,public_fields_valid:jointPublicBundleValid(bundle,jointFrameSnapshot(jointValidatedFrameInputs(),jointFrameKey(jointValidatedFrameInputs())).payload),optional_quarantined:fault==='alias_positive'?Object.values(bundle.variants).every(row=>Boolean(row.result)&&row.errorCode===null):Object.values(bundle.variants).every(row=>row.result===null&&row.errorCode==='OPTIONAL_VARIANT_UNAVAILABLE')});
  }
  // The public-only House shadow uses the same quarantine; no invented district
  // input is admitted: a cloned public basis is an explicit isolated test fixture.
  if(mode==='compatible'){
   jointPrivateEnabled=false;jointPrivateData=null;jointBasis=jointBasisPublic;correlation.open=false;shadow.open=true;jointBasisShadow=structuredClone(jointBasisPublic);jointBasisShadow.__optionalShadowFixture=true;jointBasisShadow.fundamentals_shadow={paired_districts:1};window.ChamberControlModel=window.__guardOriginalEngine;await jointRender(true);await jointWhenIdle();const expected=JSON.stringify(jointLastResult);
   window.ChamberControlModel={...window.__guardOriginalEngine,simulate(basis,options){const result=window.__guardOriginalEngine.simulate(basis,options);if(basis.__optionalShadowFixture){const next=structuredClone(result);next.synthetic=new Float64Array([1,2]);return next;}return result;}};
   const decision=await jointRender(true);await jointWhenIdle();records.push({mode,fault:'house_shadow_typed',disposition:decision.status,matching_private_public_preserved:JSON.stringify(jointLastResult)===expected&&jointPublicResult===null,public_fields_valid:jointPublicBundleValid(window.__optionalBundle,jointFrameSnapshot(jointValidatedFrameInputs(),jointFrameKey(jointValidatedFrameInputs())).payload),optional_quarantined:window.__optionalBundle.variants.house_shadow?.result===null&&window.__optionalBundle.variants.house_shadow?.errorCode==='OPTIONAL_VARIANT_UNAVAILABLE'});
  }
  window.ChamberControlModel=window.__guardOriginalEngine;window.JointModelWorkerRunner=old.runner;jointComputeCompatible=old.compatible;jointBasis=old.basis;jointPrivateEnabled=old.privateEnabled;jointPrivateData=old.privateData;jointPrivateSource=old.privateSource;jointBasisShadow=old.shadow;correlation.open=oldDisclosure.correlation;shadow.open=oldDisclosure.shadow;await jointRender(true);await jointWhenIdle();return records;
 },mode);
 for(const row of records){assert.equal(row.disposition,'READY',row.mode+'/'+row.fault);assert.equal(row.matching_private_public_preserved,true,row.mode+'/'+row.fault);assert.equal(row.public_fields_valid,true,row.mode+'/'+row.fault);assert.equal(row.optional_quarantined,true,row.mode+'/'+row.fault);}
 return records;
}

try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const [width,height]of [[1366,900],[390,844]]){
  const main=await start(width,height),{page}=main,records=[];
  for(const fault of ['nonfinite_public_scalar','typed_public_metadata'])for(const path of ['worker_unavailable','worker_construction_failure']){const state=await runFault(page,{fault,path});assertSafe(state);records.push(state);}
  for(const fault of ['nonfinite_diagnostics','serialized_private_key','nonfinite_baseline','throw','typed_usage_key','native_usage_key','typed_usage_schema','native_usage_schema','count_guide_key','count_guide_schema']){const state=await runFault(page,{fault});assertSafe(state);records.push(state);}
  // The normal MAIN runner itself is also an optional boundary: even a corrupt
  // returned diagnostic must be discarded, preserving the unchanged valid NCL.
  const runner=await runFault(page,{fault:'nonfinite_diagnostics',runnerOnly:true});assertSafe(runner,{withheld:false});records.push(runner);
  await page.evaluate(async()=>{window.__guardPublicBasis=jointBasisPublic;jointPrivateEnabled=true;jointPrivateData={};jointPrivateSource='manual';jointBasis=structuredClone(jointBasisPublic);jointBasis.private_imported_context={matched_senate_races:1,matched_house_races:0};jointBasis.senate[0].mean+=.01;await jointRender(true);await jointWhenIdle();window.__guardOldPublic=jointPublicResult;});
  const publicBad=await runFault(page,{fault:'nonfinite_public_scalar',publicOnly:true});assertSafe(publicBad,{withheld:false,privateContext:true});assert(publicBad.ncl_calls.private>0&&publicBad.ncl_calls.public>0);records.push(publicBad);
  assert.equal(await page.evaluate(()=>jointPublicResult!==window.__guardOldPublic),true,'Matching PUBLIC fallback is newly computed atomically, not a previous public frame');
  await page.evaluate(async()=>{jointPrivateEnabled=false;jointPrivateData=null;jointBasis=jointBasisPublic;await jointRender(true);await jointWhenIdle();});
  // A malformed final engine fallback is withheld before current claims/history.
  const rejected=await page.evaluate(async()=>{const before={history:enOutlookHistory.events('PUBLIC').length,audit:enOfficialAdmissionAudit.events().length};
   window.NationalCountyLikelihood={...window.__guardOriginalNCL,condition(){throw Error('SYNTHETIC_NCL_FAILURE');}};
   window.ChamberControlModel={...window.__guardOriginalEngine,simulate(...args){const result=window.__guardOriginalEngine.simulate(...args);result.synthetic={metadata:NaN};return result;}};
   const decision=await jointRender(true);await jointWhenIdle();const after={history:enOutlookHistory.events('PUBLIC').length,audit:enOfficialAdmissionAudit.events().length};
   const output={disposition:decision.status,current_model_absent:jointLastResult===null,baseline_absent:jointPulseBaseline===null,public_absent:jointPublicResult===null,accepted_cache_absent:jointCacheKey==='',history_audit_unchanged:JSON.stringify(before)===JSON.stringify(after)};
   window.ChamberControlModel=window.__guardOriginalEngine;window.NationalCountyLikelihood=window.__guardOriginalNCL;await jointRender(true);await jointWhenIdle();return output;});
  assert.deepEqual(rejected,{disposition:'UNAVAILABLE',current_model_absent:true,baseline_absent:true,public_absent:true,accepted_cache_absent:true,history_audit_unchanged:true});
  const runnerOptional=await optionalResearch(page,'runner');assert.deepEqual(main.errors,[]);await main.context.close();
  const availability=[];
  for(const missing of [['joint_model_worker'],['joint_model_worker_controller'],['joint_model_worker','joint_model_worker_controller']]){
   const fixture=await start(width,height,missing),states=[];assert.equal(fixture.missingHits.length,missing.length);
   assert.equal(await fixture.page.evaluate(()=>jointPulseBaseline===jointLastResult),true,'Clean no-call result/baseline alias remains usable without optional assets');
   for(const fault of ['nonfinite_public_scalar','typed_public_metadata']){const state=await runFault(fixture.page,{fault});assertSafe(state);states.push(state);}
   const optional=missing.length===2?await optionalResearch(fixture.page,'compatible'):null;assert.deepEqual(fixture.errors,[]);availability.push({optional_variant_quarantine:optional,missing_assets:missing,blocked_asset_requests:fixture.missingHits.length,clean_alias_accepted:true,states,blocked_external_requests:fixture.blocked.length});await fixture.context.close();
  }
  const helper=await start(width,height,['source_call_conditioning']);
  const helperResult=await helper.page.evaluate(async()=>{const original=jointLiveObservations;jointLiveObservations=()=>{jointPulseRows=[];jointDescriptiveReturns=[];return {'IA-SEN':{mode:'source_called',winnerParty:'D'}};};const decision=await jointRender(true);await jointWhenIdle();const race=jointLastResult?.race_probabilities.find(row=>row.race_code==='IA-SEN');const output={disposition:decision.status,source_call_helper_absent:!window.SourceCallConditioning,validated_D_winner_retained:race?.dem_beats_rep_pct===100,broader_call_conditioning_withheld:jointLastResult?.source_call_conditioning?.status==='WITHHELD',independent_no_credit:jointLastResult?.senate_independent_credit_mode==='no_credit'};jointLiveObservations=original;return output;});
  assert.deepEqual(helperResult,{disposition:'READY',source_call_helper_absent:true,validated_D_winner_retained:true,broader_call_conditioning_withheld:true,independent_no_credit:true});assert.deepEqual(helper.errors,[]);await helper.context.close();
  proofs.push({width,height,runner_optional_variant_quarantine:runnerOptional,normal_assets:records,invalid_engine_fallback:rejected,optional_asset_availability:availability,missing_proposal_helper:helperResult,blocked_external_requests:main.blocked.length,actual_native_provider_gets:0});
 }
 const report={schema:'joint-model-public-boundary-browser-v1',at:new Date().toISOString(),status:'PASS',scope:dashboard?'Actual published HTTPS app; actual served static bytes and script identities match final origin/main blobs. No HTML/script content overrides, only deliberate optional-asset request aborts. Synthetic RAM-only output faults; all external/election providers blocked.':'Actual isolated full app; model source unchanged; synthetic RAM-only malformed result fixtures and explicit observation-layer validated-call fixture. Genuine optional script request failures, all election/external providers blocked.',...(dashboard?{publication_url:dashboard.href,final_current_main:publishedMain,final_current_main_pages:Number(process.env.DASHBOARD_TEST_PAGES_RUN),actual_published_static_bytes_match:true}:{}),local_server_started:!dashboard,source_sha256:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(pinned[file]).digest('hex')])),proofs,private_numeric_values_recorded:false,human_acceptance:'NOT_RUN',calibration:'NOT_ESTABLISHED'};
 writeFileSync(resolve(out,'public-output-guard.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,proof:resolve(out,'public-output-guard.json'),viewports:proofs.map(row=>({width:row.width,height:row.height,normal_fault_cases:row.normal_assets.length,optional_asset_contexts:row.optional_asset_availability.length,missing_helper:true}))}));
}finally{await browser?.close();if(server)await new Promise(ok=>server.close(ok));}
