#!/usr/bin/env node
// End-to-end-ish DOM smoke tests against the ACTUAL index.html and data JSON.
// Run with: npm install --no-save --no-package-lock jsdom@26.1.0 && node scripts/test_dashboard_runtime.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const ROOT=path.resolve(__dirname,'..');
const read=(f)=>fs.readFileSync(path.join(ROOT,f),'utf8');
const json=(f)=>JSON.parse(read(f));
const model=json('data/polling_estimates.json');
const primary=json('data/polls.json');
const recent=json('data/pollresults_recent.json');
const history=json('data/model_history.json');
const html=read('index.html');
const mobileHeroCSS=html.match(/\/\* Preserve the full surfer photo on narrow screens\.[\s\S]*?\*\/\s*@media\(max-width:620px\)\{[\s\S]*?background-repeat:no-repeat;/)?.[0];
assert(mobileHeroCSS,'Mobile portrait hero should explicitly preserve surfer-image framing');
assert.match(mobileHeroCSS,/background-size:100% 100%,100% auto,cover;/,
 'Surfer photo must fit full width instead of horizontally cropping a face with cover');
assert.match(mobileHeroCSS,/background-position:center,center top,center;/,
 'Keep the surfer image anchored at the top while copy remains at the bottom');

const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
assert.equal(scripts.length,1,'Expected exactly one live inline application script');
const errors=[];
const virtualConsole=new VirtualConsole();
virtualConsole.on('jsdomError',(err)=>errors.push(String(err)));
const dom=new JSDOM(html,{url:'https://election-command-center.local/',runScripts:'outside-only',
  pretendToBeVisual:true,virtualConsole});
const w=dom.window;
w.scrollTo=()=>{};
w.Element.prototype.scrollIntoView=function(){};
w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
const fixtures={
 'polling_estimates.json':model,'polls.json':primary,
 'pollresults_recent.json':recent,'model_history.json':history,
 'congress_scenarios.json':json('data/congress_scenarios.json'),
 'house_history_2024_staging.json':json('data/house_history_2024_staging.json')
};
for(const file of ['briefing.json','integrity_impact.json','seat_universe.json','house_geography_bridge.json','house_two_cycle_context.json']){
 const name='data/'+file;
 if(fs.existsSync(path.join(ROOT,name)))fixtures[file]=json(name);
}
w.fetch=async (url)=>{
 const name=String(url).split('?')[0].split('/').pop();
 if(!(name in fixtures))return {ok:false,status:404,json:async()=>({})};
 return {ok:true,status:200,json:async()=>fixtures[name]};
};
w.console.error=(...parts)=>errors.push(parts.map(String).join(' '));
function get(selector){const el=w.document.querySelector(selector);assert(el,'Missing '+selector);return el}
async function settle(){
 for(let n=0;n<60;n++){
  await new Promise(resolve=>setTimeout(resolve,20));
  if(get('#modelBoard').querySelectorAll('.model-race-row').length&&
      get('#scenarioBands').querySelectorAll('.scenario-tile').length===4&&
      get('#newPolls').querySelectorAll('.item').length)return;
 }
 throw Error('Timed out waiting for model and dynamic section rendering');
}
(async()=>{
 w.eval(scripts[0]);
 await settle();
 // Distinguish observed historical election variation from a calibrated
 // outcome forecast. Audit exactly the 191 map-comparable party-vote seats.
 const researchDrawer=get('.model-research-drawer');
 assert(!researchDrawer.open,'Historical research must be collapsed by default');
 assert(researchDrawer.querySelector('#senateBacktestSummary'),
   'Historical research must still exist inside the drawer');
 assert(!researchDrawer.contains(get('#modelBoard')),
   'Current 2026 polling race board must remain visible without opening the research drawer');
 researchDrawer.open=true;
 assert.equal(researchDrawer.open,true);
 researchDrawer.open=false;
 const twoCycle=json('data/house_two_cycle_context.json');
 assert.equal(twoCycle.coverage.districts_with_two_historical_major_party_shares,191);
 const points=w.eval('historicalHouseSwingSample('+JSON.stringify(twoCycle)+')');
 assert.equal(points.length,191,'Only directly comparable 2022/24 House races');
 assert(points.every(Number.isFinite));
 assert.equal(points[0]<=points.at(-1),true,'Sorted historical shifts');
 assert(twoCycle.rows.some(x=>x.race_code_2026==='TX-01'&&!x.can_compare_historic_two_party_votes),
  'Changed-map Texas seat must be excluded');
 w.eval('renderHouseHistoricalSwing('+JSON.stringify(twoCycle)+')');
 assert.match(get('#houseSwingSummary').textContent,/191 \/ 435/);
 assert.match(get('#houseSwingNote').textContent,/NOT a calibrated polling-error distribution/);
 const bins=[...get('#houseSwingDistribution').querySelectorAll('.house-history-bin')];
 assert.equal(bins.length,8);
 assert.equal(bins.reduce((n,x)=>n+Number(x.querySelector('strong').textContent),0),191,
  'Every eligible district must appear exactly once in the historical distribution');
 const corruptTwoCycle=structuredClone(twoCycle);
 const eligible=corruptTwoCycle.rows.find(x=>x.can_compare_historic_two_party_votes);
 eligible.geography_comparable_across_all_three_elections=false;
 assert.equal(w.eval('historicalHouseSwingSample('+JSON.stringify(corruptTwoCycle)+')'),null,
  'Data with an unmapped district may not enter model research');
 // Historical Senate polling study is a REAL error diagnostic, never an
 // election-odds model. Exercise year controls and actual source limitations.
 const studyRow=(year,state,error)=>({
   cycle:year,state,label:state+' · Senate',pollster_count:3,
   actual_two_party_margin:2.0,cutoff_is_fieldwork_only:true,
   methods:{
     recency21:{predicted_two_party_margin:2+error,error},
     equal_firm:{predicted_two_party_margin:2+error*.8,error:error*.8}
   }
 });
 const study={
   schema_version:'historical-poll-backtest-v1',
   status:'retrospective_poll_research_not_calibrated_forecast',
   is_forecast:false,can_calibrate_2026_win_probabilities:false,
   poll_source_first_publication_dates_available:false,
   outcome_eligible_races:16,cutoff_days_before_election:7,
   records:[studyRow(2020,'AZ',3),studyRow(2022,'PA',-5),studyRow(2024,'WI',2)]
 };
 w.eval('setHistoricalSenatePollStudy('+JSON.stringify(study)+')');
 assert.match(get('#senateBacktestSummary').textContent,/3 \/ 16/);
 assert.equal(get('#senateBacktestRaces').querySelectorAll('.en-activity-item').length,3);
 assert.match(get('#senateBacktestRaces').querySelector('.en-activity-item strong').textContent,/PA.*2022/);
 assert.match(get('#senateBacktestNote').textContent,/NOT leakage-free/);
 assert.match(get('#senateBacktestNote').textContent,/NOT a backtest of live JackStradamus/);
 const filter2024=get('#senateBacktestTabs [data-hist-year="2024"]');filter2024.click();
 assert.equal(filter2024.getAttribute('aria-pressed'),'true');
 assert.equal(get('#senateBacktestRaces').querySelectorAll('.en-activity-item').length,1);
 assert.match(get('#senateBacktestRaces').textContent,/WI/);
 get('#senateBacktestTabs [data-hist-year="all"]').click();
 assert.equal(get('#senateBacktestRaces').querySelectorAll('.en-activity-item').length,3);
 w.eval('setHistoricalSenatePollStudy(null)');
 assert.match(get('#senateBacktestSummary').textContent,/awaiting source verification/);
 // Actual 42-race study is the contract for the year-held-out UI. Use
 // externally sourced historical errors, not synthetic claims of model odds.
 const trueStudy=json('data/historical_senate_poll_backtest.json');
 assert.equal(trueStudy.races_evaluated,42);
 const historicalYears=[2020,2022,2024];
 const cycleScores={};
 const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
 const mae=a=>Math.round(mean(a.map(Math.abs))*1000)/1000;
 const byYearValues=Object.fromEntries(historicalYears.map(year=>[
   year,trueStudy.records.filter(x=>x.cycle===year).map(x=>x.methods.recency21.error)
 ]));
 for(const year of historicalYears){
   const train=historicalYears.filter(y=>y!==year);
   const learned=mean(train.map(y=>mean(byYearValues[y])));
   const errors=byYearValues[year],methods={};
   for(const [key,mult] of [['uncorrected',0],['half_prior_bias',.5],['full_prior_bias',1]]){
     methods[key]={mae_points:mae(errors.map(e=>e-mult*learned))};
   }
   cycleScores[year]={
     test_cycle:year,test_races:errors.length,training_cycles:train,
     fixed_training_bias_points:learned,methods
   };
 }
 const holdoutStudy={
   schema_version:'senate-bias-holdout-v1',
   status:'retrospective_leave_election_year_out_research_only',
   is_forecast:false,is_as_of_leakage_free:false,
   is_statistically_calibrated_for_2026:false,
   permitted_to_change_live_2026_polling_model:false,
   training_and_test_years_never_overlap:true,
   source_race_count:trueStudy.records.length,
   all_heldout_races:{uncorrected:{races:42,mae_points:4.420},
     half_prior_bias:{mae_points:4.159},full_prior_bias:{mae_points:4.284}},
   by_test_year:cycleScores
 };
 w.eval('setHistoricalSenatePollStudy('+JSON.stringify(trueStudy)+')');
 w.eval('setSenateBiasHoldoutData('+JSON.stringify(holdoutStudy)+')');
 assert.match(get('#senateBiasSummary').textContent,/42-race error check/);
 assert.match(get('#senateBiasSummary').textContent,/4.42 to 4.28/);
 const yearRows=[...get('#senateBiasRows').querySelectorAll('tr')];
 assert.equal(yearRows.length,3,'One out-of-election-year comparison per cycle');
 assert.match(yearRows[1].textContent,/2022/);
 assert(yearRows[1].textContent.includes('5.9'),'A full prior over-correction makes 2022 worse');
 assert.match(get('#senateBiasNote').textContent,/do NOT justify applying either correction to 2026/);
 const invalidHoldout=structuredClone(holdoutStudy);
 invalidHoldout.by_test_year['2022'].training_cycles=[2020,2022];
 w.eval('setSenateBiasHoldoutData('+JSON.stringify(invalidHoldout)+')');
 assert.match(get('#senateBiasSummary').textContent,/awaiting source-matched verification/,
    'Future-year leakage must fail closed');
 assert.equal(get('#senateBiasRows').querySelectorAll('tr').length,0);
 w.eval('setSenateBiasHoldoutData(null)');
 w.eval('setHistoricalSenatePollStudy(null)');
 // Verify that 2026 evidence triage is genuinely about polling input
 // uncertainty, not a past partisan-bias proxy or an invented win interval.
 const evidenceSenate=w.eval('modelEvidenceWatchItems('+JSON.stringify(model)+',"senate")');
 assert(evidenceSenate.length>=2,'Actual 2026 Senate sources should produce quality checks');
 assert(evidenceSenate.every(x=>x.scope==='senate'&&x.race_code.endsWith('-SEN')));
 assert(evidenceSenate.some(x=>x.race_code==='ID-SEN'&&x.signal==='Weighting changes the lead'),
  'Large weighting sensitivity must surface with exact Senate office');
 assert(evidenceSenate.some(x=>x.signal==='No independent confirmation'),
  'No independently sourced current Senate poll must be clearly signaled');
 assert(evidenceSenate.every(x=>Math.abs(x.margin)<=12));
 assert(evidenceSenate.every(x=>!/[0-9]+(?:\\.[0-9]+)?% chance/i.test(x.reason)),
  'Evidence review may not invent numerical victory probabilities');
 const evidenceHouse=w.eval('modelEvidenceWatchItems('+JSON.stringify(model)+',"house")');
 assert(evidenceHouse.length>=3);
 assert(evidenceHouse.every(x=>x.scope==='house'&&/^[A-Z]{2}-\d{2}$/.test(x.race_code)));
 assert(evidenceHouse.some(x=>x.race_code==='UT-04'&&x.signal==='Weighting changes the lead'));
 const evidenceGov=w.eval('modelEvidenceWatchItems('+JSON.stringify(model)+',"governor")');
 assert(evidenceGov.length>=2);
 assert(evidenceGov.every(x=>x.scope==='governor'&&x.race_code.endsWith('-GOV')));
 assert.equal(w.eval('modelEvidenceWatchItems({is_election_forecast:true,senate_all:'+JSON.stringify(model.senate_all)+'},"senate")').length,0);
 const signalSynthetic={is_election_forecast:false,senate_all:[
   {race_code:'TX-SEN',status:'multi_poll',dem_minus_rep:1.2,state_name:'Texas',
    independent_pollsters:0,partisan_pollsters:2,contributing_pollsters:2,
    latest_poll_end:'2026-10-10',poll_diagnostics:{latest_poll_age_days:3,
     model_sensitivity:{alternative_margin_min:1,alternative_margin_max:2}}},
   {race_code:'ME-SEN',status:'multi_poll',dem_minus_rep:2,state_name:'Maine',
    independent_pollsters:1,partisan_pollsters:1,contributing_pollsters:2,
    latest_poll_end:'2026-10-11',poll_diagnostics:{latest_poll_age_days:2,
     model_sensitivity:{alternative_margin_min:-3,alternative_margin_max:5,
      independent_only_margin:-3}}}
 ]};
 const syntheticWatch=w.eval('modelEvidenceWatchItems('+JSON.stringify(signalSynthetic)+',"senate")');
 assert.equal(syntheticWatch.length,2);
 assert.equal(syntheticWatch[0].race_code,'ME-SEN');
 assert.equal(syntheticWatch[0].signal,'Weighting changes the lead');
 assert.equal(syntheticWatch[1].signal,'No independent confirmation');
 w.eval("modelMode='senate';renderModelEvidenceWatch("+JSON.stringify(signalSynthetic)+")");
 assert.equal(get('#modelEvidenceList').querySelectorAll('.model-evidence-entry').length,2);
 assert.match(get('#modelEvidenceList').textContent,/Maine · ME-SEN/);
 assert.match(get('#modelEvidenceList').textContent,/Texas · TX-SEN/);
 assert.match(get('#modelEvidenceNote').textContent,/NOT a ranking of win probability/);
 // Click a real 2026 office-specific evidence item; race selector, model
 // detail and location hash must follow rather than showing a different Texas office.
 get('[data-model-scope="senate"]').click();
 const idEntry=[...get('#modelEvidenceList').querySelectorAll('button')].find(x=>
   x.textContent.includes('ID-SEN'));
 assert(idEntry,'The evidence list must offer the real published ID-SEN result');
 idEntry.click();
 assert.equal(get('#modelDetailEyebrow').textContent,'IDAHO · SENATE');
 assert.match(w.location.hash,/model\/senate\/ID-SEN/);
 get('[data-model-scope="governor"]').click();
 assert([...get('#modelEvidenceList').querySelectorAll('button')].every(b=>
   b.getAttribute('aria-label').includes('governor')));
 get('[data-model-scope="senate"]').click();
 // Poll Wire is a real searchable, source-attributed full-feed explorer,
 // not just the top ten survey postings shown on the Daily Brief.
 const wireTab=get('.tab[data-page="wire"]');
 wireTab.click();
 assert(get('#wire').classList.contains('active'));
 assert(get('#wireCount').textContent.includes('indexed observation'));
 const wireWindow=get('#wireWindow');
 wireWindow.value='all';wireWindow.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert(get('#wireCount').textContent.includes('available'));
 let wireCards=[...get('#wireResults').querySelectorAll('.wire-entry')];
 assert.equal(wireCards.length,24,'Wire must paginate, not render the entire source archive');
 assert(!get('#wireMore').hidden,'Wire must show a working pagination control');
 get('#wireMore').click();
 assert.equal(get('#wireResults').querySelectorAll('.wire-entry').length,48);
 const sourceAnchor=wireCards[0].querySelector('a[href]');
 assert(sourceAnchor,'A displayed poll needs its original source link');
 assert.match(sourceAnchor.href,/^https?:/);
 assert.match(sourceAnchor.rel,/noopener/);
 assert.match(wireCards[0].textContent,/Source indexed/);
 assert.match(wireCards[0].textContent,/Fieldwork/);
 assert.match(wireCards[0].textContent,/timezone unreported/);
 // Every index record retains its own candidate matchup and question
 // even when several questions share the survey poll ID.
 const wireIdentity=w.eval('wireIdentity('+JSON.stringify(recent.observations[0])+')');
 const altered={...recent.observations[0],question_id:'distinct-ballot-question'};
 assert.notEqual(wireIdentity,w.eval('wireIdentity('+JSON.stringify(altered)+')'));
 // The model filter must use exact poll matching, not infer that
 // an indexed poll is included just because it shares a race code.
 const indexedOnly=recent.observations.find(p=>
   !primary.races.find(r=>r.race_code===p.race_code)?.polls.some(q=>
     q.poll_id===p.poll_id&&q.field_end===p.field_end&&
     q.dem_name===p.dem_name&&q.rep_name===p.rep_name&&
     Math.abs(q.dem-p.dem)<.11&&Math.abs(q.rep-p.rep)<.11));
 assert(indexedOnly,'Test fixture requires at least one unmatched indexed poll');
 assert.equal(w.eval('wireModelStatus('+JSON.stringify(indexedOnly)+').kind'),'index');
 const wireModel=get('#wireModel');
 wireModel.value='included';wireModel.dispatchEvent(new w.Event('change',{bubbles:true}));
 wireCards=[...get('#wireResults').querySelectorAll('.wire-entry')];
 assert(wireCards.length>0,'A source survey should be traceable to the active average');
 for(const card of wireCards){
   assert.match(card.textContent,/Included in current average/);
   const go=card.querySelector('button');
   assert(go,'Included survey must have model drill-down');
 }
 wireCards[0].querySelector('button').click();
 assert(get('#model').classList.contains('active'),'Clicked survey should open its exact model race');
 assert(get('#modelPollRows tr.model-featured-poll'),'Clicked poll was not highlighted');
 // Office, listed sponsor, and search controls must actually change the list.
 wireTab.click();
 wireModel.value='all';wireModel.dispatchEvent(new w.Event('change',{bubbles:true}));
 const wireOffice=get('#wireOffice');wireOffice.value='governor';
 wireOffice.dispatchEvent(new w.Event('change',{bubbles:true}));
 for(const card of get('#wireResults').querySelectorAll('.wire-entry')){
   assert.match(card.querySelector('h3').textContent,/Governor/);
 }
 const searchBox=get('#wireSearch');searchBox.value='ZZ-unlikely-race-code';
 searchBox.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(get('#wireResults').querySelectorAll('.wire-entry').length,0);
 assert.match(get('#wireResults').textContent,/No indexed observations match/);
 searchBox.value='';searchBox.dispatchEvent(new w.Event('input',{bubbles:true}));
 wireOffice.value='all';wireOffice.dispatchEvent(new w.Event('change',{bubbles:true}));
 // Election Night is usable before the 2026 vote: its 2024 archive can
 // rehearse the real reported-count UI without mistaking leaders for calls.
 const archival={
  api:1,year:2024,office:'House',live:false,stale:true,counting:true,final:false,
  as_of:'2026-09-23T17:47:54+00:00',source:'state',
  counts:{races:1,with_precincts:1,reporting:1,not_called:1,called:{}},
  races:{'AZ-01':{leader:'D',called:false,winner:'',pct_in:100,total:200,
    uncontested:false,cands:[
     {n:'Example D',p:'D',v:115,pct:57.5,inc:false,w:false,b:''},
     {n:'Example R',p:'R',v:85,pct:42.5,inc:false,w:false,b:''}
    ]}}
 };
 assert.equal(w.eval('enSourceValid('+JSON.stringify(archival)+',2024,"House")'),true,
  '2024 official-state archival fixture must pass provider contract');
 const badArchive=structuredClone(archival);
 badArchive.races['AZ-01'].cands[0].v=250;
 assert.equal(w.eval('enSourceValid('+JSON.stringify(badArchive)+',2024,"House")'),false,
  'Candidate vote sums cannot exceed race totals');
 badArchive.races['AZ-01'].cands[0].v=115;badArchive.races['AZ-01'].called=true;
 assert.equal(w.eval('enSourceValid('+JSON.stringify(badArchive)+',2024,"House")'),false,
  'State-derived provider cannot inject fabricated race calls');
 assert.equal(w.eval('enSourceValid('+JSON.stringify(archival)+',2024,"Senate")'),false,
  'Wrong office data must never render as House');
 const suspicious2026=structuredClone(archival);suspicious2026.year=2026;
 assert.equal(w.eval('enSourceValid('+JSON.stringify(suspicious2026)+',2026,"House")'),false,
  'Pre-election vote totals must never pass as live 2026 results');
 // The real 2026 adapter issues a direct browser fetch (never through
 // an unauthorized server mirror), honors source coverage, and backs off.
 const empty2026={api:1,year:2026,office:'House',
  live:false,stale:false,counting:false,final:false,as_of:null,
  source:'',counts:{races:0,with_precincts:0,reporting:0,not_called:0,called:{}},races:{}};
 assert.equal(w.eval('enFetchUrl(2026,"House")'),
  'https://openamerica.io/elections/results.json?year=2026&office=House');
 assert.equal(w.eval('enRefreshInterval({live:true},0)'),60000);
 assert.equal(w.eval('enRefreshInterval({counting:true},0)'),900000);
 assert.equal(w.eval('enRefreshInterval({counting:false},0)'),600000);
 assert.equal(w.eval('enRefreshInterval(null,2)'),120000);
 assert.equal(w.eval('enRefreshInterval(null,8)'),600000);
 const originalRemoteFetch=w.fetch;
 const calls=[];
 w.fetch=async(url,options)=>{calls.push({url,options});
  return {ok:true,json:async()=>empty2026};};
 get('#enMode2026').click();
 await w.eval('enLoad(true)');
 const requests=calls.filter(c=>String(c.url).startsWith('https://openamerica.io/elections/results.json'));
 assert(requests.length>=1,'2026 mode must fetch the live state-derived source');
 assert.match(requests[0].url,/openamerica.io\/elections\/results.json\?year=2026&office=House/);
 assert.equal(requests[0].options.mode,'cors');
 assert.equal(requests[0].options.credentials,'omit');
 assert.equal(get('#enRaces').textContent,'0');
 assert.match(get('#enStatus').textContent,/AWAITING FIRST COUNTS|COUNTING NOT LIVE/);
 assert.match(get('#enConnection').textContent,/WAITING FOR VOTES/);
 assert.equal(get('#enCalls').textContent,'Not supplied');
 w.fetch=originalRemoteFetch;
 get('#enMode2024').click();
 await w.eval('enLoad(true)');
 // Real provider-format 2024 rehearsal must use the 2024 endpoint, and
 // display named candidates and precinct data from the unmodified source.
 const stateSelect=get('#enArchiveSource');
 assert.equal(stateSelect.value,'medsl');
 const namedQueries=[];
 const archiveOriginalFetch=w.fetch;
 w.fetch=async(url,opts)=>{
  if(String(url).startsWith('https://openamerica.io/')){
   namedQueries.push(String(url));
   return {ok:true,json:async()=>archival};
  }
  return archiveOriginalFetch(url,opts);
 };
 stateSelect.value='state';
 stateSelect.dispatchEvent(new w.Event('change',{bubbles:true}));
 await w.eval('enLoad(true)');
 assert(namedQueries.some(url=>url.includes('year=2024&office=House')),
   'State rehearsal should load the actual archived provider endpoint');
 assert.equal(get('#enRaces').textContent,'1');
 assert.match(get('#enConnection').textContent,/STATE SOURCE/);
 assert.match(get('#enCandidateList').textContent,/Example D/);
 assert(get('#enDetailSummary').querySelector('.en-report-progress'),
   'Source-native archive exposes 2024 reporting progress');
 assert.match(get('#enArchiveIntro').textContent,/not a timed 2024 replay/);
 w.fetch=archiveOriginalFetch;
 stateSelect.value='medsl';
 stateSelect.dispatchEvent(new w.Event('change',{bubbles:true}));
 await w.eval('enLoad(true)');
 assert.equal(get('#enRaces').textContent,'435');
 const nightTab=get('.tab[data-page="electionNight"]');
 // Avoid network in deterministic tests; the public API is integration-tested
 // separately on the real site and this suite validates rendering/contracts.
 w.eval('enModeYear=2024;enOffice="House";enAcceptSource('+JSON.stringify(archival)+')');
 assert.match(get('#enStatus').textContent,/2024 ARCHIVE/);
 assert.equal(get('#enDLeads').textContent,'1');
 assert.equal(get('#enRLeads').textContent,'0');
 assert.equal(get('#enCalls').textContent,'Not supplied');
 assert.match(get('#enDetailSummary').textContent,/NOT a race call/);
 assert.equal(get('#enActivityBox').hidden,true,'No live update timeline in a 2024 archive');
 // The entire 435-district 2024 House archive must load through the real
 // same-origin fetch path. No cross-origin election-results request is needed.
 await w.eval('enLoad(true)');
 assert.equal(get('#enRaces').textContent,'435','2024 House should have nationwide coverage');
 assert.match(get('#enStatus').textContent,/2024 HOUSE ARCHIVE/);
 assert.match(get('#enStatus').textContent,/44 districts missing one major party/);
 assert.equal(get('#enRaceList').querySelectorAll('button.en-race-entry').length,121,
  'Archive begins with 120 districts and a Show more button');
 get('#enRaceList button.en-race-entry:last-child').click();
 assert.equal(get('#enRaceList').querySelectorAll('button.en-race-entry').length,241);
 const chooseArchiveRace=key=>{
   const row=[...get('#enRaceList').querySelectorAll('button.en-race-entry')].find(b=>
     b.querySelector('strong')?.textContent===key);
   assert(row,'Missing 2024 House row '+key);
   row.click();
 };
 chooseArchiveRace('AK-01');
 assert.match(get('#enDetailMeta').textContent,/MIT Election Data and Science Lab/);
 assert.match(get('#enDetailSummary').textContent,/recorded party votes/);
 assert.match(get('#enDetailMeta a[href]').href,/dataverse.harvard.edu/);
 assert.match(get('#enCandidateList').textContent,/Democratic party total/);
 assert(!get('#enDetailSummary').querySelector('.en-report-progress'),
  'Historical party totals do not contain precinct progress');
 chooseArchiveRace('AL-03');
 assert.match(get('#enDetailMeta').textContent,/no recorded candidate votes/);
 const rawArchive=json('data/house_history_2024_staging.json');
 const incompleteArchive=structuredClone(rawArchive);
 incompleteArchive.records=incompleteArchive.records.slice(1);
 assert.throws(()=>w.eval('enBuildHouseArchive('+JSON.stringify(incompleteArchive)+')'),
  /coverage\/provenance|provenance\/coverage|historical/i,
  'Fail closed on incomplete archive');
 const adulteratedArchive=structuredClone(rawArchive);
 adulteratedArchive.records[0].recorded_dem_votes=-100;
 assert.throws(()=>w.eval('enBuildHouseArchive('+JSON.stringify(adulteratedArchive)+')'),
  /Invalid historical party-vote totals/);

 const early=structuredClone(archival),late=structuredClone(archival);
 early.year=late.year=2026;early.as_of='2026-11-04T02:00:00Z';late.as_of='2026-11-04T02:05:00Z';
 late.races['AZ-01'].total=180;late.races['AZ-01'].cands[0].v=80;
 late.races['AZ-01'].cands[1].v=100;
 const movement=w.eval('enCompareSnapshots('+JSON.stringify(early)+','+JSON.stringify(late)+')');
 assert.equal(movement.length,1);
 assert.equal(movement[0].delta,-20);
 assert.equal(movement[0].leaderChanged,true);
 assert.match(JSON.stringify(movement),/AZ-01/);
 // A new race's initial batch must enter the update feed; a candidate
 // correction without changed total cannot be silently discarded.
 const preCount={...early,races:{},counts:{races:0}};
 const arrival=w.eval('enCompareSnapshots('+JSON.stringify(preCount)+','+JSON.stringify(late)+')');
 assert.equal(arrival.length,1);
 assert.equal(arrival[0].newRace,true);
 assert.equal(arrival[0].delta,180);
 assert.equal(arrival[0].current,180);
 const sameTotal=structuredClone(early);
 sameTotal.as_of='2026-11-04T02:08:00Z';
 sameTotal.races['AZ-01'].cands[0].v=65;
 sameTotal.races['AZ-01'].cands[1].v=135;
 const corrected=w.eval('enCompareSnapshots('+JSON.stringify(early)+','+JSON.stringify(sameTotal)+')');
 assert.equal(corrected.length,1);
 assert.equal(corrected[0].delta,0);
 assert.equal(corrected[0].candidateChanged,true);
 assert.equal(corrected[0].leaderChanged,true);
 const identical=w.eval('enCompareSnapshots('+JSON.stringify(early)+','+JSON.stringify({...early,as_of:'2026-11-04T02:10:00Z'})+')');
 assert.equal(identical.length,0,'A new timestamp by itself is not a vote movement');

 // A connection outage must preserve previously verified results, rather than
 // quietly replacing them with zeros or JackStradamus probabilities.
 const savedFetch=w.fetch;
 w.fetch=async()=>{throw Error('Simulated archive transport outage')};
 await w.eval('enLoad(true)');
 w.fetch=savedFetch;
 assert.match(get('#enStatus').textContent,/LAST VERIFIED RESULTS RETAINED/);
 assert.equal(get('#enRaces').textContent,'435','Outage must preserve the 435 verified historical records');
 assert.match(get('#enStatus').textContent,/Simulated archive transport outage/);
 // Optional 2024 Senate archive is only enabled by a verified, complete
 // historical research file. Never turn a synthetic fixture into production.
 const states='AK AL AR AZ CA CO CT DE FL GA HI IA ID IL IN KS KY LA MA MD ME MI MN MO MS MT NC ND NE NH NJ NM NV NY'.split(' ');
 const senateRecords=[];
 for(const year of [2020,2022,2024]){
  for(const state of states){
   senateRecords.push({
    election_year:year,state,election_type:'regular',
    eligible_as_2026_forecast_prior:false,historical_election_result_not_poll:true,
    recorded_dem_votes:1000,recorded_rep_votes:1200,recorded_other_votes:200,
    recorded_total_candidate_votes:2400,recorded_two_party_vote_total:2200,
    missing_major_party_vote:false
   });
  }
  senateRecords.push({
    election_year:year,state:year===2020?'GA':year===2022?'OK':'NE',
    election_type:'special',eligible_as_2026_forecast_prior:false,historical_election_result_not_poll:true,
    recorded_dem_votes:year===2024?0:900,recorded_rep_votes:1100,recorded_other_votes:300,
    recorded_total_candidate_votes:year===2024?1400:2300,
    recorded_two_party_vote_total:year===2024?1100:2000,
    missing_major_party_vote:year===2024
  });
 }
 const senateSynthetic={
  status:'historical_senate_results_research_only',schema_version:'1.0',
  source_doi:'doi:10.7910/DVN/PEJ5QU',source_license:'CC0 1.0',
  source_url:'https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/PEJ5QU',
  imported_at:'2026-10-13T12:00:00Z',
  is_election_forecast:false,can_predict_2026_senate:false,
  contest_count:senateRecords.length,contests_by_year:{'2020':35,'2022':35,'2024':35},
  contest_records:senateRecords
 };
 const senateArchive=w.eval('enBuildSenateArchive('+JSON.stringify(senateSynthetic)+')');
 assert(senateArchive,'2024 historical Senate archive should be generated from validated party votes');
 assert.equal(Object.keys(senateArchive.races).length,35);
 assert(senateArchive.races.NE,'Regular Nebraska historical election must survive');
 assert(senateArchive.races['NE-special'],'Special Nebraska historical election must remain separate');
 assert.equal(senateArchive.races['NE-special'].cands.find(x=>x.p==='D').v,0);
 assert(senateArchive.races['NE-special'].cands.some(x=>x.p==='O'));
 assert.equal(w.eval('enSourceValid('+JSON.stringify(senateArchive)+',2024,"Senate")'),true);
 const corruptSenate=structuredClone(senateSynthetic);
 corruptSenate.contest_records.find(r=>r.election_year===2024).recorded_dem_votes=-1;
 assert.equal(w.eval('enBuildSenateArchive('+JSON.stringify(corruptSenate)+')'),null,
  'Never show historical Senate archive with corrupt votes');
 const missingSenate=structuredClone(senateSynthetic);
 missingSenate.contest_records=missingSenate.contest_records.filter(r=>!(r.election_year===2024&&r.state==='GA'));
 missingSenate.contest_count--;
 assert.equal(w.eval('enBuildSenateArchive('+JSON.stringify(missingSenate)+')'),null,
  'Never accept incomplete historical Senate cycle');
 fixtures['senate_history_2020_2022_2024.json']=senateSynthetic;
 get('#enOfficeSenate').click();
 await w.eval('enLoad(true)');
 assert.equal(get('#enRaces').textContent,'35');
 assert.match(get('#enStatus').textContent,/2024 SENATE ARCHIVE/);
 assert(get('#enRaceList').textContent.includes('NE-special'));
 assert.match(get('#enDetailMeta').textContent,/U.S. Senate candidate-party returns/);
 // Returning to 2024 House must not leak state-level Senate results.
 get('#enOfficeHouse').click();
 await w.eval('enLoad(true)');
 assert.equal(get('#enRaces').textContent,'435');
 // Canonical in-app identifiers must be visible. TX Senate and TX governor
 // cannot both be ambiguous "Texas" cards any longer.
 const [txSen,txGov]=['senate','governor'].map(type=>
   model[type==='senate'?'senate_all':'governor'].find(x=>x.race_code==='TX-'+(type==='senate'?'SEN':'GOV')));
 assert(txSen&&txGov,'Both TX Senate and TX governor model averages required');
 const identity=(type,data)=>w.eval('raceIdentity('+JSON.stringify(data)+')');
 assert.match(identity('senate',txSen),/Texas.*Senate/);
 assert.match(identity('governor',txGov),/Texas.*Governor/);
 assert.notEqual(identity('senate',txSen),identity('governor',txGov));


 // Model-roadmap milestone: saved snapshots can make a real timeline but
 // only for the SAME race, candidate matchup, and model version.
 const modelGate=get('#forecastGateList');
 assert(modelGate.querySelectorAll('.item').length>=4,'Show actual model-readiness blockers');
 assert.match(get('#forecastGateStatus').textContent,/NOT CALIBRATED/);
 const fakeSnap=(at,candidate,margin,method='poll-mean-1.4')=>({
   at,method_version:method,races:[{
      race_code:txSen.race_code,race_type:txSen.race_type,
      dem_candidate:candidate,rep_candidate:txSen.rep_candidate,
      dem_minus_rep:margin
   }]
 });
 const goodHistory={snapshots:[
   fakeSnap('2026-10-11T12:00:00Z',txSen.dem_candidate,0.5),
   fakeSnap('2026-10-12T12:00:00Z',txSen.dem_candidate,1.7)
 ]};
 const serie=w.eval('modelHistorySeries('+JSON.stringify(txSen)+','+JSON.stringify(goodHistory)+')');
 assert.equal(serie.length,2);
 assert.equal(serie[1].margin,1.7);
 const mismatch=w.eval('modelHistorySeries('+JSON.stringify(txSen)+','+JSON.stringify({snapshots:[
   fakeSnap('2026-10-11T12:00:00Z',txSen.dem_candidate,0.5),
   fakeSnap('2026-10-12T12:00:00Z','Different D Candidate',2.7),
   fakeSnap('2026-10-13T12:00:00Z',txSen.dem_candidate,3.2,'changed-method')
 ]})+')');
 assert.equal(mismatch.length,1,'Never draw poll changes across candidate or algorithm changes');
 w.eval('setModelHistoryData('+JSON.stringify(goodHistory)+');renderModelTrend('+JSON.stringify(txSen)+')');
 assert(get('#modelTrendChart').querySelector('polyline'),'Real two-snapshot model series must plot');
 assert.match(get('#modelTrendNote').textContent,/actual saved average snapshots/);
 assert.match(get('#modelTrendChange').textContent,/D \+1\.2/);
 w.eval('setModelHistoryData('+JSON.stringify({snapshots:[goodHistory.snapshots[0]]})+')'+
  ';renderModelTrend('+JSON.stringify(txSen)+')');
 assert(!get('#modelTrendChart').querySelector('polyline'),'One snapshot cannot create a fake trend');
 assert.match(get('#modelTrendChange').textContent,/Awaiting longer history/);
 w.eval('setModelHistoryData('+JSON.stringify(history)+')');
 // The same multipurpose Recon survey contains DISTINCT 2026 Senate and
 // Governor ballot questions. Check model inclusion, vote-share match and
 // exact original drilldown selection in BOTH office tabs.
 for(const [office,race] of [['senate',txSen],['governor',txGov]]){
  const p=recent.observations.find(p=>p.race_code===race.race_code&&
    p.pollster.includes('ReconMR')&&p.field_end===race.latest_poll_end);
  assert(p,'Recon poll missing from supplemental '+office+' feed');
  const raw=primary.races.find(x=>x.race_code===race.race_code);
  assert(raw?.polls.some(x=>x.poll_id===p.poll_id&&x.dem_name===p.dem_name&&x.rep_name===p.rep_name),
    'Recon poll missing from primary '+office+' source');
  const code='postedMatchesModelSurvey('+JSON.stringify(p)+','+JSON.stringify(race)+')';
  assert.equal(w.eval(code),true,'Source reconciliation failed in '+office);
  w.eval('navigateInsightToModel({office:'+JSON.stringify(office)+',race:'+
       JSON.stringify(race)+',poll:'+JSON.stringify(p)+'})');
  assert.match(get('#modelDetailTitle').textContent,new RegExp('Texas.*'+(office==='senate'?'Senate':'Governor')));
  const highlighted=get('#modelPollRows tr.model-featured-poll');
  assert.match(highlighted.textContent,/ReconMR/,'Did not select correct '+office+' Recon observation');
  assert.match(get('#modelPollStatus').textContent,/Observations matched|All observations/);
  assert.equal(get('#modelDetailEyebrow').textContent.includes(office.toUpperCase()),true);
  const sourceLink=highlighted.querySelector('a[href]');
  assert(sourceLink,'Recon primary poll source should be clickable in drilldown');
 }
 // A different question or candidate matchup sharing a poll ID MUST be
 // rejected as evidence for the selected race.
 const mistaken=recent.observations.find(p=>p.race_code==='TX-GOV'&&p.pollster.includes('ReconMR'));
 assert.equal(w.eval('postedMatchesModelSurvey('+JSON.stringify(mistaken)+','+
      JSON.stringify(txSen)+')'),false,'Cross-office shared poll ID contaminated race');
 // An older, otherwise valid poll from the SAME firm must be reachable
 // via All recent, but must NOT masquerade as the firm's included newest wave.
 const oldRecon=primary.races.find(x=>x.race_code==='TX-SEN')?.polls.find(
   p=>p.pollster.includes('ReconMR')&&p.field_end<'2026-10-08');
 assert(oldRecon,'Missing older Recon survey fixture for inclusion-vs-source test');
 const oldLink={race_code:'TX-SEN',poll_id:oldRecon.poll_id,
   pollster:oldRecon.pollster,field_end:oldRecon.field_end,
   source_url:oldRecon.source_poll_url||null};
 w.eval('navigateInsightToModel({office:"senate",race:'+JSON.stringify(txSen)+
        ',poll:'+JSON.stringify(oldLink)+'})');
 assert.equal(get('#modelPollAll').getAttribute('aria-pressed'),'true',
   'Excluded historic firm wave should open All recent, not In average');
 const oldRow=get('#modelPollRows tr.model-featured-poll');
 assert(oldRow.classList.contains('excluded'),
   'Previous Recon wave should be highlighted but NOT included in model average');
 // Every visible pulse card needs a race office. No repeated anonymous Texas.
 w.eval('renderRacePulse('+JSON.stringify(model)+')');
 for(const card of get('#racePulse').querySelectorAll('button.pulse-tile')){
  const label=card.querySelector('.pulse-race span')?.textContent||'';
  assert(/Senate|Governor|House|Generic ballot/.test(label),'Insight lacks office: '+label);
 }

 // Force BOTH Texas races into the insight feed simultaneously. This catches
 // collisions where a shared poll ID and the same state hide the office.
 const synthetic={generated_at:model.generated_at,senate_all:[txSen],house:[],
   governor:[txGov],generic_ballot:{status:'insufficient_data'}};
 w.eval('modelHistoryData=null;renderRacePulse('+JSON.stringify(synthetic)+')');
 const texasCards=[...get('#racePulse').querySelectorAll('button.pulse-tile')];
 assert.equal(texasCards.length,2,'Texas Senate and governor should each receive one insight');
 assert(texasCards.some(c=>/Texas.*Senate/.test(c.textContent)));
 assert(texasCards.some(c=>/Texas.*Governor/.test(c.textContent)));
 for(const [office,identifier] of [['senate','Senate'],['governor','Governor']]){
   const card=texasCards.find(c=>c.textContent.includes('Texas · '+identifier));
   assert(card,'Missing clearly identified '+identifier+' Texas insight');
   card.click();
   assert.match(get('#modelDetailTitle').textContent,new RegExp('Texas.*'+identifier));
   const sourceFirm=card.textContent.includes('ReconMR')?'ReconMR':card.textContent.includes('GBAO')?'GBAO':null;
   assert(sourceFirm,'Expected named poll source in '+identifier+' insight');
   assert(get('#modelPollRows tr.model-featured-poll').textContent.includes(sourceFirm),
     'Insight opened a different survey instead of the clicked '+identifier+' '+sourceFirm+' poll');
 }
 // Four Endings must be attributable MODEL probabilities, not sliders or
 // invented split probability for the DDHQ-unpublished Blue Tsunami subset.
 const cards=[...get('#scenarioBands').querySelectorAll('.scenario-tile')];
 assert.equal(cards.length,4);
 const seeded=json('data/congress_scenarios.json');
 assert.equal(seeded.status,'external_model_attributed_not_jackstradamus_probabilities');
 const findCard=name=>cards.find(c=>c.textContent.includes(name));
 for(const [label,key] of [['RED DAWN','red_dawn'],['THE SHRUG','shrug'],['BLUE WAVE','blue_both']]){
   const expected=seeded.display_outcomes[key].pct;
   assert(findCard(label).textContent.includes(expected+'%'),
     label+' should show DDHQ '+expected+'% model-based probability');
 }
 const tsunami=findCard('BLUE TSUNAMI');
 assert(tsunami,'Missing tsunami outcome');
 assert.match(tsunami.textContent,/not separately estimated/i);
 assert(!tsunami.textContent.includes('0%'),'Unreported tsunami probability cannot be shown as 0%');
 // A source outage must not leave a week-old percentage looking current.
 const staleCopy=structuredClone(seeded);
 const past=new Date(Date.now()-10*86400000).toISOString().slice(0,10);
 staleCopy.source_updated_date=past;
 w.eval('setCongressScenarioSnapshot('+JSON.stringify(staleCopy)+')');
 assert.match(get('#scenarioUpdated').textContent,/OUTDATED/);
 assert.match(get('#scenarioCenter').textContent,/Historical forecast/);
 assert(!get('#scenarioBands').textContent.includes('54%'),'Expired probability shown as current');
 const corruptCopy=structuredClone(seeded);
 corruptCopy.raw_joint_outcomes_pct.both_dem=90;
 w.eval('setCongressScenarioSnapshot('+JSON.stringify(corruptCopy)+')');
 assert.match(get('#scenarioBands').textContent,/integrity checks/);
 w.eval('setCongressScenarioSnapshot('+JSON.stringify(seeded)+')');
 assert(!get('#scenarioSimulator').querySelector('input'),'Hypothetical sliders should be removed');
 assert.match(get('#scenarioSimulator').textContent,/DDHQ does not publish/i);
 assert.match(get('#enForecastOdds').textContent,/Both D .*% · Split .*% · Both R .*%/);
 assert.match(get('#enForecastOdds').textContent,/DDHQ 2026-10-13/);
 assert.match(get('.scenario-source-link').href,/decisiondeskhq.com/);
 // Sort all posted polls by full timestamps; no alphabetical field-end tie.
 const posted=recent.observations.filter(p=>p.posted_date>=new Date(Date.now()-14*86400000).toISOString().slice(0,10));
 const topTime=posted.reduce((max,p)=>{
  const t=w.eval('pollPostedStamp('+JSON.stringify(p)+')');
  return t>max?t:max;
 },'');
 assert(topTime,'No recent full timestamp data');
 assert(get('#newPolls').textContent.includes('Source posted'),'Posted date labels disappeared');
 // The outreach context is clearly a dated external rating, not a fourth invented probability.
 const reach=get('#tsunamiReachWatch');
 assert.match(reach.textContent,/South Carolina U.S. Senate/);
 assert.match(reach.textContent,/Darline Graham/);
 assert.match(reach.textContent,/Likely Republican/);
 assert.match(reach.textContent,/not by itself/);
 assert(reach.querySelector('a[href*="cookpolitical.com/senate/race/"]'));
 // Index-poll listing must preserve distinct ballot questions in one race,
 // unlike a poll-id-only dedupe that discards one matchup.
 const sameRace=recent.observations.find(p=>p.race_code==='TX-GOV');
 assert(sameRace,'Need TX governor posting to test shared-survey questions');
 const secondQuestion={...sameRace,question_id:'another-qualifying-question',
   dem_name:'Another named challenger'};
 w.eval('setPostedPollingSnapshot('+JSON.stringify({observations:[sameRace,secondQuestion]})+')');
 assert.equal(get('#newPolls').querySelectorAll('.item').length,2,
  'Two same-poll distinct ballot questions should both display');
 assert.match(get('#changesSince').textContent,/2 source postings/);
 // Personal 2026 watchlist must be storable before Election Day and must
 // never silently turn source coverage gaps into zero-valued race results.
 assert.deepEqual(w.eval('enWatchParse("CA-53")'),null,'2026 California only has 52 voting House seats');
 assert.equal(w.eval('enWatchParse("AK-00").key'),'AK-00','At-large House uses 00');
 assert.equal(w.eval('enWatchParse(" NC-SEN ").office'),'Senate');
 assert.equal(w.eval('enWatchParse("TX-GOV").office'),'Governor');
 assert.equal(w.eval('enWatchParse("NE-SEN-SPECIAL").key'),'NE-special');
 assert.equal(w.eval('enWatchParse("NC-99")'),null);
 w.localStorage.removeItem('bluewaves_election_watch_2026_v1');
 w.eval('enWatched=[];enRenderWatchlist()');
 const watchInput=get('#enWatchInput'),watchForm=get('#enWatchForm');
 for(const race of ['NC-SEN','AZ-01','NH-SEN']){
  watchInput.value=race;
  watchForm.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 }
 assert.equal(get('#enWatchCount').textContent,'3 races');
 const stored=JSON.parse(w.localStorage.getItem('bluewaves_election_watch_2026_v1'));
 assert.equal(stored.length,3);
 assert(stored.some(r=>r.office==='Senate'&&r.key==='NC'));
 assert.match(get('#enWatchItems').textContent,/Outside the 22-state source/,
  'Unsupported state must never be represented as zero counted votes');
 watchInput.value='CA-53';
 watchForm.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(get('#enWatchCount').textContent,'3 races');
 assert.match(get('#enWatchError').textContent,/valid 2026 seat/);
 const originalClock=w.Date.now;
 w.Date.now=()=>Date.parse('2026-11-04T02:40:00Z');
 const counted2026={
  api:1,year:2026,office:'Senate',source:'state',as_of:'2026-11-04T02:30:00Z',
  live:true,stale:false,counting:true,final:false,
  counts:{races:1,with_precincts:1,reporting:0,not_called:1,called:{}},
  races:{NC:{leader:'D',called:false,winner:'',pct_in:42,total:300,
   uncontested:false,cands:[
     {n:'Democratic candidate',p:'D',v:160,pct:53.33,inc:false,w:false,b:''},
     {n:'Republican candidate',p:'R',v:140,pct:46.67,inc:false,w:false,b:''}
   ]}}
 };
 assert.equal(w.eval('enSourceValid('+JSON.stringify(counted2026)+',2026,"Senate")'),true);
 const preWatchFetch=w.fetch;
 w.fetch=async url=>({
  ok:true,json:async()=>
    String(url).includes('office=Senate')?counted2026:empty2026
 });
 get('#enMode2026').click();
 get('#enOfficeSenate').click();
 await w.eval('enLoad(true)');
 w.fetch=preWatchFetch;
 assert.match(get('#enWatchItems').textContent,/NC-SEN/);
 assert.match(get('#enWatchItems').textContent,/300 counted/);
 assert.match(get('#enPinArea').textContent,/Unpin from watchlist/);
 assert.match(get('#enWatchItems').textContent,/Outside the 22-state source/);
 const vanished=structuredClone(counted2026);vanished.races={};vanished.counts.races=0;
 vanished.counting=false;vanished.live=false;
 assert.equal(w.eval('enSnapshotCompatible('+JSON.stringify(counted2026)+','+JSON.stringify(vanished)+')'),false,
  'A transient empty feed must not overwrite the most recent verified reported vote counts');
 const backdated=structuredClone(counted2026);backdated.as_of='2026-11-04T02:01:00Z';
 assert.equal(w.eval('enSnapshotCompatible('+JSON.stringify(counted2026)+','+JSON.stringify(backdated)+')'),false);
 const sameStamp=structuredClone(counted2026);
 sameStamp.races.NC.cands[0].v=150;sameStamp.races.NC.cands[1].v=150;
 const correctedSameTime=w.eval('enCompareSnapshots('+JSON.stringify(counted2026)+','+JSON.stringify(sameStamp)+')');
 assert.equal(correctedSameTime.length,1,
  'The national as_of is not a per-state revision timestamp: detect actual state changes anyway');
 assert.equal(correctedSameTime[0].delta,0);
 assert.equal(correctedSameTime[0].candidateChanged,true);
 const removedRace=w.eval('enCompareSnapshots('+JSON.stringify(counted2026)+','+JSON.stringify(vanished)+')');
 assert.equal(removedRace.length,1);
 assert.equal(removedRace[0].withdrawn,true);
 const fetchBeforeWatch=w.fetch;
 const seenBackground=[];
 w.fetch=async(url)=>{
  seenBackground.push(String(url));
  if(String(url).includes('office=Senate'))
   return {ok:true,json:async()=>counted2026};
  if(String(url).includes('office=House'))
   return {ok:true,json:async()=>empty2026};
  return {ok:false,status:404};
 };
 get('.tab[data-page="electionNight"]').click();
 await w.eval('enRefreshWatchedOffices("House")');
 assert(seenBackground.some(x=>x.includes('office=Senate')));
 assert.match(get('#enWatchItems').textContent,/300 counted/);
 w.fetch=fetchBeforeWatch;
 w.Date.now=originalClock;
 // Clear only synthetic test selections; browser users keep their own pins.
 w.eval('enWatched=[];enRenderWatchlist()');
 w.localStorage.removeItem('bluewaves_election_watch_2026_v1');

 // Supplemental provider is separately identified; never merge civicAPI
 // votes into Open America's national office counts or accept primary races.
 const nhSenateItem={office:'Senate',key:'NH'};
 const nhSenateSearch={
   id:87283,country:'US',province:'NH',municipality:null,district:null,
   type:'US Senate',election_type:'General',election_name:'New Hampshire US Senate',
   election_date:'2026-11-03T05:00:00.000Z',
   candidates:[
    {name:'First candidate',party:'Democratic',votes:0,percent:0,winner:false},
    {name:'Second candidate',party:'Republican',votes:0,percent:0,winner:false}
   ],percent_reporting:0
 };
 const nhSenateDetail={
   ...nhSenateSearch,election_type:'US Senate',last_updated:'2026-11-04T01:30:00Z',
   candidates:[
    {name:'First candidate',party:'Democratic',votes:510,percent:51,winner:false},
    {name:'Second candidate',party:'Republican',votes:490,percent:49,winner:false}
   ],percent_reporting:45
 };
 const civicDoc={count:1,limit:20,offset:0,races:[nhSenateSearch]};
 assert.equal(w.eval('enCivicMatch('+JSON.stringify(nhSenateItem)+','+JSON.stringify(nhSenateSearch)+')'),true);
 assert.equal(w.eval('enCivicSelect('+JSON.stringify(nhSenateItem)+','+JSON.stringify(civicDoc)+')').id,87283);
 const badPrimary={...nhSenateSearch,election_type:'Primary',election_name:'New Hampshire US Senate Primary'};
 assert.equal(w.eval('enCivicMatch('+JSON.stringify(nhSenateItem)+','+JSON.stringify(badPrimary)+')'),false);
 assert.equal(w.eval('enCivicMatch({office:"House",key:"NH-01"},'+JSON.stringify(nhSenateSearch)+')'),false);
 const wrongDistrict={...nhSenateSearch,type:'House of Representatives',district:'NH-02',election_name:'New Hampshire US House 2'};
 assert.equal(w.eval('enCivicMatch({office:"House",key:"NH-01"},'+JSON.stringify(wrongDistrict)+')'),false);
 assert.equal(w.eval('enCivicSelect('+JSON.stringify(nhSenateItem)+','+JSON.stringify({...civicDoc,races:[nhSenateSearch,nhSenateSearch]})+')'),null,
   'Duplicate race identity from a secondary provider must fail closed');
 const oldClock=w.Date.now;
 w.Date.now=()=>Date.parse('2026-11-04T03:00:00Z');
 const rawCivic=w.eval('enCivicValidate('+JSON.stringify(nhSenateItem)+','+
    JSON.stringify(nhSenateSearch)+','+JSON.stringify(nhSenateDetail)+')');
 assert.equal(rawCivic.provider,'civicAPI');
 assert.equal(rawCivic.total,1000);
 assert.equal(rawCivic.called,null);
 const calledDetail=structuredClone(nhSenateDetail);
 calledDetail.candidates[0].winner=true;
 assert.equal(w.eval('enCivicValidate('+JSON.stringify(nhSenateItem)+','+
   JSON.stringify(nhSenateSearch)+','+JSON.stringify(calledDetail)+')').called,'First candidate',
   'Source-originated call is stored as a civicAPI call, not an official certification');
 const badVotes=structuredClone(nhSenateDetail);badVotes.candidates[0].votes=-1;
 assert.equal(w.eval('enCivicValidate('+JSON.stringify(nhSenateItem)+','+
   JSON.stringify(nhSenateSearch)+','+JSON.stringify(badVotes)+')'),null);
 const invalidDate=structuredClone(nhSenateDetail);invalidDate.election_date='2026-09-08T05:00:00.000Z';
 assert.equal(w.eval('enCivicValidate('+JSON.stringify(nhSenateItem)+','+
   JSON.stringify(nhSenateSearch)+','+JSON.stringify(invalidDate)+')'),null);
 const preElectionClock=Date.parse('2026-10-13T20:00:00Z');
 w.Date.now=()=>preElectionClock;
 assert.equal(w.eval('enCivicValidate('+JSON.stringify(nhSenateItem)+','+
   JSON.stringify(nhSenateSearch)+','+JSON.stringify(nhSenateDetail)+')'),null,
   'No 2026 civicAPI counting or calls accepted before November 3');
 w.Date.now=()=>Date.parse('2026-11-04T03:00:00Z');
 const originalCivicFetch=w.fetch,civicRequests=[];
 w.fetch=async(url)=>{
   civicRequests.push(String(url));
   if(String(url).startsWith('https://civicapi.org/api/v2/race/search'))
     return {ok:true,json:async()=>civicDoc};
   if(String(url).startsWith('https://civicapi.org/api/v2/race/87283'))
     return {ok:true,json:async()=>nhSenateDetail};
   return {ok:true,json:async()=>empty2026};
 };
 // NH-SEN was pinned through the real watchlist form earlier in this suite.
 // Never replace a lexical 'let' by w.eval assignment: it creates an unrelated
 // global and does not change the script's actual saved watchlist.
 assert(get('#enWatchItems .en-watch-open[aria-label="Open NH-SEN Senate 2026 results"]'));
 get('.tab[data-page="electionNight"]').click();
 await w.eval('enRefreshCivicWatchlist(true)');
 assert(civicRequests.some(x=>x.includes('province=NH')&&x.includes('startDate=2026-11-03')));
 assert(civicRequests.some(x=>x.includes('/race/87283?light=')));
 assert.match(get('#enWatchItems').textContent,/civicAPI · 1,000 reported votes/);
 assert.match(get('#enWatchItems').textContent,/Outside the 22-state source/);
 assert.match(get('#enWatchItems').textContent,/civicAPI race source/);
 assert.equal(w.eval('enCivicStatus({office:"Senate",key:"NH"})').includes('1,000 reported votes'),true,
    'Validated supplemental vote totals must reach rendered source status');
 const nhWatchEntry=get('#enWatchItems .en-watch-open[aria-label="Open NH-SEN Senate 2026 results"]');
 assert(nhWatchEntry,'Verified civicAPI race should be present in personal watchlist');
 assert.equal(nhWatchEntry.getAttribute('aria-expanded'),'false');
 nhWatchEntry.click();
 assert.equal(get('#enWatchItems .en-watch-open[aria-label="Open NH-SEN Senate 2026 results"]').getAttribute('aria-expanded'),'true',
   'Out-of-coverage watchlist item should toggle open; captured errors: '+errors.slice(-3).join(' | ')+
   '; markup: '+get('#enWatchItems').innerHTML.slice(0,800));
 const civicDetail=get('#enWatchItems .en-civic-detail');
 assert(civicDetail,'Clicking an out-of-primary-state pinned race expands source-native candidate details');
 assert.match(civicDetail.textContent,/First candidate/);
 assert.match(civicDetail.textContent,/Second candidate/);
 assert.match(civicDetail.textContent,/510/);
 assert.match(civicDetail.textContent,/490/);
 assert.match(civicDetail.textContent,/separate from Open America/);
 assert(civicDetail.querySelector('a.en-civic-direct').href.includes('/api/v2/race/87283'));
 assert.equal(get('#enWatchItems .en-watch-open[aria-label="Open NH-SEN Senate 2026 results"]').getAttribute('aria-expanded'),'true');
 get('#enWatchItems .en-watch-open[aria-label="Open NH-SEN Senate 2026 results"]').click();
 assert.equal(w.document.querySelector('#enWatchItems .en-civic-detail'),null,
  'Supplemental race detail should collapse without losing its verified source snapshot');

 assert.equal(get('#enRaces').textContent,'0',
   'Supplemental provider vote returns must not leak into primary official-state totals');
 w.fetch=originalCivicFetch;
 w.Date.now=oldClock;
 w.eval('enWatched=[];enRenderWatchlist()');
 w.localStorage.removeItem('bluewaves_election_watch_2026_v1');

 assert.equal(errors.length,0,'Application emitted errors: '+errors.slice(0,4).join(' | '));
 console.log('Dashboard DOM integration passed: exact TX-SEN/TX-GOV poll drilldowns, race labels, DDHQ stale-data guards, dated news feed, and no script errors.');
 dom.window.close();
})().catch(e=>{console.error(e.stack||e);dom.window.close();process.exitCode=1});
