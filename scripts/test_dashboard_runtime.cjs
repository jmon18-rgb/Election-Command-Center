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
 'congress_scenarios.json':json('data/congress_scenarios.json')
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
 // Canonical in-app identifiers must be visible. TX Senate and TX governor
 // cannot both be ambiguous "Texas" cards any longer.
 const [txSen,txGov]=['senate','governor'].map(type=>
   model[type==='senate'?'senate_all':'governor'].find(x=>x.race_code==='TX-'+(type==='senate'?'SEN':'GOV')));
 assert(txSen&&txGov,'Both TX Senate and TX governor model averages required');
 const identity=(type,data)=>w.eval('raceIdentity('+JSON.stringify(data)+')');
 assert.match(identity('senate',txSen),/Texas.*Senate/);
 assert.match(identity('governor',txGov),/Texas.*Governor/);
 assert.notEqual(identity('senate',txSen),identity('governor',txGov));

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
 assert.equal(errors.length,0,'Application emitted errors: '+errors.slice(0,4).join(' | '));
 console.log('Dashboard DOM integration passed: exact TX-SEN/TX-GOV poll drilldowns, race labels, DDHQ stale-data guards, dated news feed, and no script errors.');
 dom.window.close();
})().catch(e=>{console.error(e.stack||e);dom.window.close();process.exitCode=1});
