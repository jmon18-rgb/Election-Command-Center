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

const roster={87151:['IA','iowa',2022,'Josh Turek','Ashley Hinson','Thomas Laehn'],87162:['KS','kansas',2020,'Adam Hamilton','Roger Marshall','David C Graham'],87438:['TX','texas',2024,'James Talarico','Ken Paxton','Ted Brown']};
const load=n=>JSON.parse(readFileSync(resolve(root,'data/'+n+'.json')));
function packet(id,margin,stamp,test=false,zero=false){
 const [state,name,year,dem,rep,other]=roster[id],ref=load(name+'_county_fips_reference');
 const raw=load(name==='iowa'?'iowa_senate_county_modes_official':name==='kansas'?'kansas_senate_county_facts_official':'texas_senate_2024_county_baseline_official');
 const rows=name==='texas'?raw.counties:raw.years[year].counties;
 const data=rows.map(c=>({...c,...(c.records?.total||c)}));
 const n=data.reduce((s,c)=>s+c.dem_votes+c.rep_votes,0),d=data.reduce((s,c)=>s+c.dem_votes,0),shift=(margin-100*(2*d/n-1))/200;
 const fips=new Map(ref.counties.map(c=>[c.county,c.fips]));let D=0,R=0;
 const candidates=(d,r)=>[{name:dem,party:'Democratic',votes:d},{name:rep,party:'Republican',votes:r},{name:other,party:'Libertarian',votes:0}];
 const region_results=Object.fromEntries(data.map(c=>{const total=zero?0:Math.floor((c.dem_votes+c.rep_votes)*.65),d=Math.floor(total*Math.max(.001,Math.min(.999,c.dem_votes/(c.dem_votes+c.rep_votes)+shift))),r=total-d;D+=d;R+=r;
  return [fips.get(c.county),{name:c.county,type:'County',fips:fips.get(c.county),percent_reporting:100,candidates:candidates(d,r)}];}));
 return {country:'US',province:state,district:null,municipality:null,election_scope:'General',election_type:'US Senate',election_name:({IA:'Iowa',KS:'Kansas',TX:'Texas'}[state])+' US Senate',election_date:'2026-11-03T05:00:00.000Z',test_data:test,last_updated:stamp,region_results,candidates:candidates(D,R)};
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
   const p=packet(id,mode==='red'?-8:8,stamp,mode==='test',mode==='withdrawn');
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(p)});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>[enIowaPilotController,enKansasPilotController,enTexasPilotController].every(c=>c.status().phase.includes('TEST DATA'))&&jointLastResult?.probabilities).catch(async e=>{console.log(JSON.stringify({errors,state:await page.evaluate(()=>({phases:[window.enIowaPilotController,window.enKansasPilotController,window.enTexasPilotController].map(c=>c?.status().phase),modelError:jointErrorMessage,hasBasis:!!jointBasis}))}));throw e;});
  const baseline=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  async function update(next,minute){mode=next;stamp='2026-11-04T03:'+minute+':00Z';await page.clock.setSystemTime(new Date(stamp));
   await page.evaluate(async()=>{await Promise.all([enIowaPilotController.tick(true),enKansasPilotController.tick(true),enTexasPilotController.tick(true)]);jointRender(true);});}
  await update('blue','10');
  await page.waitForFunction(()=>jointLastResult?.county_results_update?.used.length===3);
  const blue=await page.evaluate(()=>({p:jointLastResult.probabilities,calls:jointLastResult.race_probabilities.filter(r=>r.provider_called_party).length,base:JSON.stringify(jointPulseBaseline.probabilities),d:jointLastResult.county_results_update}));
  assert.equal(blue.calls,0);assert.equal(blue.base,baseline);assert.equal(blue.d.house_vote_sources,0);
  assert.match(await page.locator('#jointNightNeedle').textContent(),/EXPERIMENTAL COUNTY RESULTS/);
  assert.match(await page.locator('#jointNightNeedle').textContent(),/no House vote sources/);
  const arrowBlue=await page.locator('#jointNightNeedle .four-needle-arrow').getAttribute('style');
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
  await page.evaluate(async()=>{await Promise.all([enIowaPilotController.tick(true),enKansasPilotController.tick(true),enTexasPilotController.tick(true)]);jointRender(true);});
  const preserved=await page.evaluate(()=>({model:JSON.stringify(jointLastResult),storage:JSON.stringify({...localStorage})}));
  await page.locator('#enNationalRehearsal summary').click();
  await page.waitForFunction(()=>document.querySelector('#enNationalStage').textContent.includes('1/5'));
  const first=await page.locator('#enNationalPreviewChances').textContent();
  for(let step=2;step<=5;step++){
   await page.locator('#enNationalNext').click();await page.waitForFunction(step=>document.querySelector('#enNationalStage').textContent.includes(step+'/5'),step);
   assert.match(await page.locator('#enNationalPreviewNeedle').getAttribute('aria-label'),/SIMULATED/);
   if(step===3)assert.notEqual(await page.locator('#enNationalPreviewChances').textContent(),first);
  }
  assert.equal(await page.locator('#enNationalPreviewChances').textContent(),first,'Withdrawal returns rehearsal to its exact baseline');
  assert.deepEqual(await page.evaluate(()=>({model:JSON.stringify(jointLastResult),storage:JSON.stringify({...localStorage})})),preserved,'National rehearsal never changes live model or storage');
  assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  mkdirSync(resolve(root,'artifacts/readiness'),{recursive:true});await page.locator('#enNationalRehearsal').screenshot({path:resolve(root,'artifacts/readiness/national-rehearsal-'+width+'.png')});
  console.log(width+'px NATIONAL: before-call movement, correction, withdrawal, outage, test exclusion, prior isolation and isolated rehearsal PASS');
  await context.close();
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
