// Mechanical UI evidence in a separate browser. Fictional component examples
// are visibly labeled; they are not actual admitted returns, calibration or
// owner/physical-device acceptance. Actual source binding has its own unit.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
let root=import.meta.dirname;while(!existsSync(resolve(root,'index.html'))){const next=dirname(root);if(next===root)throw Error('Repository root unavailable');root=next;}
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const out=resolve(root,process.env.UI_REVIEW_OUTPUT_DIR||'artifacts/readiness/ui-review/unified-early-indicators');mkdirSync(out,{recursive:true});
const dashboard=process.env.DASHBOARD_TEST_URL?new URL(process.env.DASHBOARD_TEST_URL):null;
if(dashboard){assert.equal(dashboard.origin,'https://jmon18-rgb.github.io');assert.equal(dashboard.pathname,'/Election-Command-Center/');assert.equal(dashboard.username,'');assert.equal(dashboard.password,'');assert.equal(dashboard.search,'');assert(['','#electionNight'].includes(dashboard.hash));}
const main=dashboard?execFileSync('git',['rev-parse','origin/main'],{cwd:root,encoding:'utf8'}).trim():null;
if(dashboard){assert.equal(process.env.DASHBOARD_TEST_MAIN,main);assert(/^\d+$/.test(process.env.DASHBOARD_TEST_PAGES_RUN||''));}
const pinFiles=['index.html','scripts/election_night_indicator_status.js','scripts/election_night_early_weather.js','scripts/election_night_early_signals.js','scripts/house_early_watch_reference.js','scripts/personal_election_focus.js','scripts/recorded_asset_lineage.js','scripts/election_night_poll_closings_2026.js','scripts/washington_remaining_source.js','scripts/washington_remaining_scenarios.js','scripts/source_call_conditioning.js','scripts/chamber_control_model.js','scripts/national_county_likelihood.js','scripts/joint_model_worker.js','scripts/joint_model_worker_controller.js','scripts/joint_count_snapshot_policy.js','scripts/virginia_official_house_source.js','scripts/virginia_official_cache.js','scripts/virginia_official_usage.js','scripts/washington_official_house_source.js','scripts/washington_official_cache.js','scripts/washington_remaining_usage.js'];
assert.equal(new Set(pinFiles).size,pinFiles.length);
const pinned=Object.fromEntries(pinFiles.map(file=>[file,dashboard?execFileSync('git',['show',main+':'+file],{cwd:root,maxBuffer:16*1024*1024}):readFileSync(resolve(root,file))]));
const hash=body=>createHash('sha256').update(body).digest('hex'),tags=Object.fromEntries(pinFiles.filter(file=>file!=='index.html').map(file=>{const tag=(pinned['index.html'].toString().match(/<script[^>]+src="([^"]+)"[^>]*>/g)||[]).find(tag=>tag.includes(file+'?'));assert(tag,'Actual index references '+file);return [file,tag.match(/src="([^"]+)"/)[1]];}));
const harnessSHA=hash(readFileSync(new URL(import.meta.url)));
if(dashboard)for(const file of ['scripts/national_county_likelihood.js','scripts/election_night_poll_closings_2026.js'])assert(readFileSync(resolve(root,file)).equals(pinned[file]),'Local fixture compiler matches final origin/main: '+file);
const load=name=>JSON.parse(dashboard?execFileSync('git',['show',main+':data/'+name+'.json'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}):readFileSync(resolve(root,'data',name+'.json'),'utf8')),NCL=require(resolve(root,'scripts/national_county_likelihood.js'));
const fixtureNow=Date.parse('2026-11-04T03:10:00Z'),stamp='2026-11-04T03:05:00Z';
function matched(code,surprise){
 const stem=code==='VA-02'?'virginia_house_02':code==='PA-07'?'pennsylvania_house_07':'south_carolina',reference=load(stem+'_county_fips_reference');
 const h=load(code==='VA-02'?'virginia_house_02_2024_county_baseline_official':code==='PA-07'?'pennsylvania_house_07_2024_county_baseline_official':'south_carolina_senate_2020_county_baseline_official');
 const baseline={...h,counties:h.counties.map(c=>c.records?c:{...c,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}})};
 const totals=c=>c.records.total||{dem_votes:c.records.absentee.dem_votes+c.records.election_day.dem_votes,rep_votes:c.records.absentee.rep_votes+c.records.election_day.rep_votes};
 const d=baseline.counties.reduce((s,c)=>s+totals(c).dem_votes,0),n=baseline.counties.reduce((s,c)=>s+totals(c).dem_votes+totals(c).rep_votes,0),mean=100*(2*d/n-1),fips=new Map(reference.counties.map(c=>[c.county,c.fips]));
 const counties=baseline.counties.map(c=>{const b=totals(c),n=Math.floor((b.dem_votes+b.rep_votes)*.25),d=Math.round(n*Math.max(.001,Math.min(.999,b.dem_votes/(b.dem_votes+b.rep_votes)+surprise/200)));return {county:c.county,county_fips:fips.get(c.county),dem_votes:d,rep_votes:n-d,other_votes:0};});
 const source_url=code==='VA-02'?'https://enr.elections.virginia.gov/results/public/api/elections/virginia/2026-November-General/data/ballot-item/01000000-f030-c43d-fd71-08df1fee52e7':'https://civicapi.org/api/v2/race/'+(code==='PA-07'?87382:87409);
 const compiled=NCL.compile({baseline,reference,baseline_year:code==='SC-SEN'?2020:2024,snapshot:{race_code:code,source_url,status:'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',live_votes_accepted:true,county_identities_matched:reference.counties.length,snapshot_updated_at:stamp,counties}},{now:fixtureNow});
 const {logLikelihood,describePerformance,...projection}=compiled;return {...projection,matched_performance:describePerformance(mean)};
}
const fixture={now:fixtureNow,stamp,noticeable:['VA-02','SC-SEN'].map(code=>matched(code,4)),strong:['VA-02','SC-SEN','PA-07'].map(code=>matched(code,6)),opposing:matched('SC-SEN',-4)};
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'};
const server=dashboard?null:createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,key=p==='/'?'index.html':decodeURIComponent(p).slice(1),file=resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile())return res.writeHead(404).end();res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'}).end(pinned[key]||readFileSync(file));});
if(server)await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;const proofs=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const [width,height]of [[1366,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[],blocked=[],served=new Map(),pendingPins=[],requestedPins=new Set(),pinErrors=[];
  page.on('pageerror',e=>errors.push(e.message));
  context.on('response',response=>{const u=new URL(response.url()),base=dashboard?.pathname||'/',own=dashboard?u.origin===dashboard.origin:u.hostname==='127.0.0.1';if(!own)return;const file=u.pathname===base?'index.html':u.pathname.startsWith(base)?u.pathname.slice(base.length):null;if(!pinFiles.includes(file)||requestedPins.has(file))return;requestedPins.add(file);pendingPins.push(response.body().then(body=>{assert.equal(response.status(),200,file);assert(body.equals(pinned[file]),'Actual served bytes: '+file);served.set(file,hash(body));}).catch(e=>pinErrors.push(e.message)));});
  await page.clock.install({time:new Date('2026-10-29T15:30:00Z')});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(dashboard?u.origin===dashboard.origin&&u.pathname.startsWith(dashboard.pathname):u.hostname==='127.0.0.1')return route.continue();blocked.push(u.hostname);return route.abort();});
  await page.goto(dashboard?.href||'http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>jointLastResult?.probabilities&&document.querySelectorAll('#enPersonalFocus [data-watch-race]').length===32);
  await page.clock.pauseAt(new Date('2026-10-29T15:30:10Z'));
  assert.deepEqual(await page.evaluate(files=>Object.fromEntries(files.map(file=>[file,document.querySelector('script[src*="'+file+'?"]')?.getAttribute('src')||null])),Object.keys(tags)),tags);
  const initial=await page.evaluate(()=>({watches:document.querySelectorAll('#enPersonalFocus .early-watch').length,rows:[...document.querySelectorAll('#enPersonalFocus [data-watch-race]')].map(n=>n.dataset.watchRace),priority:[...document.querySelectorAll('.early-watch-priority [data-watch-race]')].map(n=>n.dataset.watchRace),legacy_rows:document.querySelectorAll('#enEarlySignals .en-early-row').length}));
  assert.equal(initial.watches,1);assert.equal(initial.rows.length,32);assert.equal(new Set(initial.rows).size,32);assert.deepEqual(initial.priority,['KY-06','IN-05','FL-SEN']);assert.equal(initial.legacy_rows,0);
  for(const code of initial.priority){const row=page.locator('[data-watch-race="'+code+'"]');assert.match(await row.textContent(),/Matched comparison inputs still needed/);assert.doesNotMatch(await row.textContent(),/[DR] victory · validated source call/);}
  await page.locator('#enEarlySignalsDetails > summary').click();await page.locator('#enEarlyWatchOpen').click();
  assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#enPersonalFocus .early-watch > h3')),true);
  const ky=page.locator('#enPersonalFocus [data-watch-race="KY-06"]');await ky.locator(':scope > summary').focus();await ky.locator(':scope > summary').press('Space');assert.equal(await ky.evaluate(n=>n.open),true);
  await page.evaluate(()=>renderPersonalElectionFocus());assert.equal(await page.evaluate(()=>document.activeElement.closest('[data-watch-race]')?.dataset.watchRace),'KY-06');assert.equal(await ky.evaluate(n=>n.open),true);
  // Pin actions are deliberately checked only after the final production
  // renderer has installed its per-race button contract.
  const pin=ky.locator('[data-early-watch-pin]');assert.equal(await pin.count(),1,'Final per-race pin control');const pressed=await pin.getAttribute('aria-pressed');await pin.click();assert.equal(await ky.locator('[data-early-watch-pin]').getAttribute('aria-pressed'),String(pressed!=='true'));await ky.locator('[data-early-watch-pin]').click();assert.equal(await ky.locator('[data-early-watch-pin]').getAttribute('aria-pressed'),pressed);
  await page.evaluate(async()=>{await jointWhenIdle();});
  const previewBefore=await page.evaluate(()=>enIndicatorWeather.state().seen);await page.locator('#enEarlyWeatherPreview').click();assert.equal(await page.locator('#enEarlyWeatherToast').isVisible(),true);assert.match(await page.locator('#enEarlyWeatherKicker').innerText(),/SIMULATED PREVIEW/);assert.equal(await page.evaluate(()=>enIndicatorWeather.state().seen),previewBefore);
  await page.locator('#enEarlyWeatherDismiss').focus();await page.locator('#enEarlyWeatherDismiss').press('Space');assert.equal(await page.locator('#enEarlyWeatherToast').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'enEarlyWatchOpen');
  await page.locator('#enCelebrationsOpen').click();assert.equal(await page.locator('#enMilestoneSpotlight').evaluate(n=>n.open),true);await page.evaluate(()=>document.querySelector('#enEarlyWeatherPreview').click());assert.equal(await page.locator('#enEarlyWeatherToast').isVisible(),false);assert.equal(await page.evaluate(()=>enIndicatorWeather.state().seen),previewBefore);await page.locator('#enMilestoneClose').click();
  await page.locator('#enEarlyWeatherPreview').click();assert.equal(await page.locator('#enEarlyWeatherToast').isVisible(),true);const beforeFishClock=await page.evaluate(()=>Date.now());await page.locator('#enFishPreview').click();const fishPriority=await page.evaluate(()=>({weatherHidden:document.querySelector('#enEarlyWeatherToast').hidden,fishVisible:!document.querySelector('#enFishToast').hidden,now:Date.now()}));assert.equal(fishPriority.weatherHidden,true,'Normal Fish presentation immediately preempts weather');assert.equal(fishPriority.fishVisible,true);assert.equal(fishPriority.now,beforeFishClock,'Preemption is synchronous before a clock tick');await page.locator('#enFishDismiss').click();
  const liveBefore=await page.evaluate(()=>JSON.stringify(jointLastResult));
  await page.evaluate(fiction=>{
   const banner=document.createElement('div');banner.id='indicator-component-test-banner';banner.textContent='SIMULATED COMPONENT REVIEW · FICTIONAL COUNTS · NO LIVE SOURCE ADMISSION';Object.assign(banner.style,{position:'fixed',top:'0',left:'0',right:'0',zIndex:'2147483647',padding:'6px',fontSize:'12px',background:'#fbbf24',color:'#111',whiteSpace:'normal',boxSizing:'border-box'});document.body.append(banner);
   window.__indicatorFixture=fiction;
   window.__indicatorExample=(kind='noticeable',context='PUBLIC',current=true)=>{
    const set=kind==='strong'?fiction.strong:kind==='mixed'?[fiction.noticeable[0],fiction.opposing]:kind==='expired'?fiction.noticeable:fiction.noticeable;
    const now=kind==='expired'?fiction.now+181*60000:fiction.now,byCode=new Map(set.map(row=>[row.code,row]));
    const rows=ElectionNightIndicatorStatus.records.map(spec=>ElectionNightIndicatorStatus.assess(spec.code,{now,matched:byCode.get(spec.code)||null,matchedCurrent:current,observation:['KY-06','IN-05','FL-SEN'].includes(spec.code)?{verified:true,provider:spec.code==='KY-06'?'civicAPI':'Open America',asOf:fiction.stamp,total:20000,d:4500,r:15000,precincts:12,stale:false}:null}));
    const view={rows,summary:ElectionNightIndicatorStatus.summarize(rows),current,active:true,context,now};
    PersonalElectionFocus.render(document.querySelector('#enPersonalFocus'),jointLastResult,jointPulseBaseline,{year:2026,now,simulated:true,closes:ElectionNightPollClosings2026,indicators:view,context});return view;
   };
  },fixture);
  const example=await page.evaluate(()=>{const view=__indicatorExample();enIndicatorPublish(view);return {stage:view.summary.stage,no_calls:view.rows.every(row=>row.calledParty===null),no_earned_modal:!document.querySelector('#enMilestoneSpotlight').open,no_fish:document.querySelector('#enFishToast').hidden,noticeable_codes:view.summary.positive_races,weather:enIndicatorWeather.state()};});
  assert.equal(example.stage,'STORM_BREWING');assert.equal(example.no_calls,true);assert.equal(example.no_earned_modal,true);assert.equal(example.no_fish,true);assert.equal(example.weather.visible,true);assert.equal(example.weather.seen,previewBefore+1);
  assert.match(await page.locator('#enPersonalFocus .early-watch > h3').innerText(),/SIMULATED/);assert.match(await page.locator('[data-watch-race="KY-06"]').textContent(),/Raw race returns.*not matched overperformance/s);await page.evaluate(()=>PersonalElectionFocus.openWatch(document.querySelector('#enPersonalFocus'),'VA-02'));assert.match(await page.locator('[data-watch-race="VA-02"]').innerText(),/Matched-area performance.*difference/s);assert.doesNotMatch(await page.locator('[data-watch-race="VA-02"]').innerText(),/victory · validated/);
  assert.equal(await page.locator('#indicator-component-test-banner').isVisible(),true);await page.screenshot({path:resolve(out,'provisional-component-'+width+'.png')});await page.locator('#enEarlyWeatherDismiss').click();await page.evaluate(()=>enIndicatorPublish(__indicatorExample()));assert.equal(await page.locator('#enEarlyWeatherToast').isVisible(),false,'Dismissed same-stage bulletin does not repeat');
  const component=await page.evaluate(()=>{
   const evidence=[];
   for(const boundary of ['pending','ASOF','correction','expiry']){
    const rendered=[],probe=ElectionNightEarlyWeather.create({render:value=>{rendered.push(value);enIndicatorWeatherRender(value);}});
    const positive=__indicatorExample();probe.update({...positive,summary:positive.summary});if(!probe.state().visible)throw Error('Positive component must show before '+boundary);
    const next=boundary==='correction'?__indicatorExample('mixed'):boundary==='expiry'?__indicatorExample('expired'):__indicatorExample('noticeable','PUBLIC',false);
    probe.update({...next,summary:next.summary});evidence.push({boundary,cleared:!probe.state().visible,dom_hidden:document.querySelector('#enEarlyWeatherToast').hidden,stage:next.summary.stage,current:next.current});probe.dismiss();
   }return evidence;
  });assert(component.every(row=>row.cleared&&row.dom_hidden));
  // Actual page lifecycle boundaries operate on the wired controller. Preview
  // is explicitly fictional and does not consume the live pattern key.
  await page.locator('#enEarlyWeatherPreview').click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.locator('#enEarlyWeatherToast').isVisible(),false);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});});
  await page.evaluate(()=>{document.querySelector('#enNationalRehearsal').open=true;enIndicatorWithdraw();document.querySelector('#enEarlyWeatherPreview').click();});assert.equal(await page.locator('#enEarlyWeatherToast').isVisible(),false);await page.evaluate(()=>{document.querySelector('#enNationalRehearsal').open=false;});
  assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult)),liveBefore,'Fictional component views never replace the live model');
  await page.evaluate(()=>{enIndicatorWithdraw();document.querySelector('#indicator-component-test-banner').remove();delete window.__indicatorExample;delete window.__indicatorFixture;renderPersonalElectionFocus();});
  assert.doesNotMatch(await page.locator('#enPersonalFocus .early-watch > h3').innerText(),/SIMULATED/);assert.equal(await page.evaluate(()=>JSON.stringify(jointLastResult)),liveBefore);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);await page.screenshot({path:resolve(out,'unified-watch-'+width+'.png')});
  await page.locator('#enEarlyWeatherPreview').click();await page.locator('#enMode2024').click();assert.equal(await page.locator('#enEarlyWeatherToast').isVisible(),false);await page.locator('#enMode2026').click();await page.evaluate(async()=>{await jointWhenIdle();});
  assert.deepEqual(errors,[]);await Promise.all(pendingPins);assert.deepEqual(pinErrors,[]);assert.equal(served.size,pinFiles.length,'Every pinned actual source was observed');
  proofs.push({width,height,status:'PASS',watch_rows:initial.rows.length,priority:initial.priority,one_shared_watch:true,keyboard_and_redraw:true,pin_toggle_restored:true,preview_does_not_consume_live_stage:true,automatic_component_without_call:example,component_boundaries:component,hidden_archive_rehearsal_isolation:true,live_model_unchanged_before_archive:true,no_overflow:true,source_files:[...served].map(([file,sha256])=>({file,sha256})),blocked_external_hosts:[...new Set(blocked)],external_native_successes:0,proof_scope:'Actual served app and visibly fictional component mechanics; actual CURRENT source binding proved by separate portable test.390px is desktop phone viewport, not physical phone or human acceptance.'});
  await context.close();
 }
 writeFileSync(resolve(out,'proof.json'),JSON.stringify({status:'PASS',harness_sha256:harnessSHA,main,pages_run:dashboard?process.env.DASHBOARD_TEST_PAGES_RUN:null,published_https:Boolean(dashboard),proofs},null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',viewports:proofs.map(row=>row.width),watch_rows:32,source_pins:pinFiles.length,scope:'Actual app; fictional component and separate real-source-binding proof; providers blocked'}));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({status:'FAIL',completed_viewports:proofs,error:error.message,stack:error.stack},null,2)+'\n');throw error;}
finally{await browser?.close();if(server)await new Promise(ok=>server.close(ok));}
