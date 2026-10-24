#!/usr/bin/env node
/** Chromium Election Night Ohio official NIST approved-source outage/recovery.
 * All totals below are SYNTHETIC INTERCEPTED FIXTURES, never genuine votes.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const ROOT=resolve(import.meta.dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json',
 '.css':'text/css','.csv':'text/plain','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer((req,res)=>{
 const url=new URL(req.url||'/', 'http://127.0.0.1');
 const file=resolve(ROOT,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(ROOT+sep)||!existsSync(file)||!statSync(file).isFile()){
  res.writeHead(404);res.end('Not found');return;
 }
 res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream',
  'cache-control':'no-store'});
 createReadStream(file).pipe(res);
});
await new Promise((done,fail)=>{
 server.once('error',fail);server.listen(0,'127.0.0.1',done);
});
const SITE_URL='http://127.0.0.1:'+server.address().port+'/';
const SOURCE='https://liveresults.ohiosos.gov/Api/v1/download?filename=VSSC1622XmlFileBlob';
const DISABLED={schema:'ohio-nist-2026-live-approval-v1',enabled:false,
 real_results_publication_reviewed:false};
const approval={schema:'ohio-nist-2026-live-approval-v1',enabled:true,
 real_results_publication_reviewed:true,source_url:SOURCE,
 source_reviewed_at:'2026-11-04T00:45:00Z',
 county_gpunit_to_fips:Object.fromEntries(Array.from({length:88},(_,i)=>
  ['g'+i,'39'+String(i*2+1).padStart(3,'0')])),
 approved_contests:[{race_key:'OH-SEN-special'}]};
const snapshot={
 schema:'ohio-nist-candidate-county-2026-v1',
 status:'INDEPENDENTLY_REVIEWED_UNOFFICIAL_CANDIDATE_COUNTS_NO_RACE_CALLS',
 election_date:'2026-11-03',state:'OH',
 source:{url:SOURCE,xml_sha256:'a'.repeat(64),
  generated_at:'2026-11-04T00:50:00Z',
  approval_reviewed_at:approval.source_reviewed_at},
 ballots_remaining:null,reporting_fraction:null,
 independently_certified_winner_calls:false,may_move_national_needle:false,
 races:[{
  race_key:'OH-SEN-special',dashboard_race_id:'Senate|OH-special',
  office:'Senate',reported_county_count:1,
  counties:[{county_fips:'39001',candidates:[
   {name:'Fixture Blue',party:'DEM',votes:120},
   {name:'Fixture Red',party:'REP',votes:125}]}]
 }]
};
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const [name,viewport] of [
  ['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]
 ]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'});
  const page=await context.newPage();
  const exceptions=[];
  page.on('pageerror',e=>exceptions.push(e.message));
  let mode='disabled';
  await page.addInitScript(()=>{
   Date.now=()=>Date.parse('2026-11-04T01:00:00Z');
  });
  await page.route('**/*',route=>
   new URL(route.request().url()).hostname==='127.0.0.1'?
    route.continue():route.abort('blockedbyclient'));
  await page.route('**/data/ohio_nist_source_approval_2026.json*',route=>{
   if(mode==='config-outage')return route.abort('failed');
   return route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify(mode==='disabled'?DISABLED:approval)});
  });
  await page.route('**/data/ohio_nist_candidate_votes_2026.json*',route=>{
   if(mode==='snapshot-outage')return route.abort('failed');
   const doc=mode==='bad-sha'?{...snapshot,
    source:{...snapshot.source,xml_sha256:'wrong'}}:
    mode==='stale'?{...snapshot,
     source:{...snapshot.source,generated_at:'2026-11-03T20:00:00Z'}}:
    snapshot;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(doc)});
  });
  await page.goto(SITE_URL,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>
   document.querySelector('#enOhioOfficialCountyResults')?.textContent?.includes('not yet approved'),
   {timeout:25000});
  const read=()=>page.locator('#enOhioOfficialCountyResults').textContent();
  assert(!(await read()).includes('Fixture Blue'));
  const refresh=async()=>{
   await page.evaluate(()=>window.OhioOfficialDeskRefresh());
   return await read();
  };
  mode='approved';
  let text=await refresh();
  assert.match(text,/Fixture Blue \(DEM\): 120/);
  assert.match(text,/Senate\|OH-special/);
  assert.match(text,/NOT verified ballots remaining/);
  mode='bad-sha';
  text=await refresh();
  assert.match(text,/source integrity/i);
  assert(!text.includes('Fixture Blue'),'Bad source SHA was retained in Ohio UI');
  mode='stale';
  text=await refresh();
  assert.match(text,/stale or future/i);
  assert(!text.includes('Fixture Red'),'Expired Ohio source stayed visible');
  mode='snapshot-outage';
  text=await refresh();
  assert.match(text,/source unavailable/i);
  assert(!text.includes('Fixture Blue'),'Ohio transport failure retained old source counts');
  mode='config-outage';
  text=await refresh();
  assert.match(text,/source unavailable/i);
  mode='disabled';
  text=await refresh();
  assert.match(text,/not yet approved/i);
  assert(!text.includes('Fixture Red'),'Revoked approval leaked old Ohio votes');
  mode='approved';
  text=await refresh();
  assert.match(text,/Fixture Red \(REP\): 125/);
  assert.deepEqual(exceptions.filter(x=>/SyntaxError|ReferenceError|TypeError/.test(x)),[],
   name+': browser runtime exception');
  console.log(name+': Ohio mock gate, approved Senate county, source SHA, stale, both outages and recovery PASS');
  await context.close();
 }
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
