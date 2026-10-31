// Native Chrome display proof. Fictional comparator events never enter source acceptance.
// No application HTML/script/function override, provider data, call admission or model rerun.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
let root=resolve(process.env.DASHBOARD_TEST_ROOT||import.meta.dirname);
while(!existsSync(resolve(root,'index.html'))){const next=dirname(root);assert.notEqual(next,root);root=next;}
const hash=b=>createHash('sha256').update(b).digest('hex'),harnessSHA=hash(readFileSync(import.meta.filename));
const out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness/ui-review/priority-movements-'+Date.now());assert(!existsSync(out),'Fresh output required');
assert(!process.env.BROWSER_CHANNEL||process.env.BROWSER_CHANNEL==='chrome','Actual Chrome required');
const dashboard=process.env.DASHBOARD_TEST_URL?new URL(process.env.DASHBOARD_TEST_URL):null;
if(dashboard){assert.equal(process.env.PR546_PUBLISHED_MOVEMENTS_AUTHORIZED,'FINAL_CURRENT_MAIN_PAGES_AND_BYTES_VERIFIED');assert.equal(dashboard.origin,'https://jmon18-rgb.github.io');assert.equal(dashboard.pathname,'/Election-Command-Center/');assert.equal(dashboard.search,'');assert.equal(dashboard.username,'');assert.equal(dashboard.password,'');assert(['','#electionNight'].includes(dashboard.hash));}
const main=dashboard?execFileSync('git',['rev-parse','origin/main'],{cwd:root,encoding:'utf8'}).trim():null;
if(dashboard){assert.equal(process.env.DASHBOARD_TEST_MAIN,main);assert(/^\d+$/.test(process.env.DASHBOARD_TEST_PAGES_RUN||''));}
const files=['index.html','scripts/election_night_priority.js','scripts/house_at_large_bridge.js','scripts/electorate_what_if_2026.js','scripts/active_race_input_diagnostics.js','scripts/private_senate_fundamentals.js','scripts/chamber_control_model.js','scripts/source_call_conditioning.js','scripts/national_county_likelihood.js','scripts/joint_model_worker.js','scripts/joint_model_worker_controller.js','scripts/joint_count_snapshot_policy.js','scripts/personal_election_focus.js','scripts/official_admission_audit.js','scripts/election_night_poll_closings_2026.js','scripts/washington_remaining_source.js','scripts/washington_remaining_scenarios.js','scripts/recorded_asset_lineage.js','data/polling_estimates.json','data/race_probabilities.json','data/seat_universe.json','ZqBdM (1).csv','f3ome (1).csv'];
const bytes=file=>dashboard?execFileSync('git',['show',main+':'+file],{cwd:root,maxBuffer:32*1024*1024}):readFileSync(resolve(root,file));
const pinned=Object.fromEntries(files.map(file=>[file,bytes(file)])),html=pinned['index.html'].toString('utf8').replaceAll('\r\n','\n');
assert(html.includes('function enPriorityMovementEvents('),'Promote exact activity marker before executing');
function span(s,a,b){const i=s.indexOf('\n'+a),j=s.indexOf('\n'+b,i+1);assert(i>=0&&j>i);return s.slice(i+1,j);}
assert.equal(hash(Buffer.from(span(html,'// Display-only movement order.','function enCurrentRaces('))),'2a9435fef73d4f0345562bd1533a7f13f217c6d99adc5ad7c45699a2f4f5c58b');
const protectedSpans=[
 ['function enCompareSnapshots(','/* Browser-local interruption recovery:','b29bb75cf3c0106f5547e5b361ae3627adb0cddafa8373589bfdff71119ff817'],
 ['function enResumeMovementValid(','function enSnapshotCompatible(','4090fe02f3482e1b0f115e228a4d8cf222a5bfe103c0510431ca806509b5fe5d'],
 ['function enBuildActivityCsv(','function enRenderExportControls(','3c29a8d1ffa171f30ea3cd5294d806c3f7d3dafbf4bd80b72de636143c000fa5'],
 ['function smartModelMap(','function smartEligible(','3d3beab14afbf004e41268d89ef698c08ed08effdf846adc76865123b4077105']
];
for(const[a,b,expected]of protectedSpans)assert.equal(hash(Buffer.from(span(html,a,b))),expected,'Unchanged actual producer/resume/CSV/current-rank source');
const runtimeReferences=[...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)].map(x=>x[1]);assert.equal(runtimeReferences.length,93);
const importLiteral=pinned['scripts/joint_model_worker.js'].toString().match(/const IMPORTS=Object\.freeze\(\((\[[^\n]+\])\)\.map\(Object\.freeze\)\)/);assert(importLiteral);
const workerImports=JSON.parse(importLiteral[1]);assert.equal(workerImports.length,6);for(const a of workerImports){assert(files.includes('scripts/'+a.name+'.js'));assert(runtimeReferences.includes('./scripts/'+a.name+'.js?v='+a.stamp));}
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.csv':'text/csv','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg'};
const server=dashboard?null:createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method))return res.writeHead(405).end();let p;try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return res.writeHead(400).end();}
 const file=resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root+sep)||p.startsWith('/artifacts/')||!existsSync(file)||!statSync(file).isFile())return res.writeHead(404).end();
 res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'}).end(readFileSync(file));
});
if(server)await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=dashboard?.href||'http://127.0.0.1:'+server.address().port+'/';
const appReady=({refs})=>{
 const status=document.querySelector('#privateContextStatus')?.textContent||'',terminal=jointPrivateSource==='repository'&&status.startsWith('Repository fundamentals ACTIVE')||status.startsWith('Repository fundamentals unavailable:')||status.startsWith('Private context not applied:');
 return Boolean(terminal&&enModeYear===2026&&jointBasis&&jointCompletedFrame&&jointLastResult?.samples===3000&&jointPublicResult?.samples===3000&&jointPulseBaseline?.samples===3000&&!jointModelPending&&!jointAsOfSnapshot&&!jointActiveKey&&jointRefreshTimer===null&&jointCacheKey===jointCompletedFrame.key&&jointCacheKey===jointFrameKey(jointValidatedFrameInputs())&&jointCompletedFrame.modelRevision===jointModelCodeRevision()&&jointCompletedFrame.payload.args.samples===3000&&jointCompletedFrame.payload.args.independentSenateCredit==='no_credit'&&modelOddsValidate(modelRaceOddsData,latestSenateEstimates)&&!document.hidden&&document.body.dataset.activePage==='electionNight'&&document.querySelector('#electionNight')?.classList.contains('active')&&typeof enPriorityMovementEvents==='function'&&typeof enCompareSnapshots==='function'&&typeof enBuildActivityCsv==='function'&&JSON.stringify([...document.querySelectorAll('script[src]')].map(n=>n.getAttribute('src')))===JSON.stringify(refs));
};
// One shared30s app+first-source-body ceiling; no network-idle or catch/retry path.
async function ready(page,state){
 const deadline=performance.now()+30000,left=()=>{const n=deadline-performance.now();if(n<=0)throw Error('App/source readiness exceeded30000ms');return Math.ceil(n);};let listener,timer;
 const pins=new Promise((resolve,reject)=>{listener=()=>{if(state.errors.length)reject(Error(state.errors.join('; ')));else if(files.every(f=>state.served.has(f)))resolve();};state.listeners.add(listener);timer=setTimeout(()=>reject(Error('App/source readiness exceeded30000ms; missing '+files.filter(f=>!state.served.has(f)).join(', '))),left());listener();});
 try{await Promise.all([pins,page.waitForFunction(appReady,{refs:runtimeReferences},{timeout:left(),polling:100})]);await page.waitForFunction(appReady,{refs:runtimeReferences},{timeout:left(),polling:100});assert.deepEqual(state.errors,[]);assert.equal(state.served.size,files.length);}finally{clearTimeout(timer);state.listeners.delete(listener);}
}
async function storeBoundary(page){await page.evaluate(()=>{
 const refs=[jointLastResult,jointPublicResult,jointPulseBaseline,modelRaceOddsData,jointBasis,jointBasisPublic,jointCompletedFrame];
 window.__movementBoundary={refs,values:JSON.stringify(refs),key:jointCacheKey,epoch:jointRequestEpoch,
  history:JSON.stringify([enOutlookHistory.events('PUBLIC'),enOutlookHistory.events('LOCAL_RESEARCH_VARIANT'),enOfficialAdmissionAudit.events()]),
  raw:enMovements,rawValues:JSON.stringify(enMovements),office:enOffice,mode:enModeYear,
  prefs:JSON.stringify([jointPrivateEnabled,jointPrivateHouse,jointPrivateRemember])};
});}
async function sameAccepted(page){return page.evaluate(()=>{const b=__movementBoundary,refs=[jointLastResult,jointPublicResult,jointPulseBaseline,modelRaceOddsData,jointBasis,jointBasisPublic,jointCompletedFrame];return{same_objects:refs.every((x,i)=>x===b.refs[i]),whole_values:JSON.stringify(refs)===b.values,same_key:jointCacheKey===b.key,same_epoch:jointRequestEpoch===b.epoch,history_and_admissions:JSON.stringify([enOutlookHistory.events('PUBLIC'),enOutlookHistory.events('LOCAL_RESEARCH_VARIANT'),enOfficialAdmissionAudit.events()])===b.history,private_prefs:JSON.stringify([jointPrivateEnabled,jointPrivateHouse,jointPrivateRemember])===b.prefs,current:!jointModelPending&&!jointAsOfSnapshot&&!jointActiveKey&&jointRefreshTimer===null&&jointCacheKey===jointFrameKey(jointValidatedFrameInputs()),samples:jointLastResult.samples,public_samples:jointPublicResult.samples,baseline_samples:jointPulseBaseline.samples};});}
function assertAccepted(s){for(const k of ['same_objects','whole_values','same_key','same_epoch','history_and_admissions','private_prefs','current'])assert.equal(s[k],true,k);for(const k of ['samples','public_samples','baseline_samples'])assert.equal(s[k],3000);}
let browser,page;const reports=[];
try{
 for(const[width,height]of[[1366,900],[390,844]]){
  browser=await chromium.launch({headless:true,channel:'chrome'});const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(30000);
  const errors=[],served=new Map(),reserved=new Set(),pending=[],pinErrors=[],listeners=new Set(),counts={workers:0,sourceGETs:0,providerAttempts:0},signal=()=>{for(const fn of listeners)fn();};
  const provider=u=>/(^|\.)civicapi\.org$|(^|\.)openamerica\.io$|^enr\.elections\.virginia\.gov$|^results\.vote\.wa\.gov$/.test(u.hostname);
  page.on('pageerror',e=>errors.push(e.message));page.on('worker',()=>counts.workers++);page.on('request',r=>{const u=new URL(r.url());if(r.method()==='GET'&&(/\.(?:json|csv)$/i.test(u.pathname)||provider(u)))counts.sourceGETs++;});
  context.on('response',r=>{const u=new URL(r.url()),prefix=dashboard?.pathname||'/',own=dashboard?u.origin===dashboard.origin:u.hostname==='127.0.0.1';if(!own||!u.pathname.startsWith(prefix))return;const file=u.pathname===prefix?'index.html':decodeURIComponent(u.pathname.slice(prefix.length));if(!files.includes(file)||reserved.has(file))return;reserved.add(file);pending.push(r.body().then(b=>{assert.equal(r.status(),200,file);assert(b.equals(pinned[file]),'First response bytes '+file);served.set(file,hash(b));}).catch(e=>pinErrors.push(e.message)).finally(signal));});
  await context.route('**/*',route=>{const u=new URL(route.request().url()),own=dashboard?u.origin===dashboard.origin&&u.pathname.startsWith(dashboard.pathname):u.hostname==='127.0.0.1';if(own)return route.continue();if(provider(u))counts.providerAttempts++;return route.abort();});
  await page.clock.install({time:new Date()});const entry=new URL(base);entry.hash='electionNight';await page.goto(entry.href,{waitUntil:'load'});await page.locator('#enMode2026').click();await ready(page,{served,errors:pinErrors,listeners});assert(counts.workers>0,'A genuine normal startup Worker is required');await storeBoundary(page);const before={...counts};
  const fixture=await page.evaluate(()=>{
   const ranked=smartRaceRanked(),houses=ranked.filter(r=>r.office==='House'&&Number.isFinite(r.editorScore)),high=houses.reduce((a,b)=>!a||b.editorScore>a.editorScore?b:a,null),low=houses.find(r=>r.editorScore<high.editorScore);if(!high||!low)throw Error('Existing accepted race scores must supply two distinct House priorities');
   const H=enHouseSourceItem(high).key,L=enHouseSourceItem(low).key,at='2026-11-04T03:00:00Z';
   const race=(d,r)=>({total:d+r,cands:[{n:'FICTIONAL Democratic candidate',p:'D',v:d},{n:'FICTIONAL Republican candidate',p:'R',v:r}]}),snap=(time,races)=>({year:2026,office:'House',as_of:time,races});
   function event(key,kind,time=at){const prior=snap('2026-11-04T00:00:00Z',{[key]:race(60,40)});let next;
    if(kind==='withdrawn')next=snap(time,{});
    else if(kind==='revision')next=snap(time,{[key]:race(40,60)});
    else if(kind==='lead')next=snap(time,{[key]:race(60,80)});
    else if(kind==='first')return enCompareSnapshots(snap(prior.as_of,{[key]:race(0,0)}),snap(time,{[key]:race(60,40)}))[0];
    else next=snap(time,{[key]:race(61,40)});
    return enCompareSnapshots(prior,next)[0];
   }
   const tierEvents=[event(L,'added','2026-11-04T05:00:00Z'),event(L,'first','2026-11-04T04:00:00Z'),event(L,'lead'),event(L,'revision',null)];
   enOffice='House';enMovements=tierEvents;enRenderMovement();const rows=()=>[...document.querySelectorAll('#enActivityFeed .en-activity-item')];
   const tier_order=rows().map(r=>r.querySelector('span').textContent),ordered_tiers=enPriorityMovementEvents(tierEvents,'House',ranked).map(enMovementPriorityTier),lead_heading=rows()[1].querySelector('strong').textContent;
   const revision_overlap=tierEvents[3].delta===0&&tierEvents[3].candidateChanged&&tierEvents[3].leaderChanged&&enMovementPriorityTier(tierEvents[3])===0;
   const scoreInput=[event(L,'added'),event(H,'added')];enMovements=scoreInput;enRenderMovement();const score_tie_uses_current_exact_identity=rows()[0].querySelector('strong').textContent===H;
   const oldEvent=event(H,'added','2026-11-04T01:00:00Z'),newEvent=event(L,'added','2026-11-04T02:00:00Z');const time_before_score=enPriorityMovementEvents([oldEvent,newEvent],'House',ranked)[0]===newEvent;
   const stableA=event(H,'added'),stableB=event(H,'added');const stable=enPriorityMovementEvents([stableA,stableB],'House',ranked);const stable_original_order=stable[0]===stableA&&stable[1]===stableB;
   const routine=Array.from({length:69},(_,i)=>event(H,'added',new Date(Date.parse('2026-11-04T05:00:00Z')-i*60000).toISOString())),withdrawn=event(L,'withdrawn','2026-11-04T01:00:00Z'),raw70=[...routine,withdrawn],rawValues=JSON.stringify(raw70),beforeCSV=enBuildActivityCsv(raw70);
   const legacy_window_omits_older_withdrawal=!raw70.filter(r=>r.office==='House').slice(0,8).includes(withdrawn);
   enMovements=raw70;enRenderMovement();const priority_surfaces_older_withdrawal=rows()[0].querySelector('strong').textContent.includes('REMOVED FROM FEED');
   const raw70_preserved=enMovements===raw70&&JSON.stringify(raw70)===rawValues&&enBuildActivityCsv()===beforeCSV;
   const senate={...event(H,'added'),office:'Senate',key:'TX'},governor={...event(H,'added'),office:'Governor',key:'OH'};
   const mixed70=[...routine.slice(0,64),withdrawn,event(L,'revision',null),event(L,'lead'),event(L,'first'),senate,governor];if(mixed70.length!==70)throw Error('Explicit raw70 fixture contract');
   const mixedValues=JSON.stringify(mixed70),mixedCSV=enBuildActivityCsv(mixed70);enMovements=mixed70;enOffice='Senate';enRenderMovement();const only_current_office=rows().length===1&&rows()[0].querySelector('strong').textContent==='TX';enOffice='House';enRenderMovement();enRenderExportControls();
   const first8=enPriorityMovementEvents(mixed70,'House',ranked).slice(0,8),rendered8=rows(),raw_and_csv_unchanged=enMovements===mixed70&&JSON.stringify(enMovements)===mixedValues&&enBuildActivityCsv()===mixedCSV;
   const resume_order_preserved=mixed70.filter(enResumeMovementValid).length===70&&mixed70.filter(enResumeMovementValid).every((r,i)=>r===mixed70[i]);
   const unknown_time_visible=rendered8.some(r=>r.querySelector('small')?.textContent==='Snapshot record time unknown'),known_time_exact=rendered8.filter(r=>r.querySelector('time')).every(r=>r.querySelector('time').getAttribute('datetime')===first8[rendered8.indexOf(r)].at);
   const box=document.querySelector('#enActivityBox'),banner=document.createElement('p');banner.id='movement-fiction-label';banner.textContent='SIMULATED ACTIVITY REVIEW · FICTIONAL SNAPSHOTS · NO SOURCE ADMISSION';banner.className='tiny';document.querySelector('#enActivityFeed').prepend(banner);
   window.__movementFixture={mixed70,mixedValues,mixedCSV,banner};
   return{tier_order,ordered_tiers,lead_heading,revision_overlap,score_tie_uses_current_exact_identity,time_before_score,stable_original_order,legacy_window_omits_older_withdrawal,priority_surfaces_older_withdrawal,raw70_preserved,only_current_office,raw_and_csv_unchanged,resume_order_preserved,unknown_time_visible,known_time_exact,display_rows:rendered8.length,raw_events:mixed70.length,no_call_text:rendered8.every(r=>!/winner|called|elected|probability/i.test(r.textContent)),fixture_only:true};
  });
  assert.deepEqual(fixture.ordered_tiers,[0,1,2,3]);assert.match(fixture.lead_heading,/LEAD CHANGED/);assert.match(fixture.tier_order[0],/Candidate totals revised/);assert.match(fixture.tier_order[1],/recorded votes/);assert.match(fixture.tier_order[2],/first reported votes/);assert.match(fixture.tier_order[3],/recorded votes/);
  for(const key of ['revision_overlap','score_tie_uses_current_exact_identity','time_before_score','stable_original_order','legacy_window_omits_older_withdrawal','priority_surfaces_older_withdrawal','raw70_preserved','only_current_office','raw_and_csv_unchanged','resume_order_preserved','unknown_time_visible','known_time_exact','no_call_text'])assert.equal(fixture[key],true,key);assert.equal(fixture.display_rows,8);assert.equal(fixture.raw_events,70);
  await page.locator('#enActivityBox').scrollIntoViewIfNeeded();assert.equal(await page.locator('#movement-fiction-label').isVisible(),true);assert.match(await page.locator('#enActivityFeed').innerText(),/Priority order: revisions, lead changes, first reports, added votes/);
  await page.locator('#enExportChanges').focus();assert.equal(await page.evaluate(()=>document.activeElement.id),'enExportChanges');
  const geometry=await page.locator('#enActivityBox').evaluate(box=>{const r=box.getBoundingClientRect(),label=box.querySelector('#movement-fiction-label')?.getBoundingClientRect();return{box_fits:box.scrollWidth<=box.clientWidth,document_fits:document.documentElement.scrollWidth<=innerWidth+1,rows:[...box.querySelectorAll('.en-activity-item')].map(n=>({width:n.getBoundingClientRect().width,positive_height:n.getBoundingClientRect().height>0,readable_font:parseFloat(getComputedStyle(n).fontSize)>0})),unknown_visible:box.textContent.includes('Snapshot record time unknown'),fiction_label_within_component:Boolean(label&&label.width>0&&label.height>0&&label.top>=r.top&&label.bottom<=r.bottom&&label.left>=r.left&&label.right<=r.right),component_bounds:{width:r.width,height:r.height},label_bounds_in_component:label?{top:label.top-r.top,bottom:label.bottom-r.top,left:label.left-r.left,right:label.right-r.left}:null};});
  assert.equal(geometry.box_fits,true);assert.equal(geometry.document_fits,true);assert(geometry.rows.every(r=>r.width>0&&r.positive_height&&r.readable_font));assert.equal(geometry.fiction_label_within_component,true,'Fictional snapshot label stays inside the fully captured activity component');await page.locator('#enActivityBox').screenshot({path:resolve(out,'priority-movements-'+width+'.png')});
  geometry.fiction_label_unoccluded_after_capture=await page.locator('#movement-fiction-label').evaluate(label=>{const r=label.getBoundingClientRect(),x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;if(!(r.width>0&&r.height>0&&x>=0&&x<innerWidth&&y>=0&&y<innerHeight))return false;const paintedTarget=document.elementFromPoint(x,y);return Boolean(paintedTarget&&(paintedTarget===label||label.contains(paintedTarget)));});assert.equal(geometry.fiction_label_unoccluded_after_capture,true,'Fictional snapshot label is in the current viewport and not covered after full component capture');
  const acceptedDuring=await sameAccepted(page);assertAccepted(acceptedDuring);assert.deepEqual(counts,before,'Activity view adds no source GET/provider attempt or Worker');
  const restoration=await page.evaluate(()=>{const b=__movementBoundary;enMovements=b.raw;enOffice=b.office;enModeYear=b.mode;__movementFixture.banner.remove();enRenderMovement();enRenderExportControls();return{raw_identity:enMovements===b.raw,raw_values:JSON.stringify(enMovements)===b.rawValues,office:enOffice===b.office,mode:enModeYear===b.mode};});for(const value of Object.values(restoration))assert.equal(value,true);
  assertAccepted(await sameAccepted(page));assert.deepEqual(counts,before);await Promise.all(pending);assert.deepEqual(pinErrors,[]);assert.deepEqual(errors,[]);assert.equal(served.size,files.length);
  reports.push({width,fixture,geometry,restoration,accepted_bundle:acceptedDuring,counters_unchanged:true,actual_source_pins:Object.fromEntries(served),source_pin_count:files.length,canonical_references:93,fixed_worker_imports:workerImports,native_provider_GETs:0,RNG_scope:'No changed source or unchanged rank/producer path calls a sampler. Whole accepted bundle/epoch and real Worker count are unchanged; global RNG is not instrumented.',engine:'Chrome'});await context.close();await browser.close();browser=null;
 }
 for(const file of files)assert(bytes(file).equals(pinned[file]),'Frozen code/source changed '+file);assert.equal(hash(readFileSync(import.meta.filename)),harnessSHA);
 writeFileSync(resolve(out,'priority-movements-browser.json'),JSON.stringify({status:'PASS',at:new Date().toISOString(),harness_sha256:harnessSHA,published_main:main,pages_run:process.env.DASHBOARD_TEST_PAGES_RUN||null,published_https:!!dashboard,reports,scope:'Native actual-app presentation only with fictional comparator records, never accepted source snapshots. No source/model/script overrides, call authority or persistent resume writes.'},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS',widths:[1366,390],actual_source_pins:files.length}));
}catch(error){
 const diagnostic=await page?.evaluate(()=>({samples:typeof jointLastResult==='undefined'?null:jointLastResult?.samples,pending:typeof jointModelPending==='undefined'?null:jointModelPending,activity_rows:document.querySelectorAll('#enActivityFeed .en-activity-item').length,fixture_visible:!!document.querySelector('#movement-fiction-label'),active_id:document.activeElement?.id||null})).catch(()=>null);
 writeFileSync(resolve(out,'failure.json'),JSON.stringify({status:'FAIL',harness_sha256:harnessSHA,completed_reports:reports,diagnostic,error:error.message,stack:error.stack},null,2)+'\n',{flag:'wx'});await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw error;
}finally{await browser?.close();if(server)await new Promise(ok=>server.close(ok));}
