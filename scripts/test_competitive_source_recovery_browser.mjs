// Real browser rendering with synthetic provider outage; no synthetic votes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.mp3':'audio/mpeg','.jpg':'image/jpeg'};
const server=createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const width of [1440,1366,390]){
  const context=await browser.newContext({viewport:{width,height:width===1366?768:1000},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-04T03:00:00Z')});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();
  await page.waitForFunction(()=>Boolean(enPublishedCoverageLedger&&jointLastResult&&jointBasis&&latestSenateEstimates&&
   enEditorialCallChecks?.race_pages?.some(r=>r.id==='House|CA-13')));
  await page.evaluate(()=>{
   const existing=jointLastResult.race_probabilities.filter(r=>!['CA-13','ME-SEN'].includes(r.race_code));
   jointLastResult={...jointLastResult,race_probabilities:[...existing,
    {office:'house',race_code:'CA-13',dem_beats_rep_pct:50,rep_beats_dem_pct:50},
    {office:'senate',race_code:'ME-SEN',dem_beats_rep_pct:51,rep_beats_dem_pct:49}]};
   jointBasis={...jointBasis,generated_from_sources:{...jointBasis.generated_from_sources,
    model_polling_at:latestSenateEstimates.generated_at}};
   enCivicLastAttemptAt['House|CA-13']=Date.now();
   enCivicBreaker.fail(503);enRenderAmbientDesk();
  });
  const panel=page.locator('.en-coverage-recovery');
  const texas=panel.locator('[data-source-race="House|TX-23"]');
  assert.equal(await texas.locator('a[href="https://electionresults.sos.state.tx.us/results.html"]').count(),1);
  assert.match(await texas.textContent(),/2026 returns NOT YET published/);
  assert.match(await page.locator('.en-coverage-priority [data-source-race="House|NJ-07"]').textContent(),
   /county links ONLY; NO statewide Election Night results/);
  assert(await page.locator('.en-coverage-priority > p[data-source-race]').count() <= 4,
   'A growing identity-gap inventory must not expand every manual task on the main desk');
  const expectedGapIds=await page.evaluate(()=>enPublishedCoverageLedger.races
   .filter(r=>r.gap_status==='UNRESOLVED_SOURCE_GAP').map(r=>r.id).sort());
  const displayedGapIds=await page.locator('.en-coverage-priority [data-source-race]')
   .evaluateAll(rows=>rows.map(r=>r.dataset.sourceRace).sort());
  assert.deepEqual(displayedGapIds,expectedGapIds,
   'Collapsing lower priority work must preserve every unresolved race exactly once');
  const priorityMore=page.locator('details[data-source-drawer="priority-more"]');
  assert.equal(await priorityMore.evaluate(el=>el.open),false,'Lower priority work starts collapsed');
  await priorityMore.locator('summary').click();
  const lastFallback=priorityMore.locator('a').last();
  const focusedRace=await lastFallback.evaluate(el=>el.closest('[data-source-race]').dataset.sourceRace);
  await lastFallback.focus();
  await page.evaluate(()=>enRenderAmbientDesk());
  assert.equal(await priorityMore.evaluate(el=>el.open),true);
  assert.equal(await page.evaluate(()=>document.activeElement.closest('[data-source-race]')?.dataset.sourceRace),focusedRace,
   'Collapsed priority work retains exact-race keyboard focus when opened');
  await priorityMore.locator('summary').click();
  const text=await panel.textContent();
  assert.match(text,/House CA-13 — COMPETITIVE · Supplemental source request FAILED/);
  assert.match(text,/Senate ME — COMPETITIVE/);
  assert.equal(await panel.locator('a[href="https://votes.decisiondeskhq.com/races/2026-11-03/california-us-house-13-general-election/results"]').count(),1,
   'Known-ID feed outage has its independently checked human newsroom fallback');
  assert.match(await page.locator('#enCoverageReconciliation').innerText(),/House 0\/435 reporting/);
  assert.match(await page.locator('#enCoverageReconciliation').innerText(),/0 civicAPI calls/);
  const senateDrawer=page.locator('#enLiveCoverageTriage details').filter({
   has:page.locator('summary').filter({hasText:/^Senate source gaps/})});
  await senateDrawer.locator('summary').click();
  await page.evaluate(()=>enRenderAmbientDesk());
  assert.equal(await senateDrawer.evaluate(el=>el.open),true,
   'Source refresh must preserve an operator-opened Senate drawer');
  assert.equal(await senateDrawer.locator('summary').evaluate(el=>el===document.activeElement),true,
   'Source refresh must preserve the focused drawer summary');
  const moreDrawer=page.locator('#enLiveCoverageTriage details[data-source-drawer="operational-more"]');
  await moreDrawer.locator('summary').click();
  await page.evaluate(()=>{for(let n=0;n<3;n++)enRenderAmbientDesk()});
  assert.equal(await moreDrawer.evaluate(el=>el.open),true);
  assert.equal(await senateDrawer.evaluate(el=>el.open),true,'Independent drawer states survive repeated source updates');
  assert.equal(await moreDrawer.locator('summary').evaluate(el=>el===document.activeElement),true);
  await moreDrawer.locator('summary').click();
  await page.evaluate(()=>enRenderAmbientDesk());
  assert.equal(await moreDrawer.evaluate(el=>el.open),false,'Closed drawers must also stay closed');
  const caFallback=panel.locator('a[href="https://votes.decisiondeskhq.com/races/2026-11-03/california-us-house-13-general-election/results"]');
  await caFallback.focus();
  await page.evaluate(()=>enRenderAmbientDesk());
  assert.equal(await caFallback.evaluate(el=>el===document.activeElement),true,
   'Keyboard users keep the same race fallback link through redraw');
  await page.locator('#enMode2026').focus();
  await page.evaluate(()=>enRenderAmbientDesk());
  assert.equal(await page.locator('#enMode2026').evaluate(el=>el===document.activeElement),true,
   'Background source refresh cannot steal focus from another control');
  await page.clock.setSystemTime(new Date('2026-11-04T03:11:00Z'));
  await page.evaluate(()=>enRenderAmbientDesk());
  assert.match(await panel.textContent(),/House CA-13 — COMPETITIVE · Supplemental source request FAILED/,
   'Cooldown expiry alone is not verified provider recovery');
  await panel.scrollIntoViewIfNeeded();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No horizontal overflow');
  mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});
  await panel.screenshot({path:resolve(root,`artifacts/readiness/source-recovery-${width}.png`)});
  await page.locator('.en-coverage-priority').screenshot({
   path:resolve(root,`artifacts/readiness/source-recovery-priorities-${width}.png`)});
  await page.evaluate(()=>{
   // Fixture-only fresh transport recovery; no vote payload or call is added.
   enCivicBreaker.success();delete enCivicErrors['House|CA-13'];
   delete enCivicByWatch['House|CA-13'];enCivicPending.delete('House|CA-13');
   enRenderAmbientDesk();
  });
  assert(!(await page.locator('#enLiveCoverageTriage').textContent()).includes('House CA-13 — COMPETITIVE'),
   'Cleared source failure leaves recovery worklist');
  assert.match(await page.locator('#enCoverageReconciliation').innerText(),/House 0\/435 reporting/);
  // A native-DOM fixture uses two distinct races sharing one government URL.
  // Restoring by URL alone would silently focus the wrong race after redraw.
  const preciseFocus=await page.evaluate(()=>{
   const host=document.createElement('section');document.body.append(host);
   const pulse={totals:{House:{reported:0,missing:435},Senate:{reported:0,missing:35},Governor:{reported:0,missing:36}},
    senate:[],senateMissing:35,unverifiedMachineIds:[{id:'House|CA-20',office:'House'},{id:'House|CA-25',office:'House'}]};
   const links=[{race_ids:['House|CA-20','House|CA-25'],url:'https://voterguide.sos.ca.gov/voter-info/election-results.htm',
    mode:'november_2026_results_not_yet_published'}];
   const render=()=>ElectionNightCoverageTriage.render(host,pulse,document,links);
   render();host.querySelector('details[data-source-drawer="identity-gaps"]').open=true;
   host.querySelector('[data-source-race="House|CA-25"] a').focus();
   render();
   const result={race:document.activeElement.closest('[data-source-race]')?.dataset.sourceRace,
    open:host.querySelector('details[data-source-drawer="identity-gaps"]').open};
   host.remove();return result;
  });
  assert.deepEqual(preciseFocus,{race:'House|CA-25',open:true});
  assert.deepEqual(errors,[]);
  console.log(`${width}px: outage/cooldown/recovery plus open drawers and exact-race keyboard focus across redraws PASS`);
  await context.close();
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
