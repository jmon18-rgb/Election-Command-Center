// Isolated full-app async boundary review. Calls are explicit observation-layer
// fixtures, not native-source validation or actual election outcomes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness/ui-review/joint-model-worker-app');mkdirSync(out,{recursive:true});
const dashboard=process.env.DASHBOARD_TEST_URL?new URL(process.env.DASHBOARD_TEST_URL):null;
if(dashboard){assert.equal(dashboard.origin,'https://jmon18-rgb.github.io');assert.equal(dashboard.pathname,'/Election-Command-Center/');assert.equal(dashboard.username,'');assert.equal(dashboard.password,'');assert.equal(dashboard.search,'');assert(['','#electionNight'].includes(dashboard.hash));}
const publishedMain=dashboard?execFileSync('git',['rev-parse','origin/main'],{cwd:root,encoding:'utf8'}).trim():null;
if(dashboard){assert.equal(process.env.DASHBOARD_TEST_MAIN,publishedMain,'Root must verify final CURRENT-main Pages and bytes before published execution');assert(/^\d+$/.test(process.env.DASHBOARD_TEST_PAGES_RUN||''),'Root must supply its verified final successful Pages run');}
const pinFiles=['index.html','scripts/personal_election_focus.js','scripts/joint_model_worker.js','scripts/joint_model_worker_controller.js'],pinned=Object.fromEntries(pinFiles.map(file=>[file,dashboard?execFileSync('git',['show',publishedMain+':'+file],{cwd:root,maxBuffer:16*1024*1024}):readFileSync(resolve(root,file))]));
const reviewedTags=dashboard?Object.fromEntries(pinFiles.filter(file=>file!=='index.html').map(file=>{const tags=pinned['index.html'].toString('utf8').match(/<script[^>]+src="([^"]+)"[^>]*>/g)||[],tag=tags.find(tag=>tag.includes(file+'?'));assert(tag,'Published index references '+file);return [file,tag.match(/src="([^"]+)"/)[1]];})):null;
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=dashboard?null:createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,key=p==='/'?'index.html':decodeURIComponent(p).slice(1),f=resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));if(!f.startsWith(root+sep)||!existsSync(f)||!statSync(f).isFile())return res.writeHead(404).end();res.writeHead(200,{'content-type':types[extname(f)]||'application/octet-stream'}).end(pinned[key]||readFileSync(f));});
if(server)await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;const proofs=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const [width,height]of [[1366,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const Native=Worker,control={hold:false,records:[]};window.__heldModel=control;
   window.Worker=class{
    constructor(url,options){if(control.failConstruction){control.failConstruction=false;throw Error('FICTIONAL_WORKER_CONSTRUCTION_FAILURE');}this.native=new Native(url,options);this.id=control.records.length+1;this.held=[];this.terminated=false;control.records.push(this);
     this.native.onmessage=event=>{const callback=this.onmessage;if(event.data?.type==='RESULT'&&control.hold){this.held.push({event,callback});return;}callback?.(event);};
     this.native.onerror=event=>this.onerror?.(event);this.native.onmessageerror=event=>this.onmessageerror?.(event);}
    postMessage(message){this.metadata={requestId:message.requestId,signature:message.signature,contextKey:message.contextKey,frameKind:message.frameKind};this.native.postMessage(message);}
    terminate(){this.terminated=true;this.native.terminate();}
   };
   control.release=id=>{const record=control.records.find(r=>r.id===id);for(const item of record?.held.splice(0)||[])item.callback?.(item.event);};
  });
  await page.clock.install({time:new Date('2026-10-28T19:00:00Z')});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(dashboard?u.origin===dashboard.origin&&u.pathname.startsWith(dashboard.pathname):u.hostname==='127.0.0.1')return route.continue();external.push(u.hostname);return route.abort();});
  await page.goto(dashboard?.href||'http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  if(dashboard){const actual=await page.evaluate(files=>Object.fromEntries(files.map(file=>[file,document.querySelector('script[src*="'+file+'?"]')?.getAttribute('src')||null])),Object.keys(reviewedTags));assert.deepEqual(actual,reviewedTags,'Actual published page script identities match final origin/main index');}
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>typeof jointWhenIdle==='function'&&jointBasis&&jointLastResult?.probabilities);await page.evaluate(()=>jointWhenIdle());
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
  const initial=await page.evaluate(()=>({history:enOutlookHistory.events('PUBLIC').length+enOutlookHistory.events('LOCAL_RESEARCH_VARIANT').length,audit:enOfficialAdmissionAudit.events().length}));
  // Use the real app/model/worker; replace only its already-validated observation
  // provider with a RAM-only fictional map for this boundary test.
  await page.evaluate(()=>{window.__originalObservations=jointLiveObservations;window.__fixtureCalls={'IA-SEN':{mode:'source_called',winnerParty:'D'}};
   jointLiveObservations=()=>{const calls=enModeYear===2026?window.__fixtureCalls:{};jointPulseRows=Object.entries(calls).map(([race_code,row])=>({race_code,calledParty:row.winnerParty,provider:'FICTIONAL_BOUNDARY_TEST',reporting:50,asOf:'2026-10-28T19:00:00Z'}));jointDescriptiveReturns=[];return structuredClone(calls);};return jointRender(true);});
  const ia=page.locator('#enPersonalFocus [data-race="IA-SEN"]');assert.match(await ia.innerText(),/D victory/);
  const nationalDriver=page.locator('#jointNightNeedle [data-joint-driver="IA-SEN"]');assert.equal(await nationalDriver.count(),1);await nationalDriver.focus();
  assert.equal(await page.evaluate(()=>{const value=jointCompetitivePrior('TX-SEN');if(!value)return false;window.__priorBeforePending=JSON.stringify(value);const basis=jointBasis,shift=jointNationalShift,error=jointErrorMultiplier;jointBasis={...basis};const wrongBasis=jointCompetitivePrior('TX-SEN')===null;jointBasis=basis;const mean=basis.senate[0].mean;basis.senate[0].mean=mean+.01;const inPlaceMutation=jointCompetitivePrior('TX-SEN')===null;basis.senate[0].mean=mean;jointNationalShift=shift+.1;const wrongShift=jointCompetitivePrior('TX-SEN')===null;jointNationalShift=shift;jointErrorMultiplier=error+.01;const wrongError=jointCompetitivePrior('TX-SEN')===null;jointErrorMultiplier=error;return wrongBasis&&inPlaceMutation&&wrongShift&&wrongError;}),true,'Source-adapter reference rejects changed or in-place-mutated basis and sensitivity');
  await page.evaluate(()=>{const context=document.querySelector('#jointNightNeedle .four-needle-live-context');if(!context)throw Error('Expected current national context');context.append(Object.assign(document.createElement('p'),{textContent:'FICTIONAL PREVIOUS CALL CONTEXT · must be withheld'}));});
  const oldMax=await page.evaluate(()=>{__heldModel.hold=true;window.__fixtureCalls={};jointQueueRefresh();return __heldModel.records.length;});
  assert.equal(await page.evaluate(()=>jointLastResult),null,'Changed source clears current model before debounce');
  assert.equal(await page.locator('#jointNightNeedle').evaluate(node=>node===document.activeElement&&!node.closest('[inert]')),true,'Hidden national driver bridges focus to its safe local needle');
  assert.deepEqual(await page.evaluate(()=>enReadingReturnAnchor(document.activeElement)),{nationalHostId:'jointNightNeedle',race:'IA-SEN'});
  await page.evaluate(()=>{window.__nationalAnchor=enReadingReturnAnchor(document.activeElement);document.querySelector('#enMode2026').focus();enRestoreReadingFocus(null,window.__nationalAnchor,'enMode2026');});
  assert.equal(await page.locator('#jointNightNeedle').evaluate(node=>node===document.activeElement),true,'Announcement-style close during pending returns to safe national anchor');
  assert.equal(await page.evaluate(()=>jointPulseBaseline===null&&JSON.stringify(jointCompetitivePrior('TX-SEN'))===window.__priorBeforePending),true,'Count adapters retain the accepted no-call reference while public model baseline is pending');
  assert.doesNotMatch(await ia.innerText(),/D victory/);assert.doesNotMatch(await ia.ariaSnapshot(),/D victory/);
  assert.doesNotMatch(await page.locator('#jointNightNeedle').innerText(),/FICTIONAL PREVIOUS CALL CONTEXT/,'Pending national needle must also withhold old call-driver narrative');
  assert.equal(await page.locator('#jointNightNeedle .four-needle-live-context').evaluate(node=>getComputedStyle(node).visibility==='hidden'&&node.getAttribute('aria-hidden')==='true'&&node.inert),true);
  await page.evaluate(()=>{void jointWhenIdle();});
  await page.waitForFunction(id=>__heldModel.records.some(r=>r.id>id&&r.held.length),oldMax);
  const withdrawnId=await page.evaluate(()=>__heldModel.records.filter(r=>r.held.length).at(-1).id);
  const correctionMax=await page.evaluate(()=>{window.__fixtureCalls={'IA-SEN':{mode:'source_called',winnerParty:'R'}};void jointRender(true);return __heldModel.records.length;});
  await page.waitForFunction(id=>__heldModel.records.some(r=>r.id>id&&r.held.length),correctionMax);
  const correctedId=await page.evaluate(()=>__heldModel.records.filter(r=>r.held.length&&!r.terminated).at(-1).id);
  await page.evaluate(id=>__heldModel.release(id),withdrawnId);assert.equal(await page.evaluate(()=>jointLastResult),null,'Retained obsolete callback cannot republish withdrawn state');
  await page.evaluate(id=>{__heldModel.hold=false;__heldModel.release(id);},correctedId);await page.evaluate(()=>jointWhenIdle());assert.match(await ia.innerText(),/R victory/);
  assert.equal(await nationalDriver.evaluate(node=>node===document.activeElement),true,'Accepted frame restores the same national driver when it still exists');
  // A different context/settings request supersedes an already-running result.
  const settingsMax=await page.evaluate(()=>{__heldModel.hold=true;jointNationalShift=.5;void jointRender(true);return __heldModel.records.length;});
  await page.locator('#enMode2026').focus();const movedReaderScroll=await page.evaluate(()=>scrollY);
  await page.waitForFunction(id=>__heldModel.records.some(r=>r.id>id&&r.held.length),settingsMax);
  const settingsOld=await page.evaluate(()=>__heldModel.records.filter(r=>r.held.length&&!r.terminated).at(-1).id);
  const last=await page.evaluate(()=>{jointNationalShift=1;void jointRender(true);return __heldModel.records.length;});
  await page.waitForFunction(id=>__heldModel.records.some(r=>r.id>id&&r.held.length),last);
  const settingsNew=await page.evaluate(()=>__heldModel.records.filter(r=>r.held.length&&!r.terminated).at(-1).id);
  await page.evaluate(id=>__heldModel.release(id),settingsOld);assert.equal(await page.evaluate(()=>jointLastResult),null);
  await page.evaluate(id=>{__heldModel.hold=false;__heldModel.release(id);},settingsNew);await page.evaluate(()=>jointWhenIdle());
  assert.match(await page.locator('#jointRunStatus').textContent(),/swing \+1\.0/);
  assert.equal(await page.locator('#enMode2026').evaluate(node=>node===document.activeElement),true,'A national pending reader who moved elsewhere keeps focus');assert(Math.abs((await page.evaluate(()=>scrollY))-movedReaderScroll)<=2,'Accepted national frame cannot scroll-steal after its reader moved');
  // A private/public toggle supersedes the old frame and its matching public
  // comparison atomically; no private numeric inputs are saved in this proof.
  await nationalDriver.focus();
  const contextMax=await page.evaluate(()=>{window.__nationalAnchor=enReadingReturnAnchor(document.activeElement);window.__oldNationalDriver=document.activeElement;__heldModel.hold=true;jointNationalShift=1.1;void jointRender(true);document.querySelector('#enMode2026').focus();return __heldModel.records.length;});
  await page.waitForFunction(id=>__heldModel.records.some(r=>r.id>id&&r.held.length),contextMax);
  const contextOld=await page.evaluate(()=>__heldModel.records.filter(r=>r.held.length&&!r.terminated).at(-1).id);
  const contextNewMax=await page.locator('#privateContextEnabled').evaluate(node=>{node.checked=!node.checked;node.dispatchEvent(new Event('change',{bubbles:true}));return __heldModel.records.length;});
  await page.waitForFunction(id=>__heldModel.records.some(r=>r.id>id&&r.held.length),contextNewMax);
  const contextNew=await page.evaluate(()=>__heldModel.records.filter(r=>r.held.length&&!r.terminated).at(-1).id);
  await page.evaluate(id=>__heldModel.release(id),contextOld);assert.equal(await page.evaluate(()=>jointLastResult),null);
  await page.evaluate(id=>{__heldModel.hold=false;__heldModel.release(id);},contextNew);await page.evaluate(()=>jointWhenIdle());
  assert.equal(await page.evaluate(()=>Boolean(jointPublicResult)===jointUsesPrivateContext()),true,'Public comparison and current private context are accepted as one bundle');
  assert.equal(await page.locator('#enMode2026').evaluate(node=>node===document.activeElement),true);await page.evaluate(()=>enRestoreReadingFocus(window.__oldNationalDriver,window.__nationalAnchor,'enMode2026'));assert.equal(await nationalDriver.evaluate(node=>node===document.activeElement),true,'Announcement-style close after acceptance resolves the regenerated national driver');
  await page.evaluate(()=>{window.__fixtureCalls={};return jointRender(true);});assert.equal(await nationalDriver.count(),0);assert.equal(await page.locator('#jointNightNeedle').evaluate(node=>node===document.activeElement),true,'Withdrawn national driver leaves its reader at the safe same-needle anchor');
  // Rehearsal has its own worker/controller and never replaces primary output.
  await page.locator('#enNationalRehearsal > summary').click();await page.locator('#enNationalRehearsal > details > summary').click();await page.evaluate(()=>nationalPreviewPromise);
  assert.equal(await page.locator('#enPersonalFocusPreview article').count(),19);
  const rehearsalMax=await page.evaluate(()=>{window.__primaryBeforePreview=JSON.stringify(jointLastResult);__heldModel.hold=true;return __heldModel.records.length;});
  await page.locator('#enNationalNext').click();await page.waitForFunction(id=>__heldModel.records.some(r=>r.id>id&&r.metadata.frameKind==='REHEARSAL'&&r.held.length),rehearsalMax);
  const oldRehearsal=await page.evaluate(()=>__heldModel.records.filter(r=>r.held.length&&!r.terminated&&r.metadata.frameKind==='REHEARSAL').at(-1).id);
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult)===window.__primaryBeforePreview),true,'Pending rehearsal leaves primary model unchanged');
  const primaryAfterPreview=await page.evaluate(()=>{jointNationalShift=1.2;void jointRender(true);return __heldModel.records.length;});
  assert.equal(await page.locator('#enNationalPreviewNeedle').evaluate(node=>node.getAttribute('aria-busy')==='true'&&!node.inert&&[...node.children].every(child=>getComputedStyle(child).visibility==='hidden'&&child.getAttribute('aria-hidden')==='true'&&child.inert)),true,'Primary input change withholds old simulated children while retaining a safe wrapper');
  await page.waitForFunction(id=>__heldModel.records.some(r=>r.id>id&&r.metadata.frameKind==='LIVE'&&r.held.length),primaryAfterPreview);
  const newPrimary=await page.evaluate(()=>__heldModel.records.filter(r=>r.held.length&&!r.terminated&&r.metadata.frameKind==='LIVE').at(-1).id);
  await page.evaluate(id=>__heldModel.release(id),oldRehearsal);assert.equal(await page.locator('#enNationalPreviewNeedle').evaluate(node=>[...node.children].every(child=>getComputedStyle(child).visibility==='hidden')),true,'Obsolete rehearsal callback cannot publish after primary change');
  await page.evaluate(id=>{__heldModel.hold=false;__heldModel.release(id);},newPrimary);await page.evaluate(()=>jointWhenIdle());await page.evaluate(()=>nationalPreviewPromise);
  assert.equal(await page.locator('#enNationalPreviewNeedle').evaluate(node=>getComputedStyle(node).visibility==='visible'&&!node.inert),true);
  assert.match(await page.locator('#enNationalStage').textContent(),/SIMULATED/);assert.match(await page.locator('#jointRunStatus').textContent(),/swing \+1\.2/);
  // The simulated national driver has the same semantic pending/announcement
  // contract as the live national driver, without making its wrapper inert.
  const previewHost=page.locator('#enNationalPreviewNeedle'),previewDriver=previewHost.locator('[data-joint-driver]').first(),previewRace=await previewDriver.getAttribute('data-joint-driver');await previewDriver.focus();
  const previewHeight=(await previewHost.boundingBox()).height;
  const focusPreviewMax=await page.evaluate(()=>{window.__previewReaderAnchor=enReadingReturnAnchor(document.activeElement);__heldModel.hold=true;void jointRender(true);return __heldModel.records.length;});
  assert.equal(await previewHost.evaluate(node=>node===document.activeElement&&!node.inert),true,'Focused simulated driver bridges to its safe non-inert wrapper');assert(Math.abs((await previewHost.boundingBox()).height-previewHeight)<=1,'Pending simulated needle retains its old geometry');
  assert.deepEqual(await page.evaluate(()=>enReadingReturnAnchor(document.activeElement)),{nationalHostId:'enNationalPreviewNeedle',race:previewRace});
  await page.evaluate(()=>{document.querySelector('#enMode2026').focus();enRestoreReadingFocus(null,window.__previewReaderAnchor,'enMode2026');});assert.equal(await previewHost.evaluate(node=>node===document.activeElement),true,'Announcement-style close during simulated pending uses safe wrapper');
  await page.waitForFunction(id=>__heldModel.records.some(r=>r.id>id&&r.metadata.frameKind==='LIVE'&&r.held.length),focusPreviewMax);const focusPrimary=await page.evaluate(()=>__heldModel.records.filter(r=>r.held.length&&!r.terminated&&r.metadata.frameKind==='LIVE').at(-1).id);
  await page.evaluate(id=>{__heldModel.hold=false;__heldModel.release(id);},focusPrimary);await page.evaluate(()=>jointWhenIdle());await page.evaluate(()=>nationalPreviewPromise);
  const acceptedPreviewDriver=previewHost.locator('[data-joint-driver="'+previewRace+'"]');assert.equal(await acceptedPreviewDriver.evaluate(node=>node===document.activeElement),true,'Accepted simulation resolves the same driver after pending');
  await page.evaluate(()=>{window.__oldPreviewDriver=document.activeElement;window.__previewReaderAnchor=enReadingReturnAnchor(document.activeElement);void jointRender(true);document.querySelector('#enMode2026').focus();});const movedPreviewScroll=await page.evaluate(()=>scrollY);await page.evaluate(()=>jointWhenIdle());await page.evaluate(()=>nationalPreviewPromise);
  assert.equal(await page.locator('#enMode2026').evaluate(node=>node===document.activeElement),true);assert(Math.abs((await page.evaluate(()=>scrollY))-movedPreviewScroll)<=2,'Accepted simulation cannot scroll-steal after its reader moved');
  await page.evaluate(()=>enRestoreReadingFocus(window.__oldPreviewDriver,window.__previewReaderAnchor,'enMode2026'));assert.equal(await acceptedPreviewDriver.evaluate(node=>node===document.activeElement),true,'Announcement-style close after simulation acceptance resolves regenerated driver');
  await page.locator('#enNationalRehearsal > summary').click();
  // Archive cancels live work but keeps the global2026 Home polling baseline.
  await page.evaluate(()=>{__heldModel.hold=true;jointNationalShift=1.5;void jointRender(true);});await page.waitForFunction(()=>__heldModel.records.some(r=>r.held.length&&!r.terminated));
  const beforeArchive=await page.evaluate(()=>__heldModel.records.filter(r=>r.held.length&&!r.terminated).at(-1).id);
  await page.locator('#enMode2024').click();await page.evaluate(()=>{__heldModel.hold=false;void jointWhenIdle();});await page.evaluate(()=>jointWhenIdle());
  await page.evaluate(id=>__heldModel.release(id),beforeArchive);
  assert.equal(await page.evaluate(()=>enModeYear),2024);assert.equal(await page.locator('#enPersonalFocus').isHidden(),true);assert.equal(await page.evaluate(()=>Boolean(jointLastResult?.probabilities)),true);
  assert.equal(await page.evaluate(()=>jointLastResult.race_probabilities.some(row=>row.provider_called_party)),false,'Archive Home model is pure baseline');
  // Hidden document cancels current work; resume obtains a current new frame.
  await page.evaluate(()=>{window.__fixtureCalls={};});await page.locator('#enMode2026').click();await page.evaluate(()=>jointWhenIdle());
  await page.evaluate(()=>{__heldModel.hold=true;jointNationalShift=2;void jointRender(true);});await page.waitForFunction(()=>__heldModel.records.some(r=>r.held.length&&!r.terminated));
  const hiddenOld=await page.evaluate(()=>__heldModel.records.filter(r=>r.held.length&&!r.terminated).at(-1).id);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.evaluate(id=>__heldModel.release(id),hiddenOld);assert.equal(await page.evaluate(()=>jointLastResult),null);
  await page.evaluate(()=>{__heldModel.hold=false;Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await page.evaluate(()=>jointWhenIdle());
  assert.equal(await page.evaluate(()=>Boolean(jointLastResult?.probabilities)),true);
  // A deliberate native construction failure uses the identical main runner;
  // a timed-out worker is explicitly withheld without repeating heavy math.
  await page.evaluate(()=>{__heldModel.failConstruction=true;jointNationalShift=2.1;return jointRender(true);});
  assert.equal(await page.evaluate(()=>jointWorkerCompatibility),true);assert.equal(await page.evaluate(()=>Boolean(jointLastResult?.probabilities)),true);
  await page.locator('[data-page="model"]').click();const modelReader=page.locator('#modelBoard [data-model-race="IA-SEN"]');await modelReader.focus();
  const timeoutMax=await page.evaluate(()=>{window.__originalMainRunner=JointModelWorkerRunner;window.__fallbackCalls=0;window.JointModelWorkerRunner={...JointModelWorkerRunner,run(...args){window.__fallbackCalls++;return window.__originalMainRunner.run(...args);}};__heldModel.hold=true;jointNationalShift=2.2;void jointRender(true);return __heldModel.records.length;});
  assert.equal(await modelReader.evaluate(node=>node===document.activeElement),true,'Pending probability refresh preserves model-board keyboard race identity');assert.match(await page.locator('#modelOddsNumbers').textContent(),/Waiting/);
  await page.waitForFunction(id=>__heldModel.records.some(r=>r.id>id&&r.held.length&&!r.terminated),timeoutMax);
  const timedOutId=await page.evaluate(()=>__heldModel.records.filter(r=>r.held.length&&!r.terminated).at(-1).id);
  await page.clock.runFor(30001);
  let idleTimer;const timeoutIdle=await Promise.race([page.evaluate(()=>jointWhenIdle()).then(()=>true),new Promise(resolve=>{idleTimer=setTimeout(()=>resolve(false),5000);})]);clearTimeout(idleTimer);
  if(!timeoutIdle){writeFileSync(resolve(out,'timeout-idle-failure-'+width+'.json'),JSON.stringify(await page.evaluate(()=>({pending:jointModelPending,activeKey:jointActiveKey,timer:jointRefreshTimer!==null,worker:jointModelController.state(),workers:__heldModel.records.map(r=>({id:r.id,held:r.held.length,terminated:r.terminated,metadata:r.metadata}))})),null,2)+'\n',{flag:'wx'});throw Error('Timed-out frame did not settle within the bounded idle check');}
  assert.equal(await page.evaluate(()=>jointLastResult),null);assert.match(await page.locator('#jointRunStatus').textContent(),/timed out/);assert.equal(await page.evaluate(()=>window.__fallbackCalls),0,'Timeout must not repeat expensive simulation on the main thread');
  const noRetry=await page.evaluate(async()=>{const before=__heldModel.records.length;jointQueueRefresh();const status=await jointRender(false);return {before,after:__heldModel.records.length,timer:jointRefreshTimer!==null,status:status.status};});assert.deepEqual(noRetry,{before:noRetry.before,after:noRetry.before,timer:false,status:'UNAVAILABLE'},'Unchanged routine refresh cannot restart a terminal timed-out frame');
  await page.evaluate(id=>__heldModel.release(id),timedOutId);assert.equal(await page.evaluate(()=>jointLastResult),null);
  await page.evaluate(()=>{window.JointModelWorkerRunner=window.__originalMainRunner;__heldModel.hold=false;jointNationalShift=2.3;return jointRender(true);});await page.evaluate(()=>jointWhenIdle());assert.equal(await page.evaluate(()=>Boolean(jointLastResult?.probabilities)),true);
  assert.equal(await modelReader.evaluate(node=>node===document.activeElement),true,'Accepted probability refresh preserves the same model-board keyboard race');
  assert.deepEqual(await page.evaluate(()=>({history:enOutlookHistory.events('PUBLIC').length+enOutlookHistory.events('LOCAL_RESEARCH_VARIANT').length,audit:enOfficialAdmissionAudit.events().length})),initial,'Preclose fictional boundary frames cannot populate live history/admission');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);assert.deepEqual(errors,[]);
  await page.screenshot({path:resolve(out,'accepted-worker-'+width+'.png')});
  proofs.push({width,height,real_worker_computation:true,held_callbacks:true,immediate_withdrawal_before_debounce:true,old_national_call_context_hidden:true,national_driver_safe_pending_anchor:true,national_driver_accepted_identity_restored:true,national_driver_withdrawal_safe_local_anchor:true,national_reader_moved_no_focus_or_scroll_steal:true,national_announcement_style_return_before_and_after_acceptance:true,preview_driver_safe_pending_anchor:true,preview_children_withheld_wrapper_geometry_retained:true,preview_driver_accepted_identity_restored:true,preview_reader_moved_no_focus_or_scroll_steal:true,preview_announcement_style_return_before_and_after_acceptance:true,stale_withdrawal_and_settings_callbacks_rejected:true,private_public_context_atomic:true,rehearsal_pending_primary_unchanged:true,primary_change_invalidates_and_refreshes_rehearsal:true,stale_rehearsal_callback_rejected:true,current_R_call_after_correction:true,archive_home_baseline_without_calls:true,hidden_cancel_and_resume:true,construction_failure_identical_main_fallback:true,timeout_withheld_without_main_retry:true,unchanged_timed_out_frame_no_routine_retry:true,late_timed_out_callback_rejected:true,new_input_recovery_after_timeout:true,accepted_count_reference_retained_pending:true,wrong_basis_or_sensitivity_reference_rejected:true,model_board_race_focus_retained:true,preclose_live_history_unchanged:true,horizontal_overflow:false,blocked_external_requests:external.length});await context.close();
 }
 if(dashboard)assert.equal(execFileSync('git',['rev-parse','origin/main'],{cwd:root,encoding:'utf8'}).trim(),publishedMain,'Final origin/main remains unchanged through the published check');
 const report={at:new Date().toISOString(),status:'PASS',scope:dashboard?'Actual published HTTPS app and real Worker with RAM-only fictional observation calls; all external providers blocked. No local server or HTML/script route override. Source pins use final origin/main blobs.':'Actual isolated app and real Worker with RAM-only observation-layer fictional calls; source validation and media not replayed. Index/helper/worker/controller served from exact start-of-test source buffers.',...(dashboard?{publication_url:dashboard.href,final_current_main:publishedMain,final_current_main_pages:Number(process.env.DASHBOARD_TEST_PAGES_RUN),actual_published_script_identities_match:true}:{}),local_server_started:!dashboard,source_sha256:Object.fromEntries(pinFiles.map(f=>[f,createHash('sha256').update(pinned[f]).digest('hex')])),proofs,private_numeric_values_recorded:false,actual_native_provider_gets:0,human_acceptance:'NOT_RUN',calibration:'NOT_ESTABLISHED'};
 writeFileSync(resolve(out,'full-app-delayed-worker.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,path:resolve(out,'full-app-delayed-worker.json')}));
}finally{await browser?.close();if(server)await new Promise(ok=>server.close(ok));}
