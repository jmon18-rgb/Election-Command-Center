#!/usr/bin/env node
/** End-to-end Chromium drill: approved ZIP -> browser -> outage -> recovery.
 * All votes and source approvals below are clearly synthetic intercepted
 * fixtures. They are NEVER committed to data/ or used as real 2026 returns.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const ROOT=resolve(import.meta.dirname,'..');
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json',
 '.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
 '.webp':'image/webp','.txt':'text/plain','.csv':'text/csv'};
const server=createServer((req,res)=>{
 const url=new URL(req.url||'/', 'http://127.0.0.1');
 const loc=resolve(ROOT,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!(loc===ROOT||loc.startsWith(ROOT+sep))||!existsSync(loc)||!statSync(loc).isFile()){
  res.writeHead(404);res.end('Not found');return;
 }
 res.writeHead(200,{'content-type':MIME[extname(loc)]||'application/octet-stream',
  'cache-control':'no-store'});
 createReadStream(loc).pipe(res);
});
await new Promise((resolve,reject)=>{
 server.once('error',reject);server.listen(0,'127.0.0.1',resolve);
});
const base='http://127.0.0.1:'+server.address().port+'/';
const SHA='a'.repeat(64);
const official='https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip';
const reviewed={schema:'county-desk-config-v1',enabled:true,
 snapshot_path:'./data/nc_candidate_votes_2026.json',
 expected:{mode:'nc-candidate-only',reviewed:true,verified_source_url:official,
  verified_archive_sha256:SHA,office:'Senate',race_key:'NC-SEN',
  contest_name:'US SENATE',contest_group_id:'37'}};
const valid={schema:'nc-official-candidate-votes-v1',election_date:'2026-11-03',
 state:'NC',office:'Senate',race_key:'NC-SEN',
 source:{url:official,sha256:SHA,archive_member:'results_pct_20261103.txt',
  contest_name:'US SENATE',contest_group_id:'37'},
 archive_checked_at:'2026-11-04T00:45:00Z',ballots_reported:null,
 reporting_fraction:null,may_move_national_needle:false,
 counties:[{county_id:'37183',candidates:[
  {name:'Fixture Alpha',party:'DEM',votes:120},
  {name:'Fixture Beta',party:'REP',votes:140}]}]};
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const [device,viewport] of [['desktop',{width:1440,height:900}],
                                 ['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'});
  const page=await context.newPage();
  let scenario='verified';
  const failures=[];
  page.on('pageerror',e=>failures.push(e.message));
  await page.addInitScript(()=>{
   // Election-night fixture clock; never changes production code or data.
   Date.now=()=>Date.parse('2026-11-04T00:55:00Z');
  });
  await page.route('**/*',route=>{
   const host=new URL(route.request().url()).hostname;
   return host==='127.0.0.1'?route.continue():route.abort('blockedbyclient');
  });
  await page.route('**/data/nc_county_results_desk_config.json*',route=>{
   if(scenario==='disabled')
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
     schema:'county-desk-config-v1',enabled:false,expected:null,
     snapshot_path:null,reason:'No reviewed official ZIP'})});
   if(scenario==='config-outage')return route.abort('failed');
   return route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify(reviewed)});
  });
  await page.route('**/data/nc_candidate_votes_2026.json*',route=>{
   if(scenario==='snapshot-outage')return route.abort('failed');
   if(scenario==='bad-sha')return route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({...valid,source:{...valid.source,sha256:'b'.repeat(64)}})});
   if(scenario==='stale')return route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({...valid,archive_checked_at:'2026-11-03T10:00:00Z'})});
   return route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify(valid)});
  });
  await page.route('**/data/nc_2022_senate_county_verified.csv*',route=>{
   if(scenario==='senate-baseline-outage')return route.abort('failed');
   return route.continue();
  });
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>
   document.querySelector('#enVerifiedCountyResults')?.textContent?.includes('Fixture Alpha'),
   {timeout:25000});
  let rendered=await page.locator('#enVerifiedCountyResults').textContent();
  assert.match(rendered,/Fixture Alpha \(DEM\): 120/);
  assert.match(rendered,/County FIPS 37183/);
  assert.match(rendered,/NOT available from this feed/);
  assert(!/percent reporting: [0-9]|projected winner/i.test(rendered));
  await page.waitForFunction(()=>
   document.querySelector('#enNcHistoricalComparison')?.textContent?.includes('DESCRIPTIVE ONLY'),
   {timeout:25000});
  let comparison=await page.locator('#enNcHistoricalComparison').textContent();
  assert.match(comparison,/partial 2026 Senate vs\. full 2024 presidential/i);
  assert.match(comparison,/No geographic needle or national forecast adjustment/);
  assert.match(comparison,/37183/);
  await page.waitForFunction(()=>
   document.querySelector('#enNcSenateSameOfficeComparison')?.textContent?.includes('DESCRIPTIVE ONLY'),
   {timeout:25000});
  let senateCompare=await page.locator('#enNcSenateSameOfficeComparison').textContent();
  assert.match(senateCompare,/same office/i);
  assert.match(senateCompare,/2022 full Senate D−R/);
  assert.match(senateCompare,/NOT statewide swings/);
  const refresh=async()=>{
   await page.evaluate(()=>window.NcCountyDeskRefresh());
   return page.locator('#enVerifiedCountyResults').textContent();
  };
  // Failure to load the historical source must not hide the current
  // approved county vote totals or the independent 2024 reference.
  scenario='senate-baseline-outage';
  rendered=await refresh();
  assert(rendered.includes('Fixture Alpha (DEM): 120'));
  comparison=await page.locator('#enNcHistoricalComparison').textContent();
  assert.match(comparison,/DESCRIPTIVE ONLY/);
  senateCompare=await page.locator('#enNcSenateSameOfficeComparison').textContent();
  assert.match(senateCompare,/2022 Senate comparison unavailable/);
  assert(!senateCompare.includes('DESCRIPTIVE ONLY'));
  scenario='verified';
  rendered=await refresh();
  senateCompare=await page.locator('#enNcSenateSameOfficeComparison').textContent();
  assert.match(senateCompare,/DESCRIPTIVE ONLY/);

  scenario='bad-sha';
  rendered=await refresh();
  assert.match(rendered,/identity or missing-ballot safeguards failed/i);
  assert(!rendered.includes('Fixture Alpha'),'Bad ZIP fingerprint retained candidate totals');
  comparison=await page.locator('#enNcHistoricalComparison').textContent();
  assert(!comparison.includes('DESCRIPTIVE ONLY'),'Invalid ZIP retained historical comparison');
  senateCompare=await page.locator('#enNcSenateSameOfficeComparison').textContent();
  assert(!senateCompare.includes('DESCRIPTIVE ONLY'),'Invalid ZIP retained 2022 same-office comparison');
  scenario='stale';
  rendered=await refresh();
  assert.match(rendered,/stale or future-dated/i);
  assert(!rendered.includes('Fixture Alpha'),'Stale ZIP retained candidate totals');
  scenario='snapshot-outage';
  rendered=await refresh();
  assert.match(rendered,/County source not available/i);
  assert(!rendered.includes('Fixture Alpha'),'Outage was misrepresented as current totals');
  scenario='config-outage';
  rendered=await refresh();
  assert.match(rendered,/County source not available/i);
  scenario='disabled';
  rendered=await refresh();
  assert.match(rendered,/No reviewed official ZIP/);
  assert(!rendered.includes('Fixture Alpha'),'Revoked approval leaked candidate totals');
  comparison=await page.locator('#enNcHistoricalComparison').textContent();
  assert(!comparison.includes('DESCRIPTIVE ONLY'),'Revoked approval retained historical comparison');
  senateCompare=await page.locator('#enNcSenateSameOfficeComparison').textContent();
  assert(!senateCompare.includes('DESCRIPTIVE ONLY'),'Revoked approval retained 2022 same-office comparison');
  scenario='verified';
  rendered=await refresh();
  assert.match(rendered,/Fixture Alpha \(DEM\): 120/);
  assert.match(rendered,/NC-SEN/);
  comparison=await page.locator('#enNcHistoricalComparison').textContent();
  assert.match(comparison,/DESCRIPTIVE ONLY/);
  senateCompare=await page.locator('#enNcSenateSameOfficeComparison').textContent();
  assert.match(senateCompare,/DESCRIPTIVE ONLY/);
  assert.deepEqual(failures.filter(x=>/SyntaxError|ReferenceError|TypeError/.test(x)),[],
   device+': Unhandled exception during outage/recovery');
  console.log(device+': NC official county snapshot, invalid SHA, staleness, both outages, approval revocation and recovery PASS');
  await context.close();
 }
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
