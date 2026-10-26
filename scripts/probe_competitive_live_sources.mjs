// Real deployed-page probe. Approved provider routes are continued, NEVER
// fulfilled with fixtures. No virtual clock and no test vote payload archival.
import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {races,inWindow,summarize}=require('./competitive_live_source_report.cjs');
const out=resolve('artifacts/readiness/competitive-live');mkdirSync(out,{recursive:true});
const target='https://jmon18-rgb.github.io/Election-Command-Center/';
if(!inWindow(Date.now())){
 const report={generated_at:new Date().toISOString(),status:'OUTSIDE_2026_ELECTION_WINDOW_NO_SOURCE_REQUESTS',interval_calibrated:false};
 writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}else{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
 let browser,report,pageFingerprint=null;
 const probeEnvironment=process.env.GITHUB_ACTIONS==='true'?'github_actions_browser':'local_browser';
 let probeRevision=null,probeDirty=null;
 try{probeRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  probeDirty=Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim());}catch{}
 const observed=new Map(),requestErrors=new Map(),pageErrors=[];
 const bounded=async promise=>{
  let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Source body read deadline')),5000);})]);}
  finally{clearTimeout(timer);}
 };
 try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'}),page=await context.newPage();
  const approved=new Set(races.map(r=>r.url)),siteOrigin=new URL(target).origin;
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('requestfailed',request=>{if(approved.has(request.url()))requestErrors.set(request.url(),request.failure()?.errorText||'Request failed');});
  page.on('response',response=>{
   if(approved.has(response.url())){
    const body=response.body().then(bytes=>({bytes,raw:JSON.parse(bytes.toString('utf8')),received_at:new Date().toISOString()})).catch(error=>({error:error.message}));
    observed.set(response.url(),{url:response.url(),http:response.status(),body,headers_received_at:new Date().toISOString()});
   }
  });
  await page.route('**/*',route=>{
   const url=route.request().url();
   return new URL(url).origin===siteOrigin||approved.has(url)?route.continue():route.abort();
  });
  const navigation=await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000});
  if(navigation?.status()!==200)throw Error('Production page did not return HTTP200');
  pageFingerprint=createHash('sha256').update(await navigation.body()).digest('hex');
  await page.waitForFunction(()=>typeof jointLastResult!=='undefined'&&jointLastResult?.probabilities,{},{timeout:25000});
  const nationalBefore=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  await page.waitForFunction(()=>window.enIowaPilotController&&window.enKansasPilotController&&
   !window.enIowaPilotController.status().busy&&!window.enKansasPilotController.status().busy&&
   !/Waiting|Select|Checking/.test(window.enIowaPilotController.status().phase)&&
   !/Waiting|Select|Checking/.test(window.enKansasPilotController.status().phase),{},{timeout:25000});
  await page.evaluate(async()=>{await Promise.all([window.enIowaPilotController.tick(),window.enKansasPilotController.tick()]);});
  const rows=[],rawBodies=new Map();
  for(const race of races){
   const network=observed.get(race.url),body=network?await bounded(network.body).catch(e=>({error:e.message})):null;
   const raw=body?.raw;
   const ui=await page.evaluate(async({race,raw,nationalBefore})=>{
    const controller=window[race.controller],state=controller.status();let parsed=null,parse_error=null;
    try{
     if(!raw)throw Error('No actual provider JSON response');
     const response=await fetch(new URL(race.reference,location.href),{cache:'no-store',credentials:'omit'});
     if(!response.ok)throw Error('Independent county reference HTTP '+response.status);
     parsed=window[race.parser].parse(raw,await response.json(),{source_url:race.url,now:Date.now()});
    }catch(error){parse_error=error.message;}
    const projection=state.projection?{
     status:state.projection.status,dem_win_probability:state.projection.dem_win_probability,
     counted_dem_votes:state.projection.counted_dem_votes,counted_rep_votes:state.projection.counted_rep_votes,
     modeled_remaining_two_party_votes:state.projection.modeled_remaining_two_party_votes,
     modeled_remaining_two_party_votes_band:state.projection.modeled_remaining_two_party_votes_band,
     interval_calibrated:state.projection.interval_calibrated,may_move_national_needle:state.projection.may_move_national_needle}:null;
    return {source_identity_validated:parsed?.county_identities_matched===race.counties,
     county_identities_matched:parsed?.county_identities_matched||0,
     parsed_counties:parsed?.counties?.length||0,source_status:parsed?.status||null,parse_error,
     live_votes_accepted:parsed?.live_votes_accepted===true,
     counted_dem_votes:parsed?.live_votes_accepted?parsed.counties.reduce((n,c)=>n+c.dem_votes,0):0,
     counted_rep_votes:parsed?.live_votes_accepted?parsed.counties.reduce((n,c)=>n+c.rep_votes,0):0,
     projection,preview:state.preview===true,phase:state.phase,
     national_unchanged:JSON.stringify(jointLastResult.probabilities)===nationalBefore};
   },{race,raw:raw||null,nationalBefore});
   rows.push({code:race.code,source_url:network?.url||race.url,http:network?.http||null,
    captured_at:body?.received_at||null,headers_received_at:network?.headers_received_at||null,
    source_stamp:raw?.last_updated||null,source_test_data:raw?.test_data??null,
    transport_error:requestErrors.get(race.url)||body?.error||(!network?'No provider response':null),...ui});
   if(body?.bytes)rawBodies.set(race.code,body.bytes);
  }
  report={...summarize(rows),site:target,probe_environment:probeEnvironment,probe_revision:probeRevision,probe_working_tree_dirty:probeDirty,
   site_index_decoded_body_sha256:pageFingerprint,fixture_free:true,virtual_clock:false,
   other_providers:'Blocked, not replaced; this isolates the competitive county paths',page_errors:pageErrors,
   loaded_scripts:await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src'))),raw_archives:[]};
  if(pageErrors.length)report.status='ACTION_REQUIRED';
  for(const row of report.sources){
   // Only independently time-gated, accepted NON-TEST source data is saved.
   if(!row.live_input_validated)continue;
   const bytes=rawBodies.get(row.code);if(!bytes)throw Error('Accepted actual source body unavailable');
   const raw=JSON.parse(bytes.toString('utf8'));
   const vector=Object.values(raw.region_results).sort((a,b)=>a.fips.localeCompare(b.fips)).map(c=>[
    c.fips,...['Democratic','Republican','Libertarian'].map(p=>c.candidates.filter(v=>v.party===p).reduce((n,v)=>n+v.votes,0))]);
   const file=row.code+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
   const dir=resolve(out,'raw');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,file),bytes);
   report.raw_archives.push({race:row.code,path:'raw/'+file,source_url:row.source_url,captured_at:row.captured_at,
    provider_snapshot_at:row.source_stamp,decoded_http_body_sha256:createHash('sha256').update(bytes).digest('hex'),
    county_vote_vector_sha256:createHash('sha256').update(JSON.stringify(vector)).digest('hex'),
    county_update_times_independently_observed:false,authoritative_race_call:false});
  }
 }catch(error){
  report={generated_at:new Date().toISOString(),status:'ACTION_REQUIRED',site:target,
   probe_environment:probeEnvironment,probe_revision:probeRevision,probe_working_tree_dirty:probeDirty,site_index_decoded_body_sha256:pageFingerprint,
   fixture_free:true,virtual_clock:false,interval_calibrated:false,error:error.message,raw_archives:[]};
 }finally{await browser?.close();}
 writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 const summary=['# Actual competitive-source probe','',`Status: **${report.status}**`,
  '', 'Real provider responses; no fixtures or virtual clock. Test mode never proves live delivery. No calibration claim.',
  '', '| Race | HTTP | Actual source status | Accepted live two-party votes | Forecast observed |', '| --- | --- | --- | ---: | --- |',
  ...(report.sources||[]).map(r=>`| ${r.code} | ${r.http??'unavailable'} | ${r.status} | ${r.counted_dem_votes+r.counted_rep_votes} | ${r.actual_live_input_forecast_observed} |`),
  '', 'Source: civicAPI (https://civicapi.org), permitted public API with attribution. Raw test payloads are never archived.',
  ...(report.error?['',report.error]:[])].join('\n')+'\n';
 writeFileSync(resolve(out,'report.md'),summary);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 console.log(JSON.stringify({...report,loaded_scripts:undefined}));
 if(report.status==='ACTION_REQUIRED')process.exitCode=1;
 else if(report.status==='SOURCE_AVAILABILITY_REVIEW_REQUIRED')console.log('::warning::Prolonged lack of a usable current competitive feed: review source status and race state. This is not live forecast acceptance.');
}
