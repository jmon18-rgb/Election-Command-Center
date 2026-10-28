/* Personal race display, not another forecasting or source-ingestion model. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.PersonalElectionFocus=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const SENATE=Object.freeze(['IA','KS','ME','OH','MI','NE','SC','MN','MS','AK']);
 const HOUSE=Object.freeze(['VA-02','PA-10','PA-07','PA-08','MI-07','NY-17','WI-03','AZ-06']);
 const CONNECTED=new Set(['IA-SEN','KS-SEN','ME-SEN','OH-SEN','SC-SEN','NE-SEN',...HOUSE]);
 const finite=x=>typeof x==='number'&&Number.isFinite(x),chance=x=>finite(x)&&x>=0&&x<=100;
 const time=x=>Number.isFinite(x)?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(x)+' ET':'Time unverified';
 const margin=(x,positive='D',negative='R')=>Math.abs(x)<.05?'Even':(x>0?positive+'+':negative+'+')+Math.abs(x).toFixed(1);
 const range=(x,positive='D',negative='R')=>Math.abs(x[1]-x[0])<.05?margin((x[0]+x[1])/2,positive,negative):margin(x[0],positive,negative)+' to '+margin(x[1],positive,negative);
 const ENDINGS=['red_dawn','shrug','blue_wave','blue_tsunami'];
 const HISTORY_KEY='bluewaves_outlook_history_v1',HISTORY_LIMIT=192,HISTORY_BYTES=240000,HISTORY_AGE=72*3600000;
 const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/(?:Z|[+-]\d\d:\d\d)$/.test(x);
 const code=x=>typeof x==='string'&&/^[A-Z]{2}-(?:SEN|GOV|\d{2})$/.test(x);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const sourceUrl=x=>typeof x==='string'&&x.length<=500&&/^https?:\/\//.test(x)?x:null;
 const historyTime=x=>iso(x)?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(Date.parse(x))+' ET':'Time unavailable';
 // Browser observations only. Never restore evidence/model state from storage.
 function createHistory({storage,now=()=>Date.now(),simulated=false}={}){
  let events=[],states={};
  const key=HISTORY_KEY,contextOk=x=>['PUBLIC','LOCAL_RESEARCH_VARIANT'].includes(x);
  const probsOk=p=>p&&ENDINGS.every(k=>chance(p[k]))&&Math.abs(ENDINGS.reduce((s,k)=>s+p[k],0)-100)<.2;
  const kinds=['SESSION_START','RETURNS','CORRECTION','WITHDRAWAL','RECOVERY','CALL','SOURCE_CHANGE','BASELINE_CHANGE','REEVALUATION'];
  const valid=e=>e&&iso(e.observed_at)&&iso(e.window_started_at)&&contextOk(e.context)&&kinds.includes(e.kind)&&probsOk(e.probabilities)&&
   typeof e.revision==='string'&&e.revision.length<=600&&iso(e.polling_at)&&e.simulated===simulated&&
   Number.isSafeInteger(e.observations)&&e.observations>0&&Array.isArray(e.changes)&&e.changes.length<=24&&
   e.changes.every(c=>code(c.code)&&typeof c.kind==='string'&&c.kind.length<=40&&(c.source_at===null||iso(c.source_at))&&(c.receipt_at===null||iso(c.receipt_at)));
  function prune(){const count=events.length,at=now();events=events.filter(e=>at-Date.parse(e.observed_at)<=HISTORY_AGE&&Date.parse(e.observed_at)<=at+60000).slice(0,HISTORY_LIMIT);return events.length!==count;}
  function save(){prune();while(events.length&&JSON.stringify({schema:1,events}).length>HISTORY_BYTES)events.pop();try{if(!simulated)storage?.setItem(key,JSON.stringify({schema:1,events}));}catch{}}
  try{const raw=!simulated&&storage?.getItem(key);if(raw&&raw.length<=HISTORY_BYTES){const d=JSON.parse(raw);if(d.schema===1&&Array.isArray(d.events)&&d.events.length<=HISTORY_LIMIT&&d.events.every(valid))events=d.events;}}catch{}
  if(prune())save();
  function observe({active=true,result,envelopes=[],live={},evidence=[],revision,pollingAt,context='PUBLIC',simulated:sampleSimulated=false}={}){
   const at=now();if(!active||!Number.isFinite(at)||sampleSimulated!==simulated||!contextOk(context)||!probsOk(result?.probabilities)||
    typeof revision!=='string'||revision.length>600||!iso(pollingAt)||(!simulated&&at<Date.parse('2026-11-03T05:00:00Z'))||
    !Array.isArray(envelopes)||envelopes.length>18||!Array.isArray(evidence)||evidence.length>524||Object.keys(live).length>506||
    envelopes.some(e=>Boolean(e?.rehearsal)!==simulated)||(!simulated&&result?.county_results_update?.status==='SIMULATED_NATIONAL_REHEARSAL'))return false;
   const sources=new Map(),used=result?.county_results_update?.used||[];
   if(!Array.isArray(used)||used.length>18)return false;
   for(const u of used){
    const e=envelopes.find(e=>e?.snapshot?.race_code===u.code),s=e?.snapshot;
    if(!code(u.code)||!s||s.live_votes_accepted!==true||!iso(u.as_of)||u.as_of!==s.snapshot_updated_at||!Array.isArray(s.counties)||s.counties.length>254)return false;
    const independent=u.code==='NE-SEN';if(independent&&(s.candidate_contrast!=='NE_OSBORN_RICKETTS_V1'||s.caucus_credit_assumed!==false))return false;
    const rows=s.counties.map(c=>independent?{f:c.county_fips,support:c.osborn_votes,opponent:c.ricketts_votes,o:c.other_votes,others:c.other_candidates}:{f:c.county_fips,d:c.dem_votes,r:c.rep_votes,o:c.other_votes}).sort((a,b)=>String(a.f).localeCompare(String(b.f)));
    if(rows.some(c=>!/^\d{5}$/.test(c.f)||![independent?c.support:c.d,independent?c.opponent:c.r,c.o].every(n=>Number.isSafeInteger(n)&&n>=0)))return false;
    const counts=JSON.stringify(rows),supplement=JSON.stringify(u.official_remaining_sensitivity?s.official_remaining:null);
    const source_url=sourceUrl(s.source_url),transport_url=sourceUrl(s.transport_url);
    const difference=u.matched_performance?.difference_margin_scenarios,margin_difference=Array.isArray(difference)&&difference.length===2&&difference.every(finite)?[...difference]:null;
    sources.set('count:'+u.code,{code:u.code,kind:'COUNT',rows,counts,supplement,source_url,transport_url,identity:JSON.stringify([source_url,transport_url]),
     margin_difference,
     selected_hash:s.collection_payload_integrity_verified===true&&/^[a-f0-9]{64}$/.test(s.collection_selected_payload_sha256||'')?s.collection_selected_payload_sha256:null,
     source_at:u.as_of,receipt_at:iso(s.collection_fetched_at)?s.collection_fetched_at:null});
   }
   for(const [race,s]of Object.entries(live)){
    if(!code(race)||s?.mode!=='source_called'||!['D','R'].includes(s.winnerParty))return false;
    const e=evidence.find(x=>x.race_code===race&&x.calledParty===s.winnerParty);
    const source_url=sourceUrl(e?.source_url);sources.set('call:'+race,{code:race,kind:'CALL',counts:s.winnerParty,source_url,transport_url:null,selected_hash:null,margin_difference:null,identity:source_url,source_at:iso(e?.asOf)?e.asOf:null,receipt_at:null});
   }
   const old=states[context],changes=[];
   for(const [k,s]of sources){const before=old?.sources.get(k);
    if(!before||before.counts!==s.counts||before.supplement!==s.supplement||before.identity!==s.identity){
     const correction=before?.kind==='CALL'&&before.counts!==s.counts||before?.rows&&s.rows?.some(c=>{const p=before.rows.find(p=>p.f===c.f);return p&&((s.code==='NE-SEN'?c.support<p.support||c.opponent<p.opponent:c.d<p.d||c.r<p.r)||c.o<p.o||(s.code==='NE-SEN'&&c.others?.some(o=>o.votes<(p.others?.find(v=>v.provider_id===o.provider_id)?.votes??0))));});
     changes.push({code:s.code,kind:correction?'CORRECTION':!before&&old?.seen.has(k)?'RECOVERY':before&&before.identity!==s.identity?'SOURCE_CHANGE':s.kind==='CALL'?'CALL':before?.counts===s.counts?'SUPPLEMENT_CHANGE':'RETURNS',source_at:s.source_at,receipt_at:s.receipt_at,source_url:s.source_url,transport_url:s.transport_url,selected_hash:s.selected_hash,margin_difference:s.margin_difference});
    }
   }
   if(old)for(const [k,s]of old.sources)if(!sources.has(k))changes.push({code:s.code,kind:'WITHDRAWAL',source_at:s.source_at,receipt_at:s.receipt_at,source_url:s.source_url,transport_url:s.transport_url,selected_hash:s.selected_hash,margin_difference:s.margin_difference});
   const probabilities=Object.fromEntries(ENDINGS.map(k=>[k,result.probabilities[k]])),seen=new Set([...(old?.seen||[]),...sources.keys()].slice(-524));
   states[context]={sources,seen,revision,probabilities};
   if(old&&old.revision===revision&&!changes.length&&JSON.stringify(old.probabilities)===JSON.stringify(probabilities))return false;
   const kind=!old?'SESSION_START':old.revision!==revision?'BASELINE_CHANGE':['WITHDRAWAL','CORRECTION','RECOVERY','SOURCE_CHANGE','CALL'].find(k=>changes.some(c=>c.kind===k))||(changes.length?'RETURNS':'REEVALUATION');
   const e={observed_at:new Date(at).toISOString(),window_started_at:new Date(at).toISOString(),context,kind,revision,polling_at:pollingAt,probabilities,simulated,
    observations:1,source_count:sources.size,changes:changes.slice(0,24),changes_omitted:Math.max(0,changes.length-24)};
   prune();const recent=events[0],ordinary=k=>['RETURNS','CALL','REEVALUATION'].includes(k);
   if(recent&&recent.context===context&&ordinary(kind)&&ordinary(recent.kind)&&recent.revision===revision&&at>=Date.parse(recent.observed_at)&&at-Date.parse(recent.window_started_at)<5*60000){
    const merged=new Map([...recent.changes,...e.changes].map(c=>[c.kind+':'+c.code,c]));
    e.window_started_at=recent.window_started_at;e.observations+=recent.observations;e.changes=[...merged.values()].slice(0,24);e.changes_omitted+=recent.changes_omitted+Math.max(0,merged.size-24);events[0]=e;
   }else events.unshift(e);
   save();return true;
  }
  return Object.freeze({observe,events:(context='PUBLIC')=>{if(prune())save();return copy(events.filter(e=>e.context===context));}});
 }
 function renderHistory(doc,history,context,open=false){
  const el=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const data=history?.events(context)||[],details=el('details');details.className='personal-focus-history';details.open=open;
  details.append(el('summary','Recent national outlook updates'+(data.length?' · '+data.length+' records':'')));
  details.append(el('p','Browser-observed outlooks, stored only on this device. Regular updates are grouped within five minutes; corrections, withdrawals and recovery remain separate. Times show when this browser observed the model, not when a publisher first released votes. Reload starts a new comparison session. This is not independent election chronology or calibration.'));
  if(!data.length)details.append(el('p','No observed election-night updates in this context yet. Use the simulated preview to rehearse changes; live history starts November 3.'));
  const list=el('ol');details.append(list);
  for(const e of data.slice(0,8)){
   const row=el('li');row.className='personal-focus-history-entry';
   row.append(el('strong',(e.simulated?'SIMULATED · ':'')+historyTime(e.observed_at)+' · '+e.kind.replaceAll('_',' ').toLowerCase()));
   row.append(el('p',ENDINGS.map(k=>k.replaceAll('_',' ')+' '+e.probabilities[k].toFixed(1)+'%').join(' · ')));
   if(e.observations>1)row.append(el('small',e.observations+' model observations since '+historyTime(e.window_started_at)+'; latest outlook shown.'));
   if(e.changes.length)row.append(el('small',e.changes.map(c=>c.code).filter((c,i,a)=>a.indexOf(c)===i).join(' · ')));
   const source=el('details');source.append(el('summary','Source changes, model revision and clocks'));
   for(const c of e.changes){source.append(el('small',c.code+' · '+c.kind.replaceAll('_',' ').toLowerCase()+' · '+(c.kind==='WITHDRAWAL'?'previous source ':'source ')+historyTime(c.source_at)+(c.receipt_at?' · collected '+historyTime(c.receipt_at):'')),el('small','Source URL: '+(c.source_url||'unavailable')+(c.transport_url?' · collected copy: '+c.transport_url:'')+(c.selected_hash?' · existing selected-payload hash: '+c.selected_hash:'')));
    if(Array.isArray(c.margin_difference)&&c.margin_difference.length===2&&c.margin_difference.every(finite))source.append(el('small',(c.kind==='WITHDRAWAL'?'Previous ':'')+'matched-area difference: '+range(c.margin_difference,c.code==='NE-SEN'?'Osborn':'D',c.code==='NE-SEN'?'Ricketts':'R')+' margin points vs expected; method scenarios, not confidence intervals.'));
   }
   if(e.changes_omitted)source.append(el('small',e.changes_omitted+' additional source changes omitted from this compact record.'));
   source.append(el('p',e.revision),el('p','Polling lineage: '+e.polling_at+' · browser observation: '+e.observed_at+' · '+e.context));row.append(source);list.append(row);
  }
  details.append(el('small','Shows latest 8 of up to '+HISTORY_LIMIT+' records retained for 72 hours within '+HISTORY_BYTES+' characters. This is a bounded local trend, not a complete raw source archive.'));
  return details;
 }
 function rows(result,baseline,{year=2026,now=Date.now(),closes,evidence=[],simulated=false}={}){
  if(year!==2026)return [];
  const current=new Map((result?.race_probabilities||[]).map(x=>[x.race_code,x]));
  const prior=new Map((baseline?.race_probabilities||[]).map(x=>[x.race_code,x]));
  const used=new Map((result?.county_results_update?.used||[]).map(x=>[x.code,x]));
  return [...SENATE.map(state=>({code:state+'-SEN',office:'Senate',key:state==='OH'?'OH-special':state})),...HOUSE.map(code=>({code,office:'House',key:code}))].map((spec,order)=>{
   const state=spec.code.slice(0,2),entry=current.get(spec.code),base=prior.get(spec.code);
   const first=closes?.floorFor(spec.key),last=closes?.winnerFloorFor(spec.office,spec.key);
   const direct=state==='AK'?null:used.get(spec.code),ownCounts=Boolean(direct),called=state!=='AK'&&['D','R'].includes(entry?.provider_called_party);
   // Existing AK identity/round exclusions apply to this display too. A baseline
   // binary margin must not be presented as an accepted final RCV probability.
   const pct=state==='AK'||!chance(entry?.dem_beats_rep_pct)?null:entry.dem_beats_rep_pct;
   const delta=pct!==null&&chance(base?.dem_beats_rep_pct)?pct-base.dem_beats_rep_pct:null;
   const left=state==='NE'?'Osborn':'D';
   const pending=state==='AK'?'Ballot identity / ranked-choice contract pending':CONNECTED.has(spec.code)?'Own county returns not admitted':'County evidence connection pending';
   const status=ownCounts?'Own county returns used nationally':called?'Validated source call used':pending;
   const candidateStamp=direct?.as_of||(called?evidence.find(x=>x.race_code===spec.code&&x.calledParty===entry.provider_called_party)?.asOf:null);
   const sourceAt=Number.isFinite(Date.parse(candidateStamp||''))?candidateStamp:null;
   const window=Number.isFinite(first)?time(first)+(Number.isFinite(last)&&last!==first?(state==='KS'?' · conservative call gate ':'–')+time(last):''):'Time unverified';
   return {...spec,state,order,left,pct,delta,status,sourceAt,ownCounts,called,simulated:simulated||result?.county_results_update?.status==='SIMULATED_NATIONAL_REHEARSAL',
    count:direct&&finite(direct.counted_two_party_votes)?direct.counted_two_party_votes:null,
    performance:direct?.matched_performance||null,
    first,last,window,started:Number.isFinite(first)&&now>=first,
    note:state==='ME'?'First-choice evidence; final RCV transfers separate':state==='NE'?'Independent; no assumed Democratic caucus':state==='AK'?'Lowest first-night priority; final RCV timing separate':!ownCounts&&(used.size||called)?'Forecast may reflect other admitted races':'',
    rank:state==='AK'?4:ownCounts||called?0:Number.isFinite(first)&&now>=first?1:2};
  }).sort((a,b)=>a.rank-b.rank||(a.first||Infinity)-(b.first||Infinity)||a.order-b.order);
 }
 function render(host,result,baseline,options={}){
  if(!host)return;const data=rows(result,baseline,options);host.hidden=!data.length;
  const historyOpen=Boolean(host.querySelector('.personal-focus-history')?.open),historyFocused=Boolean(host.querySelector('.personal-focus-history')?.contains(host.ownerDocument.activeElement));
  // Keep operator disclosure state by race identity, never by changing row order.
  const openPerformance=new Set(Array.from(host.querySelectorAll('.personal-focus-card')).filter(c=>c.querySelector('details')?.open).map(c=>c.dataset.race));
  const activeCard=host.ownerDocument.activeElement?.closest?.('.personal-focus-card');
  const focusedRace=activeCard&&host.contains(activeCard)?activeCard.dataset.race:null;
  host.replaceChildren();if(!data.length)return;
  const doc=host.ownerDocument,el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const simulated=data.some(x=>x.simulated);
  host.append(el('h2','',(simulated?'SIMULATED · ':'')+'Your election-night needles'),el('p','methodline',simulated?'FICTIONAL COUNTS · NOT LIVE. These race needles share this simulated national update; the live dashboard is unchanged.':'Same race forecasts as the national model. Own validated returns enter once; race probabilities are never averaged back into it. Order follows admitted evidence and poll-close windows, not a promise of when votes will arrive.'));
  host.append(el('p','personal-focus-next','Focus now / next: '+data.filter(x=>x.state!=='AK').slice(0,3).map(x=>x.code+' · '+x.window).join(' | ')));
  if(options.history){const history=renderHistory(doc,options.history,options.context||'PUBLIC',historyOpen);host.append(history);if(historyFocused)history.querySelector('summary')?.focus({preventScroll:true});}
  for(const office of ['Senate','House']){
   const group=el('section','');group.append(el('h3','',office==='Senate'?'Your ten Senate races':'House power-flip watch'));
   const grid=el('div','personal-focus-grid');
   for(const row of data.filter(x=>x.office===office)){
    const card=el('article','personal-focus-card');card.dataset.race=row.code;
    const heading=el('h4','',row.code==='OH-SEN'?'Ohio · special Senate':row.code);heading.tabIndex=-1;card.append(heading);
    card.append(el('small','',row.state==='AK'?'Late night · '+row.window:row.state==='KS'?'Counts eligible from · '+row.window:'Poll-close window · '+row.window));
    if(row.pct!==null){
     const chanceLabel=row.state==='NE'?'model chance vs Ricketts':'model win chance';
     const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 200 105');svg.setAttribute('role','img');svg.setAttribute('aria-label',row.code+' '+row.left+' '+chanceLabel+' '+row.pct.toFixed(1)+' percent');
     const node=(tag,attrs)=>{const n=doc.createElementNS(svg.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
     svg.append(node('path',{d:'M20 90 A80 80 0 0 1 100 10',stroke:'#ce6878',fill:'none','stroke-width':9}),node('path',{d:'M100 10 A80 80 0 0 1 180 90',stroke:row.left==='Osborn'?'#d2acff':'#57b4ff',fill:'none','stroke-width':9}),node('line',{x1:100,y1:90,x2:100,y2:18,stroke:'#fff0a4','stroke-width':4,transform:'rotate('+(-90+1.8*row.pct)+' 100 90)'}));
     const odds=el('strong','personal-focus-odds');odds.append(el('span','',row.left+' '+row.pct.toFixed(1)+'%'),el('small','',' · '+chanceLabel));
     card.append(svg,odds);
     card.append(el('small','',row.delta===null?'Baseline comparison unavailable':(row.delta>=0?'+':'')+row.delta.toFixed(1)+' probability points vs polling baseline'));
    }else card.append(el('strong','','Needle pending'));
    card.append(el('p','',(row.simulated?'SIMULATED · ':'')+row.status));
    if(row.count!==null)card.append(el('small','',row.count.toLocaleString('en-US')+' named-candidate '+row.left+'/R votes in admitted county evidence'));
    if(row.sourceAt)card.append(el('small','',(row.ownCounts?'Count':'Call')+' source time · '+time(Date.parse(row.sourceAt))));
    const p=row.performance,positive=p?.positive_candidate||'D',negative=p?.negative_candidate||'R';
    if(p&&finite(p.observed_margin_points)&&[p.expected_margin_scenarios,p.difference_margin_scenarios].every(x=>Array.isArray(x)&&x.length===2&&x.every(finite))){
     card.append(el('p','personal-focus-performance','Matched-area performance · '+range(p.difference_margin_scenarios,positive,negative)+' margin points vs expected'));
     const detail=el('details','');detail.append(el('summary','','What was expected here?'),el('p','','Observed '+margin(p.observed_margin_points,positive,negative)+'; expected '+range(p.expected_margin_scenarios,positive,negative)+' in the same reporting areas. Historical '+p.baseline_year+' local shares adjusted to the pre-results race expectation.'));
     detail.open=openPerformance.has(row.code);
     detail.append(el('p','',p.scope));if(p.historical_transfer)detail.append(el('p','',p.historical_transfer+'; experimental and uncalibrated.'));
     if(p.directional_transfer_assumption)detail.append(el('p','',p.directional_transfer_assumption));
     for(const u of p.largest_reporting_units||[])detail.append(el('small','',(u.county||'FIPS '+u.county_fips)+(row.office==='House'?' district part':'')+' · '+u.counted_two_party_votes.toLocaleString('en-US')+' '+positive+'/'+negative+' votes · observed '+margin(u.observed_margin_points,positive,negative)+'; expected '+range(u.expected_margin_scenarios,positive,negative)));
     detail.append(el('small','','Largest '+(p.largest_reporting_units||[]).length+' of '+p.reporting_units+' reporting areas shown. This does not extrapolate the raw margin statewide or call the race.'));
     card.append(detail);
    }
    if(row.note)card.append(el('small','',row.note));grid.append(card);
   }
   group.append(grid);host.append(group);
  }
  host.append(el('p','methodline','Probability changes are not vote-margin outperformance. Matched county performance remains the model evidence. NC01/AZ01 boundary contracts are still pending; existing TX and WA03 integrations remain available. KS uses the existing conservative final-call gate pending county-hours review. Experimental and uncalibrated; a forecast is not a result.'));
  if(focusedRace){const card=Array.from(host.querySelectorAll('.personal-focus-card')).find(c=>c.dataset.race===focusedRace);(card?.querySelector('details > summary')||card?.querySelector('h4'))?.focus({preventScroll:true});}
 }
 return Object.freeze({SENATE,HOUSE,rows,render,createHistory,HISTORY_KEY,HISTORY_LIMIT,HISTORY_BYTES});
});
