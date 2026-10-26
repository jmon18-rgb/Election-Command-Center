import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.mp3':'audio/mpeg','.jpg':'image/jpeg'};
const server=createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const f=resolve(root,'.'+(p==='/'?'/index.html':p));
 if(!f.startsWith(root+sep)||!existsSync(f)||!statSync(f).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'content-type':types[extname(f)]||'application/octet-stream'}).end(readFileSync(f));});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));

const roster={87151:['IA','iowa',2022,'Josh Turek','Ashley Hinson','Thomas Laehn'],87162:['KS','kansas',2020,'Adam Hamilton','Roger Marshall','David C Graham'],87438:['TX','texas',2024,'James Talarico','Ken Paxton','Ted Brown'],87483:['WI','wisconsin_house_01',2024,'Mitchell Berman','Bryan Steil',null],87485:['WI','wisconsin_house_03',2024,'Rebecca Cooke','Derrick Van Orden',null]};
const load=n=>JSON.parse(readFileSync(resolve(root,'data/'+n+'.json')));
function packet(id,margin,stamp,test=false,zero=false){
 const [state,name,year,dem,rep,other]=roster[id],ref=load(name+'_county_fips_reference');
 const raw=load(name==='iowa'?'iowa_senate_county_modes_official':name==='kansas'?'kansas_senate_county_facts_official':name==='texas'?'texas_senate_2024_county_baseline_official':name+'_2024_county_baseline_official');
 const rows=(name==='texas'||state==='WI')?raw.counties:raw.years[year].counties;
 const data=rows.map(c=>({...c,...(c.records?.total||c)}));
 const n=data.reduce((s,c)=>s+c.dem_votes+c.rep_votes,0),d=data.reduce((s,c)=>s+c.dem_votes,0),shift=(margin-100*(2*d/n-1))/200;
 const fips=new Map(ref.counties.map(c=>[c.county,c.fips]));let D=0,R=0;
 const candidates=(d,r)=>[{name:dem,party:'Democratic',votes:d},{name:rep,party:'Republican',votes:r},...(other?[{name:other,party:'Libertarian',votes:0}]:[])];
 const region_results=Object.fromEntries(data.map(c=>{const total=zero?0:Math.floor((c.dem_votes+c.rep_votes)*.65),d=Math.floor(total*Math.max(.001,Math.min(.999,c.dem_votes/(c.dem_votes+c.rep_votes)+shift))),r=total-d;D+=d;R+=r;
  return [fips.get(c.county),{name:c.county,type:'County',fips:fips.get(c.county),percent_reporting:100,candidates:candidates(d,r)}];}));
 return {country:'US',province:state,district:state==='WI'?'WI-'+name.slice(-2):null,municipality:null,election_scope:'General',election_type:state==='WI'?'House of Representatives':'US Senate',election_name:state==='WI'?'Wisconsin US House '+Number(name.slice(-2)):({IA:'Iowa',KS:'Kansas',TX:'Texas'}[state])+' US Senate',election_date:'2026-11-03T05:00:00.000Z',test_data:test,last_updated:stamp,region_results,candidates:candidates(D,R)};
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:width===1366?768:844},reducedMotion:'reduce'}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let mode='test',stamp='2026-11-04T03:05:00Z';
  await page.clock.install({time:new Date(stamp)});
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();
   const id=+url.pathname.split('/').pop();if(!roster[id]||url.origin!=='https://civicapi.org')return route.abort();
   if(mode==='outage')return route.fulfill({status:503,body:'unavailable'});
   const p=packet(id,mode==='red'?-8:8,stamp,mode==='test'||mode==='house-blue'&&id!==87483||mode==='house03-blue'&&id!==87485,mode==='withdrawn'||mode==='withdraw-house03'&&id===87485);
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(p)});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>[enIowaPilotController,enKansasPilotController,enTexasPilotController,enWisconsinHouseController,enWisconsinHouse03Controller].every(c=>c.status().phase.includes('TEST DATA'))&&jointLastResult?.probabilities).catch(async e=>{console.log(JSON.stringify({errors,state:await page.evaluate(()=>({phases:[window.enIowaPilotController,window.enKansasPilotController,window.enTexasPilotController].map(c=>c?.status().phase),modelError:jointErrorMessage,hasBasis:!!jointBasis}))}));throw e;});
  const baseline=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  async function update(next,minute){mode=next;stamp='2026-11-04T03:'+minute+':00Z';await page.clock.setSystemTime(new Date(stamp));
   await page.evaluate(async()=>{await Promise.all([enIowaPilotController.tick(true),enKansasPilotController.tick(true),enTexasPilotController.tick(true),enWisconsinHouseController.tick(true),enWisconsinHouse03Controller.tick(true)]);jointRender(true);});}
  // No controller.tick(), manual refresh, or jointRender(): the actual page's
  // automatic source scheduler must carry changed returns into the national UI.
  mode='blue';stamp='2026-11-04T03:05:15Z';
  await page.clock.runFor(16000);
  await page.waitForFunction(()=>jointLastResult?.county_results_update?.used.length===5);
  assert.notEqual(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),baseline,'Automatic polling moves the national outlook before calls');
  assert.deepEqual(await page.evaluate(()=>[enIowaPilotController,enKansasPilotController,enTexasPilotController,enWisconsinHouseController,enWisconsinHouse03Controller].map(c=>c.status().automatic_poll_interval_ms)),[15000,15000,15000,15000,15000]);
  await update('house-blue','08');
  const houseOnly=await page.evaluate(()=>({used:jointLastResult.county_results_update?.used.map(e=>e.code),p:jointLastResult.probabilities,h:jointLastResult.house_dem_control_pct,old:jointPulseBaseline.house_dem_control_pct}));
  assert.deepEqual(houseOnly.used,['WI-01'],'A real-shaped competitive House input alone reaches the NATIONAL model');
  assert(Math.abs(houseOnly.h-houseOnly.old)>.1,'House counts influence House control before calls');
  await update('house03-blue','09');
  const secondHouse=await page.evaluate(()=>({used:jointLastResult.county_results_update?.used.map(e=>e.code),h:jointLastResult.house_dem_control_pct,old:jointPulseBaseline.house_dem_control_pct}));
  assert.deepEqual(secondHouse.used,['WI-03']);assert(Math.abs(secondHouse.h-secondHouse.old)>.1,'Second House district independently reaches the national joint forecast before calls');
  await update('blue','10');
  await page.waitForFunction(()=>jointLastResult?.county_results_update?.used.length===5);
  const blue=await page.evaluate(()=>({p:jointLastResult.probabilities,calls:jointLastResult.race_probabilities.filter(r=>r.provider_called_party).length,base:JSON.stringify(jointPulseBaseline.probabilities),d:jointLastResult.county_results_update}));
  assert.equal(blue.calls,0);assert.equal(blue.base,baseline);assert.equal(blue.d.house_vote_sources,2);
  assert.match(await page.locator('#jointNightNeedle').textContent(),/EXPERIMENTAL COUNTY RESULTS/);
  assert.match(await page.locator('#jointNightNeedle').textContent(),/2 House districts in Wisconsin, not national House coverage/);
  const arrowBlue=await page.locator('#jointNightNeedle .four-needle-arrow').getAttribute('style');
  assert.equal(blue.d.state_likelihood_budget_members.WI,2);
  assert(blue.d.state_likelihood_max_ratio.WI<=20+1e-8);
  await update('withdraw-house03','12');
  const retained=await page.evaluate(()=>jointLastResult.county_results_update);
  assert.equal(retained.used.length,4);assert.equal(retained.house_vote_sources,1);
  assert.equal(retained.state_likelihood_budget_members.WI,2);
  assert(retained.state_likelihood_max_ratio.WI<=Math.sqrt(20)+1e-8,'Retraction cannot reallocate the missing district likelihood budget');
  await update('red','15');const red=await page.evaluate(()=>jointLastResult.probabilities);
  assert(blue.p.blue_tsunami>red.blue_tsunami+1,'Incoming county returns move the NATIONAL outlook before calls');
  assert.notEqual(await page.locator('#jointNightNeedle .four-needle-arrow').getAttribute('style'),arrowBlue);
  assert(Math.abs(Object.values(red).reduce((a,b)=>a+b,0)-100)<.04);
  await update('withdrawn','20');assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),baseline);
  await update('blue','25');await update('outage','30');assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),baseline);
  await update('test','35');assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),baseline);
  await update('blue','40');
  await page.clock.setSystemTime(new Date('2026-11-04T07:00:00Z'));
  await page.evaluate(()=>jointRender(true));
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities)),baseline,'Expired source evidence cannot move national odds even before a controller refresh');
  await page.evaluate(async()=>{await Promise.all([enIowaPilotController.tick(true),enKansasPilotController.tick(true),enTexasPilotController.tick(true),enWisconsinHouseController.tick(true),enWisconsinHouse03Controller.tick(true)]);jointRender(true);});
  const preserved=await page.evaluate(()=>({model:JSON.stringify(jointLastResult),storage:JSON.stringify({...localStorage})}));
  await page.locator('#enNationalRehearsal summary').click();
  await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('1/5'));
  const first=await page.locator('#enNationalPreviewChances').textContent();
  for(let step=2;step<=5;step++){
   await page.locator('#enNationalNext').click();await page.waitForFunction(step=>document.querySelector('#enNationalStage').textContent.includes(step+'/5'),step);
   assert.match(await page.locator('#enNationalPreviewNeedle').getAttribute('aria-label'),/SIMULATED/);
   if(step===3){assert.notEqual(await page.locator('#enNationalPreviewChances').textContent(),first);assert.match(await page.locator('#enNationalPreviewNeedle').textContent(),/2 House districts in Wisconsin, not national House coverage/);}
  }
  assert.equal(await page.locator('#enNationalPreviewChances').textContent(),first,'Withdrawal returns rehearsal to its exact baseline');
  assert.deepEqual(await page.evaluate(()=>({model:JSON.stringify(jointLastResult),storage:JSON.stringify({...localStorage})})),preserved,'National rehearsal never changes live model or storage');
  assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});await page.locator('#enNationalRehearsal').screenshot({path:resolve(root,'artifacts/readiness/national-rehearsal-'+width+'.png')});
  console.log(width+'px NATIONAL: before-call movement, correction, withdrawal, outage, test exclusion, prior isolation and isolated rehearsal PASS');
  await context.close();
 }
 // Optional cadence asset outage must retain the existing source path.
 const fallback=await browser.newContext(),fallbackPage=await fallback.newPage(),fallbackErrors=[];
 fallbackPage.on('pageerror',e=>fallbackErrors.push(e.message));
 await fallbackPage.clock.install({time:new Date('2026-11-04T03:05:00Z')});
 await fallbackPage.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/competitive_source_cadence.js'))return route.abort();
  if(url.hostname==='127.0.0.1')return route.continue();
  const id=+url.pathname.split('/').pop();
  if(!roster[id]||url.origin!=='https://civicapi.org')return route.abort();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(packet(id,8,'2026-11-04T03:05:00Z',true))});
 });
 await fallbackPage.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
 await fallbackPage.locator('[data-page="electionNight"]').click();await fallbackPage.locator('#enMode2026').click();
 await fallbackPage.waitForFunction(()=>[enIowaPilotController,enKansasPilotController,enTexasPilotController,enWisconsinHouseController,enWisconsinHouse03Controller].every(c=>c.status().phase.includes('TEST DATA'))&&jointLastResult?.probabilities);
 assert.deepEqual(await fallbackPage.evaluate(()=>[enIowaPilotController,enKansasPilotController,enTexasPilotController,enWisconsinHouseController,enWisconsinHouse03Controller].map(c=>c.status().automatic_poll_interval_ms)),[60000,60000,60000,60000,60000]);
 assert.deepEqual(fallbackErrors,[]);await fallback.close();
 console.log('Missing cadence helper: five-source safety and national baseline remain functional with 60s fallback PASS');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
