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
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-04T03:00:00Z')});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();
  await page.waitForFunction(()=>Boolean(enPublishedCoverageLedger&&jointLastResult&&jointBasis&&latestSenateEstimates));
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
  const text=await panel.textContent();
  assert.match(text,/House CA-13 — COMPETITIVE · Supplemental source request FAILED/);
  assert.match(text,/Senate ME — COMPETITIVE/);
  assert.match(await page.locator('#enCoverageReconciliation').innerText(),/House 0\/435 reporting/);
  assert.match(await page.locator('#enCoverageReconciliation').innerText(),/0 civicAPI calls/);
  await page.clock.setSystemTime(new Date('2026-11-04T03:11:00Z'));
  await page.evaluate(()=>enRenderAmbientDesk());
  assert.match(await panel.textContent(),/House CA-13 — COMPETITIVE · Supplemental source request FAILED/,
   'Cooldown expiry alone is not verified provider recovery');
  await panel.scrollIntoViewIfNeeded();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No horizontal overflow');
  mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});
  await panel.screenshot({path:resolve(root,`artifacts/readiness/source-recovery-${width}.png`)});
  await page.evaluate(()=>{
   // Fixture-only fresh transport recovery; no vote payload or call is added.
   enCivicBreaker.success();delete enCivicErrors['House|CA-13'];
   delete enCivicByWatch['House|CA-13'];enCivicPending.delete('House|CA-13');
   enRenderAmbientDesk();
  });
  assert(!(await page.locator('#enLiveCoverageTriage').textContent()).includes('House CA-13 — COMPETITIVE'),
   'Cleared source failure leaves recovery worklist');
  assert.match(await page.locator('#enCoverageReconciliation').innerText(),/House 0\/435 reporting/);
  assert.deepEqual(errors,[]);
  console.log(`${width}px: known House ID + previous attempt + outage, cooldown quarantine and recovery without votes PASS`);
  await context.close();
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
