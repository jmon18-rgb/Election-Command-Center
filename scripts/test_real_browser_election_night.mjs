#!/usr/bin/env node
/**
 * Real Chromium acceptance smoke for the election-night TV-side experience.
 * Run with: npm exec --yes --package=playwright@1.57.0 -- node scripts/test_real_browser_election_night.mjs
 * Network is deliberately offline except for the locally served repository.
 * Simulates source failure: no fabricated live results or official calls.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream,existsSync,statSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');

const ROOT=resolve(process.env.DASHBOARD_TEST_ROOT||resolve(import.meta.dirname,'..'));
const out=resolve(ROOT,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness/ui-review/election-night-static-original');mkdirSync(out,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),sourceIndexSHA=sha(readFileSync(resolve(ROOT,'index.html'))),harnessSHA=sha(readFileSync(new URL(import.meta.url)));
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
let browser,currentPage,currentViewport;const reports=[];
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage();
  currentPage=page;currentViewport=viewport;
  const failures=[];
  page.on('pageerror',err=>failures.push(err.message));
  // Deterministic tall, bottom-marked image surrogate solely for layout QA.
  // The actual on-site Fish Head is the exact locally retained original JPEG.
  // Never rely on external image availability during browser CI.
  const fishFixture='<svg xmlns="http://www.w3.org/2000/svg" width="360" height="700" viewBox="0 0 360 700"><rect width="360" height="700" fill="#1e4c69"/><circle cx="180" cy="260" r="115" fill="#8ac7e1"/><rect x="72" y="565" width="216" height="85" fill="#f2bf5b"/></svg>';
  await page.route('**/*', route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1'&&u.pathname==='/assets/fish-head-original.jpg')
    return route.fulfill({status:200,contentType:'image/svg+xml',body:fishFixture});
   if(u.hostname==='127.0.0.1')return route.continue();
   return route.abort('blockedbyclient');
  });
  await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('[data-page="electionNight"]').click({timeout:45000});
  await page.locator('#electionNight.page.active').waitFor({timeout:15000});
  // Actual desktop and mobile Chromium exercise the Fish Head rehearsal,
  // rather than merely checking that the CSS rules exist as static text.
  await page.locator('#enFishPreview').click();
  await page.locator('#enFishToast').waitFor({state:'visible',timeout:10000});
  assert.match(await page.locator('#enFishMode').innerText(),/REHEARSAL/,
    name+': Mock Fish interruption must never masquerade as live results');
  assert.equal(await page.locator('#enFishTalking svg').count(),0,name+': No substitute drawing replaces the original Fish Head');
  assert.equal(await page.locator('#enFishTalking').getAttribute('data-static-original'),'true',name+': Exact original picture is the static default');
  assert.equal(await page.locator('#enFishAnimate').count(),0,name+': Substitute-animation preference was removed by owner direction');
  // Retain every original tall-still framing/control assertion using a local
  // layout-only surrogate. Exact original JPEG bytes are pinned separately.
  await page.waitForFunction(
   ()=>document.querySelector('#enFishToast .en-fish-art img')?.naturalHeight===700,
   {timeout:10000});
  // Await actual original-image readiness, then retain every original framing assertion.
  await page.waitForFunction(()=>{
   const host=document.querySelector('#enFishTalking'),img=host?.querySelector('.en-fish-still');
   return host?.dataset.animate==='false'&&host.dataset.photoReady==='true'&&img?.complete&&img.naturalWidth>0&&getComputedStyle(img).display!=='none';
  },null,{timeout:10000});
  const fish=await page.locator('#enFishToast .en-fish-art img').evaluate(img=>{
   const box=img.getBoundingClientRect(),style=getComputedStyle(img);
   return {naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,
    width:box.width,height:box.height,fit:style.objectFit,
    position:style.objectPosition};
  });
  assert.equal(fish.fit,'contain',name+': Fish must render full original frame');
  assert.equal(fish.naturalHeight,700,name+': Tall fixture must load correctly');
  assert(fish.width>100&&fish.height>0,name+': Fish portrait must occupy visible space');
  if(name==='mobile'){
   assert(fish.height<=260,name+': Fish must fit mobile viewport without covering controls');
   const buttons=page.locator('#enFishToast .en-fish-screen-controls button');
   assert.equal(await buttons.count(),2,name+': Replay and dismiss controls must be present');
   assert(await page.locator('#enFishDismiss').isVisible(),
    name+': Dismiss must remain visible below tall fish portrait');
  }
  assert.equal(await page.locator('#enFishToast .en-fish-stage').evaluate(
   el=>getComputedStyle(el).animationName),'none',
   name+': Reduced motion must suppress entrance animation');
  await page.locator('#enFishDismiss').click();
  assert.equal(await page.locator('#enFishToast').isHidden(),true,
   name+': Dismissing the mock news bulletin restores the election screen');
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
  assert.equal(await page.locator('#enSourceDesk').evaluate(el=>el.open),false,
    name+': Detailed source desk starts collapsed');
  await page.locator('#enInspectSources').click();
  assert.equal(await page.locator('#enSourceDesk').evaluate(el=>el.open),true,
    name+': Visible coverage link reveals source investigation and drilldown controls');
  assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#enSourceDesk > summary')),true,
    name+': Link opens source inspection with retained keyboard focus');
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
  reports.push({name,viewport,tall_layout_surrogate:fish,static_original_default:true,substitute_svg_count:0,original_navigation_keyboard_archive_source_and_layout_assertions:'PASS'});
  console.log(name+': 2026/2024 distinction, drilldowns, keyboard disclosure, no fake coverage and layout PASS');
  await context.close();
 }
 writeFileSync(resolve(out,'legacy-static-original-browser.json'),JSON.stringify({schema:'legacy-original-fish-tall-layout-v2',at:new Date().toISOString(),status:'PASS',harness_sha256:harnessSHA,index_sha256:sourceIndexSHA,reports,scope:'Original360x700 layout-only surrogate at the local original-image route; exact JPEG identity checked in separate native-image test. All original framing/control/navigation/source assertions retained.',source_GETs:0,human_acceptance:'NOT_RUN'},null,2)+'\n');
}catch(error){
 const suffix=Date.now();try{await currentPage?.screenshot({path:resolve(out,'failure-'+suffix+'.png')});}catch{}
 writeFileSync(resolve(out,'failure-'+suffix+'.json'),JSON.stringify({error:String(error),at:new Date().toISOString(),viewport:currentViewport,harness_sha256:harnessSHA,index_sha256:sourceIndexSHA},null,2)+'\n');throw error;
}finally{
 await browser?.close();
 await new Promise(ok=>server.close(ok));
}
