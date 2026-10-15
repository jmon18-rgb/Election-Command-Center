#!/usr/bin/env node
/**
 * Real Chromium acceptance smoke for the election-night TV-side experience.
 * Run with: npm exec --yes --package=playwright@1.57.0 -- node scripts/test_real_browser_election_night.mjs
 * Network is deliberately offline except for the locally served repository.
 * Simulates source failure: no fabricated live results or official calls.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const ROOT=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json',
 '.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
 '.mp3':'audio/mpeg','.webp':'image/webp','.txt':'text/plain'};
const server=createServer((req,res)=>{
 const url=new URL(req.url||'/', 'http://127.0.0.1');
 const pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
 const path=resolve(ROOT,'.'+pathname);
 if(!(path===ROOT||path.startsWith(ROOT+sep))||!existsSync(path)||!statSync(path).isFile()){
  res.writeHead(404);res.end('Not found');return;
 }
 res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream',
  'cache-control':'no-store'});
 createReadStream(path).pipe(res);
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)});
const port=server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage();
  const failures=[];
  page.on('pageerror',err=>failures.push(err.message));
  await page.route('**/*', route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1')return route.continue();
   return route.abort('blockedbyclient');
  });
  await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('[data-page="electionNight"]').click({timeout:45000});
  await page.locator('#electionNight.page.active').waitFor({timeout:15000});
  assert.equal(await page.locator('#enRaceDeskDetails').evaluate(el=>el.open),false,
    name+': Full race desk should not dominate initial election-night view');
  assert.equal(await page.locator('#jointNightSensitivity').evaluate(el=>el.open),false,
    name+': Model research sensitivities must be collapsed by default');
  assert.equal(await page.locator('#enWatchDrawer').evaluate(el=>el.open),false,
    name+': Personal watchlist should be collapsed by default');
  const firstSummary=page.locator('#enWatchDrawer>summary');
  await firstSummary.focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#enWatchDrawer').evaluate(el=>el.open),true,
    name+': Keyboard must open pinned race controls');
  await firstSummary.focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#enWatchDrawer').evaluate(el=>el.open),false,
    name+': Keyboard must close pinned race controls');
  for(const office of ['Senate','House','Governor']){
   await page.locator('#enJump'+office).click();
   assert.equal(await page.locator('#enRaceDeskDetails').evaluate(el=>el.open),true,
    name+': '+office+' ambient control must reveal a drilldown');
   assert.equal(await page.locator('#enOffice'+office).getAttribute('aria-pressed'),'true',
    name+': '+office+' drilldown must select its office, not inherit a stale tab');
  }
  // Restore ambient viewpoint. Archived source counts must never be mistaken
  // for live 2026 votes; disconnected source is not zero or an official call.
  await page.locator('#enMode2024').click();
  await page.waitForFunction(()=>document.querySelector('#enDistrictPulse')?.textContent?.includes('2026 results only'),
   {timeout:20000}).catch(()=>{});
  const p=await page.locator('#enCoverageReconciliation').innerText();
  assert(/2024 historical archive|2024 archive/i.test(p),name+': Historical totals need archive labeling: '+p);
  assert((await page.locator('#enAllOfficeSummary').innerText()).includes('2024'),
   name+': Never show archive counts as live 2026 coverage');
  await page.locator('#enMode2026').click();
  const dataLabel=await page.locator('#enCoverageReconciliation').innerText();
  assert(!/House 435\/435 reporting/.test(dataLabel),
   name+': Offline primary sources cannot magically report all 435 House contests');
  assert(!/authoritative chamber call confirmed/i.test(dataLabel),
   name+': Unverified offline results cannot call congressional control');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert(overflow<10,name+': Unintended horizontal scroll: '+overflow+'px');
  assert.deepEqual(failures.filter(x=>/SyntaxError|ReferenceError|TypeError/.test(x)),[],
   name+': Unhandled browser JS exception');
  console.log(name+': 2026/2024 distinction, drilldowns, keyboard disclosure, no fake coverage and layout PASS');
  await context.close();
 }
}finally{
 await browser?.close();
 await new Promise(ok=>server.close(ok));
}
