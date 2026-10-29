// Isolated synthetic/fixture UI checks, never an actual-results or calibration claim.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml'};
const out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness');mkdirSync(out,{recursive:true});
// SVGs deliberately retain their layout while a new calculation is pending.
// Wait for the original startup producer and its exact accepted frame, rather
// than treating those retained elements as a completed model.
const initialInputTerminal=()=>{
 const status=document.querySelector('#privateContextStatus')?.textContent||'';
 return (jointPrivateSource==='repository'&&status.startsWith('Repository fundamentals ACTIVE'))||
  status.startsWith('Repository fundamentals unavailable:')||status.startsWith('Private context not applied:');
};
const personalCurrent=()=>{
 const host=document.querySelector('#enPersonalFocus'),summary=host?.querySelector('[data-race="IA-SEN"] [data-disclosure="margin"] > summary'),rect=summary?.getBoundingClientRect();
 return Boolean(initialInputTerminal()&&jointCompletedFrame&&jointBasis&&jointLastResult?.samples===3000&&jointPulseBaseline?.samples===3000&&
  !jointModelPending&&!jointAsOfSnapshot&&!jointActiveKey&&jointRefreshTimer===null&&jointCacheKey===jointCompletedFrame.key&&
  jointCompletedFrame.key===jointFrameKey(jointValidatedFrameInputs())&&jointCompletedFrame.modelRevision===jointModelCodeRevision()&&
  host&&!host.hidden&&host.getAttribute('aria-busy')!=='true'&&summary&&!summary.closest('[hidden],[inert]')&&
  getComputedStyle(summary).visibility!=='hidden'&&rect.width>0&&rect.height>0);
};
// The page evaluates a self-contained copy; no app function or input is replaced.
const currentPredicate=Function('return '+personalCurrent.toString().replace('initialInputTerminal()','('+initialInputTerminal.toString()+')()'))();
async function waitForPersonalCurrent(page){await page.waitForFunction(initialInputTerminal);await page.evaluate(()=>jointWhenIdle());await page.waitForFunction(currentPredicate);}
const focusDiagnostics=[],completedWidths=[];let currentWidth=null,currentPhase='START';
async function recordFocus(page,phase){
 const state=await page.evaluate(()=>{const host=document.querySelector('#enPersonalFocus'),active=document.activeElement;return {pending:jointModelPending,as_of:Boolean(jointAsOfSnapshot),request_active:Boolean(jointActiveKey),refresh_queued:jointRefreshTimer!==null,frame_present:Boolean(jointCompletedFrame),frame_cache_equal:Boolean(jointCompletedFrame&&jointCompletedFrame.key===jointCacheKey),frame_inputs_equal:Boolean(jointCompletedFrame&&jointCompletedFrame.key===jointFrameKey(jointValidatedFrameInputs())),frame_revision_equal:Boolean(jointCompletedFrame&&jointCompletedFrame.modelRevision===jointModelCodeRevision()),result_samples:jointLastResult?.samples||null,baseline_samples:jointPulseBaseline?.samples||null,aria_busy:host?.getAttribute('aria-busy')||null,focus_tag:active?.tagName||null,focus_id:active?.id||null,focus_race:active?.closest('.personal-focus-card')?.dataset.race||null,focus_disclosure:active?.closest('details')?.dataset.disclosure||null,focus_heading:active?.tagName==='H4'&&Boolean(active?.closest('.personal-focus-card')),summary_inert:Boolean(host?.querySelector('[data-race="IA-SEN"] [data-disclosure="margin"] > summary')?.closest('[inert]'))};});
 focusDiagnostics.push({width:currentWidth,phase,...state});if(focusDiagnostics.length>12)focusDiagnostics.shift();return state;
}
const server=createServer((req,res)=>{const file=resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':decodeURIComponent(new URL(req.url,'http://localhost').pathname)));
 if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const width of [1366,390]){
  currentWidth=width;currentPhase='INITIAL_CARDS';
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-27T19:00:00Z')});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>document.querySelectorAll('#enPersonalFocus article svg').length===18);
  await waitForPersonalCurrent(page);
  assert.equal(await page.locator('#enPersonalFocus article').count(),19);
  assert.match(await page.locator('#enPersonalFocus [data-race="AK-SEN"]').innerText(),/Needle pending/);
  assert.match(await page.locator('#enPersonalFocus [data-race="NE-SEN"]').innerText(),/Osborn.*model chance vs Ricketts.*Independent; no assumed Democratic caucus/s);
  assert.doesNotMatch(await page.locator('#enPersonalFocus [data-race="MI-SEN"]').innerText(),/Own county returns used/);
  const same=await page.evaluate(()=>Array.from(document.querySelectorAll('#enPersonalFocus article')).filter(e=>e.dataset.race!=='AK-SEN').every(e=>{
   const r=jointLastResult.race_probabilities.find(x=>x.race_code===e.dataset.race);return e.querySelector('svg').getAttribute('aria-label').includes(r.dem_beats_rep_pct.toFixed(1)+' percent');}));assert(same);
  const liveBefore=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  // Normal source-status redraws must retain an actual race heading. A pending
  // heading used as a temporary summary anchor must retain the summary instead.
  // Reuse this already-computed model; these component checks make no new draws.
  currentPhase='HEADING_COMPONENT';await waitForPersonalCurrent(page);await recordFocus(page,'HEADING_CURRENT');
  const headingRedraw=await page.evaluate(()=>{
   const api=PersonalElectionFocus,host=document.querySelector('#enPersonalFocus'),code='IA-SEN',inputBefore=JSON.stringify({result:jointLastResult,baseline:jointPulseBaseline});
   const card=()=>host.querySelector('[data-race="'+code+'"]'),heading=()=>card().querySelector('h4'),summary=()=>card().querySelector('[data-disclosure="margin"] > summary'),redraw=()=>renderPersonalElectionFocus();
   heading().focus({preventScroll:true});const originalHeading=heading(),originalCard=card(),originalBody=card().querySelector('.personal-focus-odds'),bookmark=api.captureFocus(host),targetIsHeading=api.focusTarget(host,bookmark)===originalHeading;redraw();
   const normal={bookmark,targetIsHeading,tag:document.activeElement.tagName,sameRace:document.activeElement===heading(),oldDisconnected:!originalHeading.isConnected,sameHeading:heading()===originalHeading,freshCard:card()!==originalCard,freshBody:card().querySelector('.personal-focus-odds')!==originalBody,oldBodyDisconnected:!originalBody.isConnected};
   api.setPending(host);const pendingHeading=api.captureFocus(host);api.focusTarget(host,pendingHeading)?.focus({preventScroll:true});redraw();
   const resumedHeading={bookmark:pendingHeading,tag:document.activeElement.tagName,sameRace:document.activeElement===heading()};
   summary().focus({preventScroll:true});const summaryBookmark=api.captureFocus(host);api.setPending(host);const anchorIsHeading=document.activeElement===heading(),pendingSummary=api.captureFocus(host);api.focusTarget(host,pendingSummary)?.focus({preventScroll:true});redraw();
   const resumedSummary={bookmark:summaryBookmark,pendingBookmark:pendingSummary,anchorIsHeading,tag:document.activeElement.tagName,sameSummary:document.activeElement===summary()};
   summary().focus({preventScroll:true});api.setPending(host);const outside=document.querySelector('#enMode2026');outside.focus({preventScroll:true});redraw();
   const movedOutsideRetained=document.activeElement===outside;
   heading().focus({preventScroll:true});api.setPending(host);api.focusTarget(host,api.captureFocus(host))?.focus({preventScroll:true});const other=host.querySelector('[data-race="NE-SEN"] > h4');other.focus({preventScroll:true});redraw();
   const movedOtherRaceRetained=document.activeElement===host.querySelector('[data-race="NE-SEN"] > h4');
   // An arbitrary focused card control keeps the old null-disclosure behavior;
   // only the actual semantic H4 acquires the heading marker.
   const control=document.createElement('button');control.textContent='Fictional component-only control';card().append(control);control.focus({preventScroll:true});const controlBookmark=api.captureFocus(host);redraw();
   const unrelatedControl={bookmark:controlBookmark,firstSummary:document.activeElement===card().querySelector('details > summary')};
   return {normal,resumedHeading,resumedSummary,movedOutsideRetained,movedOtherRaceRetained,unrelatedControl,inputsUnchanged:inputBefore===JSON.stringify({result:jointLastResult,baseline:jointPulseBaseline})};
  });
  assert.deepEqual(headingRedraw.normal.bookmark,{kind:'race',race:'IA-SEN',disclosure:null,part:'heading'});
  assert.deepEqual(headingRedraw.normal,{bookmark:headingRedraw.normal.bookmark,targetIsHeading:true,tag:'H4',sameRace:true,oldDisconnected:false,sameHeading:true,freshCard:true,freshBody:true,oldBodyDisconnected:true},'A normal redraw retains the same semantic race heading, not the first summary');
  assert.deepEqual(headingRedraw.resumedHeading,{bookmark:headingRedraw.normal.bookmark,tag:'H4',sameRace:true},'An explicit pending heading bookmark resumes the heading');
  assert.deepEqual(headingRedraw.resumedSummary,{bookmark:{kind:'race',race:'IA-SEN',disclosure:'margin'},pendingBookmark:{kind:'race',race:'IA-SEN',disclosure:'margin'},anchorIsHeading:true,tag:'SUMMARY',sameSummary:true},'A pending H4 anchor resumes its original summary rather than becoming a heading bookmark');
  assert.equal(headingRedraw.movedOutsideRetained,true,'A user who leaves the pending card keeps their new control');
  assert.equal(headingRedraw.movedOtherRaceRetained,true,'A user who moves to another race heading keeps the new race');
  assert.deepEqual(headingRedraw.unrelatedControl,{bookmark:{kind:'race',race:'IA-SEN',disclosure:null},firstSummary:true},'Unrelated null-disclosure card controls retain their previous restoration behavior');
  assert.equal(headingRedraw.inputsUnchanged,true,'Semantic focus restoration cannot change the accepted model or polling baseline');
  // Same existing fictional summary fixture, zero new engine draws. The public
  // code-only heading may survive; every model/source/context body must be new.
  const headingLifetime=await page.evaluate(()=>{
   const api=PersonalElectionFocus,previousActive=document.activeElement,mount=document.createElement('section');mount.setAttribute('aria-label','SIMULATED heading identity component');document.body.append(mount);
   const host=document.createElement('div'),otherHost=document.createElement('div');mount.append(host,otherHost);
   const codes=[...api.SENATE.map(state=>state+'-SEN'),...api.HOUSE],distribution=axis=>({schema_version:'same-joint-margin-summary-v1',p05:-8,p25:-2,p50:2,p75:6,p95:12,mean:2,sd:6,sample_count:900,unique_election_particles:900,axis,conditioning:'POLLING_BASELINE',interval_calibrated:false,distribution_scope:'UNBOUNDED_LATENT_MARGIN_PROXY_NOT_FINAL_VOTE_INTERVAL',quantile_method:'SORTED_DRAW_LOWER_INDEX_FLOOR_N_MINUS_ONE_P'});
   const prior={race_probabilities:codes.map(race_code=>({race_code,dem_beats_rep_pct:45}))},sample={probabilities:{red_dawn:10,shrug:30,blue_wave:20,blue_tsunami:40},race_probabilities:codes.map(race_code=>({race_code,dem_beats_rep_pct:45,margin_distribution:distribution(race_code==='NE-SEN'?'osborn_minus_ricketts':'dem_minus_rep')}))},now=Date.parse('2026-11-04T02:15:00Z'),history=api.createHistory({simulated:true,now:()=>now});
   const local=structuredClone(sample);local.race_probabilities.find(row=>row.race_code==='IA-SEN').dem_beats_rep_pct=61;local.county_results_update={used:[{code:'IA-SEN',as_of:'2026-11-04T02:10:00Z',counted_two_party_votes:20000}]};
   const called=structuredClone(local);Object.assign(called.race_probabilities.find(row=>row.race_code==='IA-SEN'),{dem_beats_rep_pct:100,provider_called_party:'D'});
   const inputBefore=JSON.stringify({prior,sample,local,called}),publicHistoryRecorded=history.observe({result:sample,revision:'FICTIONAL_PUBLIC_HISTORY',pollingAt:'2026-11-03T12:00:00Z',context:'PUBLIC',simulated:true}),localHistoryRecorded=history.observe({result:sample,revision:'FICTIONAL_LOCAL_HISTORY',pollingAt:'2026-11-03T12:00:00Z',context:'LOCAL_RESEARCH_VARIANT',simulated:true});
   const options={year:2026,now,closes:ElectionNightPollClosings2026,simulated:true,history,context:'PUBLIC'},card=(node=host)=>node.querySelector('[data-race="IA-SEN"]'),heading=(node=host)=>card(node).querySelector(':scope > h4'),draw=(result=sample,extra={})=>api.render(host,result,prior,{...options,...extra});
   try{
    draw();const initialHeading=heading(),initialCard=card(),initialOdds=card().querySelector('.personal-focus-odds'),initialMargin=card().querySelector('.personal-focus-margin'),orderBefore=[...host.querySelectorAll('.personal-focus-card')].map(node=>node.dataset.race);draw(called,{context:'LOCAL_RESEARCH_VARIANT'});
    const changed={sameHeading:heading()===initialHeading,freshCard:card()!==initialCard,freshOdds:card().querySelector('.personal-focus-odds')!==initialOdds,oldMarginRemoved:!initialMargin.isConnected&&card().querySelector('.personal-focus-margin')===null,currentCall:card().querySelector('.personal-focus-rating').textContent.includes('D victory'),currentCounts:card().textContent.includes('20,000 named-candidate'),currentLocalHistory:host.querySelector('.personal-focus-history').textContent.includes('FICTIONAL_LOCAL_HISTORY'),reordered:[...host.querySelectorAll('.personal-focus-card')].map(node=>node.dataset.race).indexOf('IA-SEN')<orderBefore.indexOf('IA-SEN')};
    draw(sample);const withdrawal={sameHeading:heading()===initialHeading,noCall:!card().textContent.includes('D victory'),noOldCounts:!card().textContent.includes('20,000 named-candidate'),publicOdds:card().querySelector('.personal-focus-odds').textContent.includes('45.0%'),marginRestored:Boolean(card().querySelector('.personal-focus-margin')),publicHistory:host.querySelector('.personal-focus-history').textContent.includes('FICTIONAL_PUBLIC_HISTORY'),noLocalHistory:!host.querySelector('.personal-focus-history').textContent.includes('FICTIONAL_LOCAL_HISTORY')};
    draw(local,{context:'LOCAL_RESEARCH_VARIANT',calculationAsOf:{input_at:'2026-11-04T02:10:00Z'}});const asOfShown=card().textContent.includes('Last completed calculation');api.render(otherHost,sample,prior,options);const otherHeading=heading(otherHost),separateHosts=otherHeading!==heading()&&card(otherHost).querySelector('.personal-focus-odds').textContent.includes('45.0%');draw(sample);const contexts={sameHeading:heading()===initialHeading,asOfShown,currentClearsAsOf:!card().textContent.includes('Last completed calculation'),privateToPublicFresh:card().querySelector('.personal-focus-odds').textContent.includes('45.0%')&&!card().textContent.includes('61.0%'),separateHosts,otherHostUnchanged:heading(otherHost)===otherHeading};
    const pendingSummary=card().querySelector('[data-disclosure="margin"] > summary');pendingSummary.focus({preventScroll:true});api.setPending(host);const pendingAnchorSame=heading()===initialHeading&&document.activeElement===initialHeading;draw();const pending={pendingAnchorSame,headingSame:heading()===initialHeading,summaryBookmarkWins:document.activeElement===card().querySelector('[data-disclosure="margin"] > summary')};
    const malformed=[];for(const [name,mutate]of [['text',node=>node.textContent='Unexpected stale title'],['extra-attribute',node=>node.setAttribute('title','Unexpected')],['tabindex',node=>node.tabIndex=0],['child-shape',node=>{const span=document.createElement('span');span.textContent=node.textContent;node.replaceChildren(span);}],['second-heading',node=>node.parentElement.append(node.cloneNode(true))],['duplicate-race-card',node=>host.append(node.parentElement.cloneNode(true))]]){draw();const old=heading();mutate(old);draw();malformed.push({name,fresh:heading()!==old,oldDisconnected:!old.isConnected,canonical:heading().textContent==='IA-SEN'&&heading().attributes.length===1&&heading().getAttribute('tabindex')==='-1'&&heading().childNodes.length===1&&heading().firstChild.nodeType===Node.TEXT_NODE});}
    const removed=heading();card().remove();draw();const absentFresh=heading()!==removed&&!removed.isConnected,archiveHeading=heading();draw(sample,{year:2024});const archiveCleared=host.hidden&&host.childNodes.length===0&&!archiveHeading.isConnected;draw();const archiveReturnFresh=heading()!==archiveHeading;
    const noResultHeading=heading();api.render(host,null,null,options);const noResult={publicHeadingRetained:heading()===noResultHeading,pendingBody:card().textContent.includes('Needle pending'),noOdds:card().querySelector('.personal-focus-odds')===null,noCall:!card().textContent.includes('D victory')};
    return{historySetup:{publicRecorded:publicHistoryRecorded,localRecorded:localHistoryRecorded},changed,withdrawal,contexts,pending,malformed,absentFresh,archiveCleared,archiveReturnFresh,noResult,inputsUnchanged:inputBefore===JSON.stringify({prior,sample,local,called})};
   }finally{mount.remove();if(previousActive?.isConnected)previousActive.focus({preventScroll:true});}
  });
  assert.equal(headingLifetime.historySetup.publicRecorded,true,'Source-free fictional PUBLIC history is established before body freshness checks');
  assert.equal(headingLifetime.historySetup.localRecorded,true,'Source-free fictional LOCAL history is established before body freshness checks');
  assert.deepEqual(headingLifetime.changed,{sameHeading:true,freshCard:true,freshOdds:true,oldMarginRemoved:true,currentCall:true,currentCounts:true,currentLocalHistory:true,reordered:true},'Stable public headings cannot retain old cards, ranges, call/count labels or context bodies');
  assert.deepEqual(headingLifetime.withdrawal,{sameHeading:true,noCall:true,noOldCounts:true,publicOdds:true,marginRestored:true,publicHistory:true,noLocalHistory:true},'Withdrawal and public-context return rebuild all prediction/evidence/history text');
  assert.deepEqual(headingLifetime.contexts,{sameHeading:true,asOfShown:true,currentClearsAsOf:true,privateToPublicFresh:true,separateHosts:true,otherHostUnchanged:true},'Independent hosts and current/as-of/private/public bodies remain separate');
  assert.deepEqual(headingLifetime.pending,{pendingAnchorSame:true,headingSame:true,summaryBookmarkWins:true},'A retained heading still returns a pending summary bookmark to its fresh summary');
  assert(headingLifetime.malformed.every(row=>row.fresh&&row.oldDisconnected&&row.canonical),'Noncanonical or duplicate old headings must be replaced');
  assert.equal(headingLifetime.absentFresh,true);assert.equal(headingLifetime.archiveCleared,true);assert.equal(headingLifetime.archiveReturnFresh,true);
  assert.deepEqual(headingLifetime.noResult,{publicHeadingRetained:true,pendingBody:true,noOdds:true,noCall:true},'A missing result keeps only the public roster heading and fresh pending body');
  assert.equal(headingLifetime.inputsUnchanged,true,'Heading lifetime changes cannot mutate any supplied current or baseline inputs');
  currentPhase='RANGE_DRILL';await waitForPersonalCurrent(page);await recordFocus(page,'RANGE_CURRENT');
  const ia=page.locator('#enPersonalFocus [data-race="IA-SEN"]'),distribution=ia.locator('.personal-focus-margin');
  assert.equal(await distribution.count(),1,'Current shared simulation supplies a selected race range');
  assert.equal(await page.locator('#enPersonalFocus [data-race="AK-SEN"] .personal-focus-margin').count(),0);
  const sameRange=await ia.evaluate(card=>{const d=jointLastResult.race_probabilities.find(r=>r.race_code==='IA-SEN').margin_distribution;return {text:card.querySelector('.personal-focus-margin').textContent,median:d.p50,conditioning:d.conditioning};});
  assert.equal(sameRange.conditioning,'POLLING_BASELINE');assert.match(sameRange.text,/Middle 90%/);
  const help=distribution.locator('summary');await help.click();
  assert.match(await distribution.innerText(),/not a calibrated final-vote interval/);
  await page.evaluate(()=>renderPersonalElectionFocus());
  await waitForPersonalCurrent(page);await recordFocus(page,'RANGE_POST_REDRAW_CURRENT');
  assert.equal(await help.evaluate(e=>e===document.activeElement),true,'Range explanation keeps keyboard focus after redraw');
  assert.equal(await distribution.locator('details').evaluate(e=>e.open),true);
  await page.keyboard.press('Space');assert.equal(await distribution.locator('details').evaluate(e=>e.open),false);
  const geometry=await distribution.locator('.personal-focus-margin-strip').evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,children:[...e.children].map(c=>{const b=c.getBoundingClientRect();return {left:b.left-r.left,right:b.right-r.left,height:b.height};})};});
  assert(geometry.width>150);assert(geometry.children.every(r=>r.left>=-3&&r.right<=geometry.width+3&&r.height>0),'Margin marks render within their explicitly labelled scale');
  await ia.screenshot({path:resolve(out,'margin-range-'+width+'.png')});
  await help.click();
  await page.evaluate(()=>{const called=structuredClone(jointLastResult);called.race_probabilities.find(r=>r.race_code==='IA-SEN').provider_called_party='D';PersonalElectionFocus.render(document.querySelector('#enPersonalFocus'),called,jointPulseBaseline,{closes:ElectionNightPollClosings2026});});
  assert.equal(await distribution.count(),0,'A source call must not fabricate a final margin');
  assert.equal(await ia.locator('h4').evaluate(e=>e===document.activeElement),true,'Removed range returns its reader to the same race heading');
  await page.evaluate(()=>renderPersonalElectionFocus());assert.equal(await distribution.count(),1);
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),liveBefore,'Range interactions and synthetic display calls leave the live model unchanged');
  await page.locator('#enNationalRehearsal > summary').click();
  await page.locator('#enNationalRehearsal > details > summary').click();
  await page.waitForFunction(()=>document.querySelectorAll('#enPersonalFocusPreview article').length===19);
  assert(await page.locator('#enPersonalFocusPreview .personal-focus-margin').count()>0,'Rehearsal receives its own same-draw summaries');
  assert.match(await page.locator('#enPersonalFocusPreview').innerText(),/SIMULATED.*FICTIONAL COUNTS/s);
  await page.locator('#enNationalNext').click();await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('2/5'));
  const ksPreview=page.locator('#enPersonalFocusPreview [data-race="KS-SEN"]');
  assert.match(await ksPreview.locator('.personal-focus-performance').innerText(),/Even margin points vs expected/,'Expected blue counties show no added performance surprise');
  await ksPreview.locator(':scope > details > summary').click();assert.match(await ksPreview.innerText(),/not county polls|not confidence intervals/);
  await page.locator('#enNationalNext').click();await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('3/5'));
  assert.match(await ksPreview.locator('.personal-focus-performance').innerText(),/D\+3\.0 margin points vs expected/);
  const previewHistory=page.locator('#enPersonalFocusPreview .personal-focus-history');await previewHistory.locator(':scope > summary').click();
  assert.match(await previewHistory.innerText(),/SIMULATED/);assert.match(await previewHistory.innerText(),/model observations since/);
  await previewHistory.locator('.personal-focus-history-entry details > summary').first().click();
  assert.match(await previewHistory.innerText(),/Polling lineage:/);
  await page.locator('#enNationalNext').click();await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('4/5'));
  assert.match(await previewHistory.innerText(),/correction/);assert.equal(await previewHistory.evaluate(e=>e.open),true,'History disclosure remains open through updates');
  await page.locator('#enNationalNext').click();await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('5/5'));
  assert.match(await previewHistory.innerText(),/withdrawal/);
  assert.equal(await page.evaluate(()=>enOutlookHistory.events('PUBLIC').length+enOutlookHistory.events('LOCAL_RESEARCH_VARIANT').length),0,'Pre-election preview cannot populate either live history context');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'Expanded history must wrap model revision strings on mobile');
  await previewHistory.screenshot({path:resolve(out,'outlook-history-'+width+'.png')});
  // Return to the surprise frame to retain the existing county disclosure drill.
  await page.locator('#enNationalNext').click();await page.locator('#enNationalNext').click();await page.locator('#enNationalNext').click();
  await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('3/5'));
  await ksPreview.locator(':scope > details > summary').click();
  assert.match(await ksPreview.innerText(),/Largest 6 of/);
  await ksPreview.screenshot({path:resolve(out,'matched-performance-'+width+'.png')});
  assert.equal(await page.locator('#enPersonalFocus .personal-focus-performance').count(),0,'Simulated performance cannot leak into live cards');
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),liveBefore,'Preview must not change the live joint model');
  assert.doesNotMatch(await page.locator('#enPersonalFocus').innerText(),/SIMULATED/);
  await page.locator('#enNationalRehearsal > summary').click();
  const restored=await page.evaluate(async()=>{
   const inputs=await NationalNeedleRehearsal.load(p=>fetch('./'+p).then(r=>r.json())),args={samples:900,seed:20261103,rehearsal:true,now:NationalNeedleRehearsal.now};
   const sample=NationalCountyLikelihood.condition(ChamberControlModel,jointBasis,NationalNeedleRehearsal.stage(inputs,2,jointBasis),args);
   jointLastResult=sample.result;jointPulseBaseline=sample.baseline;renderPersonalElectionFocus();
   const admitted=document.querySelector('#enPersonalFocus [data-race="IA-SEN"]').textContent.includes('Own county returns used nationally');
   const empty=NationalCountyLikelihood.condition(ChamberControlModel,jointBasis,[],args);jointLastResult=empty.result;jointPulseBaseline=empty.baseline;renderPersonalElectionFocus();
   return {admitted,withdrawn:!document.querySelector('#enPersonalFocus [data-race="IA-SEN"]').textContent.includes('Own county returns used nationally'),same:JSON.stringify(empty.result.probabilities)===JSON.stringify(sample.baseline.probabilities)};
  });assert.deepEqual(restored,{admitted:true,withdrawn:true,same:true});
  await page.clock.setSystemTime(new Date('2026-11-04T03:00:00Z'));
  const liveHistory=await page.evaluate(async()=>{const context=jointUsesPrivateContext()?'LOCAL_RESEARCH_VARIANT':'PUBLIC';await jointRender(true);await jointWhenIdle();const first=enOutlookHistory.events(context).length;await jointRender(true);await jointWhenIdle();
   const same=enOutlookHistory.events(context).length===first,old=jointNationalShift;jointNationalShift=old+.5;await jointRender(true);await jointWhenIdle();
   const change=enOutlookHistory.events(context)[0]?.kind||null;jointNationalShift=old;await jointRender(true);await jointWhenIdle();return{first,same,change};});
  assert.deepEqual(liveHistory,{first:1,same:true,change:'BASELINE_CHANGE'},'Actual controller logs baseline/settings changes, never calls them returns');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
  await page.locator('#enPersonalFocus').screenshot({path:resolve(out,'personal-focus-'+width+'.png')});
  await page.locator('#enMode2024').click();assert.equal(await page.locator('#enPersonalFocus').isHidden(),true);assert.deepEqual(errors,[]);
  // Start the separate missing-asset bootstrap at the original pre-close clock,
  // rather than carrying the preceding post-close history drill into startup.
  await page.clock.setSystemTime(new Date('2026-10-27T19:00:00Z'));
  await page.route('**/personal_election_focus.js*',route=>route.abort());await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();await page.waitForFunction(()=>jointLastResult?.probabilities);assert.equal(await page.evaluate(()=>typeof window.PersonalElectionFocus),'undefined');assert.deepEqual(errors,[]);
  completedWidths.push(width);
  await context.close();console.log(width+'px owner Senate/House same-model needles, disclosure, synthetic admission/withdrawal, archive and optional-script fallback PASS');
 }
 writeFileSync(resolve(out,'personal-current-focus-diagnostics.json'),JSON.stringify({status:'PASS',completed_widths:completedWidths,focus_diagnostics:focusDiagnostics,scope:'Bounded public semantic focus/current-frame diagnostics only; no input values, hashes or frame bodies.'},null,2)+'\n');
}catch(error){writeFileSync(resolve(out,'personal-current-focus-failure.json'),JSON.stringify({status:'FAIL',width:currentWidth,phase:currentPhase,completed_widths:completedWidths,focus_diagnostics:focusDiagnostics,error:error.message,stack:error.stack},null,2)+'\n');throw error;}
finally{await browser?.close();await new Promise(ok=>server.close(ok));}
