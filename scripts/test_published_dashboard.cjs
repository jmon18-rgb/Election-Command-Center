#!/usr/bin/env node
'use strict';
/**
 * Deployable-data smoke check, intentionally independent of old named polls.
 *
 *   node scripts/test_published_dashboard.cjs --local
 *   node scripts/test_published_dashboard.cjs --remote
 *
 * The remote mode tests the *actual GitHub Pages response and CDN assets*
 * without credentials, Chrome, jsdom or the GitHub API. The local mode runs
 * unchanged against the PR's own files and is safe in every PR CI run.
 */
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const csvFundamentals=require('./private_senate_fundamentals.js');
const root=path.resolve(__dirname,'..');
const remote=process.argv.includes('--remote');
assert(!(remote&&process.argv.includes('--local')),'Select only one source mode');
const site=(process.env.DASHBOARD_SITE_URL||
 'https://jmon18-rgb.github.io/Election-Command-Center/').replace(/\/?$/,'/');
const checks=[];
function check(name,fn){fn();checks.push(name)}
async function load(file){
 if(!remote)return readFileSync(path.join(root,file.split('?')[0].replace(/^\.\//,'')),'utf8');
 const target=new URL(file,site).toString();
 let error;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(target,{cache:'no-store',signal:AbortSignal.timeout(12000),
    headers:{'Cache-Control':'no-cache','Pragma':'no-cache'}});
   if(!response.ok)throw Error(file+' HTTP '+response.status);
   return Buffer.from(await response.arrayBuffer()).toString('utf8');
  }catch(e){error=e; if(attempt<2)await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
 }
 throw Error('Deployed asset unavailable '+target+': '+error.message);
}
async function loadMediaBytes(file){
 if(!remote)return readFileSync(path.join(root,file.replace(/^\.\//,'')));
 const target=new URL(file,site);
 const response=await fetch(target,{cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Required Fish Head audio missing from deployed site: '+response.status);
 return Buffer.from(await response.arrayBuffer());
}
function blobRevision(code){
 const body=Buffer.from(code,'utf8');
 return crypto.createHash('sha1').update(Buffer.from('blob '+body.length+'\0')).update(body)
  .digest('hex').slice(0,12);
}
function indexOffice(rows,office){
 return new Map(rows.filter(x=>x?.race_code&&['single_poll','multi_poll'].includes(x.status))
  .map(x=>[office+'|'+x.race_code,x]));
}
async function main(){
 const html=await load('index.html');
 // The Pages deployment event may race a newer main commit, including the
 // hourly polling bot. Compare the SERVED assets to the SERVED HTML, rather
 // than requiring the checkout HEAD to equal an asynchronously built CDN.
 // A wrong/stale asset is still an error. A benign revision lag is metadata.
 const checkoutHtml=readFileSync(path.join(root,'index.html'),'utf8');
 const deployedIndexMatchesCurrentMain=blobRevision(html)===blobRevision(checkoutHtml);
 if(remote&&process.argv.includes('--require-head'))
  check('published HTML is latest checked-out revision',()=>{
   assert(deployedIndexMatchesCurrentMain,
    'GitHub Pages still serves a different index revision');
  });
 check('real index and live feature slots',()=>{
  for(const id of ['jointHomeCards','jointNightCards','modelBoard','mississippiSenateWatch',
    'senateTideRaces','enRaceList','newPolls','wireResults','newsFeedStatus',
    'integrityFeedStatus','bullScoreStates','integrityQueue']){
   assert(html.includes('id="'+id+'"'),'Missing interactive site slot '+id);
  }
  assert(html.includes('function refreshLivePollSnapshots()'));
  assert(html.includes('renderMississippiSenateWatch()'));
  for(const marker of ['id="jointHomeNeedle"','id="jointNightNeedle"',
     'id="enArchiveOutcome"','function jointRenderNeedles(result)']){
   assert(html.includes(marker),'Missing 2026 needle or 2024 archive capability '+marker);
  }
  assert(html.includes("nightPanel.classList.toggle('en-archive-mode',archive)"),
   '2024 archive must hide 2026 probabilistic Four Endings and show hindsight');
  assert(html.includes('2024 ACTUAL OUTCOME'),
   '2024 mode must show a historical result, not fabricated archived odds');
  assert(html.includes('function refreshCommandCenterFeeds()'));
  assert(html.includes('setInterval(()=>{void refreshCommandCenterFeeds()},COMMAND_NEWS_REFRESH_MS)'));
  assert(html.includes('setInterval(()=>{void refreshLivePollSnapshots()},2*60*1000)'));
 });
 const recordedAudio=html.match(/<audio\s+id="enFishAudio"[^>]*\bsrc="([^"]+\.mp3)"/);
 check('Fish Head uses local user recording, not a YouTube embed or TTS',()=>{
  assert(recordedAudio,'Missing original user MP3 player');
  assert.equal(recordedAudio[1],
   './assets/audio/breaking-news-in-the-2026-midterm-elections.mp3');
  assert(!html.includes('youtube-nocookie.com/embed/_VJKlSpTBu4'),
   'Legacy video should not appear in current Fish Head implementation');
  assert(html.includes('enFishShow(event);'),
   'Every distinct breaking alert must reach the audio queue');
 });
 const soundBytes=await loadMediaBytes(recordedAudio[1]);
 check('deployed Fish Head audio is the exact original MP3',()=>{
  assert.equal(soundBytes.length,62708,'Original recording size changed');
  assert.equal(soundBytes.subarray(0,3).toString('latin1'),'ID3');
  assert.equal(crypto.createHash('sha256').update(soundBytes).digest('hex'),
   '37245c9cba556e7ee3ed03bc97e8e54006bdefd0ffe80c846c478a5da6da223e',
   'The deployed sound differs from the uploaded recording');
 });
 const senateCsv=csvFundamentals.parse(await load('ZqBdM (1).csv'));
 const houseCsv=csvFundamentals.parse(await load('f3ome (1).csv'));
 check('published Senate+House candidate fundamentals CSVs are valid active sources',()=>{
  assert.equal(senateCsv.kind,'senateFundamentals');
  assert.equal(Object.keys(senateCsv.states).length,28);
  assert.equal(houseCsv.kind,'houseFundamentals');
  assert.equal(Object.keys(houseCsv.states).length,98);
  assert(html.includes('jointLoadRepositoryFundamentals()'));
  assert(html.includes("repositoryPublished:jointPrivateSource==='repository'"));
  assert(html.includes('jointPrivateHouse=true'));
 });
 const refs=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(x=>x[1]);
 check('all external scripts are repository-local and content-addressed',()=>{
  assert(refs.length>=8,'Expected all election-night + forecasting adapters');
  assert(refs.every(x=>/^\.\/scripts\/[a-z0-9_-]+\.js\?v=[0-9a-f]{12}$/.test(x)),
   'An unversioned script can serve an obsolete election-night/forecast engine');
  assert.equal(new Set(refs.map(x=>x.split('?')[0])).size,refs.length);
 });
 const codes=await Promise.all(refs.map(async url=>({url,code:await load(url)})));
 check('no stale CDN scripts or cache-invalidating mismatch',()=>{
  for(const x of codes){
   const expected=x.url.match(/[?&]v=([0-9a-f]{12})$/)[1];
   assert.equal(blobRevision(x.code),expected,
    'Deployed script content does not match index cache revision: '+x.url);
   new vm.Script(x.code,{filename:x.url}); // Syntax-check REAL served code.
  }
 });
 const names=['polls','polling_estimates','race_probabilities','seat_universe',
  'house_history_2024_staging','house_geography_bridge',
  'senate_history_2020_2022_2024','presidential_2024_by_2026_district_staging'];
 const docs=Object.fromEntries(await Promise.all(names.map(async name=>
  [name,JSON.parse(await load('data/'+name+'.json'))])));
 const primary=docs.polls,polling=docs.polling_estimates,odds=docs.race_probabilities;
 const seats=docs.seat_universe;
 const [briefing,queue,impact]=await Promise.all(
  ['briefing','integrity_review_queue','integrity_impact'].map(async n=>
   JSON.parse(await load('data/'+n+'.json'))));
 check('news and election-integrity feeds are present, sourced, recent and distinct',()=>{
  assert(Array.isArray(briefing.updates)&&briefing.updates.length>0,
   'Election news missing (empty collector output)');
  assert(Array.isArray(briefing.security)&&briefing.security.length>0,
   'Election security news missing');
  // An upstream RSS outage must not veto newly validated polls/odds.
  // The source collector retains old headlines with their true timestamps.
  if(!(briefing.pipeline?.successful_queries>0)){
   assert.equal(briefing.pipeline?.status,'degraded_upstream_news_unavailable',
    'Failed news collection requires explicit degraded status');
   assert(Array.isArray(briefing.pipeline?.errors)&&briefing.pipeline.errors.length>0,
    'News outage must disclose underlying errors');
   assert(Number.isFinite(Date.parse(briefing.pipeline?.last_attempt_at)),
    'Degraded news must show the actual failed-attempt time');
   assert(Number.isFinite(Date.parse(briefing.updated_at)),
    'Retained sourced headlines need a historical timestamp');
  }
  assert(briefing.updates.every(x=>x.title&&x.url?.startsWith('https://')&&x.published_at));
  assert(briefing.security.every(x=>x.title&&x.url?.startsWith('https://')&&x.published_at));
  assert(Array.isArray(queue.items)&&queue.items.length>0,
   'Election integrity news leads never reached review queue');
  assert(queue.status==='leads_only_not_verified_incidents');
  assert(Array.isArray(impact.incidents)&&impact.incidents.length>0,
   'Curated voter-access evidence ledger is missing');
  assert(impact.incidents.every(x=>x.id&&x.state&&x.verification_status&&
   Array.isArray(x.sources)&&x.sources.some(src=>src.url?.startsWith('https://'))));
  assert(impact.incidents.every(x=>x.verification_status!=='unverified_report'||
   x.adverse_scenario?.probability_of_scenario==null),
   'Unverified headline must never become a quantified impact forecast');
  if(remote){
   const newsAt=briefing.pipeline?.successful_queries>0?
    briefing.updated_at:briefing.pipeline?.last_attempt_at;
   for(const [name,at] of [['news attempt',newsAt],['integrity leads',queue.updated_at]]){
    const age=Date.now()-Date.parse(at);
    assert(Number.isFinite(age)&&age>=-15*60000&&age<8*3600000,
      'Deployed '+name+' feed has stopped updating: '+at);
   }
  }
 });
 check('hourly source health and complete matching publication',()=>{
  assert.equal(primary.health?.status,'ok',JSON.stringify(primary.health?.errors));
  assert(primary.health.successful_sections.includes('races'));
  assert(primary.health.successful_sections.includes('generic_ballot'));
  assert.equal(polling.source_snapshot,primary.updated_at);
  assert.equal(odds.polling_source_snapshot,primary.updated_at);
  assert.equal(odds.polling_source_generated_at,polling.generated_at);
  assert.equal(seats.polling_source_snapshot,polling.generated_at);
  assert.equal(seats.house.total_voting_seats,435);
  assert.equal(seats.senate.contested_total,35);
  assert(Array.isArray(primary.races)&&primary.races.length>100);
  if(remote){
   const age=Date.now()-Date.parse(polling.generated_at);
   assert(Number.isFinite(age)&&age>=-15*60000&&age<6*3600000,
    'Published model data is older than six hours: '+polling.generated_at);
  }
 });
 const byEstimate=new Map([
  ...indexOffice(polling.senate_all,'senate'),
  ...indexOffice(polling.house,'house'),...indexOffice(polling.governor,'governor')]);
 const byOdds=new Map(odds.records.map(x=>[x.office+'|'+x.race_code,x]));
 check('every eligible polled race is in the input probability model',()=>{
  assert(byOdds.size>=100);
  assert.equal(byOdds.size,odds.records.length,'Duplicate source race IDs');
  assert.equal(byOdds.size,byEstimate.size,
   'An eligible poll was dropped before probability modeling');
  for(const [key,estimate] of byEstimate){
   const race=byOdds.get(key);
   assert(race,'Missing input probability '+key);
   assert(Math.abs(race.dem_minus_rep-estimate.dem_minus_rep)<.011,
    'Race model uses a different poll margin: '+key);
   assert.equal(race.latest_poll_end,estimate.latest_poll_end,
    'Newly posted poll did not move into source probability: '+key);
  }
 });
 check('2026 Senate ballot is complete even when old named polls rotate out',()=>{
  const senate=new Map(seats.senate.contested_seats.map(r=>[r.race_code,r]));
  assert.equal(senate.size,35,'Missing Senate contests from validated election inventory');
  for(const code of ['OH-SEN','IA-SEN','MS-SEN']){
   assert(senate.has(code),'Missing 2026 Senate ballot seat '+code);
   const source=primary.races.find(x=>x.race_code===code);
   const mean=polling.senate_all.find(x=>x.race_code===code);
   const modeled=byOdds.get('senate|'+code);
   if(!source||!mean||!['single_poll','multi_poll'].includes(mean.status)){
    assert(!modeled,'No standalone poll odds without a qualifying current poll: '+code);
    continue;
   }
   assert(modeled,'Eligible Senate polling lost before probability model: '+code);
   assert(Math.abs(mean.dem_minus_rep-modeled.dem_minus_rep)<.011);
   assert.equal(modeled.latest_poll_end,mean.latest_poll_end);
  }
 });
 const engineCode=codes.find(x=>x.url.startsWith('./scripts/chamber_control_model.js?'));
 assert(engineCode,'Missing JS chamber model');
 const mod={exports:{}};
 vm.runInNewContext(engineCode.code,{module:mod,exports:mod.exports,console,Math,
  Date,Set,Map,Uint8Array,Uint32Array,ArrayBuffer,Object,Number,String},
  {filename:'chamber_control_model.js',timeout:5000});
 const engine=mod.exports;
 assert.equal(typeof engine.prepare,'function');
 assert.equal(typeof engine.simulate,'function');
 const source={
  seats,history:docs.house_history_2024_staging,geography:docs.house_geography_bridge,
  senateHistory:docs.senate_history_2020_2022_2024,
  polls:polling,odds,presidential:docs.presidential_2024_by_2026_district_staging
 };
 const prepared=engine.prepare(source,{senatePriorMode:'current_2026'});
 check('model source readiness and all race coverage',()=>{
  assert.equal(prepared.senate.length,35);
  assert.equal(prepared.house.length,435);
  assert.equal(prepared.senate_prior_mode,'current_2026');
  assert.equal(prepared.senate_current_context.model_revision,'late_2026_depth_aware_special_v5');
  assert.equal(prepared.generated_from_sources.model_polling_at,polling.generated_at);
  assert(prepared.senate.find(x=>x.code==='MS-SEN'));
  assert(prepared.senate.find(x=>x.code==='OH-SEN'));
  assert(prepared.senate.find(x=>x.code==='IA-SEN'));
 });
 // Use the SAME number of draws and seed as the browser's headline
 // forecast. A 1,200-draw smoke forecast can otherwise differ by ~1 pp
 // purely from sampling and make a correct production number look stale.
 const sampleCount=3000;
 const result=engine.simulate(prepared,{samples:sampleCount,seed:20261103});
 check('live same-draw race, chamber and Four Endings coherence',()=>{
  assert.equal(result.samples,sampleCount);
  assert.equal(result.race_probability_method,'SAME_CORRELATED_DRAWS_AS_CHAMBER_CONTROL');
  const keys=['blue_tsunami','blue_wave','shrug','red_dawn'];
  assert.equal(Object.keys(result.probabilities).length,4);
  assert.equal(keys.reduce((n,k)=>n+result.counts[k],0),sampleCount);
  assert(Math.abs(keys.reduce((n,k)=>n+result.probabilities[k],0)-100)<.12);
  assert(Math.abs(result.blue_both_including_tsunami-
   result.probabilities.blue_wave-result.probabilities.blue_tsunami)<.03);
  assert.equal(result.race_probabilities.length,
   prepared.house.length+prepared.senate.length+prepared.governors.length);
  for(const x of result.race_probabilities){
   assert(Math.abs(x.dem_beats_rep_pct+x.rep_beats_dem_pct-100)<.02,x.race_code);
   assert(Number.isFinite(x.sigma_points)&&x.sigma_points>0);
  }
  for(const [key] of byEstimate){
   const [office,race_code]=key.split('|');
   assert(result.race_probabilities.some(x=>x.office===office&&x.race_code===race_code),
    'Missing same-draw probability '+key);
  }
 });
 // Diagnostic lineage across BOTH odds engines: select an eligible,
 // currently published Senate poll. A particular named 2026 survey must
 // NOT be required to survive the source's rolling results window.
 const senateSourceByCode=new Map(primary.races.map(x=>[x.race_code,x]));
 const traceCode=['IA-SEN',...polling.senate_all.map(x=>x.race_code)].find(code=>
  Boolean(senateSourceByCode.has(code)&&byOdds.has('senate|'+code)&&
   polling.senate_all.some(x=>x.race_code===code&&
    ['single_poll','multi_poll'].includes(x.status))&&
   prepared.senate.some(x=>x.code===code&&x.polled)));
 assert(traceCode,'No qualifying current Senate source/mean/model race can be audited');
 const traceRaw=senateSourceByCode.get(traceCode);
 const tracePoll=polling.senate_all.find(x=>x.race_code===traceCode);
 const traceStandalone=byOdds.get('senate|'+traceCode);
 const traceJoint=result.race_probabilities.find(x=>
  x.office==='senate'&&x.race_code===traceCode);
 const traceBasis=prepared.senate.find(x=>x.code===traceCode);
 check('current Senate poll-to-odds and same-draw provenance',()=>{
  assert(traceRaw&&tracePoll&&traceStandalone&&traceJoint&&traceBasis);
  assert(Array.isArray(traceRaw.polls)&&traceRaw.polls.length>0);
  assert.equal(traceStandalone.dem_minus_rep,tracePoll.dem_minus_rep);
  assert.equal(traceStandalone.latest_poll_end,tracePoll.latest_poll_end);
  assert(Array.isArray(tracePoll.pollsters)&&tracePoll.pollsters.length>0,
   'Included current pollster selection must have source identity');
  assert(traceBasis.polled&&Number.isFinite(traceBasis.poll_weight));
  assert(traceJoint.simulated_dem_wins>=0&&
   traceJoint.simulated_dem_wins<=result.samples);
  assert(Math.abs(traceJoint.dem_beats_rep_pct-
    100*traceJoint.simulated_dem_wins/result.samples)<.011,
   'Live race odds must derive from the correlated model, not a stale source');
  assert(html.includes('Older standalone poll-only calculation (NOT the live forecast)'),
   'Dashboard must distinguish the standalone poll-only calculation from the forecast');
 });
 const iaTrace={
  race_code:traceCode,
  latest_source_poll:tracePoll.latest_poll_end,
  polling_snapshot:polling.generated_at,
  weighted_polling_margin_points:tracePoll.dem_minus_rep,
  source_pollster_count:tracePoll.pollsters.length,
  standalone_poll_only_dem_pct:traceStandalone.dem_beats_rep_pct,
  live_joint_correlated_dem_pct:traceJoint.dem_beats_rep_pct,
  modeled_margin_points:traceJoint.model_dem_margin_points,
  live_joint_sigma_points:traceJoint.sigma_points,
  simulation_samples:result.samples
 };
 console.log(JSON.stringify({status:'PRODUCTION_DASHBOARD_SMOKE_PASSED',
  mode:remote?'deployed_github_pages':'repository_files',
  deployed_index_matches_checkout:deployedIndexMatchesCurrentMain,
  checks,source_at:polling.generated_at,primary_races:primary.races.length,
  modeled_poll_races:byEstimate.size,simulated_total:result.race_probabilities.length,
  four_endings:result.probabilities,iowa_forecast_lineage:iaTrace,
  news_at:briefing.updated_at,news_stories:briefing.updates.length,
  integrity_news_stories:briefing.security.length,
  security_leads_at:queue.updated_at,security_leads:queue.items.length,
  curated_incident_review_at:impact.updated_at,curated_incidents:impact.incidents.length,
  site:remote?site:null},null,2));
}
main().catch(e=>{console.error('PRODUCTION DASHBOARD SMOKE FAILED',e.stack||e);process.exitCode=1});
