#!/usr/bin/env node
/** REAL Chromium user-visible 506-race coverage drill: synthetic provider
 * return -> source outage -> recovery -> 2024 archival separation.
 * The synthetic votes are HTTP-intercepted in the ephemeral browser only.
 * No production source, local JSON, or forecast receives them.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream,existsSync,statSync,readFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const ROOT=resolve(import.meta.dirname,'..');
const sourceLedger=JSON.parse(readFileSync(resolve(ROOT,'data/election_night_source_coverage.json'),'utf8'));
const otherMachineGaps=sourceLedger.races.filter(row=>
 (row.office==='House'||row.office==='Governor')&&
 row.source_identity_status==='NO_CURATED_PROVIDER_ID'&&
 !(row.verified_identity_hint_usable===true&&
   row.gap_status==='RECENT_EXACT_PROBE_NOT_LIVE_VERIFIED'));
const manualBackstops=JSON.parse(readFileSync(resolve(ROOT,'data/election_night_official_backstops.json'),'utf8')).links;
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json',
 '.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
 '.webp':'image/webp','.txt':'text/plain','.csv':'text/csv'};
const server=createServer((req,res)=>{
 const request=new URL(req.url||'/','http://127.0.0.1');
 const route=decodeURIComponent(request.pathname==='/'?'/index.html':request.pathname);
 const loc=resolve(ROOT,'.'+route);
 if(!(loc===ROOT||loc.startsWith(ROOT+sep))||!existsSync(loc)||!statSync(loc).isFile()){
  res.writeHead(404);res.end('Not found');return;
 }
 res.writeHead(200,{'content-type':MIME[extname(loc)]||'application/octet-stream',
                    'cache-control':'no-store'});
 createReadStream(loc).pipe(res);
});
await new Promise((ok,err)=>{server.once('error',err);server.listen(0,'127.0.0.1',ok)});
const url='http://127.0.0.1:'+server.address().port+'/';
// Texas closes at 8 PM Eastern for its earliest reporting counties.
// The previous 7:47 PM mock would now correctly be rejected by the real gate.
const clock='2026-11-04T01:55:00Z';
const asOf='2026-11-04T01:47:00Z';
const vote=(dem,rep)=>({
 total:dem+rep,called:false,winner:'',pct_in:null,
 cands:[{n:'Fixture Democrat',p:'D',v:dem,pct:null},
        {n:'Fixture Republican',p:'R',v:rep,pct:null}]
});
const SAMPLE={
 House:{'TX-01':vote(120,140),'TX-02':vote(0,0)},
 Senate:{NC:vote(240,260)},
 Governor:{TX:vote(0,0)}
};
function packet(office){
 const races=SAMPLE[office];
 return {api:1,year:2026,office,source:'state',live:true,stale:false,
  counting:true,final:false,as_of:asOf,counts:{races:Object.keys(races).length},
  races};
}
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const [device,viewport] of [['desktop',{width:1440,height:900}],
                                 ['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,serviceWorkers:'block',
                                        reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];
  let scenario='verified';
  const providers=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(time=>{
   Date.now=()=>Date.parse(time);
  },clock);
  await page.route('**/*',route=>{
   const req=new URL(route.request().url());
   if(req.hostname==='127.0.0.1')return route.continue();
   if(req.hostname==='openamerica.io'&&req.pathname==='/elections/results.json'){
    const office=req.searchParams.get('office');
    providers.push(office);
    if(scenario!=='verified')return route.abort('failed');
    if(!Object.prototype.hasOwnProperty.call(SAMPLE,office))
     return route.abort('blockedbyclient');
    return route.fulfill({status:200,contentType:'application/json',
                          headers:{'access-control-allow-origin':'*','cache-control':'no-store'},
                          body:JSON.stringify(packet(office))});
   }
   return route.abort('blockedbyclient');
  });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('[data-page="electionNight"]').click({timeout:45000});
  await page.locator('#electionNight.page.active').waitFor({timeout:15000});
  await page.waitForFunction(()=>document.querySelector('#enSourceReadiness')?.
     textContent?.includes('506 races'),{timeout:25000});
  await page.evaluate(()=>enRefreshWatchedOffices(''));
  await page.waitForFunction(()=>document.querySelector('#enLiveCoverageTriage')?.
     textContent?.includes('House 1/435 · Senate 1/35 · Governors 0/36'),
     {timeout:30000});
  let rendered=await page.locator('#enLiveCoverageTriage').textContent();
  assert.match(rendered,/House 1\/435 · Senate 1\/35 · Governors 0\/36/);
  assert.match(rendered,/No source evidence for 433 House, 34 Senate and 35 governor contests/);
  assert.match(rendered,/Provider-reported zero is tracked separately/);
  const groups=page.locator('#enLiveCoverageTriage details');
  assert.equal(await groups.count(),otherMachineGaps.length?2:1,
   device+': Distinct Senate and known unresolved House/governor source drawers');
  const group=groups.nth(0);
  await group.locator('summary').click();
  assert.match(await group.textContent(),/NC — Reported votes · unofficial/);
  assert.match(await group.textContent(),/ME — Supplemental source request FAILED/);
  assert.match(await group.textContent(),/MA — No verified automated source ID/);
  assert.match(await group.textContent(),/MS — Supplemental source ID · no current results/);
  if(otherMachineGaps.length){
   const other=groups.nth(1);
   await other.locator('summary').click();
   assert((await other.textContent()).includes(
    'Unpinned House / governor source IDs · '+otherMachineGaps.length));
   for(const row of otherMachineGaps)
    assert((await other.textContent()).includes(
     row.id.replace('|',' ')+' — No verified automated source ID'));
   const validLinks=otherMachineGaps.filter(row=>manualBackstops.some(link=>
    Array.isArray(link.race_ids)&&link.race_ids.includes(row.id)&&
    /^https:\/\//.test(link.url))).length;
   assert.equal(await other.locator('a[href^="https://"]').count(),validLinks,
    device+': Only curated official manual links may accompany missing machine source IDs');
  }
  assert(['House','Senate','Governor'].every(x=>providers.includes(x)),
   device+': All three office sources should have been attempted');
  scenario='outage';
  await page.evaluate(()=>enRefreshWatchedOffices(''));
  await page.waitForFunction(()=>document.querySelector('#enLiveCoverageTriage')?.
    textContent?.includes('House 0/435 · Senate 0/35 · Governors 0/36'),
    {timeout:30000});
  rendered=await page.locator('#enLiveCoverageTriage').textContent();
  assert.match(rendered,/NC — Primary provider unavailable \/ stale/);
  assert(!rendered.includes('NC — Reported votes · unofficial'),
    device+': Cached NC counts cannot be represented as LIVE after source outage');
  scenario='verified';
  await page.evaluate(()=>enRefreshWatchedOffices(''));
  await page.waitForFunction(()=>document.querySelector('#enLiveCoverageTriage')?.
    textContent?.includes('House 1/435 · Senate 1/35 · Governors 0/36'),
    {timeout:30000});
  assert.match(await page.locator('#enLiveCoverageTriage').textContent(),
    /NC — Reported votes · unofficial/);
  await page.locator('#enMode2024').click();
  await page.waitForFunction(()=>document.querySelector('#enLiveCoverageTriage')?.
    textContent?.includes('2024 historical archive'),{timeout:30000});
  rendered=await page.locator('#enLiveCoverageTriage').textContent();
  assert(!rendered.includes('NC — Reported votes · unofficial'),
    device+': Archived view cannot retain live 2026 Senate coverage status');
  assert.deepEqual(errors.filter(e=>/SyntaxError|ReferenceError|TypeError/.test(e)),[],
    device+': No runtime JS exceptions');
  console.log(device+': actual browser 506-race positive+zero+missing, 35 Senate states, outage/recovery and archive safety PASS');
  await context.close();
 }
}finally{
 await browser?.close();
 await new Promise(ok=>server.close(ok));
}
