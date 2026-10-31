// Actual application research UI. No HTML/script/provider/model-function override.
// Composition entries below are explicitly fictional assumptions, not turnout data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

let root=import.meta.dirname;
while(!existsSync(resolve(root,'index.html'))){const next=dirname(root);assert.notEqual(next,root);root=next;}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const harnessSHA=hash(readFileSync(new URL(import.meta.url)));
const out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness/ui-review/research-sensitivity-'+Date.now());
assert(!existsSync(out),'Use a fresh output directory; preserve every first failure');
const dashboard=process.env.DASHBOARD_TEST_URL?new URL(process.env.DASHBOARD_TEST_URL):null;
if(dashboard){
 assert.equal(process.env.PR543_PUBLISHED_RESEARCH_AUTHORIZED,'FINAL_CURRENT_MAIN_PAGES_AND_BYTES_VERIFIED');
 assert.equal(dashboard.origin,'https://jmon18-rgb.github.io');assert.equal(dashboard.pathname,'/Election-Command-Center/');
 assert.equal(dashboard.search,'');assert.equal(dashboard.username,'');assert.equal(dashboard.password,'');
 assert(['','#electionNight'].includes(dashboard.hash));
}
const publishedMain=dashboard?execFileSync('git',['rev-parse','origin/main'],{cwd:root,encoding:'utf8'}).trim():null;
if(dashboard){assert.equal(process.env.DASHBOARD_TEST_MAIN,publishedMain);assert(/^\d+$/.test(process.env.DASHBOARD_TEST_PAGES_RUN||''));}
const pinFiles=[
 'index.html','scripts/electorate_what_if_2026.js','scripts/active_race_input_diagnostics.js',
 'scripts/private_senate_fundamentals.js','scripts/chamber_control_model.js','scripts/source_call_conditioning.js',
 'scripts/national_county_likelihood.js','scripts/joint_model_worker.js','scripts/joint_model_worker_controller.js',
 'scripts/joint_count_snapshot_policy.js','scripts/personal_election_focus.js','scripts/official_admission_audit.js',
 'scripts/election_night_poll_closings_2026.js','scripts/washington_remaining_source.js','scripts/washington_remaining_scenarios.js',
 'scripts/recorded_asset_lineage.js','data/polling_estimates.json','data/race_probabilities.json','data/seat_universe.json',
 'ZqBdM (1).csv','f3ome (1).csv'
];
assert.equal(new Set(pinFiles).size,pinFiles.length);
const bytes=file=>dashboard?execFileSync('git',['show',publishedMain+':'+file],{cwd:root,maxBuffer:32*1024*1024}):readFileSync(resolve(root,file));
const pinned=Object.fromEntries(pinFiles.map(file=>[file,bytes(file)]));
const runtimeReferences=[...pinned['index.html'].toString().matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)].map(m=>m[1]);
assert.equal(runtimeReferences.length,93,'Promoted PR543 canonical runtime reference contract');
const scripts=pinFiles.filter(file=>file.startsWith('scripts/'));
const tags=Object.fromEntries(scripts.map(file=>{
 const found=[...pinned['index.html'].toString().matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)].filter(m=>m[1].startsWith('./'+file+'?'));
 assert.equal(found.length,1,'Actual promoted index must include '+file);return[file,found[0][1]];
}));
const importsLiteral=pinned['scripts/joint_model_worker.js'].toString().match(/const IMPORTS=Object\.freeze\(\((\[[^\n]+\])\)\.map\(Object\.freeze\)\)/);
assert(importsLiteral,'Actual fixed Worker import registry is readable');
const workerImports=JSON.parse(importsLiteral[1]);assert.equal(workerImports.length,6);
for(const asset of workerImports){const file='scripts/'+asset.name+'.js';assert(pinFiles.includes(file));assert.equal(tags[file],'./'+file+'?v='+asset.stamp);}
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.csv':'text/csv','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg'};
const server=dashboard?null:createServer((req,res)=>{
 let path;try{path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return res.writeHead(400).end();}
 const file=resolve(root,'.'+(path==='/'?'/index.html':path));
 if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile())return res.writeHead(404).end();
 // Serve actual files unchanged. Expected pins are comparison bytes, never a body replacement.
 res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'}).end(readFileSync(file));
});
if(server)await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=dashboard?.href||'http://127.0.0.1:'+server.address().port+'/';
const initialInputTerminal=()=>{
 const text=document.querySelector('#privateContextStatus')?.textContent||'';
 return jointPrivateSource==='repository'&&text.startsWith('Repository fundamentals ACTIVE');
};
const currentPredicate=()=>Boolean(
 enModeYear===2026&&jointCompletedFrame&&jointBasis&&jointLastResult?.samples===3000&&jointPulseBaseline?.samples===3000&&
 !jointModelPending&&!jointAsOfSnapshot&&!jointActiveKey&&jointRefreshTimer===null&&
 jointCacheKey===jointCompletedFrame.key&&jointCompletedFrame.key===jointFrameKey(jointValidatedFrameInputs())&&
 jointCompletedFrame.modelRevision===jointModelCodeRevision()&&jointCompletedFrame.payload.args.samples===3000&&
 jointCompletedFrame.payload.args.independentSenateCredit==='no_credit'&&modelOddsValidate(modelRaceOddsData,latestSenateEstimates)
);
async function waitCurrent(page){await page.waitForFunction(initialInputTerminal);await page.evaluate(()=>jointWhenIdle());await page.waitForFunction(currentPredicate);}
async function selectRace(page,office,code){
 await page.locator('[data-model-scope="'+office+'"]').click();
 const row=page.locator('#modelBoard [data-model-race="'+code+'"]');assert.equal(await row.count(),1);
 await row.click();await page.waitForFunction(({office,code})=>modelMode===office&&selectedModelState===code,{office,code});
}
async function diagnostic(page,office,code){
 await selectRace(page,office,code);
 return page.evaluate(({office,code})=>{
  const d=modelRaceInputDiagnostics.get(modelRaceOddsData)?.get(office+'|'+code),host=document.querySelector('#modelOddsReconciliation');
  if(!d||d.status!=='AVAILABLE')return{available:false};
  const text=host.textContent;
  return{available:true,race:code,office,source_kind:d.source_kind,source_context:d.source_context,imported:d.imported_context_active,
   global_imported_context:jointUsesPrivateContext(),public_anchor_withheld:d.anchor_margin_points===null,
   source_label_matches:text.includes('Active input: '+d.source_label+'.'),
   poll_weight_matches:text.includes('poll weight '+Math.round(100*d.poll_weight)+'%'),
   anchor_weight_matches:text.includes('anchor weight '+Math.round(100*d.anchor_weight)+'%'),
   anchor_matches:d.anchor_margin_points===null?text.includes('Exact active anchor is not exposed'):text.includes('Active anchor '+marginText(d.anchor_margin_points)+'.'),
   prior_matches:text.includes('Modeled prior '+marginText(d.active_prior_margin_points)+'.'),
   public_baseline_matches:d.public_baseline_prior_margin_points===null||text.includes('Unaugmented public prior '+marginText(d.public_baseline_prior_margin_points)+'.'),
   race_specific_no_import:text.includes('No imported candidate anchor is active for this race; its public basis is used.'),
   global_no_import:text.includes('Imported candidate fundamentals are NOT active on this device.'),
   result_record_not_extended:!Object.keys(modelRaceOddsData.records.find(x=>x.office===office&&x.race_code===code)).some(k=>['anchor_margin_points','private_context_anchor_points','source_context','active_prior_margin_points'].includes(k)),
   diagnostic_not_serialized:!JSON.stringify([jointLastResult,jointPublicResult,jointPulseBaseline,modelRaceOddsData]).includes('DERIVED_INPUT_EXPLANATION_NOT_A_FORECAST_OR_SOURCE_ADMISSION'),
   captured_frozen:Object.isFrozen(d),formula_status:d.formula_status};
 },{office,code});
}
function assertDiagnostic(d){assert.equal(d.available,true);for(const field of ['source_label_matches','poll_weight_matches','anchor_weight_matches','anchor_matches','prior_matches','public_baseline_matches','result_record_not_extended','diagnostic_not_serialized','captured_frozen'])assert.equal(d[field],true,field);}
async function saveAcceptedBoundary(page){
 await page.evaluate(()=>{
  const refs=[jointLastResult,jointPublicResult,jointPulseBaseline,modelRaceOddsData,jointBasis,jointBasisPublic,jointCompletedFrame];
  const history=()=>[enOutlookHistory.events('PUBLIC'),enOutlookHistory.events('LOCAL_RESEARCH_VARIANT'),enOfficialAdmissionAudit.events()];
  window.__researchAcceptedBoundary={refs,values:JSON.stringify(refs),history:JSON.stringify(history()),epoch:jointRequestEpoch,key:jointCacheKey};
 });
}
async function acceptedUnchanged(page){return page.evaluate(()=>{
 const before=window.__researchAcceptedBoundary,now=[jointLastResult,jointPublicResult,jointPulseBaseline,modelRaceOddsData,jointBasis,jointBasisPublic,jointCompletedFrame];
 return{all_object_identities:now.every((x,i)=>x===before.refs[i]),whole_values_equal:JSON.stringify(now)===before.values,
  history_and_audit_equal:JSON.stringify([enOutlookHistory.events('PUBLIC'),enOutlookHistory.events('LOCAL_RESEARCH_VARIANT'),enOfficialAdmissionAudit.events()])===before.history,
  same_epoch:jointRequestEpoch===before.epoch,same_key:jointCacheKey===before.key,samples:jointLastResult.samples,baseline_samples:jointPulseBaseline.samples,
  no_pending:!jointModelPending&&!jointAsOfSnapshot&&!jointActiveKey&&jointRefreshTimer===null,
  exact_frame_inputs:jointCompletedFrame.key===jointFrameKey(jointValidatedFrameInputs()),public_context:!jointUsesPrivateContext()&&jointCompletedFrame.contextKey==='PUBLIC'};
});}
function assertAccepted(state){for(const key of ['all_object_identities','whole_values_equal','history_and_audit_equal','same_epoch','same_key','no_pending','exact_frame_inputs','public_context'])assert.equal(state[key],true,key);assert.equal(state.samples,3000);assert.equal(state.baseline_samples,3000);}
async function fill(page,values){for(const[id,value]of Object.entries(values))await page.locator('#'+id).fill(String(value));}
let browser,activePage;const reports=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const[width,height]of[[1366,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage();activePage=page;
  const errors=[],blocked=[],pinErrors=[],pendingPins=[],served=new Map(),reserved=new Set(),counters={requests:0,workers:0,external_attempts:0};
  page.on('pageerror',e=>errors.push(e.message));page.on('request',()=>counters.requests++);page.on('worker',()=>counters.workers++);
  context.on('response',response=>{
   const u=new URL(response.url()),prefix=dashboard?.pathname||'/',own=dashboard?u.origin===dashboard.origin:u.hostname==='127.0.0.1';
   if(!own||!u.pathname.startsWith(prefix))return;
   const file=u.pathname===prefix?'index.html':decodeURIComponent(u.pathname.slice(prefix.length));
   if(!pinFiles.includes(file)||reserved.has(file))return;reserved.add(file);
   pendingPins.push(response.body().then(body=>{assert.equal(response.status(),200,file);assert(body.equals(pinned[file]),'First actual response bytes: '+file);served.set(file,hash(body));}).catch(e=>pinErrors.push(e.message)));
  });
  await context.route('**/*',route=>{
   const u=new URL(route.request().url()),own=dashboard?u.origin===dashboard.origin&&u.pathname.startsWith(dashboard.pathname):u.hostname==='127.0.0.1';
   if(own)return route.continue();counters.external_attempts++;blocked.push(u.hostname);return route.abort();
  });
  await page.clock.install({time:new Date()});
  const entry=new URL(base);entry.hash='electionNight';await page.goto(entry.href,{waitUntil:'load'});
  await page.locator('#enMode2026').click();await waitCurrent(page);
  await page.waitForFunction(()=>jointPrivatePollData?.polling_source_generated_at===latestSenateEstimates.generated_at&&jointPrivatePollData?.polling_source_snapshot===latestSenateEstimates.source_snapshot);
  await page.locator('[data-page="model"]').click();
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('script[src]')].map(node=>node.getAttribute('src'))),runtimeReferences,'Actual DOM preserves all93 runtime URL identities in order');
  assert.deepEqual(await page.evaluate(files=>Object.fromEntries(files.map(file=>[file,document.querySelector('script[src*="'+file+'?"]')?.getAttribute('src')||null])),scripts),tags);
  const races=await page.evaluate(()=>{
   const records=modelRaceOddsData.records,diags=modelRaceInputDiagnostics.get(modelRaceOddsData);
   const choose=office=>records.filter(r=>r.office===office&&diags.get(office+'|'+r.race_code)?.imported_context_active).sort((a,b)=>(a.race_code==='MI-SEN'?-1:b.race_code==='MI-SEN'?1:a.race_code.localeCompare(b.race_code)))[0]?.race_code;
   return{senate:choose('senate'),house:choose('house')};
  });
  assert(races.senate&&races.house,'Actual committed repository inputs must exercise both imported offices');
  const importedSenate=await diagnostic(page,'senate',races.senate),importedHouse=await diagnostic(page,'house',races.house);
  assertDiagnostic(importedSenate);assertDiagnostic(importedHouse);assert.equal(importedSenate.imported,true);assert.equal(importedHouse.imported,true);
  assert.equal(importedSenate.source_context,'REPOSITORY');assert.equal(importedHouse.source_context,'REPOSITORY');
  await page.evaluate(()=>{window.__capturedResearchInput={snapshot:modelRaceOddsData,map:modelRaceInputDiagnostics.get(modelRaceOddsData),value:JSON.stringify([...modelRaceInputDiagnostics.get(modelRaceOddsData)])};});
  const workbench=page.locator('#privateContextWorkbench');if(!await workbench.evaluate(n=>n.open))await workbench.locator(':scope > summary').click();
  await page.locator('#privateContextHouse').uncheck();await waitCurrent(page);
  const mixed=await diagnostic(page,'house',races.house);assertDiagnostic(mixed);assert.equal(mixed.imported,false);assert.equal(mixed.global_imported_context,true);assert.equal(mixed.public_anchor_withheld,true);assert.equal(mixed.race_specific_no_import,true);assert.equal(mixed.global_no_import,false);
  await page.locator('#privateContextEnabled').uncheck();await waitCurrent(page);
  const publicHouse=await diagnostic(page,'house',races.house),publicSenate=await diagnostic(page,'senate',races.senate);assertDiagnostic(publicHouse);assertDiagnostic(publicSenate);
  assert.equal(publicHouse.imported,false);assert.equal(publicHouse.public_anchor_withheld,true);assert.equal(publicHouse.global_no_import,true);
  assert.equal(publicSenate.source_kind,'PUBLIC_2026_GEOGRAPHIC_ENVIRONMENT');assert.equal(publicSenate.imported,false);
  const capture=await page.evaluate(()=>{const x=window.__capturedResearchInput;return{older_snapshot_distinct:x.snapshot!==modelRaceOddsData,older_values_unchanged:JSON.stringify([...modelRaceInputDiagnostics.get(x.snapshot)])===x.value,new_public_has_no_imported_diagnostics:[...modelRaceInputDiagnostics.get(modelRaceOddsData).values()].every(d=>!d.imported_context_active),snapshot_keys:Object.keys(modelRaceOddsData).sort()};});
  assert.equal(capture.older_snapshot_distinct,true);assert.equal(capture.older_values_unchanged,true);assert.equal(capture.new_public_has_no_imported_diagnostics,true);
  assert.deepEqual(capture.snapshot_keys,['calculation_snapshot','polling_source_generated_at','race_probability_method','records','samples','schema_version','senate_prior_mode','status']);
  // The existing Electorate Lab belongs to Brief, while the input explanations
  // above belong to Model. Navigate through the actual page controls.
  await page.locator('[data-page="brief"]').click();
  // Complete native bootstrap first; only then pause app timers during synchronous research.
  await page.waitForLoadState('networkidle');await waitCurrent(page);
  assert(counters.workers>0,'Use a genuine application Worker, not a synchronous fallback');
  assert.equal(await page.evaluate(()=>jointWorkerCompatibility),false);
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));await waitCurrent(page);
  const lab=page.locator('#electorateLabDetails'),labSummary=lab.locator(':scope > summary');assert.equal(await lab.evaluate(n=>n.open),false);
  await labSummary.focus();await labSummary.press('Space');assert.equal(await lab.evaluate(n=>n.open),true);assert.equal(await labSummary.evaluate(n=>document.activeElement===n),true,'Native research disclosure is keyboard operable');
  assert.equal(await page.locator('#labMode').inputValue(),'margin');assert.equal(await page.locator('#labScale').inputValue(),'1');
  await page.locator('#labScope').selectOption('national');await page.locator('#labMode').selectOption('composition');await page.locator('#labScale').selectOption('1.5');
  assert.equal(await page.locator('#labState').isDisabled(),true);assert.equal(await page.locator('#labCompositionFields').isVisible(),true);
  await fill(page,{labNoncollegeShare:30,labHispanicShare:20,labNoncollegeShift:4,labHispanicShift:-2,labNoncollegeBaselineMargin:-20,labHispanicBaselineMargin:40,labRemainderMargin:0,labRemainderShift:1,labNoncollegeParticipation:1.2,labHispanicParticipation:1,labRemainderParticipation:1});
  await saveAcceptedBoundary(page);const beforeResearch={...counters};await page.locator('#labRun').click();
  assert.match(await page.locator('#labStatus').innerText(),/National.*all 50 states.*2,000 matched correlated simulation draws.*headline forecast unchanged/);
  const scenario=await page.evaluate(()=>{
   // Independent arithmetic for the entered fictional assumptions; no second sampler call.
   const shares=[.3,.2,.5],baseline=[-20,40,0],change=[4,-2,1],t=[1.2,1,1],scale=1.5;
   const rate=t.map(x=>1+scale*(x-1)),total=shares.reduce((n,x,i)=>n+x*rate[i],0),newShares=shares.map((x,i)=>x*rate[i]/total);
   const b=shares.reduce((n,x,i)=>n+x*baseline[i],0),a=newShares.reduce((n,x,i)=>n+x*(baseline[i]+scale*change[i]),0),shift=a-b;
   const rows=[...jointBasis.senate,...jointBasis.governors,...jointBasis.house],excluded=rows.filter(x=>x.nonrep_independent_proxy===true).map(x=>x.code),eligible=rows.filter(x=>x.nonrep_independent_proxy!==true),by=new Map(eligible.map(x=>[x.code,x]));
   const table=[...document.querySelectorAll('#labResults tbody tr')].map(tr=>[...tr.cells].map(td=>td.textContent)),ids=table.map(c=>c[0]);
   const note=document.querySelector('#labResults').textContent;
   return{national_state_count:new Set(jointBasis.house.map(x=>x.state)).size,expected_eligible:eligible.length,table_rows:table.length,table_ids_unique:new Set(ids).size===ids.length,
    exact_eligible_ID_set:ids.slice().sort().join('|')===eligible.map(x=>x.code).sort().join('|'),
    exact_prior_columns:table.every(c=>c.length===6&&by.has(c[0])&&c[4]===marginText(by.get(c[0]).mean)&&c[5]===marginText(by.get(c[0]).mean+shift)),
    finite_probability_cells:table.every(c=>[c[1],c[2]].every(x=>/^\d+(?:\.\d+)?%$/.test(x)&&Number(x.slice(0,-1))>=0&&Number(x.slice(0,-1))<=100)),
    independent_axes:excluded,independent_axes_omitted:excluded.every(code=>!ids.includes(code)),independent_axes_visible:excluded.every(code=>note.includes(code)),
    composition_mass_text:note.includes(newShares.map(x=>(100*x).toFixed(1)+'%').join(' / ')),relative_participation_text:note.includes(total.toFixed(3)+'×'),
    baseline_scenario_margin_text:note.includes(marginText(b)+' → '+marginText(a)),all_five_comparison_tiles:document.querySelectorAll('#labResults .scenario-tile').length===5,
    table_headers:[...document.querySelectorAll('#labResults thead th')].map(x=>x.textContent)};
  });
  assert.equal(scenario.national_state_count,50);assert.equal(scenario.table_rows,scenario.expected_eligible);for(const field of ['table_ids_unique','exact_eligible_ID_set','exact_prior_columns','finite_probability_cells','independent_axes_omitted','independent_axes_visible','composition_mass_text','relative_participation_text','baseline_scenario_margin_text','all_five_comparison_tiles'])assert.equal(scenario[field],true,field);
  assert(scenario.independent_axes.includes('NE-SEN'),'Exercise actual Independent proxy; never invent one in the fixture');
  assert.deepEqual(scenario.table_headers,['Race','Before D wins','Scenario D wins','Change','Before prior margin','Scenario prior margin']);
  assertAccepted(await acceptedUnchanged(page));assert.deepEqual(counters,beforeResearch,'Research creates no source request or live Worker');
  const table=page.locator('.electorate-lab-table-scroll');await table.focus();assert.equal(await table.evaluate(n=>document.activeElement===n),true);
  const scrollBefore=await table.evaluate(n=>({left:n.scrollLeft,overflow:n.scrollWidth>n.clientWidth,role:n.getAttribute('role'),label:n.getAttribute('aria-label')}));await table.press('ArrowRight');await page.clock.runFor(32);
  // Native compositor scrolling runs on real time, separately from the paused app clock.
  // Observe its commit under the existing Playwright operation timeout; retain the original key, virtual pump and assertion.
  if(scrollBefore.overflow)await page.waitForFunction(left=>document.querySelector('.electorate-lab-table-scroll').scrollLeft>left,scrollBefore.left,{polling:20});
  const scrollAfter=await table.evaluate(n=>n.scrollLeft);if(scrollBefore.overflow)assert(scrollAfter>scrollBefore.left,'Native keyboard scrolls the horizontal research region');assert.equal(scrollBefore.role,'region');assert.equal(scrollBefore.label,'Hypothetical race comparisons');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'Comparison table does not overflow the page');
  await page.locator('#labStatus').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'national-composition-'+width+'.png')});
  const invalid=[];
  for(const name of ['BLANK_REQUIRED_PREFERENCE','OVERSUBSCRIBED_SHARES','ZERO_PARTICIPATION','OVER_12_POINT_SHIFT']){
   await page.locator('#labMode').selectOption(name==='OVER_12_POINT_SHIFT'?'margin':'composition');await page.locator('#labScale').selectOption('1');
   await fill(page,{labNoncollegeShare:30,labHispanicShare:20,labNoncollegeShift:4,labHispanicShift:-2});
   if(name!=='OVER_12_POINT_SHIFT')await fill(page,{labNoncollegeBaselineMargin:-20,labHispanicBaselineMargin:40,labRemainderMargin:0,labRemainderShift:1,labNoncollegeParticipation:1.2,labHispanicParticipation:1,labRemainderParticipation:1});
   if(name==='BLANK_REQUIRED_PREFERENCE')await page.locator('#labNoncollegeBaselineMargin').fill('');
   if(name==='OVERSUBSCRIBED_SHARES')await fill(page,{labNoncollegeShare:70,labHispanicShare:40});
   if(name==='ZERO_PARTICIPATION')await fill(page,{labNoncollegeParticipation:0,labHispanicParticipation:0,labRemainderParticipation:0});
   if(name==='OVER_12_POINT_SHIFT')await fill(page,{labNoncollegeShare:100,labHispanicShare:0,labNoncollegeShift:40,labHispanicShift:0});
   await page.locator('#labRun').click();assert.match(await page.locator('#labStatus').innerText(),/^Scenario not run · .+/);assert.equal(await page.locator('#labResults').evaluate(n=>n.children.length),0,'Invalid input clears prior scenario');
   const accepted=await acceptedUnchanged(page);assertAccepted(accepted);assert.deepEqual(counters,beforeResearch);invalid.push({case:name,withheld:true,accepted_bundle_unchanged:true,no_extra_live_worker_or_source_request:true,main_thread_sampler_call_count_not_observed:true});
  }
  await page.locator('#labReset').click();assert.equal(await page.locator('#labMode').inputValue(),'margin');assert.equal(await page.locator('#labScale').inputValue(),'1');assert.equal(await page.locator('#labScope').inputValue(),'single');assert.equal(await page.locator('#labState').isEnabled(),true);assert.equal(await page.locator('#labCompositionFields').isHidden(),true);assert.match(await page.locator('#labResults').innerText(),/Published forecast unchanged/);assertAccepted(await acceptedUnchanged(page));assert.deepEqual(counters,beforeResearch);
  await Promise.all(pendingPins);assert.deepEqual(errors,[]);assert.deepEqual(pinErrors,[]);assert.equal(served.size,pinFiles.length);for(const file of pinFiles)assert(served.has(file),file+' first response pinned');
  reports.push({width,height,diagnostics:{imported_senate:importedSenate,imported_house:importedHouse,mixed_private_context_public_house:mixed,public_house:publicHouse,public_senate:publicSenate,capture},scenario,invalid,native_disclosure_keyboard:true,keyboard_table:{...scrollBefore,after_left:scrollAfter},accepted_bundle_identity_and_values_preserved:true,source_requests_and_live_workers_added_by_research:0,observed_session_counters:{...counters},genuine_worker_required:true,research_samples_per_election:2000,real_main_thread_research_elections:2,production_samples:3000,canonical_runtime_reference_count:runtimeReferences.length,canonical_runtime_reference_order_sha256:hash(runtimeReferences.join('\n')),fixed_worker_imports:workerImports,blocked_provider_hosts:[...new Set(blocked)],source_pins:Object.fromEntries(served)});
  await context.close();
 }
 for(const file of pinFiles)if(!dashboard)assert(readFileSync(resolve(root,file)).equals(pinned[file]),'Source stayed frozen through browser run: '+file);
 writeFileSync(resolve(out,'research-sensitivity-browser.json'),JSON.stringify({status:'PASS',at:new Date().toISOString(),harness_sha256:harnessSHA,published_https:Boolean(dashboard),published_main:publishedMain,pages_run:dashboard?process.env.DASHBOARD_TEST_PAGES_RUN:null,source_pin_count:pinFiles.length,reports,scope:'Actual application controls and native Worker with external providers blocked. Explicit fictional composition assumptions; no Census/turnout estimates, empirical skill, calibrated national transfer or physical-device acceptance. Private inputs and complete accepted bundles stay in RAM, not proof output. No runtime source/function or website-body override.'},null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',viewports:reports.map(r=>r.width),pins:pinFiles.length,research_samples:2000,production_samples:3000}));
}catch(error){
 const diagnostic=await activePage?.evaluate(()=>({samples:typeof jointLastResult==='undefined'?null:jointLastResult?.samples,pending:typeof jointModelPending==='undefined'?null:jointModelPending,as_of:typeof jointAsOfSnapshot==='undefined'?null:Boolean(jointAsOfSnapshot),mode:document.querySelector('#labMode')?.value,scope:document.querySelector('#labScope')?.value,scale:document.querySelector('#labScale')?.value,results_present:Boolean(document.querySelector('#labResults tbody')),focus_tag:document.activeElement?.tagName||null,focus_id:document.activeElement?.id||null})).catch(()=>null);
 writeFileSync(resolve(out,'failure.json'),JSON.stringify({status:'FAIL',harness_sha256:harnessSHA,completed_reports:reports,diagnostic,error:error.message,stack:error.stack,source_pins_expected:Object.fromEntries(Object.entries(pinned).map(([k,v])=>[k,hash(v)]))},null,2)+'\n');
 await activePage?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw error;
}finally{await browser?.close();if(server)await new Promise(ok=>server.close(ok));}
