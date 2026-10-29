// New pending-view component checks only. Actual current helper/CSS and existing
// fictional model/rehearsal fixture; no live admission or old story replay.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),fixture=require('./fictional_call_basis.cjs');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness/ui-review/personal-election-pending');mkdirSync(out,{recursive:true});
const index=readFileSync(resolve(root,'index.html'),'utf8'),css=index.match(/<style>([\s\S]*?)<\/style>/)[1];
const scripts=['house_early_watch_reference','personal_election_focus','election_night_poll_closings_2026','source_call_conditioning','chamber_control_model','national_county_likelihood','national_needle_rehearsal'];
const sourceBytes=Object.fromEntries(scripts.map(name=>['scripts/'+name+'.js',readFileSync(resolve(root,'scripts',name+'.js'))]));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const html='<!doctype html><html><meta charset="utf-8"><title>Isolated pending needle review</title><style>'+css+'</style><body><section id="electionNight" class="page active"><div class="en-toolbar"><button id="outside">Outside reader control</button><button id="announcement">Announcement return stand-in</button></div><div id="enPersonalFocus"></div></section>'+scripts.map(name=>'<script src="/scripts/'+name+'.js"></script>').join('')+'</body></html>';
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/pending-component.html')return res.writeHead(200,{'content-type':'text/html'}).end(html);
 if(Object.hasOwn(sourceBytes,path.slice(1)))return res.writeHead(200,{'content-type':'application/javascript'}).end(sourceBytes[path.slice(1)]);
 const file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile())return res.writeHead(404).end();
 res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'}).end(readFileSync(file));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;const proofs=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const [width,height]of [[1366,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();external.push(url.hostname);return route.abort();});
  await page.goto('http://127.0.0.1:'+server.address().port+'/pending-component.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(async basis=>{
   if(typeof jointWhenIdle==='function')await jointWhenIdle();
   const baseline=await fetch('/data/nebraska_senate_2024_candidate_reference.json').then(r=>r.json()),reference=await fetch('/data/nebraska_county_fips_reference.json').then(r=>r.json());
   const inputs=[{code:'NE-SEN',id:87254,baseline,reference,baseline_year:2024}],envelopes=NationalNeedleRehearsal.stage(inputs,2,basis),
    now=NationalNeedleRehearsal.now,args={samples:300,seed:19760408,independentSenateCredit:'no_credit',marginSummaryCodes:['IA-SEN','NE-SEN','ME-SEN'],rehearsal:true,now,live:{}};
   const update=NationalCountyLikelihood.condition(ChamberControlModel,basis,envelopes,args),
    empty=ChamberControlModel.simulate(basis,{...args,live:{}}),history=PersonalElectionFocus.createHistory({simulated:true,now:()=>now});
   const common={year:2026,now,closes:ElectionNightPollClosings2026,simulated:true,history};
   history.observe({result:empty,envelopes:[],live:{},revision:'FICTIONAL_PENDING_VIEW',pollingAt:'2026-10-28T19:00:00Z',simulated:true});
   history.observe({result:update.result,envelopes,live:{},revision:'FICTIONAL_PENDING_VIEW',pollingAt:'2026-10-28T19:00:00Z',simulated:true});
   // UI-only fixture: retain the actual fictional Nebraska performance card
   // and replace one display row with the actual call-only fictional IA row.
   // This does not enter source admission or claim a coherent new forecast.
   const called=ChamberControlModel.simulate(basis,{samples:300,seed:19760408,independentSenateCredit:'no_credit',marginSummaryCodes:['IA-SEN'],live:{'IA-SEN':{mode:'source_called',winnerParty:'D'}}});
   update.result=structuredClone(update.result);Object.assign(update.result.race_probabilities.find(row=>row.race_code==='IA-SEN'),called.race_probabilities.find(row=>row.race_code==='IA-SEN'));
   const host=document.querySelector('#enPersonalFocus'),draw=result=>PersonalElectionFocus.render(host,result,update.baseline,common);
   window.review={update,empty,history,common,draw,host};draw(update.result);
  },fixture({largeBags:true}));
  const host=page.locator('#enPersonalFocus'),ia=host.locator('[data-race="IA-SEN"]'),ne=host.locator('[data-race="NE-SEN"]'),watch=host.locator('.early-watch-list'),history=host.locator('.personal-focus-history');
  assert.match(await ia.innerText(),/SIMULATED · D victory/);
  assert.equal(await ne.locator('[data-disclosure="expectation"]').count(),1);
  assert.equal(await history.locator('.personal-focus-history-entry').count()>0,true);
  await watch.locator(':scope > summary').click();await watch.locator('[data-watch-race="VA-02"] > summary').click();
  await history.locator(':scope > summary').click();await history.locator('.personal-focus-history-entry details > summary').first().click();
  await ne.locator('[data-disclosure="expectation"] > summary').click();await ne.locator('[data-disclosure="areas"] > summary').click();
  if(await ne.locator('[data-disclosure="margin"]').count())await ne.locator('[data-disclosure="margin"] > summary').click();
  await ne.locator('[data-disclosure="areas"] > summary').focus();
  const geometry=await ne.evaluate(card=>({height:card.getBoundingClientRect().height,scrollY,areas:card.querySelector('[data-disclosure="areas"]')}));
  await page.evaluate(()=>{review.originalAreas=review.host.querySelector('[data-race="NE-SEN"] [data-disclosure="areas"]');PersonalElectionFocus.setPending(review.host,'Checking source correction…');});
  assert.equal(await host.getAttribute('aria-busy'),'true');assert.equal(await ne.locator('h4').evaluate(node=>node===document.activeElement),true);
  assert.doesNotMatch(await ia.innerText(),/D victory|100\.0%/);assert.doesNotMatch(await ia.ariaSnapshot(),/D victory|100\.0/);
  const pending=await page.evaluate(()=>({sameAreas:review.originalAreas===review.host.querySelector('[data-race="NE-SEN"] [data-disclosure="areas"]'),
   areasOpen:review.originalAreas.open,expectationOpen:review.originalAreas.parentElement.open,
   hidden:[...review.host.querySelectorAll('.personal-focus-card > svg,.personal-focus-card > .personal-focus-rating,.personal-focus-card > .personal-focus-odds,.personal-focus-card > details,.personal-focus-card > .personal-focus-margin')].every(node=>getComputedStyle(node).visibility==='hidden'&&node.getAttribute('aria-hidden')==='true'&&node.hasAttribute('inert')),
   bookmark:PersonalElectionFocus.captureFocus(review.host),notes:review.host.querySelectorAll('.personal-focus-pending-note').length}));
  assert.equal(pending.sameAreas,true);assert.equal(pending.areasOpen,true);assert.equal(pending.expectationOpen,true);assert.equal(pending.hidden,true);assert.equal(pending.notes,19);
  assert.deepEqual(pending.bookmark,{kind:'race',race:'NE-SEN',disclosure:'areas'});
  assert(Math.abs((await ne.boundingBox()).height-geometry.height)<1,'Pending view preserves card layout rather than collapsing disclosures');
  await page.evaluate(()=>PersonalElectionFocus.setPending(review.host,'Checking the newest update…'));assert.equal(await host.locator('.personal-focus-pending-note').count(),19);
  assert.equal(await watch.locator('[data-watch-race="VA-02"] .early-watch-reference').isVisible(),true,'Owner reference remains readable while model is pending');
  const pendingScrollDelta=await page.evaluate(()=>scrollY)-geometry.scrollY;
  assert(Math.abs(pendingScrollDelta)<=2,'Pending semantic heading bridge preserves the existing nested reading position');
  await page.screenshot({path:resolve(out,'pending-ne-areas-'+width+'.png')});
  await page.evaluate(()=>review.draw(review.update.result));
  assert.equal(await ne.locator('[data-disclosure="areas"] > summary').evaluate(node=>node===document.activeElement),true);
  assert.equal(await ne.locator('[data-disclosure="areas"]').evaluate(node=>node.open),true);assert.equal(await ne.locator('[data-disclosure="expectation"]').evaluate(node=>node.open),true);
  assert.equal(await watch.evaluate(node=>node.open),true);assert.equal(await watch.locator('[data-watch-race="VA-02"]').evaluate(node=>node.open),true);assert.equal(await history.evaluate(node=>node.open),true);
  assert.equal(await history.locator('.personal-focus-history-entry details').first().evaluate(node=>node.open),true);
  assert.equal(await host.getAttribute('aria-busy'),null);
  // A changed reader must never be pulled back by the accepted response.
  await page.evaluate(()=>PersonalElectionFocus.setPending(review.host));await page.locator('#outside').focus();await page.evaluate(()=>review.draw(review.update.result));assert.equal(await page.locator('#outside').evaluate(node=>node===document.activeElement),true);
  // Automatic announcement-style capture and close during pending keeps the
  // original area identity even though its temporary focus node is a heading.
  await ne.locator('[data-disclosure="areas"] > summary').focus();
  await page.evaluate(()=>{PersonalElectionFocus.setPending(review.host);review.anchor=PersonalElectionFocus.captureFocus(review.host);document.querySelector('#announcement').focus();const target=PersonalElectionFocus.focusTarget(review.host,review.anchor);target.focus({preventScroll:true});});
  assert.equal(await ne.locator('h4').evaluate(node=>node===document.activeElement),true);await page.evaluate(()=>review.draw(review.update.result));
  assert.equal(await ne.locator('[data-disclosure="areas"] > summary').evaluate(node=>node===document.activeElement),true);
  // Commit while an announcement owns focus; close resolves a fresh semantic
  // control without stealing focus during the worker response.
  await page.evaluate(()=>{PersonalElectionFocus.setPending(review.host);review.anchor=PersonalElectionFocus.captureFocus(review.host);document.querySelector('#announcement').focus();review.draw(review.update.result);});
  assert.equal(await page.locator('#announcement').evaluate(node=>node===document.activeElement),true);
  await page.evaluate(()=>PersonalElectionFocus.focusTarget(review.host,review.anchor).focus({preventScroll:true}));assert.equal(await ne.locator('[data-disclosure="areas"] > summary').evaluate(node=>node===document.activeElement),true);
  // Removed evidence cannot restore a now-hidden old explanation.
  await page.evaluate(()=>{PersonalElectionFocus.setPending(review.host);review.draw(review.empty);});
  assert.equal(await ne.locator('[data-disclosure="areas"]').count(),0);assert.equal(await ne.locator('h4').evaluate(node=>node===document.activeElement),true);assert.doesNotMatch(await ia.innerText(),/victory/);
  await page.evaluate(()=>review.draw(review.update.result));
  await page.evaluate(()=>PersonalElectionFocus.setPending(review.host));
  await watch.locator('[data-watch-race="VA-02"] [data-personal-card-link]').click();
  assert.equal(await host.locator('[data-race="VA-02"] h4').evaluate(node=>node===document.activeElement),true);
  await host.locator('[data-race="VA-02"] [data-personal-watch-return]').click();
  assert.equal(await watch.locator('[data-watch-race="VA-02"] > summary').evaluate(node=>node===document.activeElement),true);
  await page.evaluate(()=>review.draw(review.update.result));assert.equal(await watch.locator('[data-watch-race="VA-02"] > summary').evaluate(node=>node===document.activeElement),true);
  const acceptedFocus=await page.evaluate(()=>{const node=document.activeElement,box=node.getBoundingClientRect(),toolbar=document.querySelector('.en-toolbar').getBoundingClientRect();return {target:node.closest('[data-watch-race]')?.dataset.watchRace||node.tagName,top:box.top,bottom:box.bottom,toolbar_bottom:toolbar.bottom,viewport:innerHeight};});
  if(acceptedFocus.top<acceptedFocus.toolbar_bottom+7||acceptedFocus.bottom>height-8)writeFileSync(resolve(out,'pending-watch-return-finding-'+width+'.json'),JSON.stringify({at:new Date().toISOString(),status:'FAIL_FOCUSED_WATCH_SUMMARY_COVERED_AFTER_PENDING_COMMIT',source_sha256:hash(sourceBytes['scripts/personal_election_focus.js']),geometry:acceptedFocus},null,2)+'\n',{flag:'wx'});
  assert(acceptedFocus.top>=acceptedFocus.toolbar_bottom+7&&acceptedFocus.bottom<height-8,'Accepted pending watch reader stays below toolbar and in viewport');
  assert.equal(await history.evaluate(node=>node.open),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await page.screenshot({path:resolve(out,'accepted-restored-'+width+'.png')});
  // A wheel-away reader retains keyboard focus elsewhere, but does not consent
  // to being scrolled back when a later accepted response restores that node.
  await page.evaluate(()=>{const card=review.host.querySelector('[data-race="NE-SEN"]');card.querySelector('[data-disclosure="expectation"]').open=true;card.querySelector('[data-disclosure="areas"]').open=true;card.querySelector('[data-disclosure="areas"] > summary').focus();PersonalElectionFocus.setPending(review.host);});
  const wheelStart=await page.evaluate(()=>({y:scrollY,maxScroll:Math.max(0,document.documentElement.scrollHeight-innerHeight)})),wheelTarget=Math.min(wheelStart.maxScroll,wheelStart.y+1200);
  await page.mouse.wheel(0,1200);await page.waitForFunction(target=>Math.abs(scrollY-target)<=1,wheelTarget);await page.waitForFunction(()=>document.activeElement.getBoundingClientRect().bottom<0);
  const wheelBeforeDiagnostic=await page.evaluate(()=>{
   window.__readPendingWheel=()=>{const active=document.activeElement,box=active.getBoundingClientRect();return {y:scrollY,maxScroll:Math.max(0,document.documentElement.scrollHeight-innerHeight),documentHeight:document.documentElement.scrollHeight,hostHeight:review.host.getBoundingClientRect().height,hostMinHeight:review.host.style.minHeight,activeTag:active.tagName,activeRace:active.closest('[data-race]')?.dataset.race||null,activeGeometry:{top:box.top,bottom:box.bottom,height:box.height},viewport:innerHeight};};
   return window.__readPendingWheel();
  });
  const wheelRenderDiagnostic=await page.evaluate(()=>{
   const calls=[],originalBy=window.scrollBy,originalTo=window.scrollTo;
   window.scrollBy=function(...args){calls.push({method:'scrollBy',args});return originalBy.apply(this,args);};window.scrollTo=function(...args){calls.push({method:'scrollTo',args});return originalTo.apply(this,args);};
   try{review.draw(review.update.result);return {afterSynchronousRender:window.__readPendingWheel(),explicitScrollCalls:calls};}finally{window.scrollBy=originalBy;window.scrollTo=originalTo;}
  });
  const wheelDiagnostic={before:wheelBeforeDiagnostic,...wheelRenderDiagnostic,after:await page.evaluate(()=>window.__readPendingWheel())};
  const wheelBefore=wheelDiagnostic.before.y,wheelAfter=wheelDiagnostic.after.y;
  writeFileSync(resolve(out,'wheel-away-diagnostic-'+width+'.json'),JSON.stringify({at:new Date().toISOString(),channel:process.env.BROWSER_CHANNEL||'chromium',browser_version:browser.version(),requested_wheel_delta:1200,wheel_start:wheelStart,settled_wheel_target:wheelTarget,helper_sha256:hash(sourceBytes['scripts/personal_election_focus.js']),...wheelDiagnostic},null,2)+'\n',{flag:'wx'});
  assert(Math.abs(wheelAfter-wheelBefore)<=1,'Accepted response cannot scroll a wheel-away reader back to retained focus');
  proofs.push({width,height,old_victory_hidden_visually_and_from_accessibility:true,model_chunks_aria_hidden_inert:true,disclosure_DOM_and_open_state_retained:true,card_height_retained:true,pending_scroll_delta:pendingScrollDelta,accepted_watch_focus_below_toolbar:true,heading_bridge_preserves_original_semantic_bookmark:true,accepted_response_same_reader_restored:true,reader_moved_no_focus_steal:true,wheel_away_scroll_delta:wheelAfter-wheelBefore,announcement_style_return_during_and_after_pending:true,removed_explanation_same_race_heading:true,watch_navigation_and_owner_references_usable:true,history_open_sources_retained:true,horizontal_overflow:false,native_provider_gets:0});
  await context.close();
 }
 const report={schema:'personal-pending-component-browser-proof-v1',at:new Date().toISOString(),status:'PASS',component_sources:Object.fromEntries(Object.entries(sourceBytes).map(([file,bytes])=>[file,hash(bytes)])),css_index_source_sha256:hash(Buffer.from(index)),viewports:proofs,
 scope:'Isolated actual current component helper/CSS; existing fixed fictional basis and Nebraska rehearsal. A UI-only fixture combines the Nebraska rehearsal card and actual fictional call-only IA display row; this is not a coherent alternative forecast or source admission. No evolving root inline integration.',external_requests:0,
 limits:['Announcement-style semantic capture/resolve stand-in, not a replay of the existing media/story system.','No actual source delivery, full worker integration, human/assistive acceptance or calibration claim.']};
 writeFileSync(resolve(out,'personal-pending-browser.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,proof:resolve(out,'personal-pending-browser.json'),viewports:proofs.length}));
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
