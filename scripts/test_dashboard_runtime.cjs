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
const milestoneKeys=['graham','blexas','blue-corn','blansas','maine','nebraska','ohio'];
for(const name of milestoneKeys){
 const art=read('assets/milestone-'+name+'.svg');
 assert(art.length>500&&art.length<20000,'Local milestone artwork must be lightweight: '+name);
 assert.match(art,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(art,/<title id="t">[\s\S]+<\/title>/);
 assert.match(art,/<desc id="d">[\s\S]+<\/desc>/);
 assert(!/<script|<foreignObject|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(art),
  'Election night illustration may not depend on remote code or assets: '+name);
}

const mobileHeroCSS=html.match(/\/\* Preserve the full surfer photo on narrow screens\.[\s\S]*?\*\/\s*@media\(max-width:620px\)\{[\s\S]*?background-repeat:no-repeat;/)?.[0];
assert(mobileHeroCSS,'Mobile portrait hero should explicitly preserve surfer-image framing');
assert.match(mobileHeroCSS,/background-size:100% 100%,100% auto,cover;/,
 'Surfer photo must fit full width instead of horizontally cropping a face with cover');
assert.match(mobileHeroCSS,/background-position:center,center top,center;/,
 'Keep the surfer image anchored at the top while copy remains at the bottom');

const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
assert.match(html,/scripts\/election_night_source_backoff\.js\?v=[0-9a-f]{12}/,
 'The deployed page must load the source-breaker module for 503 recovery');
assert.match(html,/scripts\/election_night_transport\.js\?v=[0-9a-f]{12}/,
 'The deployed page must use globally bounded supplemental request transport');
assert.match(html,/scripts\/election_night_fast_lane\.js\?v=[0-9a-f]{12}/,
 'The deployed page must load the bounded 30-second hot-race refresh policy');
assert.match(html,/<script src="\.\/scripts\/civicapi_nh_adapter\.js\?v=[0-9a-f]{12}"><\/script>/,
 'NH civicAPI adapter must load on GitHub Pages before the main application');
assert.match(html,/<script src="\.\/scripts\/civicapi_nh_governor_adapter\.js\?v=[0-9a-f]{12}"><\/script>/,
 'NH governor adapter must load before the election-night application');
assert.match(html,/<script src="\.\/scripts\/civicapi_state_batch\.js\?v=[0-9a-f]{12}"><\/script>/,
 'Four-state supplemental provider module must load before the application');
assert.match(html,/<script src="\.\/scripts\/civicapi_house_2026_adapter\.js\?v=[0-9a-f]{12}"><\/script>/,
 'Exactly scoped 2026 House adapter must load before the Election Night application');
assert.match(html,/<script src="\.\/scripts\/chamber_control_model\.js\?v=[0-9a-f]{12}"><\/script>/,
 'Version-pin the Senate engine: uncached index must never reuse the obsolete 2020 candidate model');
assert.equal(scripts.length,1,'Expected exactly one live inline application script');
const errors=[];
const virtualConsole=new VirtualConsole();
virtualConsole.on('jsdomError',(err)=>errors.push(String(err)));
const dom=new JSDOM(html,{url:'https://election-command-center.local/',runScripts:'outside-only',
  pretendToBeVisual:true,virtualConsole});
const w=dom.window;
// jsdom26 exposes <dialog>.open but has no native dialog methods. Model only
// that API boundary here; actual modality, viewport and focus are exercised by
// test_ratings_celebration_popup_browser.mjs in desktop/mobile Chromium.
// https://github.com/jsdom/jsdom/blob/v26.1.0/lib/jsdom/living/nodes/HTMLDialogElement.webidl
if(!w.HTMLDialogElement.prototype.showModal){
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){if(!this.open)return;this.open=false;w.queueMicrotask(()=>this.dispatchEvent(new w.Event('close')));};
}
let fishAudioPlays=0,fishAudioPauses=0;
w.HTMLMediaElement.prototype.play=function(){fishAudioPlays++;return Promise.resolve()};
w.HTMLMediaElement.prototype.pause=function(){fishAudioPauses++};
// This suite runs several minutes of simulated election-night activity.
// Never let real-time background refresh intervals race against controlled,
// deterministic fixture injections near the end of the test. Verify the
// registrations themselves and explicitly invoke both refresh paths below.
const registeredIntervals=[];
w.setInterval=(fn,ms)=>{registeredIntervals.push({fn,ms});return registeredIntervals.length;};
w.scrollTo=()=>{};
w.Element.prototype.scrollIntoView=function(){};
w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
const fixtures={
 'polling_estimates.json':model,'polls.json':primary,
 'pollresults_recent.json':recent,'model_history.json':history,
 'race_probabilities.json':json('data/race_probabilities.json'),
 'election_night_source_coverage.json':json('data/election_night_source_coverage.json'),
 'election_night_official_backstops.json':json('data/election_night_official_backstops.json'),
 'ZqBdM (1).csv':read('ZqBdM (1).csv'),
 'f3ome (1).csv':read('f3ome (1).csv'),
 'house_history_2024_staging.json':json('data/house_history_2024_staging.json'),
 'historical_senate_poll_backtest.json':json('data/historical_senate_poll_backtest.json'),
 'senate_history_2020_2022_2024.json':json('data/senate_history_2020_2022_2024.json')
};
for(const file of ['briefing.json','integrity_impact.json','integrity_review_queue.json','seat_universe.json','house_geography_bridge.json','house_two_cycle_context.json','presidential_2024_by_2026_district_staging.json']){
 const name='data/'+file;
 if(fs.existsSync(path.join(ROOT,name)))fixtures[file]=json(name);
}
w.fetch=async (url)=>{
 const name=decodeURIComponent(String(url).split('?')[0].split('/').pop());
 if(!(name in fixtures))return {ok:false,status:404,json:async()=>({})};
 return {ok:true,status:200,json:async()=>fixtures[name],
  text:async()=>String(fixtures[name])};
};
w.console.error=(...parts)=>errors.push(parts.map(String).join(' '));
function get(selector){const el=w.document.querySelector(selector);assert(el,'Missing '+selector);return el}
async function settle(){
 for(let n=0;n<150;n++){
  await new Promise(resolve=>setTimeout(resolve,20));
  if(get('#modelBoard').querySelectorAll('.model-race-row').length&&
      w.eval('jointForecastResult()')&&w.eval('jointRaceOddsResult()')&&
      get('#newPolls').querySelectorAll('.item').length)return;
 }
 throw Error('Timed out waiting for linked joint odds: '+
  JSON.stringify({boardRows:get('#modelBoard').querySelectorAll('.model-race-row').length,
   jointSummary:get('#jointHomeSummary').textContent,
   jointReady:Boolean(w.eval('jointForecastResult()')),
   oddsReady:Boolean(w.eval('jointRaceOddsResult()')),
   pollingReady:Boolean(w.eval('jointPollingReady()')),
   sourceErrors:errors.slice(0,6),
   newPollRows:get('#newPolls').querySelectorAll('.item').length}));
}
(async()=>{
 w.eval(read('scripts/civicapi_nh_adapter.js'));
 assert(w.NHCivicRaceAdapter,'NH adapter must actually load before the application');
 w.eval(read('scripts/civicapi_nh_governor_adapter.js'));
 assert(w.NHGovernorCivicAdapter,'NH governor adapter must load before the application');
 w.eval(read('scripts/civicapi_state_batch.js'));
 assert(w.StateBatchCivicAdapter,'Four-state adapter must load before the application');
 w.eval(read('scripts/civicapi_house_2026_adapter.js'));
 assert(w.CivicHouse2026Adapter?.validatePinned,
  'Verified House IDs must still pass the strict result-detail identity gate');
 w.eval(read('scripts/election_night_source_backoff.js'));
 assert(w.ElectionNightSourceBackoff?.create,
  'Source breaker must load in test browser just as on real GitHub Pages');
 w.eval(read('scripts/election_night_transport.js'));
 assert(w.ElectionNightTransport?.createPool,
  'One shared four-request source pool must load before the real dashboard');
 w.eval(read('scripts/election_night_openamerica_transport.js'));
 assert(w.ElectionNightOpenAmericaTransport?.create,
  'Primary Open America reader must load before inline Election Night script');
 w.eval(read('scripts/election_night_fast_lane.js'));
 assert.equal(w.ElectionNightFastLane?.MAX_RACES,4,
  'The fast lane must cap extra Election Night race checks to four per tick');
 w.eval(read('scripts/election_night_nowcast.js'));
 assert(w.RaceLiveNowcast,'Live race probability module must load before app');
 w.eval(read('scripts/election_night_early_signals.js'));
 assert(w.ElectionNightEarlySignals?.records?.length>=10,'Early signal registry must load');
 w.eval(read('scripts/election_night_priority.js'));
 assert(w.AutomaticRaceDesk?.SEED.length>75,'Automatic Silver-reference race registry must load');
 w.eval(read('scripts/election_night_signals.js'));
 w.eval(read('scripts/election_night_celebration_player.js'));
 assert.deepEqual(Array.from(w.ElectionNightSignals?.MILESTONES||[],x=>x.id),
  ['graham','blexas','blue_corn','blansas','maine','nebraska','ohio','talarico','abbott','mississippi'],
  'The dashboard must load the exact ten separately guarded celebration events');
 w.eval(read('scripts/election_night_poll_closings_2026.js'));
 assert(w.ElectionNightPollClosings2026?.allowed,
  'Actual 50-state poll-close contract must load before source reconciliation');
 w.eval(read('scripts/election_night_reconciliation.js'));
 assert(w.ElectionNightReconciliation?.reconcile,'National reconciliation script must load');
 w.eval(read('scripts/election_night_506_live_gap_desk.js'));
 assert(w.ElectionNightCoverageTriage?.build,
  'Source-attributed 506-race gap triage must load before Election Night dashboard');
 w.eval(read('scripts/election_night_rehearsal.js'));
 assert(w.ElectionNightRehearsal,'Synthetic rehearsal library must load before app');
 w.eval(read('scripts/chamber_control_model.js'));
 assert(w.ChamberControlModel,'Joint Senate/House model must load before app');
 w.eval(read('scripts/official_admission_audit.js'));
 assert(w.OfficialAdmissionAudit?.create,'Official model admission evidence must load before app');
 w.eval(read('scripts/electorate_what_if_2026.js'));
 assert(w.ElectorateWhatIf2026,'What-if electorate scenario module must load before app');
 w.eval(read('scripts/chamber_poll_error_audit.js'));
 assert(w.JackErrorAudit,'Retrospective Senate error audit must be loaded before app');
 w.eval(read('scripts/senate_calibration_audit.js'));
 assert(w.SenateCalibrationAudit,'Retrospective probability-score module must be loaded before app');
 w.eval(read('scripts/private_senate_fundamentals.js'));
 assert(w.PrivateSenateFundamentals,'Private subscriber CSV parser must load before app');
 w.eval(read('scripts/ohio_official_candidate_votes.js'));
 assert(w.OhioOfficialCandidateVotes?.prepare,
  'Ohio county candidate source guard must load before Election Night app');
 w.eval(read('scripts/ohio_official_county_startup.js'));
 assert(w.OhioOfficialDeskRefresh,
  'Ohio approved-source browser refresh must be installed');

 // Test-only fixture injector shares the app's lexical scope without
 // exposing private source caches in the production dashboard.
 w.eval(scripts[0].replace(
  'const enCivicValidatedGenerations=Object.create(null);',
  `const enCivicValidatedGenerations=Object.create(null);
function __testSeedStaleOhioSenate(){
 enCivicByWatch['Senate|OH-special']={total:1000,called:'Candidate B',provider:'civicAPI'};
 enCivicValidatedGenerations['Senate|OH-special']=enCivicBreaker.status().generation-1;
}
// Test-only access to lexical source state, never exposed by production.
function __testOpenAmericaPending(){return enOpenAmericaReader.pending()}
function __testWatchedOfficePending(){return enWatchRefreshPending.size}`));
 assert.equal(w.ElectionNightTransport.createPool(4,64).status().concurrency_limit,4);
 assert.match(w.eval('enCivicFetchJson.toString()'),/enCivicRequestPool\.run/,
  'All overlapping manual and automatic sweeps must share bounded fetches');
 assert(registeredIntervals.some(x=>x.ms===120000),
  'Still-open tab must register polling refresh every two minutes');
 assert(registeredIntervals.some(x=>x.ms===300000),
  'Still-open tab must register reporting/security refresh every five minutes');
 await settle();
 // Browser-side supplemental transport must reject foreign/redirected JSON
 // BEFORE any civicAPI race records are eligible for source attribution.
 const beforeOriginFetch=w.fetch;
 const approvedCivic='https://civicapi.org/api/v2/race/87188?light=';
 let civicCalls=0;
 w.fetch=async(url,options)=>{
  civicCalls++;
  assert.equal(String(url),approvedCivic);
  assert.equal(options.redirect,'error');
  return {ok:true,status:200,url:'https://evil.example/api/v2/race/87188?light=',
   redirected:false,json:async()=>{throw Error('Unsafe response JSON parsed')}};
 };
 await assert.rejects(w.eval('enCivicFetchJson('+JSON.stringify(approvedCivic)+')'),
  /approved source URL/);
 assert.equal(civicCalls,1);
 await assert.rejects(w.eval('enCivicFetchJson("https://evil.example/race/1?light=")'),
  /Unapproved civicAPI/);
 assert.equal(civicCalls,1,'Unapproved fetch must fail before network request');
 w.fetch=async(url)=>({ok:true,status:200,url:String(url),redirected:false,
  json:async()=>({races:[],count:0})});
 const genuine=await w.eval('enCivicFetchJson('+JSON.stringify(approvedCivic)+')');
 assert.equal(genuine.count,0,'Exact civicAPI final URL can still be parsed');
 w.fetch=beforeOriginFetch;
 // The 506-race discovery inventory must never masquerade as actual counts.
 await w.eval('enRefreshSourceReadiness()');
 const ledger=fixtures['election_night_source_coverage.json'];
 const unresolved=ledger.races.filter(r=>r.gap_status==='UNRESOLVED_SOURCE_GAP').length;
 const readiness=get('#enSourceReadiness').textContent;
 assert(readiness.includes((506-unresolved)+'/506 races with source identity paths'));
 assert(readiness.includes(unresolved+' unresolved'));
 const links=fixtures['election_night_official_backstops.json'].links;
 const manualPriority=new Set(['Senate|AK','Senate|ME','Senate|NE','Senate|NH','Senate|OH-special']);
 assert.equal(get('#enOfficialBackstopsList').querySelectorAll('a[href]').length,
  links.filter(x=>x.race_ids.some(id=>manualPriority.has(id)||
   ledger.races.some(r=>r.id===id&&r.gap_status==='UNRESOLVED_SOURCE_GAP'))).length+1,
  'The verified NH community viewer is an additional manual site, NOT a vote source');
 assert(get('#enOfficialBackstopsList').textContent.includes('NH town-by-town unofficial results'),
  'NH-01 and NH-02 must have a genuinely usable unofficial Election Night fallback');
 assert.equal(['house','senate','governor'].reduce((sum,office)=>
  sum+(ledger.summary?.[office]?.unresolved_source_gaps||0),0),unresolved,
  'A human fallback cannot artificially reduce dynamic automated source gaps');
 assert(get('#enOfficialBackstopsList').textContent.includes('certification/results may come AFTER Election Night'),
  'Massachusetts cannot be described as providing election-night provisional totals');
 assert(get('#enOfficialBackstopsList').textContent.includes('WARNING: pre-election MOCK/TEST results, not real votes'),
  'Ohio and Nebraska official pre-election practice pages must not look like real counts');

 assert.match(readiness,/NOT confirmed November 3 returns coverage/);
 const invalidLedger={...ledger,races:ledger.races.slice(1)};
 assert.match(w.eval('enSourceReadinessMessage('+JSON.stringify(invalidLedger)+')'),
  /incomplete or invalid/,'Lost race entries must invalidate readiness claim');

 // The local early-evening comparator must be installed on the actual
 // browser page and must visibly disclose that it is not a national swing.
 // A working state-level provider must not prevent civicAPI from supplying
 // a *missing* exact race, or an outage from depriving high-impact Senate/
 // House seats of a secondary source. No fake votes or premature polling.
 const fallbackStatus=w.eval(`(() => {
  const now=Date.parse('2026-11-04T00:30:00Z');
  const fresh={year:2026,office:'House',stale:false,
   as_of:'2026-11-04T00:29:00Z',
   races:{'VA-02':{total:2000},'VA-05':{total:0}}};
  const healthy={snapshot:fresh,failed:false,pending:false};
  const item={office:'House',key:'VA-02'};
  return [
   enShouldProbeSupplemental(item,now,healthy),
   enShouldProbeSupplemental({office:'House',key:'VA-05'},now,healthy),
   enShouldProbeSupplemental(item,now,{...healthy,failed:true}),
   enShouldProbeSupplemental(item,now,{...healthy,pending:true}),
   enShouldProbeSupplemental(item,now,{...healthy,snapshot:{...fresh,stale:true}}),
   enShouldProbeSupplemental(item,now,{...healthy,snapshot:{...fresh,as_of:'2026-11-03T20:00:00Z'}}),
   enShouldProbeSupplemental({office:'House',key:'KY-06'},now,healthy),
   enShouldProbeSupplemental(item,Date.parse('2026-11-03T21:00:00Z'),healthy)
  ].join(',');
 })()`);
 assert.equal(fallbackStatus,'false,true,true,true,true,true,true,false',
  'Supplemental provider must cover missing/stale exact races, not duplicate healthy or pre-close primary feeds');
 assert.equal(typeof w.eval('enDistrictPerformance'),'function',
  'Browser should register the source-gated local House-district comparator');
 assert.match(get('#enDistrictPulse').textContent,/Early House district checks|Early district checks/,
  'Archived votes cannot be presented as 2026 local performance');
 // Four Endings belongs above the polling/news feed and the automatic
 // election-night race desk—not buried after both.
 const beforeOnPage=(earlier,later)=>Boolean(
  earlier.compareDocumentPosition(later)&w.Node.DOCUMENT_POSITION_FOLLOWING);
 assert(beforeOnPage(get('#jointHomePanel'),get('#genericMargin')),
  'The four-outcome model should be visible above the generic-ballot chart');
 assert(beforeOnPage(get('#smartBriefDesk'),get('#racePulse')),
  'Automatic key races should appear before detailed polling deltas');
 assert(beforeOnPage(get('#smartBriefDesk'),get('#newPolls')),
  'Automatic key races should appear before scrolling through polls');
 assert.equal(w.eval('smartRawPartisanMargin(500,0)'),null,
  'D versus independent must not show D+100');
 assert.equal(w.eval('smartRawPartisanMargin(0,500)'),null,
  'R versus independent must not show R+100');
 assert.equal(w.eval('smartRawPartisanMargin(0,0)'),null);
 assert.equal(w.eval('smartRawPartisanMargin(300,700)'),-40);
 assert.equal(w.eval('smartRawPartisanMargin(700,300)'),40);
 assert.equal(w.eval('smartRawPartisanMargin(-5,100)'),null);
 assert.equal(w.eval('smartRawPartisanMargin(5.4,100)'),null);
 const frontRows=[...get('#smartBriefGrid').querySelectorAll('a.smart-signal')];
 const frontSenateRows=frontRows.filter(x=>x.dataset.race.endsWith('-SEN'));
 const frontHouseRows=frontRows.filter(x=>/^[A-Z]{2}-[0-9]{2}$/.test(x.dataset.race));
 assert.equal(frontSenateRows.length,35,
  'Every Senate contest stays visible by default, including safe seats');
 assert(frontHouseRows.length>0,
  'Competitive focus retains meaningful House districts');
 assert.equal(w.eval("smartFocusInteresting({office:'Senate',model:{dem_beats_rep_pct:95}})"),true);
 assert.equal(w.eval("smartFocusInteresting({office:'House',model:{dem_beats_rep_pct:5}})"),false);
 assert.equal(w.eval("smartFocusInteresting({office:'House',model:{dem_beats_rep_pct:94.9}})"),true);
 assert.equal(w.eval("smartFocusInteresting({office:'Senate',model:null})"),true,
  'An unrated Senate contest is unknown, not falsely classified safe');
 assert.equal(w.eval("smartFocusInteresting({office:'House',model:null})"),false,
  'Unrated House contests require current evidence to enter focus');
 const focusedCodes=new Set(w.eval('smartRaceRanked().filter(smartFocusInteresting).map(r=>r.code)'));
 assert(frontRows.every(x=>focusedCodes.has(x.dataset.race)),
  'Safe modeled races must not leak into the default focus');
 assert(frontRows.some(x=>/win chance/.test(x.textContent)),
  'Available linked model odds remain visible without inventing missing probabilities');
 assert(frontRows.some(x=>/Poll (D|R)\+/.test(x.textContent)),
  'Qualifying polling averages should be visible in the briefing');
 assert(!get('#smartBriefGrid').textContent.includes('reference tipping-point share'),
  'Screenshot reference metadata is discovery context, not homepage filler');
 assert.equal(get('#smartBriefControls').querySelector('[data-smart-office="All"]')
  .getAttribute('aria-pressed'),'true','Full roster is the default');
 const unchangedFirstRow=frontRows[0];
 w.eval('renderSmartRaceDesks()');
 assert.strictEqual(get('#smartBriefGrid').querySelector('a.smart-signal'),
  unchangedFirstRow,
  'No-op refreshes must preserve existing full-roster DOM and event handlers');
 assert.match(get('#smartBriefCount').textContent,/competitive focus/);
 assert.match(get('#smartBriefCount').textContent,/at ≥95% omitted/);
 assert.equal(get('#smartBriefShowAll').getAttribute('aria-pressed'),'false');
 get('#smartBriefShowAll').click();
 const fullRows=[...get('#smartBriefGrid').querySelectorAll('a.smart-signal')];
 assert.equal(fullRows.filter(x=>x.dataset.race.endsWith('-SEN')).length,35,
  'The full 35-seat Senate universe remains accessible on demand');
 assert(fullRows.length>frontRows.length,
  'Full roster must restore safe modeled races and other tracked districts');
 assert.equal(get('#smartBriefShowAll').getAttribute('aria-pressed'),'true');
 get('#smartBriefShowAll').click();
 assert.equal(get('#smartBriefGrid').querySelectorAll('a.smart-signal').length,frontRows.length,
  'Switching back restores the competitive-only list');
 assert.equal(get('#smartNightDesk').hidden,true,
  '2024 archive should hide the live 2026 watchboard');
 assert.equal(get('#jointHomeSummary').closest('details').open,false,
  'Collapse verbose forecast details instead of repeating them above the needle');
 assert.match(get('#jointHomeHeadline').textContent,/Tsunami [0-9.]+%/);
 assert.equal(get('#briefPollLog').open,false,'Raw poll list should be collapsed by default');
 assert(beforeOnPage(get('#updates'),get('#briefPollLog')),
  'New polls should follow the meaningful election developments');
 assert.equal(get('#senateDeepDive').open,false,
  'Duplicative Senate details should be moved into the model lab');
 const initialWatch=w.eval('smartAutoWatch()');
 assert(initialWatch.some(x=>x.code==='OH-SEN'&&x.key==='OH-special'));
 assert(initialWatch.some(x=>x.code==='AZ-06'&&x.office==='House'));
 assert(!(JSON.parse(w.localStorage.getItem('bluewaves_election_watch_2026_v1')||'[]'))
  .some(x=>x.key==='PA-10'),
  'Auto-watch must not overwrite the personal pinned list');
 get('#smartBriefControls').querySelector('[data-smart-office="House"]').click();
 assert.equal(get('#smartBriefControls').querySelector('[data-smart-office="House"]')
  .getAttribute('aria-pressed'),'true');
 assert.equal(get('#smartBriefGrid').querySelectorAll('a.smart-signal').length,frontHouseRows.length,
  'House office filter retains competitive-only House rows');
 assert(get('#smartBriefGrid').textContent.includes('NM-02')||
  get('#smartBriefGrid').textContent.includes('PA-10'),
  'House filter retains previously tracked districts');
 get('#smartBriefSearch').value='PA-10';
 get('#smartBriefSearch').dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(get('#smartBriefGrid').querySelectorAll('a.smart-signal').length,1,
  'Race search should immediately narrow the roster to the exact district');
 get('#smartBriefSearch').value='';
 get('#smartBriefSearch').dispatchEvent(new w.Event('input',{bubbles:true}));
 get('#smartBriefControls').querySelector('[data-smart-office="Senate"]').click();
 assert.equal(get('#smartBriefGrid').querySelectorAll('a.smart-signal').length,frontSenateRows.length);
 get('#smartBriefControls').querySelector('[data-smart-office="All"]').click();
 assert.equal(get('#smartBriefGrid').querySelectorAll('a.smart-signal').length,frontRows.length);
 // Full roster behavior is verified above. Keep later unrelated Monte Carlo,
 // outage, and export regression phases on the smaller Senate office filter
 // rather than constructing >100 visible cards on every synthetic update.
 get('#smartBriefControls').querySelector('[data-smart-office="Senate"]').click();
 // One cross-page heartbeat distinguishes five independent sources.
 const glanceIds=['feedPolls','feedModel','feedNews','feedSecurity','feedResults'];
 for(const id of glanceIds){
  const node=get('#'+id);
  assert(['fresh','delayed','unavailable','pending','scheduled'].includes(node.dataset.status),
   'Each source must expose a distinct, truthful state: '+id);
  assert.match(node.getAttribute('href'),/^#(wire|model|brief|integrity|electionNight)$/,
   'Source status must link to relevant desk: '+id);
 }
 // The default pre-election results tab opens 2024 archive for rehearsal.
 // This is historical, never incorrectly described as a live 2026 feed.
 assert.match(get('#feedResults').textContent,/2024 archive/,
  'Before election day, default historical mode must not pretend to be live 2026 results');
 assert.equal(get('#feedResults').dataset.status,'scheduled');
 assert.equal(get('#enMilestoneDesk').hidden,true,'2024 mode has no current milestones');
 assert.match(get('#feedModel').textContent,/^Model · /);
 assert.match(get('#feedPolls').textContent,/^Polls · /);
 // A weeks-old cached headline must never be shown as a fresh feed.
 const oldGlanceClock=w.Date.now;
 w.Date.now=()=>Date.parse('2026-11-02T15:00:00Z');
 w.eval('updateFeedGlance()');
 assert(['delayed','unavailable'].includes(get('#feedNews').dataset.status),
  'A weeks-old headline is never fresh; failed collector status is unavailable, not delayed');
 w.Date.now=oldGlanceClock;
 w.eval('updateFeedGlance()');
 assert.match(get('#privateContextStatus').textContent,/Repository fundamentals ACTIVE/,
  'Repository Senate+House CSV inputs must auto-load without device upload');
 assert.equal(w.eval('jointForecastResult()')?.samples,3000);
 assert.match(get('#modelEngineTag').textContent,/REPOSITORY FUNDAMENTALS ACTIVE/);
 assert.equal(w.eval("jointForecastResult().race_probabilities.filter(x=>x.office==='house').length"),435);
 assert.equal(w.eval("jointForecastResult().race_probabilities.filter(x=>x.office==='senate').length"),35);
 assert.equal(w.eval('jointForecastResult().senate_dem_control_pct')>=0,true);
 assert.match(get('#privateContextComparison').textContent,/28 Senate.*98 House/,
  'The CSV-augmented forecast must include both published input sets');
 // Keep all existing baseline-model regressions applicable: after proving
 // auto-activation, simulate an explicit user opt-out for the rest of the suite.
 // This tests that the public fallback still works, not a hidden shortcut.
 const repositoryResult=w.eval('jointForecastResult()');
 get('#privateContextClear').click();
 assert.match(get('#modelEngineTag').textContent,/2026 Senate model · poll-depth forecast v5/);
 assert.notDeepEqual(w.eval('jointForecastResult()').probabilities,repositoryResult.probabilities,
  'Removing repository fundamentals should restore independent live baseline');
 // Users should see actual provider-reported votes immediately after the
 // Four Endings forecast, before research, simulations, alert noise or feeds.
 const follows=(earlier,later)=>Boolean(
  earlier.compareDocumentPosition(later)&w.Node.DOCUMENT_POSITION_FOLLOWING);
 assert(follows(get('#jointNightPanel'),get('#enRaceList')),
  'Actual race counts should follow the four-outcome forecast');
 assert(follows(get('#enRaceList'),get('#enNowcastRows')),
  'Reported race results must appear before secondary probability research');
 assert(follows(get('#enRaceList'),get('#enWatchItems')),
  'Results must not be buried below expanded watchlist panels');
 assert.equal(get('#enAdvancedLab').open,false,
  'Forecast and rehearsal research should start collapsed');
 assert(get('#enAdvancedLab').contains(get('#enNowcastRows')),
  'Research remains available one expansion away');
 assert.equal(get('#electionNight .en-sources-explainer').open,false,
  'Lengthy source documentation should not dominate first view');
 assert(get('#electionNight .en-sources-explainer').contains(
  get('#electionNight .en-sources')),
  'All original source links should remain accessible');
 get('#enAdvancedLab').open=true;
 assert.equal(get('#enAdvancedLab').open,true);
 get('#enAdvancedLab').open=false;
 // Election-night first-returns checklist must remain descriptive and
 // anchored to real provider statuses (never auto-call races).
 w.eval('enRender()');
 const signals=w.ElectionNightEarlySignals;
 assert(signals.records.some(x=>x.code==='KY-06'&&x.time==='6:00 PM'));
 assert(signals.records.some(x=>x.code==='IN-05'&&x.time==='6:00 PM'));
 for(const code of ['VA-01','VA-02','VA-05','NC-01','NC-11']){
  assert(signals.records.some(x=>x.code===code),'Missing early watch seat '+code);
 }
 assert.equal(get('#enEarlySignals').querySelectorAll('.en-early-row').length,signals.records.length);
  assert.equal(get('#enEarlySignals').querySelectorAll('.en-early-row').length,15);
  assert.match(get('#enEarlyHealth').textContent,/PRE-ELECTION READINESS/);
  assert.match(get('#enEarlySignals').textContent,/Wake, Mecklenburg, Nash/);
  assert.match(get('#enEarlySignals').textContent,/MOCK totals/);
  assert.equal(get('#enScreenAwake').getAttribute('aria-pressed'),'false');
  get('#enScreenAwake').click();
  assert.equal(get('#enScreenAwake').getAttribute('aria-pressed'),'true');
  assert.match(get('#enWakeStatus').textContent,/Wake Lock unsupported|Display wake lock|Wake lock/);
  get('#enScreenAwake').click();
  assert.equal(get('#enScreenAwake').getAttribute('aria-pressed'),'false');
  assert.equal(w.eval('enReconnectGap(1000,121000)'),true,
   'A paused browser must detect a two-minute gap in the result-check clock');
  assert.equal(w.eval('enReconnectGap(1000,120999)'),false,
   'Normal one-minute checks must not trigger overlapping reconnects');
  assert.equal(w.eval('enReconnectGap(121000,1000)'),false,
   'Backwards system-clock adjustments must not trigger a reconnect');
  assert.equal(w.eval('enReconnectAfterInterruption(true)'),false,
   'Before Election Day a resumed browser must not manufacture or request live votes');

 assert.match(get('#enEarlySignals').textContent,/2026 preview/);
 assert.match(get('#enEarlySignals').textContent,/no live returns in archive/);
 assert.doesNotMatch(get('#enEarlySignals').textContent,/tsunami confirmed|Senate secured/i);
 // Long checklist is collapsed by default; important information remains
 // accessible without pushing the actual race results further down the page.
 assert.equal(get('#enEarlySignalsDetails').open,false,
  'Early signal reference list should not dominate initial Election Night view');
 get('#enEarlySignalsDetails').open=true;
 assert.equal(get('#enEarlySignalsDetails').open,true);
 get('#enEarlySignalsDetails').open=false;
 // Pin/unpin is real shared watchlist state, not an inert decorative button.
 const first=get('#enEarlySignals .en-early-pin');
 const wasPinned=first.getAttribute('aria-pressed')==='true';
 first.click();
 const afterPin=get('#enEarlySignals .en-early-pin');
 assert.equal(afterPin.getAttribute('aria-pressed'),String(!wasPinned));
 afterPin.click();
 assert.equal(get('#enEarlySignals .en-early-pin').getAttribute('aria-pressed'),String(wasPinned));
 // The Fish Head interruptor must not confuse a pretend preview, an
 // early vote-leader swing, or pre-election data with a verified race call.
 // A user arriving at Election Night must find the rehearsal immediately,
 // before the big forecast/workspace, rather than below twelve more sections.
 assert(get('#enFishPreview'),'Fish preview action must be present');
 assert(get('#electionNight .en-quick-actions #enFishPreview'),
  'Rehearsal belongs in top-of-page quick actions');
 assert(get('#enFishPreview').compareDocumentPosition(get('#jointNightPanel'))&
  w.Node.DOCUMENT_POSITION_FOLLOWING,
  'Fish Head rehearsal action must precede the main panel');
 assert.equal(w.document.querySelector('#electionNight .en-fish-controls'),null,
  'Do not retain the old redundant full-width Fish Head control panel');
 const fish=get('#enFishToast');
 assert.equal(fish.getAttribute('role'),'dialog',
  'Fish bulletin must be an accessible foreground interruption');
 assert.match(get('#enFishToast .en-fish-art img').src,
  /upload\.wikimedia\.org\/wikipedia\/commons\/d\/d4\/Realistic_Fish_Head\.jpg/,
  'Use the actual Commons-licensed Fish Head still, not a drawn knockoff');
 assert.match(get('#enFishToast .en-fish-attribution').textContent,
  /HandyGames.*CC BY 3\.0/);
 const soundtrack=get('#enFishAudio');
 assert.match(soundtrack.getAttribute('src'),
  /assets\/audio\/breaking-news-in-the-2026-midterm-elections\.mp3$/,
  'Use the exact user-uploaded MP3 hosted as a local repository asset');
 assert.equal(fishAudioPlays,0,'No audio before a breaking-news event');
 assert.equal(w.document.querySelector('#enFishOfficialFrame'),null,
  'The prior YouTube video embed must be removed');
 assert(fish.hidden,'Breaking news panel must start dismissed');
 assert.match(get('#enFishVoice').textContent,/Sound: on/);
 get('#enFishPreview').click();
 assert.equal(fish.hidden,false);
 assert.match(get('#enFishMode').textContent,/REHEARSAL/);
 assert.match(get('#enFishHeadline').textContent,/Bikini Bottom election desk/);
 assert.match(get('#enFishSource').textContent,/no real election result/);
 assert.equal(w.document.activeElement,get('#enFishDismiss'),
  'Keyboard focus should move to the in-your-face breaking bulletin');
 assert.equal(fishAudioPlays,1,'Preview must play the original uploaded MP3 automatically');
 get('#enFishPlayClip').click();
 assert.equal(fishAudioPlays,2,'Replay control should replay the same uploaded MP3');
 get('#enFishDismiss').click();
 assert(fish.hidden,'Dismiss control must close the fish-news overlay');
 assert(fishAudioPauses>=2,'Dismissal stops audio rather than letting it continue');
 // A new user-validated update receives its own announcement. When
 // multiple independent alerts arrive, the same MP3 runs sequentially.
 const fishOldClock=w.Date.now;
 const priorNightMode2026=get('#enMode2026').getAttribute('aria-pressed')==='true';
 const priorNightVisible=get('#electionNight').classList.contains('active');
 w.Date.now=()=>Date.parse('2026-11-04T03:20:00Z');
 get('#electionNight').classList.add('active');
 get('#enMode2026').click();
 assert.equal(get('#smartNightDesk').hidden,false,
  '2026 results mode must show automatic key race watch');
 const nightFocus=[...get('#smartNightGrid').querySelectorAll('a.smart-signal')]
  .filter(x=>x.dataset.race.endsWith('-SEN'));
 assert.equal(nightFocus.length,35,
  'Election-night desk defaults to all 35 Senate contests');
 get('#smartNightShowAll').click();
 assert.equal([...get('#smartNightGrid').querySelectorAll('a.smart-signal')]
  .filter(x=>x.dataset.race.endsWith('-SEN')).length,35,
  'Election-night full roster still exposes every Senate seat');
 get('#smartNightShowAll').click();
 get('#smartNightControls').querySelector('[data-smart-office="Senate"]').click();
 assert.equal(get('#smartNightGrid').querySelectorAll('a.smart-signal').length,nightFocus.length);
 assert.equal(w.eval("enAutoTracked({office:'House',key:'PA-10'})"),true,
  'Reference House district is followed without custom user pins');
 assert.equal(w.eval("enAutoTracked({office:'Senate',key:'ME'})"),true);
 // A provider-reported winner call must constrain this race in ALL correlated
 // House/Senate simulation draws, not merely contribute a tiny partial lead.
 // NC has a state-derived primary results feed; a separately identity-checked
 // civicAPI call must still be honored by the joint model.
 // Test through the actual provider lookup, identity validation and
 // fetch/revision path. No injected global state or test-only production hook.
 const beforeSourceCallFishPlays=fishAudioPlays;
 const beforeNcFetch=w.fetch;
 const ncRow={id:8241,country:'US',province:'NC',municipality:null,
  election_date:'2026-11-03',election_name:'NC US Senate General Election',
  election_type:'General',type:'US Senate',district:null,candidates:[]};
 let ncCalledParty='R',ncHttpStatus=200;
 const ncCandidateData=()=>[
  {name:'Mock Democrat',party:'Democratic',votes:100100,percent:52.6842,
   winner:ncCalledParty==='D'},
  {name:'Mock Republican',party:'Republican',votes:89900,percent:47.3158,
   winner:ncCalledParty==='R'}];
 w.fetch=async(url,opts)=>{
  if(String(url).startsWith('https://civicapi.org/api/v2/race/search?'))
   return {ok:true,json:async()=>({races:[ncRow],count:1})};
  if(String(url)==='https://civicapi.org/api/v2/race/8241?light='){
   if(ncHttpStatus!==200)return {ok:false,status:ncHttpStatus};
   return {ok:true,json:async()=>({...ncRow,election_type:'US Senate',
    last_updated:'2026-11-04T03:05:00Z',percent_reporting:82,
    candidates:ncCandidateData()})};
  }
  return beforeNcFetch(url,opts);
 };
 w.eval('enWatchToggle({office:"Senate",key:"NC"})');
 await w.eval('enCivicFetchOne({office:"Senate",key:"NC"})');
 w.eval('jointRender(true)');
 let calledRace=w.eval("jointForecastResult().race_probabilities.find(r=>r.race_code==='NC-SEN')");
 assert.equal(calledRace.provider_called_party,'R');
 assert.equal(calledRace.dem_beats_rep_pct,0,
  'A vetted civicAPI Republican call constrains a primary-covered race');
 assert.equal(w.eval("Object.values(jointForecastResult().probabilities).reduce((a,b)=>a+b,0)").toFixed(1),'100.0');
 // A valid cached winner is no longer eligible if its exact race fails.
 ncHttpStatus=404;
 await w.eval('enCivicFetchOne({office:"Senate",key:"NC"})');
 assert.equal(w.eval("enCivicUsable({office:'Senate',key:'NC'})"),null);
 ncHttpStatus=200;
 w.eval('jointRender(false)');
 calledRace=w.eval("jointForecastResult().race_probabilities.find(r=>r.race_code==='NC-SEN')");
 assert.equal(calledRace.provider_called_party,null,
  'A race-specific source failure must release an earlier cached winner call');
 // Only a new validated detail fetch should clear that race's error.
 await w.eval('enCivicFetchOne({office:"Senate",key:"NC"})');
 w.eval('jointRender(false)');
 calledRace=w.eval("jointForecastResult().race_probabilities.find(r=>r.race_code==='NC-SEN')");
 assert.equal(calledRace.provider_called_party,'R');
 // A single upstream 503 makes ALL civicAPI records ineligible. Advancing
 // past backoff alone must not resurrect a cached winner without rechecking.
 ncHttpStatus=503;
 await w.eval('enCivicFetchOne({office:"Senate",key:"NC"})');
 assert.equal(w.eval("enCivicUsable({office:'Senate',key:'NC'})"),null);
 ncHttpStatus=200;
 w.eval('jointRender(false)');
 calledRace=w.eval("jointForecastResult().race_probabilities.find(r=>r.race_code==='NC-SEN')");
 assert.equal(calledRace.provider_called_party,null,
  'Shared upstream outage must not leave cached calls locking simulation draws');
 assert.equal(w.eval('enCivicProviderVerified()'),false,
  'An upstream HTTP 503 must mark supplemental provider unverified');
 w.eval('enRenderSourceHealth()');
 assert.match(get('#enHealthRows').textContent,/PAUSED · UPSTREAM HTTP 503/);
 w.Date.now=()=>Date.parse('2026-11-04T03:21:05Z');
 assert.equal(w.eval('enCivicProviderVerified()'),false,
  'Cooldown expiry alone cannot verify source recovery');
 assert.equal(w.eval("enCivicUsable({office:'Senate',key:'NC'})"),null,
  'Elapsed backoff is not proof of source recovery');
 w.eval('jointRender(false)');
 calledRace=w.eval("jointForecastResult().race_probabilities.find(r=>r.race_code==='NC-SEN')");
 assert.equal(calledRace.provider_called_party,null);
 await w.eval('enCivicFetchOne({office:"Senate",key:"NC"})');
 assert.equal(w.eval('enCivicProviderVerified()'),true,
  'Valid, post-outage candidate detail is required to restore source trust');
 // Other races cannot piggyback on the recovered provider's trusted epoch.
 // Supply an old, previously validated Ohio record and verify the actual
 // browser dashboard rejects it until that race's detail is rechecked.
 w.eval('__testSeedStaleOhioSenate()');
 assert.equal(w.eval("enCivicUsable({office:'Senate',key:'OH-special'})"),null,
  'Revalidating North Carolina cannot revive stale Ohio Senate results');

 assert(w.eval("enCivicUsable({office:'Senate',key:'NC'})"));
 w.eval('jointRender(false)');
 calledRace=w.eval("jointForecastResult().race_probabilities.find(r=>r.race_code==='NC-SEN')");
 assert.equal(calledRace.provider_called_party,'R',
  'Only fresh verified detailed provider response may reactivate source calls');
 ncCalledParty='D';
 await w.eval('enCivicFetchOne({office:"Senate",key:"NC"})');
 w.eval('jointRender(false)');
 calledRace=w.eval("jointForecastResult().race_probabilities.find(r=>r.race_code==='NC-SEN')");
 assert.equal(calledRace.dem_beats_rep_pct,100,
  'Same-timestamp corrected provider call must reverse simulated winner');
 ncCalledParty=null;
 await w.eval('enCivicFetchOne({office:"Senate",key:"NC"})');
 w.eval('jointRender(false)');
 calledRace=w.eval("jointForecastResult().race_probabilities.find(r=>r.race_code==='NC-SEN')");
 assert.equal(calledRace.provider_called_party,null,
  'Withdrawing a winner call restores uncertain election-night simulation');
 w.eval('enWatchToggle({office:"Senate",key:"NC"})');
 w.fetch=beforeNcFetch;
 w.eval('jointRender(true)');
 // Synthetic provider-call regressions may legitimately queue the Fish Head
 // broadcast. They must not contaminate the independent Fish Head test below.
 w.eval('enFishDismiss()');
 get('#enAlertClear').click();
 fishAudioPlays=beforeSourceCallFishPlays;
 assert.equal(get('#enMilestoneDesk').hidden,false,'2026 mode reveals achievements');
 assert.equal(get('#enMilestoneGrid').querySelectorAll('.en-milestone-card').length,10);
 assert.equal(get('#jointNightSensitivity').open,false,
  'Keep optional probability-model switches off the ambient election-night screen');
 const posterCards=[...get('#enMilestoneGrid').querySelectorAll('.en-milestone-card')];
 assert.equal(posterCards.filter(el=>el.querySelector('img.en-milestone-thumb')).length,10,
  'Every milestone gets its own original or owner-supplied illustrated thumbnail');
 assert(posterCards[3].querySelector('img.en-milestone-thumb').getAttribute('src')
  .includes('celebration-owner-kansas.jpg?v=26f7df1f64f4'),
  'Kansas thumbnail must use the exact owner-supplied painting revision');
 assert(posterCards.every(el=>el.dataset.state==='waiting'),
  'Posters may be previewed before results, but must not claim earned status');
 posterCards[3].click(); // Kansas · John Brown-inspired art
 assert.equal(get('#enMilestoneSpotlight').open,true,'Preview must invoke the dialog API');
 assert.match(get('#enMilestoneKicker').textContent,/PREVIEW/,
  'A locked milestone is an explicit preview, not a called victory');
 assert.equal(get('#enMilestonePoster').hidden,false);
 assert(get('#enMilestonePoster').getAttribute('src').includes('celebration-owner-kansas.jpg?v=26f7df1f64f4'),
  'Kansas achievement must feature the owner-supplied fictional painting');
 assert(get('#enMilestonePoster').classList.contains('owner-celebration-art'));
 assert(!get('#enMilestonePoster').classList.contains('historic-john-brown'));
 assert.equal(get('#enJohnBrownPosterTitle').hidden,true);
 assert.match(get('#enMilestoneSource').textContent,/Owner-supplied fictional artwork/);
 assert.doesNotMatch(get('#enMilestoneSource').textContent,/Library of Congress|authentic 1859/,
  'Never attribute the supplied fictional painting as an authenticated archival photograph');
 assert.match(get('#enMilestonePoster').alt,/John Brown/i);
 assert.equal(get('#enTsunamiMeme').hidden,true);
 get('#enMilestoneClose').click();
 get('#enTsunamiPreview').click();
 assert.equal(get('#enMilestonePoster').hidden,true,
  'Switching to the Blue Tsunami preview must hide the previous state-specific poster');
 assert.equal(get('#enJohnBrownPosterTitle').hidden,true);
 assert.match(get('#enMilestoneKicker').textContent,/PREVIEW/);
 assert.match(get('#enMilestoneTitle').textContent,/BLUE WAVE/);
 assert.match(get('#enMilestoneSource').textContent,/DEMO ONLY/);
 assert.equal(get('#enTsunamiMeme').hidden,false);
 assert.equal(get('#enTsunamiMeme').getAttribute('src'),'./assets/blue-tsunami-meme.svg');
 assert.equal(get('#enMilestoneArt').hidden,true);
 get('#enMilestoneClose').click();
 assert.equal(get('#enMilestoneSpotlight').hidden,true);
 assert.equal(get('#enMilestoneSpotlight').open,false,'Dismiss must close the dialog API as well as hide it');
 const firstUpdate={kind:'first',source:'Open America',title:'VA-02 first votes',
  details:'Source reports the first ballots; no candidate called'};
 const nextUpdate={kind:'flip',source:'civicAPI',title:'NC-SEN leader changed',
  details:'Reported vote leader changed; no winner called'};
 const thirdUpdate={kind:'revision',source:'Open America',title:'OH-SEN revised',
  details:'Candidate totals corrected'};
 const beforeBulletinPlays=fishAudioPlays;
 assert.equal(w.eval('enFishShow('+JSON.stringify(firstUpdate)+',false)'),true,
  'First vote bulletin must qualify for Fish Head interruption');
 assert.match(get('#enFishMode').textContent,/FIRST VOTES/);
 assert.equal(fishAudioPlays,beforeBulletinPlays+1);
 assert.equal(w.eval('enFishShow('+JSON.stringify(nextUpdate)+',false)'),true);
 assert.equal(w.eval('enFishShow('+JSON.stringify(thirdUpdate)+',false)'),true);
 assert.equal(fishAudioPlays,beforeBulletinPlays+1,'Pending updates should not cut the first audio off');
 assert.equal(w.eval('enFishQueueState().pending'),2);
 w.eval('enFishNextBulletin()');
 assert.equal(fishAudioPlays,beforeBulletinPlays+2,'Second alert must replay the MP3 once the first is done');
 assert.match(get('#enFishHeadline').textContent,/NC-SEN/);
 w.eval('enFishNextBulletin()');
 assert.equal(fishAudioPlays,beforeBulletinPlays+3,'Third alert must get its own original MP3 intro');
 assert.match(get('#enFishHeadline').textContent,/OH-SEN/);
 get('#enFishDismiss').click();
 assert.equal(w.eval('enFishQueueState().pending'),0,'Dismiss clears pending popups');
 if(!priorNightMode2026)get('#enMode2024').click();
 w.Date.now=fishOldClock;
 if(!priorNightVisible)get('#electionNight').classList.remove('active');

 const bogusCall={kind:'call',source:'civicAPI',title:'VA-02 provider call',
  details:'Preview only; no real returns exist'};
 assert.equal(w.eval('enFishShow('+JSON.stringify(bogusCall)+',false)'),false,
  'Do not show Fish Head results interruptions prior to Election Day');
 assert.equal(w.eval('enFishShow('+JSON.stringify({
  ...bogusCall,kind:'flip'})+',false)'),false,
  'Uncalled leader change cannot be promoted to breaking call');
 assert.equal(fish.hidden,true,'No fake election outcomes may appear');
 // A deliberately NON-PRODUCTION shared-error sensitivity that preserves
 // the original baseline odds and does not read Silver paid CSV values.
 assert(get('#jointHomeCorrelationDetails'),'Senate covariance research must be discoverable');
 const beforeCorrelationSenate=w.eval('jointForecastResult().senate_dem_control_pct');
 const beforeCorrelationHouse=w.eval('jointForecastResult().house_dem_control_pct');
 get('#jointHomeCorrelationDetails').open=true;
 w.eval('jointRender(true)');
 assert.match(get('#jointHomeCorrelation').textContent,/Production shared risk/);
 assert.match(get('#jointHomeCorrelation').textContent,/Moderately lower shared risk/);
 assert.match(get('#jointHomeCorrelation').textContent,/2020 \+5\.72 D/);
 assert.match(get('#jointHomeCorrelation').textContent,/2018 \+2\.83 D/);
 assert.match(get('#jointHomeCorrelation').textContent,/four-cycle|Four-cycle/);
 assert.match(get('#jointHomeCorrelation').textContent,/NOT promoted/);
 assert.match(get('#jointHomeCorrelation').textContent,/DOES NOT change the live prediction/);
 assert.equal(w.eval('jointForecastResult().senate_dem_control_pct'),beforeCorrelationSenate);
 assert.equal(w.eval('jointForecastResult().house_dem_control_pct'),beforeCorrelationHouse);
 get('#jointHomeCorrelationDetails').open=false;
 assert.match(get('#modelEngineTag').textContent,/2026 Senate model · poll-depth forecast v5/);
 assert.equal(w.eval('jointRaceOddsResult()').senate_prior_mode,'current_2026');
 assert.equal(w.eval("jointForecastResult().race_probabilities.find(x=>x.race_code==='MN-SEN').poll_weight"),.90);
 // Browser-only CSV ingestion must really update displayed model and restore it
 // without leaking Silver source rows or feeding completed forecast probabilities.
 assert(get('#privateContextFiles').type==='file');
 const baselineMN=w.eval("jointForecastResult().race_probabilities.find(x=>x.race_code==='MN-SEN').model_dem_margin_points");
 const baselineSenate=w.eval('jointForecastResult().senate_dem_control_pct');
 const fakeFundamentals=['X.1,X.2,~~~Fundamentals~~~,X.3,X.4',
  'Race,Polls,Simple,Fancy,Blended',
  'MN,D +3@@3,D +10@@10,D +16@@16,D +20@@20',
  'NC,D +9@@9,D +6@@6,D +7@@7,D +8@@8',
  'GA,D +8@@8,D +10@@10,D +12@@12,D +14@@14'].join('\n')+'\n';
 const privateFile={name:'senate_fundamentals.csv',size:fakeFundamentals.length,
  text:async()=>fakeFundamentals};
 await w.eval('importPrivateContextFiles')([privateFile]);
 assert.match(get('#modelEngineTag').textContent,/LOCAL CSV CONTEXT ACTIVE/);
 assert.match(get('#privateContextStatus').textContent,/senateFundamentals/);
 assert.notEqual(w.eval("jointForecastResult().race_probabilities.find(x=>x.race_code==='MN-SEN').model_dem_margin_points"),baselineMN);
 assert.match(get('#privateContextComparison').textContent,/published model/);
 assert(w.eval('jointBaselineForecastResult()'),'Private model must preserve baseline comparison');
 assert.equal(w.eval('jointBaselineForecastResult().senate_dem_control_pct'),baselineSenate);
 assert.equal(get('#privateContextRemember').checked,true);
 const savedKey=w.PrivateSenateFundamentals.STORAGE_KEY;
 assert(w.localStorage.getItem(savedKey),'Imported context should be saved automatically');
 assert.equal(w.PrivateSenateFundamentals.restoreDevice(w.localStorage).data
    .senateFundamentals.MN.blended,20);
 const importTimestamp=w.PrivateSenateFundamentals.restoreDevice(w.localStorage).imported_at;
 get('#privateContextHouse').click();
 assert.equal(w.PrivateSenateFundamentals.restoreDevice(w.localStorage).imported_at,
  importTimestamp,'Changing model options must not silently freshen stale inputs');
 get('#privateContextRemember').click();
 assert.equal(w.localStorage.getItem(savedKey),null,
  'Opting out must remove saved subscriber data');
 assert.match(get('#modelEngineTag').textContent,/LOCAL CSV CONTEXT ACTIVE/,
  'Opting out of persistence must not disable active in-memory model');
 get('#privateContextRemember').click();
 assert(w.localStorage.getItem(savedKey),
  'Reenabling persistence must save active imported context');
 get('#privateContextClear').click();
 assert.equal(w.localStorage.getItem(savedKey),null,
  'Clear must remove ALL locally stored subscriber context');
 assert.match(get('#modelEngineTag').textContent,/2026 Senate model/);
 assert.equal(w.eval("jointForecastResult().race_probabilities.find(x=>x.race_code==='MN-SEN').model_dem_margin_points"),baselineMN);
 assert.equal(w.eval('jointForecastResult().senate_dem_control_pct'),baselineSenate);
 assert.equal(w.eval("jointForecastResult().race_probabilities.find(x=>x.race_code==='NJ-SEN').source_method.includes('public_solid_no_poll_')"),true);
 // Reproduce the actual failure behind 62.2% Minnesota: an old cached
 // chamber_control_model.js silently ignores the new Senate options.
 const freshEngine=w.ChamberControlModel;
 w.ChamberControlModel={...freshEngine,prepare:()=>({
  senate_prior_mode:'legacy_2020',senate:[]})};
 w.eval('jointSetSources({})');
 assert.match(get('#modelEngineTag').textContent,/Outdated model script detected/);
 assert.equal(w.eval('jointRaceOddsResult()'),null,
  'A legacy engine cannot surface 2020-era odds as current 2026 forecasts');
 assert.equal(w.eval('jointForecastResult()'),null,
  'Legacy chamber odds must fail shut instead of impersonating the new model');
 w.ChamberControlModel=freshEngine;
 await w.eval('jointLoadSources()');
 assert.equal(w.eval('jointRaceOddsResult()').senate_prior_mode,'current_2026');
 assert.match(get('#modelEngineTag').textContent,/2026 Senate model · poll-depth forecast v5/);
 // Race odds and chamber control derive from ONE correlated Monte Carlo.
 const oddsData=w.eval('jointRaceOddsResult()');
 assert(oddsData,'Linked joint simulation must publish race odds');
 assert.equal(oddsData.schema_version,'joint-race-probabilities-v1');
 assert.equal(oddsData.race_probability_method,
  'SAME_CORRELATED_DRAWS_AS_CHAMBER_CONTROL');
 assert.equal(oddsData.samples,3000);
 assert.deepEqual(Object.fromEntries(['senate','house','governor'].map(office=>
  [office,oddsData.records.filter(r=>r.office===office).length])),{
  senate:model.senate_all.filter(r=>['multi_poll','single_poll'].includes(r.status)).length,
  house:model.house.filter(r=>['multi_poll','single_poll'].includes(r.status)).length,
  governor:model.governor.filter(r=>['multi_poll','single_poll'].includes(r.status)).length
 });
 assert.equal(w.eval('jointRaceOddsIntegrity()'),true);
 const msPoll=model.senate_all.find(x=>x.race_code==='MS-SEN');
 const msOdds=w.eval("jointForecastResult().race_probabilities.find(x=>x.office==='senate'&&x.race_code==='MS-SEN')");
 // Rolling data must never require a specific old poll (particularly after a
 // documented fake pollster is removed). Every Senate race retains model odds;
 // when no qualified Mississippi poll remains, the site must say that plainly.
 assert(msOdds,'Mississippi must remain in all-35-race Senate model');
 const msSpotlight=get('#mississippiSenateWatch').textContent;
 assert.match(msSpotlight,/Mississippi · U.S. Senate/);
 if(msPoll&&['single_poll','multi_poll'].includes(msPoll.status)){
  assert(msSpotlight.includes(msPoll.dem_candidate));
  assert(msSpotlight.includes(msPoll.rep_candidate));
  assert.match(msSpotlight,/independent/);
 }else{
  assert.match(msSpotlight,/No current qualified poll/);
  assert.match(msSpotlight,/Awaiting a qualified survey/);
 }
 assert(msSpotlight.includes((msOdds.dem_beats_rep_pct>=50?'D ':'R ')+
  (msOdds.dem_beats_rep_pct>=50?msOdds.dem_beats_rep_pct:
   100-msOdds.dem_beats_rep_pct).toFixed(1)+'%'));
 assert.match(get('#mississippiWatchAsOf').textContent,/same joint model as Four Endings/);
 const iaTide=[...get('#senateTideRaces').querySelectorAll('[data-senate-tide]')].find(x=>
  x.dataset.senateTide==='IA-SEN');
 assert(iaTide,'Iowa must be in the live Senate tide line');
 const currentIowa=model.senate_all.find(x=>x.race_code==='IA-SEN');
 assert(currentIowa,'Iowa must remain in the 2026 Senate polling universe');
 const iowaValid=['single_poll','multi_poll'].includes(currentIowa.status)&&
  Number.isFinite(currentIowa.dem_minus_rep);
 if(iowaValid){
  const displayedMargin=w.eval('marginText('+currentIowa.dem_minus_rep+')');
  assert(iaTide.textContent.includes(displayedMargin),
   'Iowa tide margin must match the current qualifying Senate polling average');
  const firm=(currentIowa.pollsters||[]).find(x=>/marist/i.test(x.name));
  const raw=primary.races.find(x=>x.race_code==='IA-SEN')?.polls.find(p=>
   p.poll_id===firm?.poll_id&&p.field_end===firm?.field_end);
  if(firm&&raw){
   assert(iaTide.textContent.includes(firm.name+' '+firm.field_end),
    'Featured poll must be the actual currently included Marist wave');
   assert(iaTide.textContent.includes(
    String(raw.sample_population||'sample').toUpperCase()+' '+
    w.eval('marginText('+raw.margin+')')+' INCLUDED'),
    'Featured poll must use its actual current sample and observed margin');
   const alternate=recent.observations.find(x=>
    x.race_code==='IA-SEN'&&x.poll_id===firm.poll_id&&
    x.sample_population!==raw.sample_population);
   if(alternate)assert(iaTide.textContent.includes('not double-counted'),
    'Alternate population in the same Iowa poll must not count as a second wave');
   assert(iaTide.textContent.includes('combined mean '+displayedMargin),
    'Iowa source spotlight must show the current live polling mean');
  }
 }else assert(iaTide.textContent.includes('No poll'),
  'No current Iowa sample must not produce a fabricated margin');
 assert(!html.includes('DDHQ published forecast · comparison only'));
 assert(!html.includes('scenarioCenter'));
 assert(!html.includes('enForecastSource'));
 assert.match(get('#modelOddsNumbers').textContent,/DEMOCRATIC/);
 assert.match(get('#modelOddsNumbers').textContent,/REPUBLICAN/);
 // Full joint probabilities and the historical poll-only input must be
 // simultaneously inspectable in any race, using exactly the same snapshot.
 for(const code of ['TX-SEN','OH-SEN']){
  w.eval('navigateInsightToModel({office:"senate",race:{race_code:"'+code+'"}})');
  const diagnostic=get('#modelOddsReconciliation').textContent;
  const fromSource=fixtures['race_probabilities.json'].records.find(r=>
   r.office==='senate'&&r.race_code===code);
  const joint=w.eval('jointRaceOddsResult()').records.find(r=>
   r.office==='senate'&&r.race_code===code);
  assert(fromSource&&joint);
  assert(diagnostic.includes('Poll-only diagnostic: D '+fromSource.dem_beats_rep_pct.toFixed(1)+'%'),
   'Poll-only percentage must come from the live source JSON for '+code);
  assert(diagnostic.includes('Full joint forecast: D '+joint.dem_beats_rep_pct.toFixed(1)+'%'),
   'Joint percentage must match the displayed correlated forecast for '+code);
  assert(diagnostic.includes('poll weight '+Math.round(100*joint.poll_weight)+'%'),
   'Every polled Senate race must explain its actual source weighting');
  assert(diagnostic.includes('projected margin '+w.eval('marginText('+joint.model_dem_margin_points+')')),
   'Displayed model margin must be traced to the live joint simulation');
  assert.match(diagnostic,/NOT active on this device/);
  if(code==='OH-SEN')assert.match(diagnostic,/Special-election tier/);
 }
 // The homepage list and combined Race Lab must survive the UI restructure.
 assert(get('#senateTideRaces').querySelectorAll('.tide-race').length>=15);
 const msTide=get('#senateTideRaces [data-senate-tide="MS-SEN"]').textContent;
 assert(get('#senateTideRaces [data-senate-tide="MS-SEN"]').dataset.senateTide==='MS-SEN',
  'Mississippi 2026 Senate race must retain its stable race identity');
 if(!msPoll||!['single_poll','multi_poll'].includes(msPoll.status))
  assert(msTide.includes('No poll'),'Unpolled Mississippi race must not invent a candidate average');
 assert.match(get('#senateTideRaces [data-senate-tide="SC-SEN"]').textContent,/South Carolina/);
 assert.match(get('#senateTideRaces [data-senate-tide="SC-SEN"]').textContent,/Darline Graham/);
 assert.match(get('#senateTideRaces [data-senate-tide="ME-SEN"]').textContent,/model win chance/);
 assert.equal(get('#raceWorkbench').open,false,'Survey explorer collapses inside JackStradamus');
 assert.equal(w.document.querySelectorAll('.tab[data-page="races"]').length,0,
  'Race Lab is a single integrated JackStradamus destination');
 assert.match(get('.joint-cell.d-split').textContent,/SHRUG/);
 assert(!w.document.querySelector('.joint-cell.split'),'No collision with sitewide flex .split');
 assert(!w.document.querySelector('#tsunamiReachWatch'),'Legacy Graham promo is removed');
 assert.match(get('.brief-intro h2').textContent,/Today’s tide schedule/);
 // A narrow TX lead can round to the same integer odds for two distinct
 // error settings. Select MN (a stronger sensitivity case) before verifying
 // that the model's 3,000-draw probability actually changes on screen.
 w.eval("navigateInsightToModel({office:'senate',race:{race_code:'MN-SEN'}})");
 assert.match(get('#modelDetail').textContent,/Minnesota/);
 const baselineOdds=get('#modelOddsNumbers').textContent;
 const widthWide=get('.model-odds-presets [data-odds-width="wide"]');
 widthWide.click();
 assert.equal(widthWide.getAttribute('aria-pressed'),'true');
 assert.notEqual(get('#modelOddsNumbers').textContent,baselineOdds,
   'Changing the error assumption must update the displayed model percentages');
 get('.model-odds-presets [data-odds-width="tight"]').click();
 assert.equal(get('.model-odds-presets [data-odds-width="tight"]').getAttribute('aria-pressed'),'true');
 get('.model-odds-presets [data-odds-width="standard"]').click();
 assert.match(get('#modelOddsContext').textContent,/Same 3,000 correlated draws/);
 // JackStradamus race board must foreground the published conditional
 // model odds, not hide them inside the selected race's detail panel.
 assert.match(get('#modelProbabilityCoverage').textContent,/of \d+ current polled senate races/);
 assert.match(get('#modelBoard').closest('.model-board').querySelector('.model-board-header').textContent,/D\/R WIN PROBABILITY/);
 const senateRows=get('#modelBoard').querySelectorAll('.model-race-row');
 assert.equal(senateRows.length,oddsData.records.filter(r=>r.office==='senate').length);
 assert.equal(get('#modelBoard').querySelectorAll('.model-race-win-probabilities').length,
  senateRows.length,'Every polled Senate row must expose source-matched two-party model odds');
 assert.match(senateRows[0].querySelector('.model-race-win-probabilities').textContent,/D .*%R .*%/);
 assert.match(senateRows[0].querySelector('.model-race-edge').textContent,/Poll [DR] [+-]/);
 get('[data-model-scope="house"]').click();
 assert.match(get('#modelProbabilityCoverage').textContent,/current polled house races/);
 assert.match(get('#modelProbabilityCoverage').textContent,/173 seats in nine redrawn states/,
  'Model must disclose redrawn map geometry rather than suggest precise old-district voting trends');
 assert.equal(get('#modelBoard').querySelectorAll('.model-race-win-probabilities').length,
  oddsData.records.filter(r=>r.office==='house').length);
 get('[data-model-scope="governor"]').click();
 assert.equal(get('#modelBoard').querySelectorAll('.model-race-win-probabilities').length,
  oddsData.records.filter(r=>r.office==='governor').length);
 get('[data-model-scope="generic"]').click();
 assert.match(get('#modelProbabilityCoverage').textContent,/not a two-candidate/);
 assert.equal(get('#modelBoard').querySelectorAll('.model-race-win-probabilities').length,0);
 get('[data-model-scope="senate"]').click();
 get('[data-senate-tide="SC-SEN"]').click();
 assert.equal(get('.tab[data-page="model"]').getAttribute('aria-selected'),'true');
 assert.equal(w.location.hash,'#model/senate/SC-SEN','SC tide race opens its exact candidate model');
 assert.equal(get('#raceWorkbench').open,false,'Tide click does not force open poll explorer');
 assert(get('#senateEstimateCards').querySelectorAll('.senate-card-odds').length>0,
  'Senate intelligence cards should also show conditional model odds');
 assert.match(get('#senateEstimateCards').textContent,/JACKSTRADAMUS · CORRELATED JOINT MODEL/);
 assert.doesNotMatch(get('#senateEstimateCards').textContent,/Not assessed/,
  'Missing source coverage cannot masquerade as an ambiguous risk score');
 assert.match(get('#senateEstimateCards').textContent,/No documented case in our limited ledger/,
  'A state with no matching source must display the coverage gap');
 assert.match(get('#bullCoverageSummary').textContent,/documented incidents in/);
 assert.match(get('#bullCoverageSummary').textContent,/remaining states have unknown risk, not zero/);
 assert.match(get('#senateEstimateCards').textContent,/coverage gap, not a judgment/);
 assert(get('#bullScoreStates').querySelectorAll('.bs-state-row').length>0,
  'Verified source states keep their documented incident cards');

 const misdatedOdds=structuredClone(oddsData);
 misdatedOdds.polling_source_generated_at='2026-01-01T00:00:00Z';
 assert.equal(w.eval('modelOddsValidate('+JSON.stringify(misdatedOdds)+','+JSON.stringify(model)+')'),false);
 w.eval('setModelRaceOddsData('+JSON.stringify(misdatedOdds)+')');
 assert.equal(get('#modelBoard').querySelectorAll('.model-race-win-probabilities').length,0);
 assert.match(get('#modelProbabilityCoverage').textContent,/model odds pending a matching/);
 w.eval('setModelRaceOddsData('+JSON.stringify(oddsData)+')');
 assert.equal(get('#modelBoard').querySelectorAll('.model-race-win-probabilities').length,
  oddsData.records.filter(r=>r.office==='senate').length);

 const fakeRaceOdds=structuredClone(oddsData);
 fakeRaceOdds.records[0].dem_beats_rep_pct=-1;
 assert.equal(w.eval('modelOddsValidate('+JSON.stringify(fakeRaceOdds)+','+JSON.stringify(model)+')'),false,
  'Invalid candidate-matched model probability input fails closed');

 // Distinguish observed historical election variation from a calibrated
 // outcome forecast. Audit exactly the 197 map-comparable party-vote seats.
 const researchDrawer=get('.model-research-drawer');
 assert(!researchDrawer.open,'Historical research must be collapsed by default');
 assert(researchDrawer.querySelector('#senateBacktestSummary'),
   'Historical research must still exist inside the drawer');
 assert(!researchDrawer.contains(get('#modelBoard')),
   'Current 2026 polling race board must remain visible without opening the research drawer');
 researchDrawer.open=true;
 assert.equal(researchDrawer.open,true);
 researchDrawer.open=false;
 assert.match(get('#jointHomeSummary').textContent,/D House control [0-9.]+%/);
 assert.match(get('#jointHomeSummary').textContent,/D Senate control [0-9.]+%/);
 assert.match(get('#jointHomeSummary').title,/central 90% D seats/);
 assert.match(get('#jointNightSummary').textContent,/D House control [0-9.]+%/);
 assert.match(get('#jointHomeShadow').textContent,/197\/435 House districts/);
 assert.match(get('#jointHomeShadow').textContent,/NOT independently backtested/);
 assert.match(get('#jointNightShadow').textContent,/research only|Research only/i);
 const shadowDisclosure=get('#jointHomeShadow').parentElement;
 shadowDisclosure.open=true;
 w.eval('jointRender(true)');
 assert.match(get('#jointHomeShadow').textContent,/for both chambers vs/);
 assert.match(get('#jointHomeShadow').textContent,/2024 presidential district lean: 435\/435/);
 assert.match(get('#jointHomeShadow').textContent,/do not replace headline odds/);
 shadowDisclosure.open=false;
 const twoCycle=json('data/house_two_cycle_context.json');
 assert.equal(twoCycle.coverage.districts_with_two_historical_major_party_shares,197);
 const points=w.eval('historicalHouseSwingSample('+JSON.stringify(twoCycle)+')');
 assert.equal(points.length,197,'Only directly comparable 2022/24 House races');
 assert(points.every(Number.isFinite));
 assert.equal(points[0]<=points.at(-1),true,'Sorted historical shifts');
 assert(twoCycle.rows.some(x=>x.race_code_2026==='TX-01'&&!x.can_compare_historic_two_party_votes),
  'Changed-map Texas seat must be excluded');
 w.eval('renderHouseHistoricalSwing('+JSON.stringify(twoCycle)+')');
 assert.match(get('#houseSwingSummary').textContent,/197 \/ 435/);
 assert.match(get('#houseSwingNote').textContent,/NOT a calibrated polling-error distribution/);
 const bins=[...get('#houseSwingDistribution').querySelectorAll('.house-history-bin')];
 assert.equal(bins.length,8);
 assert.equal(bins.reduce((n,x)=>n+Number(x.querySelector('strong').textContent),0),197,
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
 const localQuestions=json('data/substate_poll_signals.json');
 w.eval('renderSubstatePollSignals('+JSON.stringify(localQuestions)+')');
 assert.equal(get('#wireSubstateCount').textContent,'2 source-verified local questions');
 assert.equal(get('#wireSubstateSignals').querySelectorAll('.wire-local-row').length,2);
 assert.match(get('#wireSubstateSignals').textContent,/TX-09 electorate/);
 assert.match(get('#wireSubstateSignals').textContent,/NOT a statewide Texas margin/);
 assert(get('#wireSubstateSignals').textContent.includes('R +1.0 pts'),
  'TX-09 Senate ballot margin must remain localized and correct');
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
 w.eval('updateFeedGlance()');
 assert.match(get('#feedResults').textContent,/Nov 3/,
  'Switching to 2026 before counting must show scheduled source status');
 assert.equal(get('#feedResults').dataset.status,'scheduled');
 assert.equal(get('#enArchiveOutcome').hidden,true,
  'Returning to 2026 must restore active probability forecast and hide history');
 assert(!get('#jointNightPanel').classList.contains('en-archive-mode'));
 assert.equal(get('#enAdvancedLab').hidden,false,
  '2026 forecast research should be restored when switching from archive');
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
 w.eval('updateFeedGlance()');
 assert.match(get('#feedResults').textContent,/2024 archive/,
  'Historical returns must not be shown as a live 2026 reporting source');
 await w.eval('enLoad(true)');
 assert.equal(get('#enArchiveOutcome').hidden,false,
  '2024 should show a retrospective historical control outcome');
 assert.match(get('#enArchiveOutcome').textContent,/2024 ACTUAL OUTCOME/);
 assert.match(get('#enArchiveOutcome').textContent,/Republicans won both chambers/);
 assert.match(get('#enArchiveOutcome').textContent,/220 R \/ 215 D/);
 assert.match(get('#enArchiveOutcome').textContent,/53 R \/ 47 D-caucus/);
 assert(get('#jointNightPanel').classList.contains('en-archive-mode'),
  '2026 simulated win percentages must not be visible during 2024 archive');
 assert.equal(get('#enAdvancedLab').hidden,true,
  '2024 must hide secondary 2026 model probabilities and rehearsal research');
 assert.equal(get('#jointNightPanel .joint-grid').getAttribute('id'),'jointNightCards');
 assert.match(get('#jointNightPanel .joint-title h3').textContent,/2024/);
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
 assert(w.ElectionNightReconciliation?.reconcile,
  'National coverage engine must load before the 2026 results app');
 assert.match(get('#enCoverageReconciliation').textContent,/2024 historical archive/,
  '2024 recorded vote totals must never masquerade as 2026 national coverage');
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
 assert.match(get('#enStatus').textContent,/37 districts missing one major party/);
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
 assert.equal(get('#enRaceDeskDetails').open,false,
  'Detailed race counts must not overwhelm the ambient all-election page');
 assert.match(get('#enAllOfficeSummary').textContent,/2024 ARCHIVE/);
 get('#enJumpSenate').click();
 assert.equal(get('#enRaceDeskDetails').open,true,
  'Senate ambient card must open the detailed result section');
 assert.equal(get('#enOfficeSenate').getAttribute('aria-pressed'),'true');
 await w.eval('enLoad(true)');
 assert.equal(get('#enRaces').textContent,'35');
 assert.match(get('#enStatus').textContent,/2024 SENATE ARCHIVE/);
 assert(get('#enRaceList').textContent.includes('NE-special'));
 assert.match(get('#enDetailMeta').textContent,/U.S. Senate candidate-party returns/);
 // Returning to 2024 House must not leak state-level Senate results.
 get('#enJumpHouse').click();
 assert.equal(get('#enOfficeHouse').getAttribute('aria-pressed'),'true');
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
 const fakeSnap=(at,candidate,margin,method=model.method_version)=>({
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
 // Use the actual newly published survey IDs and two distinct offices.
 // Date-specific Recon/GBAO fixtures are not permanent release contracts.
 const linkedPosted={};
 for(const [office,race] of [['senate',txSen],['governor',txGov]]){
  const raw=primary.races.find(x=>x.race_code===race.race_code);
  const includedIds=new Set((race.pollsters||[]).map(x=>x.poll_id).filter(Boolean));
  const p=recent.observations.find(p=>p.race_code===race.race_code&&
   includedIds.has(p.poll_id)&&raw?.polls.some(x=>
    x.poll_id===p.poll_id&&x.field_end===p.field_end&&
    x.pollster===p.pollster&&x.dem_name===p.dem_name&&
    x.rep_name===p.rep_name&&Math.abs(x.dem-p.dem)<.11&&Math.abs(x.rep-p.rep)<.11));
  assert(p,'No current source-matched '+office+' survey for '+race.race_code);
  linkedPosted[office]=p;
  assert.equal(w.eval('postedMatchesModelSurvey('+JSON.stringify(p)+','+
   JSON.stringify(race)+')'),true,'Exact source identity failed in '+office);
  w.eval('navigateInsightToModel({office:'+JSON.stringify(office)+',race:'+
   JSON.stringify(race)+',poll:'+JSON.stringify(p)+'})');
  assert.match(get('#modelDetailTitle').textContent,
   new RegExp('Texas.*'+(office==='senate'?'Senate':'Governor')));
  const highlighted=get('#modelPollRows tr.model-featured-poll');
  assert(highlighted.textContent.includes(p.pollster),
   'Different survey was selected for '+office+' '+p.poll_id);
  assert.match(get('#modelPollStatus').textContent,/Observations matched|All observations/);
  assert.equal(get('#modelDetailEyebrow').textContent.includes(office.toUpperCase()),true);
  // Source links are only shown for individually verified upstream URLs.
  // Primary ElectIndex observations without a direct topline link must not
  // pretend that a poll-specific source URL exists.
  const rawMatched=raw.polls.find(x=>x.poll_id===p.poll_id&&
   x.pollster===p.pollster&&x.field_end===p.field_end);
  const direct=rawMatched?.source_poll_url;
  const hasDirectSource=typeof direct==='string'&&
   (direct.startsWith('https://')||direct.startsWith('http://'));
  assert.equal(Boolean(highlighted.querySelector('a[href]')),hasDirectSource,
   'Poll drilldown link must match actual available direct source: '+office);
 }
 // A governor question is never evidence for a Senate contest, even if an
 // upstream study reuses its poll ID for both offices.
 const mistaken={...linkedPosted.governor,poll_id:linkedPosted.senate.poll_id};
 assert.equal(w.eval('postedMatchesModelSurvey('+JSON.stringify(mistaken)+','+
  JSON.stringify(txSen)+')'),false,'Cross-office poll identity contaminated race');
 // An excluded source poll must open All recent, not be marked as included.
 const includedSenateIds=new Set((txSen.pollsters||[]).map(x=>x.poll_id).filter(Boolean));
 const oldExcluded=primary.races.find(x=>x.race_code==='TX-SEN')?.polls.find(p=>
  !includedSenateIds.has(p.poll_id)&&p.dem_name===txSen.dem_candidate&&
  p.rep_name===txSen.rep_candidate);
 assert(oldExcluded,'Need an excluded survey to test drilldown');
 const oldLink={race_code:'TX-SEN',poll_id:oldExcluded.poll_id,
  pollster:oldExcluded.pollster,field_end:oldExcluded.field_end,
  source_url:oldExcluded.source_poll_url||null};
 w.eval('navigateInsightToModel({office:"senate",race:'+JSON.stringify(txSen)+
  ',poll:'+JSON.stringify(oldLink)+'})');
 assert.equal(get('#modelPollAll').getAttribute('aria-pressed'),'true',
  'Excluded survey must open All recent, not In average');
 assert(get('#modelPollRows tr.model-featured-poll').classList.contains('excluded'),
  'Excluded source wave should be highlighted but NOT included in average');
 // Every visible pulse card needs a race office. No repeated anonymous Texas.
 w.eval('renderRacePulse('+JSON.stringify(model)+')');
 for(const card of get('#racePulse').querySelectorAll('button.pulse-tile')){
  const label=card.querySelector('.pulse-race span')?.textContent||'';
  assert(/Senate|Governor|House|Generic ballot/.test(label),'Insight lacks office: '+label);
 }

 // Without a comparable prior model revision or actually recent matching
 // source poll, the pulse is required NOT to invent activity. Senate and
 // governor office identity and source-specific drilldown are validated above.
 const synthetic={generated_at:model.generated_at,senate_all:[txSen],house:[],
  governor:[txGov],generic_ballot:{status:'insufficient_data'}};
 // Supply an isolated empty evidence context. Do not reassign variables
 // declared in the separately evaluated application script: that does not
 // reliably mutate its lexical bindings and can create fake test failures.
 w.eval('renderRacePulse('+JSON.stringify(synthetic)+
  ',{history:null,postedSource:null})');
 const syntheticPulse=[...get('#racePulse').querySelectorAll('button.pulse-tile')];
 assert.equal(syntheticPulse.length,0,
  'No comparison history/new poll should yield no fabricated polling insight');
 assert.match(get('#racePulse').textContent,/Building comparison history|No meaningful movement/,
  'No eligible recent poll or meaningful movement should produce a truthful empty pulse');
 // DDHQ forecast removed; each race marginal comes from the joint simulation.
 assert.equal(w.document.querySelector('#scenarioBands'),null);
 assert.equal(w.document.querySelector('#scenarioCenter'),null);
 assert.match(get('#enForecastOdds').textContent,/Our model · D both/);
 assert.match(get('#enForecastOdds').textContent,/linked simulations/);
 const jointState=w.eval('jointForecastResult()');
 assert.equal(jointState.race_probability_method,'SAME_CORRELATED_DRAWS_AS_CHAMBER_CONTROL');
 const mnOdds=oddsData.records.find(x=>x.race_code==='MN-SEN');
 const mnJoint=jointState.race_probabilities.find(x=>x.race_code==='MN-SEN');
 assert(mnOdds&&mnJoint);
 assert.equal(mnOdds.dem_beats_rep_pct,mnJoint.dem_beats_rep_pct);
 assert(mnOdds.sigma_points>5.633);
 for(const x of oddsData.records){
  assert.equal(x.simulation_samples,jointState.samples);
  assert(Math.abs(x.dem_beats_rep_pct-100*x.simulated_dem_wins/x.simulation_samples)<.011);
 }
 // Sort all posted polls by full timestamps; no alphabetical field-end tie.
 const posted=recent.observations.filter(p=>p.posted_date>=new Date(Date.now()-14*86400000).toISOString().slice(0,10));
 const topTime=posted.reduce((max,p)=>{
  const t=w.eval('pollPostedStamp('+JSON.stringify(p)+')');
  return t>max?t:max;
 },'');
 assert(topTime,'No recent full timestamp data');
 assert(get('#newPolls').textContent.includes('Source posted'),'Posted date labels disappeared');
 // No isolated Graham promo: South Carolina belongs to the same live,
 // model-sourced Senate tide watchlist as the other pivotal races.
 assert.equal(w.document.querySelector('#tsunamiReachWatch'),null);
 const southCarolina=get('#senateTideRaces [data-senate-tide="SC-SEN"]');
 assert.match(southCarolina.textContent,/Darline Graham/);
 assert.match(southCarolina.textContent,/Wider wave/);
 assert.match(southCarolina.textContent,/model win chance/);
 assert.match(get('.tide-line-note').textContent,/not required conditions for a Blue Tsunami/);
 // Index-poll listing must preserve distinct ballot questions in one race,
 // unlike a poll-id-only dedupe that discards one matchup.
 const sameRace=recent.observations.find(p=>p.race_code==='TX-GOV');
 assert(sameRace,'Need TX governor posting to test shared-survey questions');
 const secondQuestion={...sameRace,question_id:'another-qualifying-question',
   dem_name:'Another named challenger'};
 const testSourceAt=new Date(Date.parse(recent.updated_at)+1000).toISOString();
 w.eval('setPostedPollingSnapshot('+JSON.stringify({updated_at:testSourceAt,
  observations:[sameRace,secondQuestion]})+')');
 assert.equal(get('#newPolls').querySelectorAll('.item').length,2,
  'Two same-poll distinct ballot questions should both display');
 assert.match(get('#changesSince').textContent,/2 source postings/);
 assert.match(get('#changesSince').textContent,/index checked/,
  'New polls desk needs the real last index-check timestamp');
 // Nationwide 2026 Senate desk derives all 35 seat IDs from the
 // published ballot universe. Florida/Ohio must be special, no phantom
 // noncontested-state Senate entry and no fabricated source counting.
 const senateUniverse=json('data/seat_universe.json');
 const validate35=w.eval('enNationalValidate('+JSON.stringify(senateUniverse)+')');
 assert.equal(validate35.length,35);
 assert.equal(validate35.filter(x=>x.kind==='special').length,2);
 assert.equal(JSON.stringify(validate35.filter(x=>x.kind==='special').map(x=>x.state)),JSON.stringify(['FL','OH']));
 w.eval('enNationalSetUniverse('+JSON.stringify(senateUniverse)+')');
 assert.equal(w.eval('enWatchParse("FL-SEN").key'),'FL-special');
 assert.equal(w.eval('enWatchParse("OH-SEN").key'),'OH-special');
 assert.equal(w.eval('enWatchParse("OH-SEN-SPECIAL").key'),'OH-special');
 assert.equal(w.eval('enWatchParse("NE-SEN-SPECIAL")'),null);
 assert.equal(w.eval('enWatchParse("CA-SEN")'),null,'California has no 2026 Senate contest');
 assert.equal(w.eval('enWatchParse("NC-SEN").key'),'NC');
 get('#enMode2026').click();
 assert.equal(get('#enNationalSenate').hidden,false);
 assert.equal(get('#enNationalRows').querySelectorAll('.en-national-seat').length,35);
 assert.match(get('#enNationalRows').textContent,/FL-SEN · SPECIAL/);
 assert.match(get('#enNationalRows').textContent,/OH-SEN · SPECIAL/);
 assert.match(get('#enNationalSummary').textContent,/35/);
 const corrupted35=structuredClone(senateUniverse);
 corrupted35.senate.contested_seats.pop();
 assert.equal(w.eval('enNationalValidate('+JSON.stringify(corrupted35)+')'),null,
   'A partial or corrupted election contest universe must never appear as all 35 races');
 const beforeFollow=w.localStorage.getItem('bluewaves_national_senate_2026_v1');
 w.eval('enNationalToggle(false)');
 assert.equal(get('#enNationalToggle').getAttribute('aria-pressed'),'false');
 assert.equal(w.eval('enNationalWatchItems().length'),0);
 // Use 2024 mode to activate tracking without live source fetches in tests.
 get('#enMode2024').click();
 w.eval('enNationalToggle(true)');
 assert.equal(w.eval('enNationalWatchItems().length'),35);
 assert.equal(w.localStorage.getItem('bluewaves_national_senate_2026_v1'),'true');
 get('#enMode2026').click();
 assert.equal(get('#enNationalRows').querySelectorAll('.en-national-seat').length,35);
 // Restore default paused mode for unrelated provider tests below.
 get('#enMode2024').click();
 w.eval('enNationalToggle(false)');
 get('#enMode2026').click();
 if(beforeFollow===null)w.localStorage.removeItem('bluewaves_national_senate_2026_v1');
 else w.localStorage.setItem('bluewaves_national_senate_2026_v1',beforeFollow);

 // Personal 2026 watchlist must be storable before Election Day and must
 // never silently turn source coverage gaps into zero-valued race results.
 assert.deepEqual(w.eval('enWatchParse("CA-53")'),null,'2026 California only has 52 voting House seats');
 assert.equal(w.eval('enWatchParse("AK-00").key'),'AK-00','At-large House uses 00');
 assert.equal(w.eval('enWatchParse(" NC-SEN ").office'),'Senate');
 assert.equal(w.eval('enWatchParse("TX-GOV").office'),'Governor');
 for(const impossible of ['WA-GOV','DE-GOV','CA-SEN','NY-SEN','OH-SENATE-SPECIAL']){
  assert.equal(w.eval('enWatchParse('+JSON.stringify(impossible)+')'),null,
   'The 2026 watchlist cannot invent a governor or Senate seat '+impossible);
 }
 assert.equal(w.eval('enWatchParse("FL-SEN").key'),'FL-special',
  '2026 Florida special Senate cannot silently become a regular seat');
 assert.equal(w.eval('enWatchParse("OH-SEN-SPECIAL").key'),'OH-special');
 assert.equal(w.eval('enWatchParse("NC-99")'),null);
 w.localStorage.removeItem('bluewaves_election_watch_2026_v1');
 w.eval('enWatched=[];enRenderWatchlist()');
 const drawer=get('#enWatchDrawer');
 assert.equal(drawer.tagName,'DETAILS');
 assert.equal(drawer.open,false,'Unpinned details must stay out of ambient default view');
 assert(drawer.querySelector('summary').contains(get('#enWatchCount')),
  'Saved watchlist race count must remain visible while secondary controls are collapsed');
 drawer.open=true;
 const watchInput=get('#enWatchInput'),watchForm=get('#enWatchForm');
 for(const race of ['NC-SEN','AZ-01','NH-SEN']){
  watchInput.value=race;
  watchForm.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 }
 assert.equal(get('#enWatchCount').textContent,'3 races');
 drawer.open=false;
 assert.equal(get('#enWatchCount').textContent,'3 races',
  'Watchlist count must stay visible while its contents are collapsed');
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
 // Validated probabilistic source bridge, actual 2026 dashboard controls.
 w.eval('enRenderLiveDesk()');
 assert.equal(get('.en-live-desk').hidden,false);
 assert.match(get('#enNowcastSummary').textContent,/race-level experimental diagnostics/);
 assert.match(get('#enNowcastRows').textContent,/NC-SEN/);
 assert.match(get('#enNowcastRows').textContent,/RAW-RETURN EXPERIMENT/);
 const ncNowcast=w.eval('enLiveRaceEstimate({office:"Senate",key:"NC"})');
 assert(ncNowcast&&ncNowcast.mode==='live_informed',
  'Only the current source-validated partial Senate count may update NC odds');
 assert(ncNowcast.demPct>0&&ncNowcast.demPct<100);
 assert.match(get('#enHealthRows').textContent,/Senate · Open America/);
 assert.match(get('#enHealthRows').textContent,/Supplemental · civicAPI/);
 assert.equal(get('#enNowcastRows').querySelectorAll('.en-live-race').length,8);
 // Real published polling + House history + audited geography: four
 // exhaustive national scenarios must render, not a DDHQ-only estimate.
 w.eval('jointRender(true)');
 assert.equal(get('#jointHomeCards').querySelectorAll('.joint-cell').length,4);
 assert.equal(get('#jointNightCards').querySelectorAll('.joint-cell').length,4);
 // Pre-election What-if must run the actual correlated model on a COPY of
 // the 506-race priors, not replace the default Tide-o-Meter probabilities.
 const defaultJointBeforeLab=w.eval('jointForecastResult()');
 assert(get('#electorateLabDetails')&&get('#labRun'),
  'Briefing must expose a runnable, interactive state electorate what-if');
 get('#labNoncollegeShare').value='45';
 get('#labNoncollegeShift').value='6';
 get('#labHispanicShare').value='8';
 get('#labHispanicShift').value='4';
 get('#labRun').click();
 assert.match(get('#labStatus').textContent,/MI D−R shift \+3\.02 pts/);
 assert(get('#labResults').querySelectorAll('tbody tr').length>=10,
  'State what-if must render real affected race probabilities, not a static label');
 assert.match(get('#labResults').textContent,/MI-SEN/);
 get('#labScope').value='blue-wall';
 get('#labRun').click();
 assert.match(get('#labStatus').textContent,/MI \/ PA \/ WI D−R shift \+3\.02 pts/);
 assert.match(get('#labResults').textContent,/WI-GOV/);
 assert.match(get('#labResults').textContent,/PA-01/);
 assert(get('#labResults').querySelectorAll('tbody tr').length>=40,
  'A multi-state scenario must expose all affected actual races together');
 assert.equal(w.eval('jointForecastResult()'),defaultJointBeforeLab,
  'Pre-election coalition experiment must never overwrite headline probabilities');
 get('#labNoncollegeShare').value='90';
 get('#labHispanicShare').value='90';
 get('#labRun').click();
 assert.match(get('#labStatus').textContent,/cannot exceed 100%/);
 get('#labReset').click();
 assert.equal(get('#labNoncollegeShare').value,'0');
 const needleForecast=w.eval('jointForecastResult()');
 const needleProb=needleForecast.probabilities;
 const expectedNeedlePosition=(needleProb.shrug+2*needleProb.blue_wave+
  3*needleProb.blue_tsunami)/(3*Object.values(needleProb).reduce((a,b)=>a+b,0))*100;
 for(const selector of ['#jointHomeNeedle','#jointNightNeedle']){
  const needle=get(selector);
  assert.match(needle.getAttribute('aria-label'),/2026 correlated Four Endings forecast/);
  assert.equal(needle.querySelectorAll('.four-needle-distribution span').length,4);
  assert.equal(needle.querySelectorAll('.four-needle-arc > path').length,4,
   'Semicircular dial must have four ordered outcome arcs');
  assert(needle.querySelector('.four-needle-arc-pointer')?.getAttribute('x2'),
   'Visible needle pointer must track correlated model');
  assert(needle.querySelector('.four-needle-arc-baseline'),
   'Baseline pointer must exist for later qualified vote returns');
  assert.match(needle.querySelector('.four-needle-footer').textContent,
   /PRE-ELECTION FORECAST|VERIFIED SOURCE CALLS|UNADJUSTED RETURNS/,
   'Needle must attribute its source mode instead of implying certified results');
  const renderedNeedle=needle.querySelector('.four-needle-arrow').style.left;
  assert(renderedNeedle.endsWith('%')&&
    Math.abs(parseFloat(renderedNeedle)-expectedNeedlePosition)<0.011,
   'Needle must use the same Four Endings distribution as the rendered odds');
 }
 assert.match(get('#jointHomeSummary').title,/3,000 correlated draws/);
 assert.match(get('#jointHomeAudit').textContent,/2020 poll minus result/);
 assert.match(get('#jointNightAudit').textContent,/NO automatic historic partisan correction/);
 assert.match(get('#jointHomeAudit').textContent,/NOT calibration/);
 assert.match(get('#jointHomeAudit').textContent,/Held-out-cycle mean Brier score/);
 assert.match(get('#jointNightAudit').textContent,/90% coverage was/);
 assert(get('#jointNightCards').textContent.includes('≥235 House · ≥52 Senate'),
 'Condensed card must define the new seat-based tsunami threshold');

 assert.match(get('#jointNightCards').textContent,/BLUE TSUNAMI/);
 assert.match(get('#jointNightCards').textContent,/BLUE WAVE/);
 assert.match(get('#jointNightCards').textContent,/SHRUG/);
 assert.match(get('#jointNightCards').textContent,/RED DAWN/);
 const jointBase=w.eval('jointForecastResult()');
 assert(jointBase?.probabilities?.blue_tsunami>=0&&jointBase.total_pct>99.9);
 assert.equal(Object.values(jointBase.counts).reduce((sum,n)=>sum+n,0),3000);
 assert(!w.eval('Object.keys(jointLiveObservations()).includes("NC-SEN")'),
  'The correlated chamber needle must NOT use raw NC precinct percentages as a calibrated geographic signal');
 // The browser bundle holds descriptive evidence in a lexical scope.
 // The needle was ALREADY rendered from this same NC snapshot above:
 // re-running thousands of joint simulations here is redundant and slow.
 assert.match(get('#jointNightNeedle').textContent,/RAW RETURNS OBSERVED/,
  'Actual NC votes remain visible as descriptive source data when national odds are withheld');
 assert.match(get('#jointRunStatus').textContent,/source-validated races \(\d+ provider calls\)/);
 const housePrior=jointBase.means.house_dem_seats;
 get('#jointSwing').value='-3';
 get('#jointSwing').dispatchEvent(new w.Event('change',{bubbles:true}));
 const changedJoint=w.eval('jointForecastResult()');
 assert(changedJoint.means.house_dem_seats<housePrior,
  'A more Republican national swing must lower expected House D seats');
 get('#jointSwing').value='0';
 get('#jointSwing').dispatchEvent(new w.Event('change',{bubbles:true}));
 get('#jointError').value='1.3';
 get('#jointError').dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.match(get('#jointRunStatus').textContent,/wider error/);
 get('#jointError').value='1';
 get('#jointError').dispatchEvent(new w.Event('change',{bubbles:true}));

 // User-facing rehearsal never feeds fictional votes into the live dashboard.
 const beforeActualCount=get('#enRaces').textContent,
  beforeActualWatch=get('#enWatchItems').textContent,
  beforeActualAlerts=get('#enAlertItems').textContent,
  beforeResume=w.localStorage.getItem('bluewaves_2026_results_resume_v1');
 assert.equal(get('#enRehearsalPanel').hidden,true);
 get('#enRehearsalToggle').click();
 assert.equal(get('#enRehearsalPanel').hidden,false);
 assert.equal(get('#enRehearsalToggle').getAttribute('aria-expanded'),'true');
 assert.match(get('#enRehearsalPanel').textContent,/SIMULATION ONLY/);
 assert.match(get('#enRehearsalStage').textContent,/STEP 1 \/ 5/);
 assert.match(get('#enRehearsalRows').textContent,/NC-SEN/);
 assert.match(get('#enRehearsalRows').textContent,/MODEL PRIOR/);
 get('#enRehearsalNext').click();
 assert.match(get('#enRehearsalStage').textContent,/STEP 2 \/ 5/);
 assert.match(get('#enRehearsalRows').textContent,/SIMULATED UPDATE/);
 get('#enRehearsalNext').click();
 get('#enRehearsalNext').click();
 get('#enRehearsalNext').click();
 assert.match(get('#enRehearsalStage').textContent,/STEP 5 \/ 5/);
 assert.equal(get('#enRehearsalNext').disabled,true);
 get('#enRehearsalPrev').click();
 assert.match(get('#enRehearsalStage').textContent,/STEP 4 \/ 5/);
 get('#enRehearsalReset').click();
 assert.match(get('#enRehearsalStage').textContent,/STEP 1 \/ 5/);
 assert.equal(get('#enRaces').textContent,beforeActualCount,
  'Simulated scenario must not alter counted live races');
 assert.equal(get('#enWatchItems').textContent,beforeActualWatch,
  'Simulated race panel must not mutate saved watchlist');
 assert.equal(get('#enAlertItems').textContent,beforeActualAlerts,
  'Rehearsal cannot raise real first-vote/call alerts');
 assert.equal(w.localStorage.getItem('bluewaves_2026_results_resume_v1'),beforeResume,
  'Rehearsal cannot poison local recovered actual vote snapshots');
 get('#enRehearsalToggle').click();
 assert.equal(get('#enRehearsalPanel').hidden,true);

 assert.match(get('#enNationalSummary').textContent,/1 \/ 35 races with recorded votes/);
 assert.equal(get('#enNationalRows').querySelectorAll('.en-national-seat[data-reporting="true"]').length,1);
 assert.match(get('#enNationalRows').textContent,/NC-SEN/);
 // National reporting must agree with the strict 3-hour office-health gate.
 const currentSeat={office:'Senate',key:'NC',state:'NC'};
 assert.equal(w.eval('enNationalSourceStatus('+JSON.stringify(currentSeat)+').reported'),true);
 const originalNationalClock=w.Date.now;
 w.Date.now=()=>Date.parse('2026-11-04T07:00:00Z');
 assert.equal(w.eval('enNationalSourceStatus('+JSON.stringify(currentSeat)+').reported'),false,
  'An old, non-flagged 2026 source must not count as actively reporting');
 w.eval('enRenderNationalSenate()');
 assert.equal(get('#enNationalRows').querySelectorAll('.en-national-seat[data-reporting="true"]').length,0,
  'A stale source cannot inflate the number of reporting Senate contests');
 assert.match(get('#enNationalRows').textContent,/previous votes retained for audit only/);
 w.Date.now=originalNationalClock;
 w.eval('enRenderNationalSenate()');
 assert.equal(get('#enNationalRows').querySelectorAll('.en-national-seat[data-reporting="true"]').length,1,
  'Fresh primary data may restore active reporting status');
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
 assert.equal(w.NHCivicRaceAdapter.supports(nhSenateItem),true);
 assert.equal(w.NHCivicRaceAdapter.supports({office:'Senate',key:'NV'}),false);
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
 const badRaceID={...nhSenateDetail,id:11111};
 assert.equal(w.eval('enCivicValidate('+JSON.stringify(nhSenateItem)+','+
    JSON.stringify(nhSenateSearch)+','+JSON.stringify(badRaceID)+')'),null,
    'NH adapter must reject a race-by-ID payload for a different race');
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
 const primaryRaceCountBeforeCivic=get('#enRaces').textContent;
 await w.eval('enRefreshCivicWatchlist(true)');
 assert(civicRequests.some(x=>x.includes('province=NH')&&x.includes('startDate=2026-11-03')));
 assert(civicRequests.some(x=>x.includes('/race/87283?light=')));
 assert.match(get('#enWatchItems').textContent,/civicAPI · 1,000 reported votes/);
 assert.match(get('#enWatchItems').textContent,/Outside the 22-state source/);
 assert.match(get('#enWatchItems').textContent,/civicAPI race source/);
 // Clicking the actual owner Refresh now control must re-fetch a pinned
 // out-of-primary state Senate race independently of the primary provider.
 // The normal one-minute sweep would skip this recently checked source.
 const nhSourceCalls=()=>civicRequests.filter(x=>x.includes('/race/87283?light=')).length;
 const beforeManualNhRefresh=nhSourceCalls();
 get('#enRefresh').click();
 await w.eval('enCivicWaitUntilIdle()');
 assert(nhSourceCalls()>beforeManualNhRefresh,
  'Refresh now must revalidate a verified supplemental Senate race, not only the Open America office');
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

 assert.equal(get('#enRaces').textContent,primaryRaceCountBeforeCivic,
   'Supplemental provider votes must never alter the previously validated primary source race count');
 w.fetch=originalCivicFetch;
 w.Date.now=oldClock;
 w.eval('enWatched=[];enRenderWatchlist()');
 w.localStorage.removeItem('bluewaves_election_watch_2026_v1');

 // Pilot #2: the separately verified NH governor race must report ONLY its
 // exact statewide November general ballot. No House / Senate / primary
 // records may substitute even if they share New Hampshire.
 const govItem={office:'Governor',key:'NH'};
 const govSearch={
   id:87284,country:'US',province:'NH',municipality:null,district:null,
   type:'Governor',election_type:'Statewide',election_name:'New Hampshire Governor',
   election_date:'2026-11-03T05:00:00.000Z',
   candidates:[
     {name:'Governor D',party:'Democratic',votes:0,percent:0,winner:false},
     {name:'Governor R',party:'Republican',votes:0,percent:0,winner:false},
     {name:'Governor I',party:'Independent',votes:0,percent:0,winner:false}
   ]
 };
 const govDetail={
   ...govSearch,election_type:'Governor',last_updated:'2026-11-04T01:45:00Z',
   percent_reporting:42,
   candidates:[
     {name:'Governor D',party:'Democratic',votes:510,percent:51,winner:false},
     {name:'Governor R',party:'Republican',votes:490,percent:49,winner:false},
     {name:'Governor I',party:'Independent',votes:0,percent:0,winner:false}
   ]
 };
 // An apparently well-formed provider record for a state without a 2026
 // gubernatorial ballot must never become a real tracked result or search hit.
 const phantomGovernor={...govSearch,province:'WA',id:999009,
  election_name:'Washington Governor'};
 const phantomItem={office:'Governor',key:'WA'};
 assert.equal(w.eval('enCivicMatch('+JSON.stringify(phantomItem)+','+
   JSON.stringify(phantomGovernor)+')'),false);
 assert.equal(w.eval('enCivicSelect('+JSON.stringify(phantomItem)+','+
   JSON.stringify({count:1,races:[phantomGovernor]})+')'),null);
 assert.equal(w.eval('enCivicValidate('+JSON.stringify(phantomItem)+','+
   JSON.stringify(phantomGovernor)+','+
   JSON.stringify({...govDetail,...phantomGovernor})+')'),null);
 // Generic 2026 statewide fallback: Florida Governor is NOT a pinned
 // adapter slot. It must pass complete metadata/provenance and distinguish
 // partial Florida vote counts from premature split-time-zone winner flags.
 const flFallbackItem={office:'Governor',key:'FL'};
 const flFallbackRow={...govSearch,province:'FL',id:88991,
   election_name:'Florida Governor'};
 const flFallbackDetail={...govDetail,...flFallbackRow,
   election_type:'Governor',percent_reporting:42,
   last_updated:'2026-11-04T00:15:00Z',
   candidates:govDetail.candidates.map((x,i)=>({...x,winner:i===0}))};
 const flCall=(row,detail)=>w.eval('enCivicValidate('+
   JSON.stringify(flFallbackItem)+','+JSON.stringify(row)+','+
   JSON.stringify(detail)+')');
 assert.equal(w.eval('enCivicMatch('+JSON.stringify(flFallbackItem)+','+
   JSON.stringify(flFallbackRow)+')'),true);
 assert.equal(w.eval('enCivicSelect('+JSON.stringify(flFallbackItem)+','+
   JSON.stringify({count:1,races:[flFallbackRow]})+')')?.id,88991);
 for(const count of [0,2,-1,'1',true,1.5]){
   assert.equal(w.eval('enCivicSelect('+JSON.stringify(flFallbackItem)+','+
     JSON.stringify({count,races:[flFallbackRow]})+')'),null,
     'Truncated/malformed generic discovery cannot prove unique FL 2026 race');
 }
 for(const marker of [{is_test:true},{test:true},{mock:true},
   {is_mock:true},{active:false},{live:false}]){
  assert.equal(w.eval('enCivicMatch('+JSON.stringify(flFallbackItem)+','+
    JSON.stringify({...flFallbackRow,...marker})+')'),false);
  assert.equal(w.eval('enCivicSelect('+JSON.stringify(flFallbackItem)+','+
    JSON.stringify({count:1,races:[flFallbackRow],...marker})+')'),null);
  assert.equal(flCall(flFallbackRow,{...flFallbackDetail,...marker}),null);
 }
 assert.equal(w.eval('enCivicMatch('+JSON.stringify(flFallbackItem)+','+
   JSON.stringify({...flFallbackRow,election_date:'2026-11-03T24:30:00Z'})+')'),false);
 const flClock=w.Date.now;
 w.Date.now=()=>Date.parse('2026-11-04T00:30:00Z');
 const partialFl=flCall(flFallbackRow,flFallbackDetail);
 assert.equal(partialFl?.total,1000,'Valid Florida early results must remain visible');
 assert.equal(partialFl?.called,null,'Florida winner cannot appear before final poll close');
 assert.equal(flCall(flFallbackRow,{...flFallbackDetail,
   last_updated:'2026-11-03T23:59:59Z'}),null,
   'Votes timestamped before first Florida close cannot be accepted');
 assert.equal(flCall(flFallbackRow,{...flFallbackDetail,id:90001}),null);
 assert.equal(flCall(flFallbackRow,{...flFallbackDetail,last_updated:null}),null);
 assert.equal(flCall(flFallbackRow,{...flFallbackDetail,candidates:[
   {...flFallbackDetail.candidates[0],name:'Same Name'},
   {...flFallbackDetail.candidates[1],name:' same name '},
   flFallbackDetail.candidates[2]]}),null);
 w.Date.now=()=>Date.parse('2026-11-04T01:15:00Z');
 assert.equal(flCall(flFallbackRow,{...flFallbackDetail,
   last_updated:'2026-11-04T01:05:00Z'})?.called,'Governor D',
   'A source winner flag is eligible only after Florida final close');
 w.Date.now=flClock;
 assert(w.NHGovernorCivicAdapter.supports(govItem));
 assert(!w.NHGovernorCivicAdapter.supports(nhSenateItem));
 assert.equal(w.eval('enCivicSelect('+JSON.stringify(govItem)+','+
   JSON.stringify({races:[govSearch]})+')').id,87284);
 assert.equal(w.eval('enCivicMatch('+JSON.stringify(govItem)+','+
   JSON.stringify(nhSenateSearch)+')'),false);
 assert.equal(w.eval('enCivicMatch({office:"House",key:"NH-01"},'+
   JSON.stringify(govSearch)+')'),false);
 const govClock=w.Date.now,govFetch=w.fetch;
 w.Date.now=()=>Date.parse('2026-11-04T03:00:00Z');
 const govRequests=[];
 let providerGovDetail=govDetail;
 w.fetch=async(url)=>{
   const target=String(url);
   govRequests.push(target);
   if(target.startsWith('https://civicapi.org/api/v2/race/search'))
     return {ok:true,json:async()=>({races:[govSearch],count:1})};
   if(target.startsWith('https://civicapi.org/api/v2/race/87284'))
     return {ok:true,json:async()=>providerGovDetail};
   return {ok:true,json:async()=>empty2026};
 };
 get('#enWatchInput').value='NH-GOV';
 get('#enWatchForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await new Promise(resolve=>setTimeout(resolve,40)); // allow pin-triggered fetch to finish
 await w.eval('enCivicFetchOne('+JSON.stringify(govItem)+')');
 assert(govRequests.some(x=>x.includes('province=NH')&&x.includes('query=Governor')));
 assert(govRequests.some(x=>x.includes('/race/87284?light=')));
 assert.match(get('#enWatchItems').textContent,/NH-GOV/);
 assert.match(get('#enWatchItems').textContent,/civicAPI · 1,000 reported votes/);
 assert.match(w.eval('enCivicURL('+JSON.stringify(govItem)+')'),/\/race\/87284$/,
   'New Hampshire governor source link must match the exact validated race ID');
 assert.equal(get('#enRaces').textContent,primaryRaceCountBeforeCivic,
   'NH Governor civicAPI counts must never enter primary provider totals');
 const govRow=get('#enWatchItems .en-watch-open[aria-label="Open NH-GOV Governor 2026 results"]');
 govRow.click();
 assert.match(get('#enWatchItems .en-civic-detail').textContent,/Governor D/);
 assert.match(get('#enWatchItems .en-civic-detail').textContent,/510/);
 assert(get('#enWatchItems .en-civic-direct').href.includes('/race/87284'));
 providerGovDetail={...govDetail,id:87283,percent_reporting:75,
   last_updated:'2026-11-04T02:00:00Z'};
 await w.eval('enCivicFetchOne('+JSON.stringify(govItem)+')');
 assert.match(w.eval('enCivicStatus('+JSON.stringify(govItem)+')'),/source recheck required/,
   'Wrong ID must not remain an active verified Governor return');
 assert.match(get('#enWatchItems .en-civic-detail').textContent,/PREVIOUS SNAPSHOT/,
   'Retain the last valid candidate tally for audit while it is ineligible');
 assert.match(get('#enWatchItems .en-civic-detail').textContent,/510/,
   'Malformed response must not overwrite previously verified candidate votes');
 assert.equal(get('#enRaces').textContent,primaryRaceCountBeforeCivic);
 w.fetch=govFetch;w.Date.now=govClock;
 w.eval('enWatched=[];enRenderWatchlist()');
 w.localStorage.removeItem('bluewaves_election_watch_2026_v1');


 // Four-state batch: pin exactly one race in each state and prove that the
 // real watchlist requests distinct provider IDs. Bad cross-race details
 // cannot replace the last valid result, and primary metrics remain isolated.
 const batchSpecs=[
  {state:'NV',office:'Governor',pin:'NV-GOV',name:'Nevada Governor',id:87260},
  {state:'ME',office:'Senate',pin:'ME-SEN',name:'Maine US Senate',id:87188},
  {state:'MA',office:'Governor',pin:'MA-GOV',name:'Massachusetts Governor',id:87276},
  {state:'AK',office:'Senate',pin:'AK-SEN',name:'Alaska US Senate',id:86916}
 ];
 const batchRecords=new Map();
 for(const spec of batchSpecs){
  const row={
   id:spec.id,country:'US',province:spec.state,municipality:null,district:null,
   type:spec.office==='Senate'?'US Senate':'Governor',
   election_type:spec.office==='Senate'?'General':'Statewide',
   election_name:spec.name,election_date:'2026-11-03T05:00:00.000Z',
   candidates:[
    {name:spec.state+' Democrat',party:'Democratic',votes:0,percent:0,winner:false},
    {name:spec.state+' Republican',party:'Republican',votes:0,percent:0,winner:false}
   ]
  };
  const detail={
   ...row,election_type:row.type,percent_reporting:41,
   last_updated:'2026-11-04T05:10:00Z',
   candidates:[
    {name:spec.state+' Democrat',party:'Democratic',votes:610,percent:61,winner:false},
    {name:spec.state+' Republican',party:'Republican',votes:390,percent:39,winner:false}
   ]
  };
  if(spec.state==='AK'&&spec.office==='Senate'){
   // SYNTHETIC provider-corrected party contract, not the actual conflicting source.
   const ak=require('./alaska_senate_test_fixture.cjs');row.candidates=ak.candidates();
   detail.round=1;detail.test_data=false;detail.candidates=ak.candidates(610,390);
  }
  batchRecords.set(spec.state+'|'+spec.office,{row,detail});
  assert(w.StateBatchCivicAdapter.supports({key:spec.state,office:spec.office}));
 }
 assert.equal(w.StateBatchCivicAdapter.supports({office:'Senate',key:'MA'}),false,
  'Unverified Massachusetts Senate index must not be promoted');
 assert.equal(w.StateBatchCivicAdapter.supports({office:'Senate',key:'NV'}),false,
  'Nevada has no 2026 Senate race in this batch');
 const batchOriginalClock=w.Date.now,batchFetch=w.fetch;
 w.Date.now=()=>Date.parse('2026-11-04T05:30:00Z');
 let wrongBatchDetail=false;
 const batchURLs=[];
 w.fetch=async url=>{
  const str=String(url);batchURLs.push(str);
  if(str.startsWith('https://civicapi.org/api/v2/race/search')){
   const u=new URL(str),state=u.searchParams.get('province');
   const office=u.searchParams.get('query')==='US Senate'?'Senate':'Governor';
   const data=batchRecords.get(state+'|'+office);
   return {ok:true,json:async()=>({races:data?[data.row]:[],count:data?1:0})};
  }
  if(str.startsWith('https://civicapi.org/api/v2/race/')){
   const id=Number(str.match(/\/race\/(\d+)/)?.[1]);
   const data=[...batchRecords.values()].find(v=>v.row.id===id);
   const detail=wrongBatchDetail&&id===87260?
     {...data.detail,id:87261,last_updated:'2026-11-04T02:30:00Z'}:data?.detail;
   return {ok:Boolean(detail),status:detail?200:404,
     json:async()=>detail||{}};
  }
  return {ok:true,json:async()=>empty2026};
 };
 for(const spec of batchSpecs){
  get('#enWatchInput').value=spec.pin;
  get('#enWatchForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 }
 await new Promise(resolve=>setTimeout(resolve,75));
 await w.eval('enRefreshCivicWatchlist(true)');
 for(const spec of batchSpecs){
  const item={office:spec.office,key:spec.state};
  assert.match(w.eval('enCivicStatus('+JSON.stringify(item)+')'),/1,000 reported votes/,
    'Four-state batch must render '+spec.pin+' from its own source');
  assert(w.eval('enCivicURL('+JSON.stringify(item)+')').endsWith('/race/'+spec.id),
    'Exactly matched race ID expected: '+spec.pin);
  assert(batchURLs.some(u=>u.includes('province='+spec.state)),
    'Must query each chosen state separately: '+spec.pin);
  assert.match(get('#enWatchItems').textContent,new RegExp(spec.pin));
 }
 assert.equal(get('#enRaces').textContent,primaryRaceCountBeforeCivic,
  'All four state adapters must remain outside Open America official-source totals');
 wrongBatchDetail=true;
 await w.eval('enCivicFetchOne({office:"Governor",key:"NV"})');
 assert.match(w.eval('enCivicStatus({office:"Governor",key:"NV"})'),/1,000 reported votes/,
  'Wrong later provider ID must never erase last verified Nevada governor votes');
 assert.match(w.eval('enCivicStatus({office:"Governor",key:"NV"})'),/SOURCE RETRYING/);
 w.fetch=batchFetch;w.Date.now=batchOriginalClock;
 w.eval('enWatched=[];enRenderWatchlist()');
 w.localStorage.removeItem('bluewaves_election_watch_2026_v1');


 // Batch #2: verify all seven OH / WI / NE / KS provider race IDs in
 // the REAL watchlist, including the distinct Ohio special Senate key.
 const nextBatch=[
  {state:'OH',office:'Senate',key:'OH-special',pin:'OH-SEN',
    name:'Ohio US Senate Special',id:87527},
  {state:'OH',office:'Governor',key:'OH',pin:'OH-GOV',
    name:'Ohio Governor',id:87365},
  {state:'WI',office:'Governor',key:'WI',pin:'WI-GOV',
    name:'Wisconsin Governor',id:87491},
  {state:'NE',office:'Senate',key:'NE',pin:'NE-SEN',
    name:'Nebraska US Senate',id:87254},
  {state:'NE',office:'Governor',key:'NE',pin:'NE-GOV',
    name:'Nebraska Governor',id:87255},
  {state:'KS',office:'Senate',key:'KS',pin:'KS-SEN',
    name:'Kansas US Senate',id:87162},
  {state:'KS',office:'Governor',key:'KS',pin:'KS-GOV',
    name:'Kansas Governor',id:87163}
 ];
 const nextRecords=new Map();
 for(const spec of nextBatch){
  const row={
   id:spec.id,country:'US',province:spec.state,district:null,
   municipality:null,type:spec.office==='Senate'?'US Senate':'Governor',
   election_type:spec.office==='Senate'?'General':'Statewide',
   election_name:spec.name,election_date:'2026-11-03T05:00:00.000Z',
   candidates:[
    {name:spec.state+' D',party:'Democratic',votes:0,percent:0,winner:false},
    {name:spec.state+' R',party:'Republican',votes:0,percent:0,winner:false}
   ]
  };
  const detail={...row,election_type:row.type,
   percent_reporting:47,last_updated:'2026-11-04T03:10:00Z',
   candidates:[
    {name:spec.state+' D',party:'Democratic',votes:620,percent:62,winner:false},
    {name:spec.state+' R',party:'Republican',votes:380,percent:38,winner:false}
   ]
  };
  nextRecords.set(spec.id,{row,detail});
  assert(w.StateBatchCivicAdapter.supports({office:spec.office,key:spec.key}));
  assert.equal(w.eval('enCivicSelect('+JSON.stringify({office:spec.office,key:spec.key})+','+
    JSON.stringify({races:[row],count:1})+')').id,spec.id);
 }
 assert.equal(w.StateBatchCivicAdapter.supports({office:'Senate',key:'OH'}),false,
  'Ohio regular Senate result must not masquerade as the 2026 special election');
 const nextClock=w.Date.now,nextFetch=w.fetch;
 const seenNext=[],badUpdates=new Set();
 w.Date.now=()=>Date.parse('2026-11-04T03:20:00Z');
 w.fetch=async url=>{
  const address=String(url);seenNext.push(address);
  if(address.startsWith('https://civicapi.org/api/v2/race/search')){
   const parsed=new URL(address),state=parsed.searchParams.get('province');
   const office=parsed.searchParams.get('query')==='US Senate'?'Senate':'Governor';
   const spec=nextBatch.find(s=>s.state===state&&s.office===office);
   const record=spec?nextRecords.get(spec.id):null;
   return {ok:true,json:async()=>({races:record?[record.row]:[],count:record?1:0})};
  }
  if(address.startsWith('https://civicapi.org/api/v2/race/')){
   const id=Number(address.match(/\/race\/(\d+)/)?.[1]);
   const value=nextRecords.get(id);
   if(!value)return {ok:false,status:404,json:async()=>({})};
   const detail=badUpdates.has(id)?
     {...value.detail,id:id+1,last_updated:'2026-11-04T02:00:00Z'}:value.detail;
   return {ok:true,json:async()=>detail};
  }
  return {ok:true,json:async()=>empty2026};
 };
 for(const spec of nextBatch){
  get('#enWatchInput').value=spec.pin;
  get('#enWatchForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 }
 await new Promise(resolve=>setTimeout(resolve,70));
 await w.eval('enRefreshCivicWatchlist(true)');
 for(const spec of nextBatch){
  const item={office:spec.office,key:spec.key};
  const status=w.eval('enCivicStatus('+JSON.stringify(item)+')');
  assert.match(status,/1,000 reported votes/,
   'Expected independent source result for '+spec.pin+': '+status);
  assert(w.eval('enCivicURL('+JSON.stringify(item)+')').endsWith('/race/'+spec.id),
   'Provider ID mismatch for '+spec.pin);
  assert.match(get('#enWatchItems').textContent,new RegExp(spec.pin));
  assert(seenNext.some(u=>u.includes('province='+spec.state)),
   'No live provider search was attempted for '+spec.state);
 }
 assert.equal(get('#enRaces').textContent,primaryRaceCountBeforeCivic,
  'Seven additional civicAPI sources may not alter Open America primary totals');
 const ohSpecial={office:'Senate',key:'OH-special'};
 assert.equal(w.eval('enCivicSelect('+JSON.stringify(ohSpecial)+','+
  JSON.stringify({races:[{...nextRecords.get(87527).row,
   election_name:'Ohio US Senate'}],count:1})+')'),null,
  'OH Senate special must never ingest regular-election source records');
 badUpdates.add(87527);
 await w.eval('enCivicFetchOne('+JSON.stringify(ohSpecial)+')');
 assert.match(w.eval('enCivicStatus('+JSON.stringify(ohSpecial)+')'),/1,000 reported votes/,
  'Provider-ID mismatch must retain last verified Ohio Senate special tally');
 assert.match(w.eval('enCivicStatus('+JSON.stringify(ohSpecial)+')'),/SOURCE RETRYING/);
 w.fetch=nextFetch;w.Date.now=nextClock;
 w.eval('enWatched=[];enRenderWatchlist()');
 w.localStorage.removeItem('bluewaves_election_watch_2026_v1');


 // Five-state source-ID batch: real Election Night watchlist, no synthetic
 // votes may leak into primary state source or scenario probabilities.
 const fiveSpecs=[
  {state:'IL',office:'Senate',name:'Illinois US Senate',id:87129,pin:'IL-SEN'},
  {state:'IL',office:'Governor',name:'Illinois Governor',id:87130,pin:'IL-GOV'},
  {state:'KY',office:'Senate',name:'Kentucky US Senate',id:87174,pin:'KY-SEN'},
  {state:'NJ',office:'Senate',name:'New Jersey US Senate',id:87302,pin:'NJ-SEN'},
  {state:'NY',office:'Governor',name:'New York Governor',id:87329,pin:'NY-GOV'},
  {state:'OR',office:'Senate',name:'Oregon US Senate',id:87374,pin:'OR-SEN'},
  {state:'OR',office:'Governor',name:'Oregon Governor',id:87375,pin:'OR-GOV'}
 ];
 const fiveRows=new Map();
 for(const spec of fiveSpecs){
  const item={office:spec.office,key:spec.state};
  assert(w.StateBatchCivicAdapter.supports(item));
  const searchRow={
   id:spec.id,country:'US',province:spec.state,municipality:null,district:null,
   type:spec.office==='Senate'?'US Senate':'Governor',
   election_type:spec.office==='Senate'?'General':'Statewide',
   election_date:'2026-11-03T05:00:00.000Z',election_name:spec.name,
   candidates:[
    {name:'Candidate D',party:'Democratic',votes:0,percent:0,winner:false},
    {name:'Candidate R',party:'Republican',votes:0,percent:0,winner:false}
   ]
  };
  const result={...searchRow,election_type:searchRow.type,
   percent_reporting:50,last_updated:'2026-11-04T03:10:00Z',
   candidates:[
    {name:'Candidate D',party:'Democratic',votes:540,percent:54,winner:false},
    {name:'Candidate R',party:'Republican',votes:460,percent:46,winner:false}
   ]
  };
  fiveRows.set(spec.id,{spec,searchRow,result});
  assert.equal(w.eval('enCivicMatch('+JSON.stringify(item)+','+
     JSON.stringify(searchRow)+')'),true,
    'Shared adapter must receive '+spec.pin);
 }
 assert.equal(w.StateBatchCivicAdapter.supports({office:'Senate',key:'NY'}),false,
   'Uncontested Senate seat must not be invented');
 const fiveClock=w.Date.now,fiveFetch=w.fetch,fiveRequests=[];
 let fiveInvalidId=null;
 w.Date.now=()=>Date.parse('2026-11-04T03:20:00Z');
 w.fetch=async(url)=>{
  const address=String(url);fiveRequests.push(address);
  if(address.startsWith('https://civicapi.org/api/v2/race/search')){
   const u=new URL(address),state=u.searchParams.get('province');
   const office=u.searchParams.get('query')==='US Senate'?'Senate':'Governor';
   const record=[...fiveRows.values()].find(x=>x.spec.state===state&&x.spec.office===office);
   return {ok:true,json:async()=>({races:record?[record.searchRow]:[],
     count:record?1:0})};
  }
  if(address.startsWith('https://civicapi.org/api/v2/race/')){
   const sourceId=Number(address.match(/\/race\/(\d+)/)?.[1]);
   const record=fiveRows.get(sourceId);
   if(!record)return {ok:false,status:404,json:async()=>({})};
   const detail=fiveInvalidId===sourceId?
     {...record.result,id:sourceId+1,last_updated:'2026-11-04T02:00:00Z'}:
     record.result;
   return {ok:true,json:async()=>detail};
  }
  return {ok:true,json:async()=>empty2026};
 };
 for(const spec of fiveSpecs){
  get('#enWatchInput').value=spec.pin;
  get('#enWatchForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 }
 await new Promise(resolve=>setTimeout(resolve,80));
 await w.eval('enRefreshCivicWatchlist(true)');
 for(const spec of fiveSpecs){
  const item={office:spec.office,key:spec.state};
  const status=w.eval('enCivicStatus('+JSON.stringify(item)+')');
  assert.match(status,/1,000 reported votes/,
    'Five-state pilot must render '+spec.pin+' votes, status: '+status);
  assert(w.eval('enCivicURL('+JSON.stringify(item)+')').endsWith('/race/'+spec.id),
    'Wrong external race link for '+spec.pin);
  assert.match(get('#enWatchItems').textContent,new RegExp(spec.pin));
  assert(fiveRequests.some(url=>url.includes('province='+spec.state)),
    'No direct state query for '+spec.pin);
 }
 assert.equal(get('#enRaces').textContent,primaryRaceCountBeforeCivic,
  'Supplemental provider cannot mutate Open America race totals');
 const ilItem={office:'Senate',key:'IL'};
 fiveInvalidId=87129;
 await w.eval('enCivicFetchOne('+JSON.stringify(ilItem)+')');
 assert.match(w.eval('enCivicStatus('+JSON.stringify(ilItem)+')'),/1,000 reported votes/,
  'Rejected Illinois cross-ID correction must retain last verified votes');
 assert.match(w.eval('enCivicStatus('+JSON.stringify(ilItem)+')'),/SOURCE RETRYING/);
 assert.equal(get('#enRaces').textContent,primaryRaceCountBeforeCivic);
 w.Date.now=fiveClock;w.fetch=fiveFetch;
 w.eval('enWatched=[];enRenderWatchlist()');
 w.localStorage.removeItem('bluewaves_election_watch_2026_v1');


 // Fifth batch: eight source-ID-pinned 2026 races across AL / MT / NM / OK / TN.
 // The real Election Night watchlist must show each state's own result,
 // and civicAPI counts must not alter the primary election metrics.
 const almtBatch=[
  {state:'AL',office:'Senate',name:'Alabama US Senate',id:86907,pin:'AL-SEN'},
  {state:'AL',office:'Governor',name:'Alabama Governor',id:86908,pin:'AL-GOV'},
  {state:'MT',office:'Senate',name:'Montana US Senate',id:87247,pin:'MT-SEN'},
  {state:'NM',office:'Senate',name:'New Mexico US Senate',id:87288,pin:'NM-SEN'},
  {state:'NM',office:'Governor',name:'New Mexico Governor',id:87289,pin:'NM-GOV'},
  {state:'OK',office:'Senate',name:'Oklahoma US Senate',id:87526,pin:'OK-SEN'},
  {state:'TN',office:'Senate',name:'Tennessee US Senate',id:87475,pin:'TN-SEN'},
  {state:'TN',office:'Governor',name:'Tennessee Governor',id:87476,pin:'TN-GOV'}
 ];
 const almtRecords=new Map();
 for(const spec of almtBatch){
  const item={office:spec.office,key:spec.state};
  assert(w.StateBatchCivicAdapter.supports(item),
   'Verified 2026 race should use strict civicAPI adapter: '+spec.pin);
  const row={
   id:spec.id,country:'US',province:spec.state,district:null,municipality:null,
   type:spec.office==='Senate'?'US Senate':'Governor',
   election_type:spec.office==='Senate'?'General':'Statewide',
   election_name:spec.name,election_date:'2026-11-03T05:00:00.000Z',
   candidates:[
    {name:'Election D',party:'Democratic',votes:0,percent:0,winner:false},
    {name:'Election R',party:'Republican',votes:0,percent:0,winner:false}
   ]
  };
  const detail={...row,election_type:row.type,percent_reporting:42,
   last_updated:'2026-11-04T03:10:00Z',
   candidates:[
    {name:'Election D',party:'Democratic',votes:520,percent:52,winner:false},
    {name:'Election R',party:'Republican',votes:480,percent:48,winner:false}
   ]
  };
  almtRecords.set(spec.id,{row,detail,spec});
  assert.equal(w.eval('enCivicSelect('+JSON.stringify(item)+','+
   JSON.stringify({races:[row],count:1})+')').id,spec.id,
    'Only the correct provider race ID can enter '+spec.pin);
 }
 assert.equal(w.StateBatchCivicAdapter.supports({office:'Governor',key:'OK'}),true,
  'Newly verified Oklahoma governor source must use the strict ID adapter');
 const almtClock=w.Date.now,almtFetch=w.fetch,almtRequests=[];
 let almtBadId=null;
 w.Date.now=()=>Date.parse('2026-11-04T03:20:00Z');
 w.fetch=async(url)=>{
  const u=String(url);almtRequests.push(u);
  if(u.startsWith('https://civicapi.org/api/v2/race/search')){
   const parsed=new URL(u),state=parsed.searchParams.get('province');
   const office=parsed.searchParams.get('query')==='US Senate'?'Senate':'Governor';
   const match=[...almtRecords.values()].find(x=>x.spec.state===state&&x.spec.office===office);
   return {ok:true,json:async()=>({races:match?[match.row]:[],count:match?1:0})};
  }
  if(u.startsWith('https://civicapi.org/api/v2/race/')){
   const id=Number(u.match(/\/race\/(\d+)/)?.[1]),record=almtRecords.get(id);
   if(!record)return {ok:false,status:404,json:async()=>({})};
   return {ok:true,json:async()=>almtBadId===id?
    {...record.detail,id:id+1,last_updated:'2026-11-04T02:00:00Z'}:record.detail};
  }
  return {ok:true,json:async()=>empty2026};
 };
 for(const spec of almtBatch){
  get('#enWatchInput').value=spec.pin;
  get('#enWatchForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 }
 await new Promise(resolve=>setTimeout(resolve,90));
 await w.eval('enRefreshCivicWatchlist(true)');
 for(const spec of almtBatch){
  const item={office:spec.office,key:spec.state};
  const status=w.eval('enCivicStatus('+JSON.stringify(item)+')');
  assert.match(status,/1,000 reported votes/,
   'Source count should render for '+spec.pin+': '+status);
  assert(w.eval('enCivicURL('+JSON.stringify(item)+')').endsWith('/race/'+spec.id),
   'Source URL must link to exact '+spec.pin+' civicAPI ID');
  assert.match(get('#enWatchItems').textContent,new RegExp(spec.pin));
  assert(almtRequests.some(url=>url.includes('province='+spec.state)),
   'Browser did not query the correct state for '+spec.pin);
 }
 assert.equal(get('#enRaces').textContent,primaryRaceCountBeforeCivic,
  'Eight civicAPI watches must not alter Open America race counts');
 const almtItem={office:'Senate',key:'MT'};
 almtBadId=87247;
 await w.eval('enCivicFetchOne('+JSON.stringify(almtItem)+')');
 assert.match(w.eval('enCivicStatus('+JSON.stringify(almtItem)+')'),/1,000 reported votes/,
  'Bad later Montana result must retain last-good votes');
 assert.match(w.eval('enCivicStatus('+JSON.stringify(almtItem)+')'),/SOURCE RETRYING/);
 assert.equal(get('#enRaces').textContent,primaryRaceCountBeforeCivic);
 w.Date.now=almtClock;w.fetch=almtFetch;
 w.eval('enWatched=[];enRenderWatchlist()');
 w.localStorage.removeItem('bluewaves_election_watch_2026_v1');


 // Source-verified statewide civicAPI batch: California, Delaware,
 // South Dakota and Wyoming, including a simulated bad provider revision.
 const westSourceSpecs=[
  {state:'CA',office:'Governor',name:'California Governor',id:86952,pin:'CA-GOV'},
  {state:'DE',office:'Senate',name:'Delaware US Senate',id:87036,pin:'DE-SEN'},
  {state:'SD',office:'Senate',name:'South Dakota US Senate',id:87446,pin:'SD-SEN'},
  {state:'SD',office:'Governor',name:'South Dakota Governor',id:87447,pin:'SD-GOV'},
  {state:'WY',office:'Senate',name:'Wyoming US Senate',id:87496,pin:'WY-SEN'},
  {state:'WY',office:'Governor',name:'Wyoming Governor',id:87497,pin:'WY-GOV'},
  {state:'MD',office:'Governor',name:'Maryland Governor',id:87198,pin:'MD-GOV'}
 ];
 const westSourceRecords=new Map();
 for(const spec of westSourceSpecs){
  const item={office:spec.office,key:spec.state};
  assert(w.StateBatchCivicAdapter.supports(item),
   'Exact 2026 civicAPI adapter must support '+spec.pin);
  const search={
   id:spec.id,country:'US',province:spec.state,district:null,municipality:null,
   type:spec.office==='Senate'?'US Senate':'Governor',
   election_type:spec.office==='Senate'?'General':'Statewide',
   election_name:spec.name,election_date:'2026-11-03T05:00:00.000Z',
   candidates:[
    {name:'West D',party:'Democratic',votes:0,percent:0,winner:false},
    {name:'West R',party:'Republican',votes:0,percent:0,winner:false}
   ]
  };
  const detail={...search,election_type:search.type,percent_reporting:41,
   last_updated:'2026-11-04T04:10:00Z',
   candidates:[
    {name:'West D',party:'Democratic',votes:550,percent:55,winner:false},
    {name:'West R',party:'Republican',votes:450,percent:45,winner:false}
   ]
  };
  westSourceRecords.set(spec.id,{search,detail,spec});
  assert.equal(w.eval('enCivicSelect('+JSON.stringify(item)+','+
   JSON.stringify({races:[search],count:1})+')').id,spec.id);
 }
 assert.equal(w.StateBatchCivicAdapter.supports({office:'Senate',key:'MS'}),true,
  'Newly verified Mississippi Senate source must use the strict ID adapter');
 const westSourceClock=w.Date.now,westSourceFetch=w.fetch,westSourceRequests=[];
 let westSourceInvalidId=null;
 w.Date.now=()=>Date.parse('2026-11-04T04:20:00Z');
 w.fetch=async(url)=>{
  const request=String(url);westSourceRequests.push(request);
  if(request.startsWith('https://civicapi.org/api/v2/race/search')){
   const params=new URL(request),state=params.searchParams.get('province');
   const office=params.searchParams.get('query')==='US Senate'?'Senate':'Governor';
   const match=[...westSourceRecords.values()].find(x=>
    x.spec.state===state&&x.spec.office===office);
   return {ok:true,json:async()=>({races:match?[match.search]:[],count:match?1:0})};
  }
  if(request.startsWith('https://civicapi.org/api/v2/race/')){
   const id=Number(request.match(/\/race\/(\d+)/)?.[1]);
   const record=westSourceRecords.get(id);
   if(!record)return {ok:false,status:404,json:async()=>({})};
   return {ok:true,json:async()=>westSourceInvalidId===id?
    {...record.detail,id:id+1,last_updated:'2026-11-04T02:00:00Z'}:record.detail};
  }
  return {ok:true,json:async()=>empty2026};
 };
 for(const spec of westSourceSpecs){
  get('#enWatchInput').value=spec.pin;
  get('#enWatchForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 }
 await new Promise(resolve=>setTimeout(resolve,90));
 await w.eval('enRefreshCivicWatchlist(true)');
 for(const spec of westSourceSpecs){
  const item={office:spec.office,key:spec.state};
  const status=w.eval('enCivicStatus('+JSON.stringify(item)+')');
  assert.match(status,/1,000 reported votes/,
   'Every new watchlist race needs own source total: '+spec.pin+': '+status);
  assert(w.eval('enCivicURL('+JSON.stringify(item)+')').endsWith('/race/'+spec.id),
   'Each source deep-link must match independently verified ID: '+spec.pin);
  assert.match(get('#enWatchItems').textContent,new RegExp(spec.pin));
  assert(westSourceRequests.some(u=>u.includes('province='+spec.state)),
   'Did not search exact source state '+spec.state);
 }
 assert.equal(get('#enRaces').textContent,primaryRaceCountBeforeCivic,
  'Supplemental source counts must not mix with primary election-night totals');
 const westBadItem={office:'Governor',key:'CA'};
 westSourceInvalidId=86952;
 await w.eval('enCivicFetchOne('+JSON.stringify(westBadItem)+')');
 assert.match(w.eval('enCivicStatus('+JSON.stringify(westBadItem)+')'),/1,000 reported votes/,
  'Invalid California source revision must preserve last valid count');
 assert.match(w.eval('enCivicStatus('+JSON.stringify(westBadItem)+')'),/SOURCE RETRYING/);
 assert.equal(get('#enRaces').textContent,primaryRaceCountBeforeCivic);
 w.Date.now=westSourceClock;w.fetch=westSourceFetch;
 w.eval('enWatched=[];enRenderWatchlist()');
 w.localStorage.removeItem('bluewaves_election_watch_2026_v1');


 // FULL ELECTION-NIGHT RESILIENCE REHEARSAL: a stalled supplemental
 // source must not block other races, and a failed foreground House feed must
 // not stop an independently validated watched Senate office. Synthetic votes.
 const rehearsalClock=w.Date.now,rehearsalFetch=w.fetch;
 await w.eval('enCivicWaitUntilIdle()');
 w.Date.now=()=>Date.parse('2026-11-04T03:20:00Z');
 assert.equal(w.eval('enIsVisible()'),true,'Election Night tab must be active');
 let rehearsalSignal;
 w.fetch=async(_url,options)=>{
  // Other asynchronous watchlist refreshes may also call the fake fetch.
  // Capture only the specific request under timeout test, not the last
  // unrelated fetch to arrive while that timer is pending.
  if(String(_url)==='https://civicapi.org/api/v2/race/86916?light=')
   rehearsalSignal=options?.signal;
  return new Promise(()=>{}); // deliberate hung browser request
 };
 await assert.rejects(
  w.eval('enCivicFetchJson("https://civicapi.org/api/v2/race/86916?light=",25)'),
  /timed out; last verified result retained/,
  'An unresponsive race fetch must terminate independently');
 assert.equal(rehearsalSignal?.aborted,true,
  'Timeout must abort an actual browser-supported provider request');
 // Exercise the actual watchlist UI: detached global assignments would
 // not mutate the application's lexical state.
 const rehearsalClearPins=()=>{
  for(let n=0;n<45;n++){
   const remove=get('#enWatchItems').querySelector('.en-watch-remove');
   if(!remove)return;
   remove.click();
  }
  throw Error('Could not clear all rehearsal watchlist pins');
 };
 const rehearsalPin=pin=>{
  get('#enWatchInput').value=pin;
  get('#enWatchForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 };
 rehearsalClearPins();
 // Independent 404 search misses may run concurrently; 503 is tested separately.
 const rehearsalPins=['AK-SEN','AK-GOV','ME-SEN','ME-GOV','NV-GOV','KY-SEN'];
 w.fetch=async()=>({ok:false,status:404,json:async()=>({})});
 for(const pin of rehearsalPins)rehearsalPin(pin);
 await w.eval('enCivicWaitUntilIdle()');
 assert.equal(get('#enWatchCount').textContent,'6 races');
 let rehearsalUnblock=null,rehearsalFirst=true;
 const rehearsalRequests=[];
 w.fetch=async url=>{
  if(String(url).startsWith('https://civicapi.org/')){
   rehearsalRequests.push(String(url));
   if(rehearsalFirst){
    rehearsalFirst=false;
    await new Promise(resolve=>{rehearsalUnblock=resolve});
   }
   return {ok:false,status:404,json:async()=>({})};
  }
  return {ok:false,status:404,json:async()=>({})};
 };
 const rehearsalSweep=w.eval('enRefreshCivicWatchlist(true)');
 await new Promise(resolve=>setTimeout(resolve,65));
 assert(rehearsalRequests.length>=4,
  'Four independent source races must start while first civicAPI fetch is stalled');
 const rehearsalStalledUrl=rehearsalRequests[0];
 const rehearsalManualSweep=w.eval('enRefreshCivicWatchlist(true)');
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(rehearsalRequests.filter(u=>u===rehearsalStalledUrl).length,1,
  'Manual sweep waits on the already-pending race instead of duplicating it');
 assert(rehearsalUnblock,'First simulated source must be waiting');
 rehearsalUnblock();
 await Promise.all([rehearsalSweep,rehearsalManualSweep]);
 assert(rehearsalRequests.filter(u=>u===rehearsalStalledUrl).length>=2,
  'After stalled request resolves, an explicit refresh must actually retry it');
 assert(rehearsalRequests.length>=rehearsalPins.length,
  'Later races must still be checked when other source requests fail');
 // Main provider House outage; the background Senate feed still counts 300
 // real-shaped *simulated* votes without overwriting foreground state.
 rehearsalClearPins();
 rehearsalPin('NC-SEN');
 // Previous synthetic provider interruptions can leave a background office
 // still in-flight. Drain its now-bounded transport first so this rehearsal
 // measures House-down / Senate-up behavior, not leftover test fixtures.
 const officeDrainStart=Date.now();
 while(Date.now()-officeDrainStart<15500&&w.eval(
  '__testOpenAmericaPending()>0||__testWatchedOfficePending()>0')){
  await new Promise(resolve=>setTimeout(resolve,35));
 }
 assert.equal(w.eval('__testOpenAmericaPending()'),0,
  'Prior source requests must settle or time out before the next outage test');
 assert.equal(w.eval('__testWatchedOfficePending()'),0,
  'No stale watched-office task may monopolize the Senate refresh');
 const rehearsalOffices=[];
 w.fetch=async url=>{
  const address=String(url);rehearsalOffices.push(address);
  if(address.includes('openamerica.io')&&address.includes('office=House'))
   throw Error('Rehearsal House source disconnected');
  if(address.includes('openamerica.io')&&address.includes('office=Senate'))
   return {ok:true,json:async()=>counted2026};
  return {ok:false,status:503,json:async()=>({})};
 };
 get('#enOfficeHouse').click();
 await w.eval('enLoad(true)');
 // Production starts independently scheduled watched-office fetches after a
 // failed foreground load. The old 80ms sleep made this 6-minute integration
 // test intermittently fail under loaded CI runners before its microtasks
 // could complete. Wait for BOTH the request and rendered votes, with an
 // explicit 2.5-second upper bound that still catches real starvation.
 const watchedStart=Date.now();
 while(Date.now()-watchedStart<2500&&
       (!rehearsalOffices.some(v=>v.includes('office=Senate'))||
        !/300 counted/.test(get('#enWatchItems').textContent))){
  await new Promise(resolve=>setTimeout(resolve,25));
 }
 assert.match(get('#enStatus').textContent,/Rehearsal House source disconnected/);
 assert.match(get('#enConnection').textContent,/SOURCE RETRYING/);
 assert(rehearsalOffices.some(v=>v.includes('office=Senate')),
  'Watched Senate office must refresh during foreground House outage; seen='+
   JSON.stringify(rehearsalOffices.slice(-12)));
 assert.match(get('#enWatchItems').textContent,/300 counted/,
  'Independent Senate counts must remain available during House outage');
 assert.equal(get('#enRaces').textContent,'0','House may not borrow Senate votes');
 // Wait for the independently scheduled office requests from the outage
 // fixture to finish before replacing fetch with the coalescing fixture.
 // Rendering Senate counts alone does not prove the whole background sweep
 // (including Governor) has settled on a loaded runner.
 const coalescingDrainStart=Date.now();
 while(Date.now()-coalescingDrainStart<15500&&w.eval(
  '__testOpenAmericaPending()>0||__testWatchedOfficePending()>0')){
  await new Promise(resolve=>setTimeout(resolve,35));
 }
 assert.equal(w.eval('__testOpenAmericaPending()'),0,'Outage fixture transport must settle before the coalescing fixture');
 assert.equal(w.eval('__testWatchedOfficePending()'),0,'Outage fixture watched offices must settle before swapping fetch');
 // Same-office out-of-order HTTP responses: a late old request may not
 // overwrite the newer snapshot or trigger a false rollback.
 const rehearsalHouseOld={
  ...counted2026,office:'House',as_of:'2026-11-04T03:05:00Z',
  races:{'AZ-01':{...counted2026.races.NC}}
 };
 const rehearsalHouseNew=structuredClone(rehearsalHouseOld);
 // Both snapshots follow Arizona's 02:00Z poll-close floor and any earlier
 // 03:00Z House test snapshot. The later one is a real-shaped correction.
 rehearsalHouseNew.as_of='2026-11-04T03:10:00Z';
 rehearsalHouseNew.races['AZ-01'].total=500;
 rehearsalHouseNew.races['AZ-01'].cands[0].v=280;
 rehearsalHouseNew.races['AZ-01'].cands[0].pct=56;
 rehearsalHouseNew.races['AZ-01'].cands[1].v=220;
 rehearsalHouseNew.races['AZ-01'].cands[1].pct=44;
 let rehearsalReleaseOld;
 let rehearsalHouseCalls=0;
 w.fetch=async url=>{
  const u=String(url);
  if(u.includes('office=House')){
   rehearsalHouseCalls++;
   if(rehearsalHouseCalls===1)
    return new Promise(resolve=>{rehearsalReleaseOld=()=>resolve({
     ok:true,json:async()=>rehearsalHouseOld
    })});
   return {ok:true,json:async()=>rehearsalHouseNew};
  }
  if(u.includes('office=Senate'))
   return {ok:true,json:async()=>counted2026};
  return {ok:false,status:503,json:async()=>({})};
 };
 const rehearsalOldLoad=w.eval('enLoad(true)');
 await new Promise(resolve=>setTimeout(resolve,15));
 assert(rehearsalReleaseOld,'First House request must remain pending');
 const rehearsalCoalescedLoad=w.eval('enLoad(true)');
 await new Promise(resolve=>setTimeout(resolve,15));
 // Production transport deliberately shares same-office in-flight requests,
 // rather than opening another HTTP connection for a supposedly newer result.
 assert.equal(rehearsalHouseCalls,1,
  'Duplicate House loads must share the in-flight source request');
 rehearsalReleaseOld();
 await Promise.all([rehearsalOldLoad,rehearsalCoalescedLoad]);
 assert.match(get('#enRaceList').textContent,/AZ-01/,
  'A coalesced House response still reaches the latest requested view; status='+get('#enStatus').textContent+'; races='+get('#enRaceList').textContent.slice(0,300));
 assert.equal(get('#enRaces').textContent,'1');
 assert.equal(get('#enDLeads').textContent,'1');
 // Once the shared request settles, an explicit refresh must independently
 // fetch and accept a source-newer 500-vote House snapshot.
 await w.eval('enLoad(true)');
 assert.equal(rehearsalHouseCalls,2,
  'The source transport must release its in-flight slot after success');
 const expectedHouseSourceTime=new w.Date(rehearsalHouseNew.as_of).toLocaleString('en-US',{
  month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
 assert(get('#enStatus').textContent.includes(expectedHouseSourceTime),
  'Accepted House correction must show its source time in the browser timezone');
 assert.equal(get('#enDLeads').textContent,'1');
 assert.equal(get('#enRaces').textContent,'1');
 // Older snapshot arriving through a later request must be rejected while
 // retaining the last source-validated counts in the dashboard.
 w.fetch=async url=>{
  if(String(url).includes('office=House'))
   return {ok:true,json:async()=>rehearsalHouseOld};
  if(String(url).includes('office=Senate'))
   return {ok:true,json:async()=>counted2026};
  return {ok:false,status:503,json:async()=>({})};
 };
 await w.eval('enLoad(true)');
 assert.match(get('#enStatus').textContent,/LAST VERIFIED RESULTS RETAINED/);
 assert.match(get('#enConnection').textContent,/SOURCE RETRYING/);
 assert.equal(get('#enRaces').textContent,'1');
 // Provider recovery clears the failure; no fabricated race call appears.
 w.fetch=async url=>{
  if(String(url).includes('office=House'))
   return {ok:true,json:async()=>rehearsalHouseNew};
  if(String(url).includes('office=Senate'))
   return {ok:true,json:async()=>counted2026};
  return {ok:false,status:503,json:async()=>({})};
 };
 await w.eval('enLoad(true)');
 assert.doesNotMatch(get('#enConnection').textContent,/SOURCE RETRYING/);
 assert.equal(get('#enCalls').textContent,'Not supplied');
 assert.equal(get('#enRaces').textContent,'1');
 w.Date.now=rehearsalClock;w.fetch=rehearsalFetch;
 rehearsalClearPins();
 w.localStorage.removeItem('bluewaves_election_watch_2026_v1');


 // Meaningful alerts never grant Notification access without a click, never
 // fire for a mere timestamp refresh, and require the race be pinned.
 const alertInput=get('#enWatchInput'),alertForm=get('#enWatchForm');
 for(const label of ['NC-SEN','NH-SEN']){
  alertInput.value=label;
  alertForm.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 }
 // Switch through the actual UI, not a detached eval assignment to
 // a top-level lexical 'let' that would leave the application in 2024 mode.
 const savedAlertFetch=w.fetch;
 w.fetch=async()=>({ok:true,json:async()=>empty2026});
 get('#enOfficeHouse').click();
 get('#enMode2026').click();
 await w.eval('enLoad(true)');
 w.fetch=savedAlertFetch;
 assert.equal(get('#enMode2026').getAttribute('aria-pressed'),'true',
  'Actual 2026 mode must be selected on the visible Election Night UI');
 w.localStorage.removeItem('bluewaves_election_alerts_2026_v1');
 get('#enAlertClear').click(); // reset through the actual app-owned lexical state
 const alertRows=()=>[...get('#enAlertItems').querySelectorAll('button.en-alert-row')];
 const testTime=w.Date.now;
 w.Date.now=()=>Date.parse('2026-10-13T21:00:00Z');
 const firstNC={
   office:'Senate',key:'NC',at:'2026-11-04T02:00:00Z',prior:0,
   current:380,delta:380,newRace:true,leaderChanged:false,
   candidateChanged:true,fingerprint:'Candidate A:D:200,Candidate B:R:180'
 };
 w.eval('enProcessPrimaryAlerts('+JSON.stringify([firstNC])+')');
 assert.equal(alertRows().length,0,'No 2026 general-election alert before Election Day');
 w.Date.now=()=>Date.parse('2026-11-04T03:40:00Z');
 w.eval('enProcessPrimaryAlerts('+JSON.stringify([firstNC])+')');
 assert.equal(alertRows().length,1,'First vote batch should trigger for a pinned race');
 assert.match(get('#enAlertItems').textContent,/NC-SEN · First votes reporting/);
 assert.match(get('#enAlertItems').textContent,/Open America/);
 const durableAlert=JSON.parse(w.localStorage.getItem('bluewaves_election_alerts_2026_v1'));
 assert.equal(durableAlert.length,1,'Pinned race events should persist locally');
 w.eval('enProcessPrimaryAlerts('+JSON.stringify([firstNC])+')');
 assert.equal(alertRows().length,1,'Identical source updates must not duplicate alerts');
 const notWatched={...firstNC,key:'TX',fingerprint:'U1'};
 w.eval('enProcessPrimaryAlerts('+JSON.stringify([notWatched])+')');
 assert.equal(alertRows().length,1,'Unpinned races never generate personal alerts');
 const correction={...firstNC,newRace:false,prior:380,current:380,delta:0,
   candidateChanged:true,fingerprint:'Candidate A:D:190,Candidate B:R:190'};
 w.eval('enProcessPrimaryAlerts('+JSON.stringify([correction])+')');
 assert.equal(alertRows().length,2);
 assert.match(get('#enAlertItems').textContent,/Candidate totals revised/);
 const flip={...correction,leaderChanged:true,
   fingerprint:'Candidate A:D:170,Candidate B:R:210'};
 w.eval('enProcessPrimaryAlerts('+JSON.stringify([flip])+')');
 assert.equal(alertRows().length,3);
 assert.match(get('#enAlertItems').textContent,/Vote leader changed/);
 assert.match(get('#enAlertItems').textContent,/No winner has been called/);
 const sameEvent={...correction,leaderChanged:false,
   fingerprint:'Candidate A:D:185,Candidate B:R:195'};
 w.eval('enProcessPrimaryAlerts('+JSON.stringify([sameEvent])+')');
 assert.equal(alertRows().length,4,
   'Two distinct vote reallocations under the same source timestamp must remain distinguishable');
 const civicOriginal={
   ...rawCivic,total:0,called:null,last_updated:'2026-11-04T02:30:00Z',
   candidates:rawCivic.candidates.map(c=>({...c,votes:0,percent:0}))
 };
 w.eval('enProcessCivicAlert('+JSON.stringify(nhSenateItem)+','+
  JSON.stringify(civicOriginal)+','+JSON.stringify(rawCivic)+')');
 assert.match(get('#enAlertItems').textContent,/NH-SEN · First votes reporting/);
 const civicCall={...rawCivic,called:'First candidate'};
 w.eval('enProcessCivicAlert('+JSON.stringify(nhSenateItem)+','+
   JSON.stringify(rawCivic)+','+JSON.stringify(civicCall)+')');
 assert.match(get('#enAlertItems').textContent,/Provider race call/);
 assert.match(get('#enAlertItems').textContent,/not official certification/);
 assert.match(get('#enAlertItems').textContent,/civicAPI/);
 const civicCount=alertRows().length;
 w.eval('enProcessCivicAlert('+JSON.stringify(nhSenateItem)+','+
   JSON.stringify(civicCall)+','+JSON.stringify(civicCall)+')');
 assert.equal(alertRows().length,civicCount,'Repeated provider call must not create duplicate');
 w.eval(`enFishDismiss();
  enFishShow({kind:'call',source:'civicAPI',office:'Senate',race:'NH',
   title:'Superseded NH call',details:'First candidate'});
  enFishShow({kind:'call',source:'civicAPI',office:'Senate',race:'NH',
   title:'Queued superseded NH call',details:'First candidate'});
  enFishShow({kind:'flip',source:'civicAPI',office:'Senate',race:'ME',
   title:'Unrelated Maine bulletin',details:'Not a race call'});`);
 const withdrawnCall={...rawCivic,called:null,last_updated:'2026-11-04T03:01:00Z'};
 w.eval('enProcessCivicAlert('+JSON.stringify(nhSenateItem)+','+
   JSON.stringify(civicCall)+','+JSON.stringify(withdrawnCall)+')');
 assert.match(get('#enAlertItems').textContent,/Provider call withdrawn/);
 assert.match(get('#enFishMode').textContent,/PROVIDER CALL WITHDRAWN/);
 assert.match(get('#enFishHeadline').textContent,/outcome is uncalled/);
 assert.equal(w.eval('enFishQueueState().pending'),1,
  'Retraction removes the queued obsolete call while preserving the unrelated bulletin');
 w.eval('enFishNextBulletin()');
 assert.match(get('#enFishHeadline').textContent,/Unrelated Maine bulletin/);
 w.eval('enFishDismiss()');
 const desktopNotifications=[];
 class FakeDesktopNotification{
  static permission='default';
  static async requestPermission(){FakeDesktopNotification.permission='granted';return 'granted'}
  constructor(title,options){desktopNotifications.push({title,options})}
 }
 w.Notification=FakeDesktopNotification;
 w.eval('enRenderAlertInbox()');
 assert.equal(get('#enAlertDesktop').getAttribute('aria-pressed'),'false');
 get('#enAlertDesktop').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('#enAlertDesktop').getAttribute('aria-pressed'),'true');
 assert.equal(w.localStorage.getItem('bluewaves_election_desktop_2026_v1'),'on');
 const laterVotes={...firstNC,current:900,prior:380,delta:520,
   fingerprint:'Candidate A:D:500,Candidate B:R:400'};
 w.eval('enProcessPrimaryAlerts('+JSON.stringify([laterVotes])+')');
 assert.equal(desktopNotifications.length,1,'Opted-in significant event creates one browser notice');
 assert.match(desktopNotifications[0].title,/First votes reporting/);
 assert.match(desktopNotifications[0].options.body,/Open America/);
 get('#enAlertDesktop').click();
 assert.equal(get('#enAlertDesktop').getAttribute('aria-pressed'),'false');
 get('#enAlertClear').click();
 assert.equal(alertRows().length,0);
 assert.deepEqual(JSON.parse(w.localStorage.getItem('bluewaves_election_alerts_2026_v1')),[]);
 w.Date.now=testTime;
 w.eval('enWatched=[];enRenderWatchlist()');
 w.localStorage.removeItem('bluewaves_election_watch_2026_v1');
 w.localStorage.removeItem('bluewaves_election_desktop_2026_v1');

 // A real second document instance must restore source-verified 2026
 // results and movement history from the same browser's saved bytes.
 // No mocked "live" freshness or reconstructed race calls are allowed.
 const resumePayload={
   schema_version:1,election:'2026-11-03',
   saved_at:'2026-11-04T03:30:00Z',
   snapshots:{Senate:counted2026,House:empty2026},
   movements:[{office:'Senate',key:'NC',at:'2026-11-04T02:30:00Z',
     prior:0,current:300,delta:300,newRace:true,
     leaderChanged:false,candidateChanged:true,
     fingerprint:'Democratic candidate:D:160,Republican candidate:R:140'}]
 };
 const resumeConsole=new VirtualConsole();
 resumeConsole.on('jsdomError',err=>errors.push('Resume document: '+String(err)));
 const resumed=new JSDOM(html,{url:'https://election-command-center.local/',runScripts:'outside-only',
   pretendToBeVisual:true,virtualConsole:resumeConsole});
 const rw=resumed.window;
 rw.scrollTo=()=>{};rw.Element.prototype.scrollIntoView=function(){};
 rw.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
 rw.Date.now=()=>Date.parse('2026-11-04T03:40:00Z');
 rw.localStorage.setItem('bluewaves_2026_results_resume_v1',JSON.stringify(resumePayload));
 rw.fetch=async url=>{
   const name=String(url).split('?')[0].split('/').pop();
   if(name in fixtures)return {ok:true,json:async()=>fixtures[name]};
   throw Error('Simulated remote outage after browser reload');
 };
 // Simulate a REAL reload: GitHub Pages loads first-party <script src>
 // assets before the inline application. A bare inline eval would throw at
 // ElectionNightOpenAmericaTransport.create() before resume validation runs,
 // and an unclosed jsdom instance could hold the CI runner until timeout.
 // Discover actual linked modules from index in their browser load order.
 rw.setInterval=()=>0;
 const resumeModulePattern=new RegExp(
  '<script src="[.]/(scripts/[a-z0-9_-]+[.]js)[?]v=[0-9a-f]{12}"></script>','g');
 const resumeModules=[...html.matchAll(resumeModulePattern)].map(match=>match[1]);
 assert(resumeModules.length>=25,'Reload must include every linked election runtime dependency');
 for(const module of resumeModules)rw.eval(read(module));
 rw.eval(scripts[0]);
 const rg=selector=>{const el=rw.document.querySelector(selector);
    assert(el,'Missing resume UI element '+selector);return el};
 assert.equal(rw.eval('enResumeRestore()'),true,
   'Hydration must accept only the complete validated local envelope');
 rg('#enMode2026').click();
 rg('#enOfficeSenate').click();
 assert.equal(rg('#enRaces').textContent,'1',
   'Last verified Senate votes must show immediately after reload, even offline');
 assert.match(rg('#enConnection').textContent,/RESTORED/);
 assert.match(rg('#enStatus').textContent,/RESTORED BROWSER SNAPSHOT/);
 assert.match(rg('#enActivityFeed').textContent,/NC.*NEW REPORTING/,
    'Stored observed updates should be visible again after browser reload');
 assert.equal(rw.eval('enResumeSave()'),true,
   'A verified source snapshot must be saved locally in election mode');
 const resaved=JSON.parse(rw.localStorage.getItem('bluewaves_2026_results_resume_v1'));
 assert.equal(resaved.snapshots.Senate.races.NC.total,300);
 assert.equal(resaved.movements.length,1);
 // Reconnecting another office must NEVER remove the restored/stale badge
 // from a separate Senate office whose source has not been refreshed.
 rw.fetch=async url=>{
   const name=String(url).split('?')[0].split('/').pop();
   if(String(url).includes('openamerica.io')&&String(url).includes('office=House'))
     return {ok:true,json:async()=>empty2026};
   if(name in fixtures)return {ok:true,json:async()=>fixtures[name]};
   throw Error('Senate source still offline');
 };
 rg('#enOfficeHouse').click();
 await rw.eval('enLoad(true)');
 rg('#enOfficeSenate').click();
 assert.equal(rg('#enRaces').textContent,'1');
 assert.match(rg('#enConnection').textContent,/RESTORED/,
   'Updating House cannot silently mark restored Senate votes as live');
 const invalid={...resumePayload,
   snapshots:{Senate:{...counted2026,office:'House'}}};
 rw.localStorage.setItem('bluewaves_2026_results_resume_v1',JSON.stringify(invalid));
 assert.equal(rw.eval('enResumeRestore()'),false,
    'Cross-office payload must never restore as another race');
 const expired={...resumePayload,saved_at:'2026-10-20T20:00:00Z'};
 rw.localStorage.setItem('bluewaves_2026_results_resume_v1',JSON.stringify(expired));
 assert.equal(rw.eval('enResumeRestore()'),false,
    'Snapshots older than the 72-hour resume window must not load');
 const fakeCall=structuredClone(counted2026);fakeCall.races.NC.called=true;
 rw.localStorage.setItem('bluewaves_2026_results_resume_v1',
   JSON.stringify({...resumePayload,snapshots:{Senate:fakeCall}}));
 assert.equal(rw.eval('enResumeRestore()'),false,
    'Unverified vote calls in saved storage must not be trusted');
 rw.localStorage.setItem('bluewaves_2026_results_resume_v1',JSON.stringify(resumePayload));
 rw.Date.now=()=>Date.parse('2026-10-22T12:00:00Z');
 assert.equal(rw.eval('enResumeRestore()'),false,
    'Election-night local cache cannot appear as pre-election reported votes');
 // Allow the second page's normal asynchronous article/research fetches to
 // settle before tearing down jsdom; an unmounted DOM is not a browser page.
 await new Promise(resolve=>setTimeout(resolve,100));
 resumed.window.close();

 // Both election-night CSV exports must include only actual source data,
 // with provider attribution, correct vote totals and spreadsheet-safe cells.
 const csvClock=w.Date.now;
 w.Date.now=()=>Date.parse('2026-11-04T03:40:00Z');
 const emptyExport=w.eval('enBuildResultsCsv({},{})');
 assert.equal(emptyExport,'','No actual votes should yield a blank export');
 // A detached synthetic primary/supplemental pair is deliberately NOT a
 // verified source in the browser's current caches. Even if its JSON looks
 // well formed, a CSV must not permit a caller to bypass current rechecks.
 const sourceCsv=w.eval('enBuildResultsCsv('+
    JSON.stringify({Senate:counted2026})+','+
    JSON.stringify({'Senate|NH':rawCivic})+')');
 assert.equal(sourceCsv,'',
  'CSV must refuse synthetic snapshots not identical to current validated browser sources');
 const eventCsv=w.eval('enBuildActivityCsv('+JSON.stringify([
   firstNC,correction,flip,{...firstNC,office:'InvalidProvider'},
 ])+')');
 assert.match(eventCsv,/FIRST VOTES/);
 assert.match(eventCsv,/VOTE LEAD FLIPPED/);
 assert.match(eventCsv,/CANDIDATE VOTES REVISED/);
 assert.doesNotMatch(eventCsv,/InvalidProvider/);
 assert.equal(eventCsv.trim().split('\r\n').length,4);
 const evidenceLines=eventCsv.trim().split('\r\n');
 const evidenceCells=line=>line.match(/(?:^|,)(?:"(?:[^"]|"")*"|[^,]*)/g).length;
 assert.match(evidenceLines[0],/selected_payload_sha256/);
 assert(evidenceLines.every(line=>evidenceCells(line)===evidenceCells(evidenceLines[0])),
  'Existing activity rows remain aligned when official admission provenance columns are added');
 const malicious=w.eval('enCsvCell('+JSON.stringify('=HYPERLINK("https://malicious.example")')+')');
 assert(malicious.startsWith('"\'=HYPERLINK'),
   'Formula-like external candidate text must never execute as a spreadsheet formula');
 assert(malicious.includes('""https://malicious.example""'),
   'Quotes inside external names must be escaped');
 const quoted=w.eval('enCsvCell('+JSON.stringify('Candidate "A", Jr.')+')');
 assert.equal(quoted,'"Candidate ""A"", Jr."');
 w.Date.now=csvClock;

 // The open tab should accept a new posted survey without a page reload.
 // Hold the session's first-loaded IDs fixed for meaningful unseen counts.
 const freshPosted=structuredClone(recent);
 freshPosted.updated_at=new Date(Math.max(Date.now(),Date.parse(recent.updated_at)+60000)).toISOString();
 freshPosted.observations.unshift({...freshPosted.observations[0],
  race_code:'NC-SEN',state:'NC',race_type:'senate',
  poll_id:'new-live-refresh-test',question_id:'new-live-refresh-question',
  pollster:'In-Tab Fresh Survey',posted_date:freshPosted.updated_at.slice(0,10),
  posted_source_datetime:freshPosted.updated_at.slice(0,16)});
 fixtures['pollresults_recent.json']=freshPosted;
 await w.eval('refreshLivePollSnapshots()');
 assert.match(get('#newPolls').textContent,/In-Tab Fresh Survey/,
  'The polling feed must update in a still-open browser tab');
 assert.match(get('#changesSince').textContent,/newly indexed since opening/,
  'The unseen-count reference must not silently reset on each render');
 // A partial publication must not replace the complete previous forecast.
 const formerModelAt=w.eval('jointRaceOddsResult().polling_source_generated_at');
 const formerMN=w.eval("jointRaceOddsResult().records.find(x=>x.race_code==='MN-SEN'&&x.office==='senate').dem_beats_rep_pct");
 const formerIA=w.eval("jointRaceOddsResult().records.find(x=>x.race_code==='IA-SEN'&&x.office==='senate').dem_beats_rep_pct");
 const formerSenateControl=w.eval('jointForecastResult().senate_dem_control_pct');
 const formerFour=w.eval('jointForecastResult().probabilities');
 const formerFourCards=get('#jointHomeCards').textContent;
 const primaryNext=structuredClone(primary);
 primaryNext.updated_at=new Date(Date.parse(freshPosted.updated_at)+60000).toISOString();
 primaryNext.health={...primaryNext.health,status:'ok'};
 fixtures['polls.json']=primaryNext;
 await w.eval('refreshLivePollSnapshots()');
 assert.equal(w.eval('jointRaceOddsResult().polling_source_generated_at'),formerModelAt);
 assert(w.eval('jointForecastResult()'),
  'Temporary mismatched polling/model data must not erase good race odds');
 assert.deepEqual(w.eval('jointForecastResult().probabilities'),formerFour);
 assert.equal(get('#jointHomeCards').textContent,formerFourCards,
  'Four Endings cannot display a partially published polling revision');
 // Once the corresponding estimate and odds snapshot appear, the same
 // in-page check should refresh the model and its displayed metadata.
 const estimatesNext=structuredClone(model);
 estimatesNext.source_snapshot=primaryNext.updated_at;
 estimatesNext.generated_at=new Date(Date.parse(primaryNext.updated_at)+1000).toISOString();
 const oddsNext=structuredClone(fixtures['race_probabilities.json']);
 oddsNext.polling_source_generated_at=estimatesNext.generated_at;
 oddsNext.polling_source_snapshot=estimatesNext.source_snapshot;
 // Verify actual poll contents and the JOINT simulation change, not merely
 // the last-updated timestamp on a still-open dashboard tab.
 const mnPrimary=primaryNext.races.find(r=>r.race_code==='MN-SEN');
 assert(mnPrimary,'Minnesota primary race must exist');
 const mnNewPoll={...mnPrimary.polls[0],
  poll_id:'mn-new-firm-live-refresh-regression',
  pollster:'New Independent Minnesota Firm',
  field_end:'2026-10-14',dem:55,rep:38,margin:17,
  sample_size:720,partisan_lean:'',
  dem_name:'Peggy Flanagan',rep_name:'Michele Tafoya'};
 mnPrimary.polls.unshift(mnNewPoll);
 mnPrimary.latest=mnNewPoll;
 mnPrimary.latest_field_end=mnNewPoll.field_end;
 mnPrimary.recent_poll_count=mnPrimary.polls.length;
 const mnEstimate=estimatesNext.senate_all.find(r=>r.race_code==='MN-SEN');
 assert(mnEstimate,'Minnesota model race must exist');
 mnEstimate.dem_minus_rep=Number((mnEstimate.dem_minus_rep+6).toFixed(2));
 mnEstimate.dem_pct=Number((mnEstimate.dem_pct+3).toFixed(2));
 mnEstimate.rep_pct=Number((mnEstimate.rep_pct-3).toFixed(2));
 mnEstimate.latest_poll_end=mnNewPoll.field_end;
 mnEstimate.contributing_pollsters++;
 mnEstimate.independent_pollsters++;
 mnEstimate.pollsters.unshift({name:mnNewPoll.pollster,
  field_end:mnNewPoll.field_end,poll_id:mnNewPoll.poll_id});
 Object.assign(estimatesNext.states.find(r=>r.race_code==='MN-SEN'),mnEstimate);
 const mnRefreshOdds=oddsNext.records.find(r=>r.office==='senate'&&r.race_code==='MN-SEN');
 assert(mnRefreshOdds,'Minnesota probability input must exist');
 Object.assign(mnRefreshOdds,{
  dem_minus_rep:mnEstimate.dem_minus_rep,
  latest_poll_end:mnNewPoll.field_end,
  contributing_firms:mnEstimate.contributing_pollsters,
  independent_firms:mnEstimate.independent_pollsters
 });
 // Regression specific to Iowa: a new independent LV wave must replace
 // the on-screen model odds and the same-draw Senate/Four Endings inputs.
 // Do not special-case 55.3%, a legacy standalone poll-only diagnostic.
 const iaPrimary=primaryNext.races.find(r=>r.race_code==='IA-SEN');
 const iaEstimate=estimatesNext.senate_all.find(r=>r.race_code==='IA-SEN');
 const iaSourceOdds=oddsNext.records.find(r=>r.office==='senate'&&r.race_code==='IA-SEN');
 assert(iaPrimary&&iaEstimate&&iaSourceOdds,'Iowa must be in all source and forecast inputs');
 const iaNewPoll={...iaPrimary.polls[0],
  poll_id:'ia-new-firm-live-refresh-regression',
  question_id:'ia-new-independent-lv-question',
  pollster:'New Independent Iowa LV Firm',
  field_end:'2026-10-14',dem:55,rep:40,margin:15,
  sample_size:1200,sample_population:'lv',partisan_lean:'',
  dem_name:iaEstimate.dem_candidate,rep_name:iaEstimate.rep_candidate};
 iaPrimary.polls.unshift(iaNewPoll);
 iaPrimary.latest=iaNewPoll;
 iaPrimary.latest_field_end=iaNewPoll.field_end;
 iaPrimary.recent_poll_count=iaPrimary.polls.length;
 iaEstimate.dem_minus_rep=Number((iaEstimate.dem_minus_rep+6).toFixed(2));
 iaEstimate.dem_pct=Number((iaEstimate.dem_pct+3).toFixed(2));
 iaEstimate.rep_pct=Number((iaEstimate.rep_pct-3).toFixed(2));
 iaEstimate.latest_poll_end=iaNewPoll.field_end;
 iaEstimate.contributing_pollsters++;
 iaEstimate.independent_pollsters++;
 iaEstimate.pollsters.unshift({name:iaNewPoll.pollster,field_end:iaNewPoll.field_end,
  poll_id:iaNewPoll.poll_id,question_id:iaNewPoll.question_id,
  sample_population:'lv',dem:55,rep:40,sample_size:1200});
 Object.assign(estimatesNext.states.find(r=>r.race_code==='IA-SEN'),iaEstimate);
 Object.assign(iaSourceOdds,{
  dem_minus_rep:iaEstimate.dem_minus_rep,
  latest_poll_end:iaNewPoll.field_end,
  contributing_firms:iaEstimate.contributing_pollsters,
  independent_firms:iaEstimate.independent_pollsters
 });
 const seatNext=structuredClone(fixtures['seat_universe.json']);
 seatNext.polling_source_snapshot=estimatesNext.generated_at;
 fixtures['seat_universe.json']=seatNext;
 fixtures['polling_estimates.json']=estimatesNext;
 fixtures['race_probabilities.json']=oddsNext;
 await w.eval('refreshLivePollSnapshots()');
 assert.equal(w.eval('jointRaceOddsResult().polling_source_generated_at'),estimatesNext.generated_at,
  'Polling averages should update without reopening the dashboard');
 assert.equal(w.eval('jointRaceOddsResult().senate_prior_mode'),'current_2026');
 assert.equal(w.eval('jointRaceOddsResult().polling_source_generated_at'),estimatesNext.generated_at);
 const currentMN=w.eval("jointRaceOddsResult().records.find(x=>x.race_code==='MN-SEN'&&x.office==='senate').dem_beats_rep_pct");
 const currentIA=w.eval("jointRaceOddsResult().records.find(x=>x.race_code==='IA-SEN'&&x.office==='senate').dem_beats_rep_pct");
 assert(currentIA>formerIA+2,
  'Fresh Iowa LV polling must change the actual JOINT modeled Iowa Senate win probability');
 const newIowaCard=[...get('#senateTideRaces').querySelectorAll('[data-senate-tide]')]
  .find(x=>x.dataset.senateTide==='IA-SEN');
 assert(newIowaCard&&newIowaCard.dataset.forecastSource==='joint-correlated',
  'Iowa tide card must identify its correlated model source');
 assert.equal(newIowaCard.dataset.modelPollingAt,estimatesNext.generated_at,
  'Iowa displayed probability must come from the newly published polling snapshot');
 const currentIaWinning=currentIA>=50?currentIA:100-currentIA;
 assert(newIowaCard.textContent.includes((currentIA>=50?'D ':'R ')+currentIaWinning.toFixed(1)+'%'),
  'Iowa tide win odds must display the UPDATED joint simulation, not old poll-only odds');
 assert(currentMN>formerMN+1,
  'New Minnesota survey must change the JOINT simulated race win probability');
 assert(w.eval('jointForecastResult().senate_dem_control_pct')>=formerSenateControl,
  'A stronger Minnesota Democratic margin cannot reduce D Senate control odds with other inputs unchanged');
 assert.equal(w.eval('jointRaceOddsIntegrity()'),true,
  'New joint-model odds must still match every race and polling margin');
 assert.equal(w.eval('jointRaceOddsResult().polling_source_generated_at'),estimatesNext.generated_at);
 const nextFour=w.eval('jointForecastResult().probabilities');
 assert.notDeepEqual(nextFour,formerFour,
  'Fresh pivotal race polling must recalculate the Four Endings joint distribution');
 assert(Math.abs(Object.values(nextFour).reduce((n,x)=>n+x,0)-100)<.13);
 const keys=['blue_tsunami','blue_wave','shrug','red_dawn'];
 for(let i=0;i<4;i++){
  const value=nextFour[keys[i]].toFixed(1)+'%';
  assert.equal(get('#jointHomeCards').querySelectorAll('.joint-value')[i].textContent,value);
  assert.equal(get('#jointNightCards').querySelectorAll('.joint-value')[i].textContent,value);
 }
 assert.match(get('#jointHomeSummary').title,/central 90% D seats/);
 const currentMS=w.eval("jointForecastResult().race_probabilities.find(x=>x.office==='senate'&&x.race_code==='MS-SEN').dem_beats_rep_pct");
 assert(get('#mississippiSenateWatch').textContent.includes(
  (currentMS>=50?currentMS:100-currentMS).toFixed(1)+'%'),
  'Mississippi must share the revised Senate and Four Endings simulation');
 w.eval("navigateInsightToModel({office:'senate',race:{race_code:'MN-SEN'}})");
 assert.match(get('#modelOddsNumbers').textContent,new RegExp(Math.round(currentMN)+'%'),
  'Visible Minnesota race odds must reflect the new correlated simulation');
 w.eval("navigateInsightToModel({office:'senate',race:{race_code:'IA-SEN'}})");
 assert.match(get('#modelOddsNumbers').textContent,
  new RegExp(Math.round(currentIA)+'%'),
  'Iowa detail page must show new correlated forecast odds');
 const iaDiagnostic=get('#modelOddsReconciliation');
 assert.match(iaDiagnostic.textContent,/LIVE JOINT FORECAST: D /);
 const older=iaDiagnostic.querySelector('details.poll-only-diagnostic');
 assert(older&&!older.open,
  'Older standalone probability must be collapsed below the live Iowa forecast');
 assert.match(older.textContent,/NOT the live forecast/,
  'Do not mistake the standalone poll-only percentage for the current win chance');
 assert.match(get('#changesSince').textContent,/newly indexed since opening/,
  'Refreshing the full forecast should preserve newly indexed survey count');

 // Audit 01: a delayed initial fetch can return the *old* raw poll file
 // after an atomic newer joint source/model bundle has been installed.
 // Regression is especially harmful: the old Poll Wire falsely marks new
 // surveys as unmatched and can make Iowa/Marist appear ignored.
 const acceptedRawAt=w.eval('livePollingRevisionStatus().primary_at');
 const acceptedModelAt=w.eval('jointRaceOddsResult().polling_source_generated_at');
 const acceptedIowaMargin=w.eval('livePollingRevisionStatus().iowa_margin');
 assert.equal(acceptedRawAt,primaryNext.updated_at);
 assert.equal(acceptedModelAt,estimatesNext.generated_at);
 w.eval('renderPolls('+JSON.stringify(primary)+')');
 assert.equal(w.eval('livePollingRevisionStatus().primary_at'),acceptedRawAt,
  'A late initial polling response must never overwrite new source data');
 assert.equal(w.eval('livePollingRevisionStatus().health_source_at'),acceptedRawAt,
  'The feed health badge must not regress with an out-of-order response');
 assert.equal(w.eval('jointRaceOddsResult().polling_source_generated_at'),acceptedModelAt);
 assert.equal(w.eval('livePollingRevisionStatus().iowa_margin'),acceptedIowaMargin);

 // A late OLD joint request must also be rejected *before* replacing
 // the valid engine and its same-draw election scenarios.
 fixtures['polling_estimates.json']=model;
 fixtures['race_probabilities.json']=json('data/race_probabilities.json');
 fixtures['seat_universe.json']=json('data/seat_universe.json');
 const acceptedForecast=w.eval('jointForecastResult().probabilities');
 assert.equal(await w.eval('jointLoadSources')({
  preserveOnFailure:true,expectedModelAt:model.generated_at,
  expectedPollAt:model.source_snapshot
 }),false);
 assert.equal(w.eval('jointRaceOddsResult().polling_source_generated_at'),acceptedModelAt,
  'Older complete joint bundle must never undo a newer forecast');
 assert.deepEqual(w.eval('jointForecastResult().probabilities'),acceptedForecast,
  'Race and Four Endings probabilities must survive late older fetches');
 assert.equal(w.eval('livePollingRevisionStatus().primary_at'),acceptedRawAt);

 // Product-level smoke: news + security sources must refresh while this
 // browser remains open and must keep verified incidents distinct from leads.
 const newsBefore=fixtures['briefing.json'];
 const newsNext=structuredClone(newsBefore);
 // Use an actually current collector timestamp; adding one minute to a historical
 // fixture can still be many hours stale and must correctly display DELAYED.
 newsNext.updated_at=new Date().toISOString();
 // This fixture represents a successfully completed new news collection,
 // not merely new-looking article timestamps atop a failed collector.
 // Production deliberately labels zero-success pipelines DELAYED.
 newsNext.pipeline={...(newsNext.pipeline||{}),
  successful_queries:Math.max(1,newsNext.pipeline?.successful_queries||0)};
 const freshNewsTitle='New independently published election news test headline';
 const freshSecurityTitle='New voter access lead test headline';
 newsNext.updates.unshift({title:freshNewsTitle,source:'Test publication',
  url:'https://example.com/election-news',published_at:newsNext.updated_at,
  status:'reported_not_independently_verified'});
 newsNext.security.unshift({title:freshSecurityTitle,source:'Test publication',
  url:'https://example.com/security-news',published_at:newsNext.updated_at,
  status:'reported_not_independently_verified'});
 const leadNext=structuredClone(fixtures['integrity_review_queue.json']);
 leadNext.updated_at=new Date(Date.parse(leadNext.updated_at)+60000).toISOString();
 leadNext.items.unshift({id:'fresh-security-lead',title:freshSecurityTitle,
  publisher:'Test publication',url:'https://example.com/security-news',
  state_hints:['OH'],review_status:'needs_primary_source',
  published_at:newsNext.updated_at});
 fixtures['briefing.json']=newsNext;
 fixtures['integrity_review_queue.json']=leadNext;
 const ledgerNext=structuredClone(fixtures['integrity_impact.json']);
 ledgerNext.updated_at='2026-10-15';
 fixtures['integrity_impact.json']=ledgerNext;
 assert(await w.eval('refreshCommandCenterFeeds')(),'New reporting must update without reloading the tab');
 assert(get('#updates').textContent.includes(freshNewsTitle),
  'Home news must display the newly collected article');
 assert(get('#security').textContent.includes(freshSecurityTitle),
  'Bullshittery security feed must update with new stories');
 assert(get('#integrityQueue').textContent.includes(freshSecurityTitle),
  'Verification queue must accept newly indexed lead');
 assert(get('#bullScoreStates').textContent.includes('Ohio'),
  'Key-race coverage must be shown on the integrity index');
 assert(get('#bullScoreStates').textContent.includes('Not assessed'),
  'Absent reviewed incidents must be UNKNOWN, not zero or cleared');
 assert(get('#newsFeedStatus').textContent.includes('NEWS SYNCED'),
  'News status must show the source collection state');
 assert(get('#integrityFeedStatus').textContent.includes('unverified leads indexed'),
  'Integrity status must distinguish unverified leads');
 const previousNewsDisplay=get('#updates').textContent;
 fixtures['briefing.json']=newsBefore;
 assert.equal(await w.eval('refreshCommandCenterFeeds')(),false,
  'An older news response must never roll back already accepted headlines');
 assert.equal(get('#updates').textContent,previousNewsDisplay);
 fixtures['briefing.json']=newsNext;

 assert.equal(errors.length,0,'Application emitted errors: '+errors.slice(0,4).join(' | '));
 console.log('Dashboard DOM integration passed: exact TX-SEN/TX-GOV poll drilldowns, race labels, linked joint-model race odds and DDHQ removal, dated news feed, and no script errors.');
 dom.window.close();
})().catch(e=>{console.error(e.stack||e);dom.window.close();process.exit(1)});
