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
const root=path.resolve(__dirname,'..');
const remote=process.argv.includes('--remote');
assert(!(remote&&process.argv.includes('--local')),'Select only one source mode');
const site=(process.env.DASHBOARD_SITE_URL||
 'https://jmon18-rgb.github.io/Election-Command-Center/').replace(/\/?$/,'/');
const checks=[];
function check(name,fn){fn();checks.push(name)}
async function load(file){
 if(!remote)return readFileSync(path.join(root,file.replace(/^\.\//,'')),'utf8');
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
 check('real index and live feature slots',()=>{
  for(const id of ['jointHomeCards','jointNightCards','modelBoard','missouriHouseWatch',
    'senateTideRaces','enRaceList','newPolls','wireResults']){
   assert(html.includes('id="'+id+'"'),'Missing interactive site slot '+id);
  }
  assert(html.includes('function refreshLivePollSnapshots()'));
  assert(html.includes('renderMissouriHouseWatch()'));
  assert(html.includes('setInterval(()=>{void refreshLivePollSnapshots()},2*60*1000)'));
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
 check('Ohio, Iowa and Missouri known race contracts',()=>{
  const ohio=primary.races.find(x=>x.race_code==='OH-SEN');
  const iowa=primary.races.find(x=>x.race_code==='IA-SEN');
  const mo=polling.house.find(x=>x.race_code==='MO-02');
  assert(ohio&&iowa&&mo,'Key 2026 state race missing');
  assert(ohio.polls.some(x=>/Marist/i.test(x.pollster)&&x.dem_name==='Sherrod Brown'));
  assert(iowa.polls.some(x=>/Marist/i.test(x.pollster)&&x.dem_name==='Josh Turek'));
  assert(byOdds.has('house|MO-02'),'Missouri homepage House odds missing');
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
  assert(prepared.house.find(x=>x.code==='MO-02'));
  assert(prepared.senate.find(x=>x.code==='OH-SEN'));
  assert(prepared.senate.find(x=>x.code==='IA-SEN'));
 });
 const sampleCount=1200;
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
 console.log(JSON.stringify({status:'PRODUCTION_DASHBOARD_SMOKE_PASSED',
  mode:remote?'deployed_github_pages':'repository_files',
  checks,source_at:polling.generated_at,primary_races:primary.races.length,
  modeled_poll_races:byEstimate.size,simulated_total:result.race_probabilities.length,
  four_endings:result.probabilities,site:remote?site:null},null,2));
}
main().catch(e=>{console.error('PRODUCTION DASHBOARD SMOKE FAILED',e.stack||e);process.exitCode=1});
