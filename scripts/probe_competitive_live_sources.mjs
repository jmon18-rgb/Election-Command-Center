// Real deployed-page probe. Approved provider routes are continued, NEVER
// fulfilled with fixtures. No virtual clock and no test vote payload archival.
import {mkdirSync,writeFileSync,appendFileSync,readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {races,inWindow,summarize,nationalProof}=require('./competitive_live_source_report.cjs');
const out=resolve('artifacts/readiness/competitive-live');mkdirSync(out,{recursive:true});
let target='https://jmon18-rgb.github.io/Election-Command-Center/',candidateServer=null;
const candidate=process.argv.includes('--candidate');
if(!inWindow(Date.now())){
 const report={generated_at:new Date().toISOString(),status:'OUTSIDE_2026_ELECTION_WINDOW_NO_SOURCE_REQUESTS',interval_calibrated:false};
 writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}else{
 if(candidate){
  const root=resolve(import.meta.dirname,'..'),types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
  candidateServer=createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),path=resolve(root,'.'+(name==='/'?'/index.html':name));
   if(!path.startsWith(root+sep)||!existsSync(path)||!statSync(path).isFile()){res.writeHead(404).end();return;}
   res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'}).end(readFileSync(path));});
  await new Promise(ok=>candidateServer.listen(0,'127.0.0.1',ok));target='http://127.0.0.1:'+candidateServer.address().port+'/';
 }
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
  const canonical=url=>{const u=new URL(url);return u.origin+u.pathname;};
  const approved=new Set(races.map(r=>r.transport_url||r.url)),siteOrigin=new URL(target).origin;
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('requestfailed',request=>{if(approved.has(canonical(request.url())))requestErrors.set(canonical(request.url()),request.failure()?.errorText||'Request failed');});
  const requestStarts=new WeakMap();
  page.on('request',request=>{if(approved.has(canonical(request.url())))requestStarts.set(request,new Date().toISOString());});
  page.on('response',response=>{
   if(approved.has(canonical(response.url()))){
    const body=response.body().then(bytes=>({bytes,raw:JSON.parse(bytes.toString('utf8')),received_at:new Date().toISOString()})).catch(error=>({error:error.message}));
    observed.set(canonical(response.url()),{url:response.url(),http:response.status(),request_started_at:requestStarts.get(response.request())||null,body,response_cache:{age:response.headers()['age']??null,cache_control:response.headers()['cache-control']??null,date:response.headers()['date']??null,etag:response.headers()['etag']??null},headers_received_at:new Date().toISOString()});
   }
  });
  await page.route('**/*',route=>{
   const url=route.request().url();
   return new URL(url).origin===siteOrigin||approved.has(canonical(url))?route.continue():route.abort();
  });
  const navigation=await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000});
  if(navigation?.status()!==200)throw Error('Production page did not return HTTP200');
  pageFingerprint=createHash('sha256').update(await navigation.body()).digest('hex');
  await page.waitForFunction(()=>typeof jointLastResult!=='undefined'&&jointLastResult?.probabilities,{},{timeout:25000});
  const nationalBefore=await page.evaluate(()=>JSON.stringify(jointLastResult.probabilities));
  await page.locator('[data-page="electionNight"]').click();await page.locator('#enMode2026').click();
  const controllers=races.map(r=>r.controller);
  await page.waitForFunction(names=>names.every(name=>window[name]&&!window[name].status().busy&&
   !/Waiting|Select|Checking/.test(window[name].status().phase)),controllers,{timeout:25000});
  await page.evaluate(async names=>{await Promise.all(names.map(name=>window[name].tick()));},controllers);
  await page.evaluate(()=>jointRender(true));
  const admitted=await page.evaluate(()=>jointLastResult?.county_results_update?.used||[]);
  const rows=[],rawBodies=new Map();
  for(const race of races){
   const network=observed.get(race.transport_url||race.url),body=network?await bounded(network.body).catch(e=>({error:e.message})):null;
   const raw=body?.raw;
   const ui=await page.evaluate(async({race,raw,nationalBefore})=>{
    const controller=window[race.controller],state=controller.status();let parsed=null,parse_error=null;
    try{
     if(!raw)throw Error('No actual provider JSON response');
     const response=await fetch(new URL(race.reference,location.href),{cache:'no-store',credentials:'omit'});
     if(!response.ok)throw Error('Independent county reference HTTP '+response.status);
     const parser=race.parser_scope?window[race.parser].forRace(race.parser_scope):window[race.parser];
     parsed=await parser.parse(raw,await response.json(),{source_url:race.transport_url||race.url,now:Date.now()});
    }catch(error){parse_error=error.message;}
    const jointEvidence=jointLastResult?.county_results_update?.used.find(e=>e.code===race.code);
    const jointRace=jointLastResult?.race_probabilities.find(e=>e.race_code===race.code);
    const projection=race.forecast_scope==='national_joint_draws'&&jointEvidence&&jointRace?{
     status:'EXPERIMENTAL_NATIONAL_JOINT_DRAW_PROBABILITY',dem_win_probability:jointRace.dem_beats_rep_pct/100,
     counted_dem_votes:parsed.counties.reduce((n,c)=>n+c.dem_votes,0),counted_rep_votes:parsed.counties.reduce((n,c)=>n+c.rep_votes,0),
     modeled_remaining_two_party_votes:jointEvidence.modeled_remaining_two_party_votes,modeled_remaining_two_party_votes_band:jointEvidence.modeled_remaining_two_party_votes_band,
     interval_calibrated:false,may_move_national_needle:true}:state.projection?{
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
     projection,preview:state.preview===true,phase:state.phase,automatic_poll_interval_ms:state.automatic_poll_interval_ms??null,
     national_unchanged:JSON.stringify(jointLastResult.probabilities)===nationalBefore};
   },{race,raw:raw||null,nationalBefore});
   rows.push({code:race.code,source_url:race.transport_url?race.url:network?.url||race.url,transport_url:race.transport_url?network?.url||race.transport_url:null,http:network?.http||null,
    response_cache:network?.response_cache||null,request_started_at:network?.request_started_at||null,
    http_request_to_body_ms:body?.received_at&&network?.request_started_at?Date.parse(body.received_at)-Date.parse(network.request_started_at):null,
    captured_at:body?.received_at||null,headers_received_at:network?.headers_received_at||null,
    source_stamp:race.transport_url?(raw?.snapshot_updated_at||raw?.observed_source_stamp||null):raw?.last_updated||null,source_test_data:race.transport_url?raw?.source_test_data??null:raw?.test_data??null,
    upstream_http_status:race.transport_url?raw?.http_status??null:null,upstream_cache_control:race.transport_url?raw?.cache_control??null:null,
    raw_positive_candidate_counts_present:race.transport_url?(raw?.payload?.ballotItemWithBreakdown?.summaryResults?.ballotOptions?.some(c=>Number.isSafeInteger(c.voteCount)&&c.voteCount>0)??raw?.observed_positive_candidate_counts??null):raw?.test_data===false&&Array.isArray(raw?.candidates)?raw.candidates.some(c=>Number.isSafeInteger(c?.votes)&&c.votes>0):null,
    upstream_observation_via_collector:!!race.transport_url,
    transport_error:requestErrors.get(race.transport_url||race.url)||body?.error||(!network?'No provider response':null),...ui});
   if(body?.bytes)rawBodies.set(race.code,body.bytes);
  }
  const proof=nationalProof(rows,admitted);
  for(const row of rows){row.national_evidence_validated=proof.validated_codes.includes(row.code);row.national_contract_validated=proof.contract_validated;}
  report={...summarize(rows),national_admitted_sources:admitted,site:target,site_scope:candidate?'LOCAL_CANDIDATE_NOT_PUBLISHED':'ACTUAL_PUBLISHED_SITE',scope:candidate?'Actual candidate browser with real provider responses; not published-site acceptance, no fixtures or virtual clock':'Actual published browser with real provider responses; no fixtures or virtual clock',probe_environment:probeEnvironment,probe_revision:probeRevision,probe_working_tree_dirty:probeDirty,
   comparative_publication_lag:'UNPROVEN_REQUIRES_INDEPENDENT_MATCHED_REAL_BATCHES',
   timing_scope:'HTTP request-to-decoded-body duration only; neither provider vote availability nor comparative publication lag',
   site_index_decoded_body_sha256:pageFingerprint,fixture_free:true,virtual_clock:false,
   other_providers:'Blocked, not replaced; this isolates the competitive county paths',page_errors:pageErrors,
   loaded_scripts:await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src'))),raw_archives:[]};
  if(pageErrors.length)report.status='ACTION_REQUIRED';
  for(const row of report.sources){
   // Only independently time-gated, accepted NON-TEST source data is saved.
   if(!row.live_input_validated)continue;
   const bytes=rawBodies.get(row.code);if(!bytes)throw Error('Accepted actual source body unavailable');
   const raw=JSON.parse(bytes.toString('utf8'));
   const reference=JSON.parse(readFileSync(resolve(import.meta.dirname,'../data/washington_house_03_county_fips_reference.json'),'utf8'));
   const waNames=new Map(reference.counties.map(c=>[c.county+' County',c.fips]));
   const scReference=row.code==='SC-SEN'?JSON.parse(readFileSync(resolve(import.meta.dirname,'../data/south_carolina_county_fips_reference.json'),'utf8')):null;
   const scVector=scReference?require('./south_carolina_civic_county_source.js').parse(raw,scReference,{now:Date.parse(row.captured_at)}).counties.map(c=>[c.county_fips,c.dem_votes,c.rep_votes,c.other_votes]).sort((a,b)=>a[0].localeCompare(b[0])):null;
   const vector=scVector|| (row.code==='WA-03'?raw.payload.ballotItemWithBreakdown.breakdownResults.map(c=>[waNames.get(c.locality.name[0].text),...['1601892','1601893','9910'].map(id=>c.ballotOptions.find(o=>o.nativeId===id).voteCount)]).sort((a,b)=>a[0].localeCompare(b[0])):Object.values(raw.region_results).filter(c=>row.code!=='ME-SEN'||c.type==='County').sort((a,b)=>String(a.fips||a.name).localeCompare(String(b.fips||b.name))).map(c=>[
    c.fips,...['Democratic','Republican','Libertarian'].map(p=>c.candidates.filter(v=>v.party===p).reduce((n,v)=>n+v.votes,0))]));
   const file=row.code+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
   const dir=resolve(out,'raw');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,file),bytes);
   report.raw_archives.push({race:row.code,path:'raw/'+file,source_url:row.source_url,captured_at:row.captured_at,
    provider_snapshot_at:row.source_stamp,decoded_http_body_sha256:createHash('sha256').update(bytes).digest('hex'),
    county_vote_vector_sha256:createHash('sha256').update(JSON.stringify(vector)).digest('hex'),
    transport_kind:['WA-03','VA-02'].includes(row.code)?'OWNED_CACHE_OF_ORIGINAL_OFFICIAL_CONTEST_OBJECTS':'DIRECT_PROVIDER_RESPONSE',
    upstream_body_digest_reported_by_collector:['WA-03','VA-02'].includes(row.code)?raw.original_response_sha256:null,county_update_times_independently_observed:false,authoritative_race_call:false});
  }
 }catch(error){
  report={generated_at:new Date().toISOString(),status:'ACTION_REQUIRED',site:target,
   probe_environment:probeEnvironment,probe_revision:probeRevision,probe_working_tree_dirty:probeDirty,comparative_publication_lag:'UNPROVEN_REQUIRES_INDEPENDENT_MATCHED_REAL_BATCHES',
   timing_scope:'HTTP request-to-decoded-body duration only; neither provider vote availability nor comparative publication lag',
   site_index_decoded_body_sha256:pageFingerprint,
   fixture_free:true,virtual_clock:false,interval_calibrated:false,error:error.message,raw_archives:[]};
 }finally{await browser?.close();if(candidateServer)await new Promise(ok=>candidateServer.close(ok));}
 writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 const summary=['# Actual competitive-source probe','',`Status: **${report.status}**`,
  '',`Target scope: ${report.site_scope||'no page observed'}`, '', 'Real provider responses; no fixtures or virtual clock. Test mode never proves live delivery. No calibration claim.',
  '', '| Race | HTTP | Actual source status | Accepted live two-party votes | Forecast observed |', '| --- | --- | --- | ---: | --- |',
  ...(report.sources||[]).map(r=>`| ${r.code} | ${r.http??'unavailable'} | ${r.status} | ${r.counted_dem_votes+r.counted_rep_votes} | ${r.actual_live_input_forecast_observed} |`),
  '', 'Sources: attributed civicAPI and independent official Virginia results, plus Washington Secretary of State through an owned cache. Raw test payloads are never archived; cached transport captures are labeled separately.',
  ...(report.error?['',report.error]:[])].join('\n')+'\n';
 writeFileSync(resolve(out,'report.md'),summary);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 console.log(JSON.stringify({...report,loaded_scripts:undefined}));
 if(report.status==='ACTION_REQUIRED')process.exitCode=1;
 else if(report.status==='SOURCE_AVAILABILITY_REVIEW_REQUIRED')console.log('::warning::Prolonged lack of a usable current competitive feed: review source status and race state. This is not live forecast acceptance.');
}
