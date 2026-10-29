/* Personal race display, not another forecasting or source-ingestion model. */
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./house_early_watch_reference.js'):root?.HouseEarlyWatchReference);if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.PersonalElectionFocus=api;})(typeof window!=='undefined'?window:null,function(WATCH){
 'use strict';
 const SENATE=Object.freeze(['IA','KS','ME','OH','MI','NE','SC','MN','MS','TX','AK']);
 const HOUSE=Object.freeze(['VA-02','PA-10','PA-07','PA-08','MI-07','NY-17','WI-03','AZ-06']);
 const CONNECTED=new Set(['IA-SEN','KS-SEN','ME-SEN','OH-SEN','SC-SEN','NE-SEN','TX-SEN',...HOUSE]);
 const finite=x=>typeof x==='number'&&Number.isFinite(x),chance=x=>finite(x)&&x>=0&&x<=100;
 const time=x=>Number.isFinite(x)?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(x)+' ET':'Time unverified';
 const margin=(x,positive='D',negative='R')=>Math.abs(x)<.05?'Even':(x>0?positive+'+':negative+'+')+Math.abs(x).toFixed(1);
 const range=(x,positive='D',negative='R')=>Math.abs(x[1]-x[0])<.05?margin((x[0]+x[1])/2,positive,negative):margin(x[0],positive,negative)+' to '+margin(x[1],positive,negative);
 const ENDINGS=['red_dawn','shrug','blue_wave','blue_tsunami'];
 const HISTORY_KEY='bluewaves_outlook_history_v1',HISTORY_LIMIT=192,HISTORY_BYTES=240000,HISTORY_AGE=72*3600000;
 const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/(?:Z|[+-]\d\d:\d\d)$/.test(x);
 const code=x=>typeof x==='string'&&/^[A-Z]{2}-(?:SEN|GOV|\d{2})$/.test(x);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const pendingViews=new WeakMap();
 const sourceUrl=x=>typeof x==='string'&&x.length<=500&&/^https?:\/\//.test(x)?x:null;
 // Presentation bands only. Even100% remains a forecast without a validated call.
 function rating(pct,{positive='D',negative='R',calledParty=null}={}){
  if(['D','R'].includes(calledParty))return {label:(calledParty==='D'?positive:negative)+' victory',state:'called',side:calledParty==='D'?'positive':'negative'};
  if(!chance(pct))return {label:'Rating pending',state:'pending',side:'neutral'};
  const support=pct>=50,confidence=support?pct:100-pct;
  return {label:confidence<60?'Toss-up':(confidence>=95?'Safe ':confidence>=80?'Likely ':'Leaning ')+(support?positive:negative),state:'forecast',side:confidence<60?'neutral':support?'positive':'negative'};
 }
 // Quantiles describe this model's existing margin proxy, not empirical coverage.
 // Older snapshots and unsupported/called axes must not acquire an inferred range.
 function marginSummary(entry,{raceCode,called=false,pending=false}={}){
  const d=entry?.margin_distribution,keys=['p05','p25','p50','p75','p95'];
  if(called||pending||!d||d.schema_version!=='same-joint-margin-summary-v1'||
   d.interval_calibrated!==false||d.distribution_scope!=='UNBOUNDED_LATENT_MARGIN_PROXY_NOT_FINAL_VOTE_INTERVAL'||
   d.quantile_method!=='SORTED_DRAW_LOWER_INDEX_FLOOR_N_MINUS_ONE_P'||
   d.axis!==(raceCode==='NE-SEN'?'osborn_minus_ricketts':'dem_minus_rep')||
   !['POLLING_BASELINE','COUNTY_IMPORTANCE_RESAMPLED','LIVE_INFORMED_SCENARIO','VALIDATED_CALL_IMPORTANCE_RESAMPLED','CALL_AND_COUNTY_IMPORTANCE_RESAMPLED'].includes(d.conditioning)||
   !Number.isInteger(d.sample_count)||d.sample_count<300||d.sample_count>30000||
   !Number.isInteger(d.unique_election_particles)||d.unique_election_particles<1||d.unique_election_particles>d.sample_count||
   !finite(d.mean)||!finite(d.sd)||d.sd<0||keys.some(k=>!finite(d[k])||Math.abs(d[k])>100)||
   keys.some((k,i)=>i>0&&d[k]<d[keys[i-1]]))return null;
  return Object.fromEntries([...keys,'mean','sd','sample_count','unique_election_particles','axis','conditioning'].map(k=>[k,d[k]]));
 }
 function renderMarginSummary(doc,row,el,open=false){
  const d=row.marginDistribution;if(!d)return null;
  const positive=row.state==='NE'?'Osborn':'D',negative=row.state==='NE'?'Ricketts':'R';
  const scale=Math.max(10,Math.ceil(Math.max(Math.abs(d.p05),Math.abs(d.p95))/5)*5),position=x=>50+50*x/scale;
  const section=el('section','personal-focus-margin');section.setAttribute('aria-label',row.code+' model margin range');
  section.append(el('p','personal-focus-margin-title','Model margin · median '+margin(d.p50,positive,negative)));
  const strip=el('div','personal-focus-margin-strip');strip.setAttribute('role','img');
  strip.setAttribute('aria-label',(row.calculationAsOf?'Last completed calculation; newer returns processing. ':'')+row.code+' model margin: median '+margin(d.p50,positive,negative)+'; middle 50 percent '+range([d.p25,d.p75],positive,negative)+'; middle 90 percent '+range([d.p05,d.p95],positive,negative)+'. Scale '+negative+'+'+scale+' to '+positive+'+'+scale+'. Model scenarios, not a calibrated final-vote interval.');
  for(const [name,value]of Object.entries({'range90-left':position(d.p05),'range90-width':position(d.p95)-position(d.p05),'range50-left':position(d.p25),'range50-width':position(d.p75)-position(d.p25),'median-left':position(d.p50)}))strip.style.setProperty('--'+name,value+'%');
  for(const cls of ['base','zero','range90','range50','median']){const part=el('span','personal-focus-margin-'+cls);part.setAttribute('aria-hidden','true');strip.append(part);}section.append(strip);
  const axis=el('div','personal-focus-margin-axis');axis.setAttribute('aria-hidden','true');
  axis.append(el('span','',negative+'+'+scale),el('span','','Even'),el('span','',positive+'+'+scale));section.append(axis);
  section.append(el('small','personal-focus-margin-caption','Middle 90% · '+range([d.p05,d.p95],positive,negative)));
  const detail=el('details','personal-focus-margin-detail');detail.dataset.disclosure='margin';detail.open=open;
  detail.append(el('summary','','What does this range mean?'),el('p','','The dot is the median model margin. The thick segment contains the middle 50% of model scenarios; the thin segment contains the middle 90%. Each strip labels its own scale. These are the same shared model draws as this needle, not an additional forecast or evidence input.'),el('p','','These experimental scenarios are not a calibrated final-vote interval or a count of ballots remaining. The model uses an unbounded margin approximation; no range is shown when its central scenarios exceed possible vote-margin bounds. A source call establishes a winner, not a winning margin.'));
  detail.append(el('small','',['COUNTY_IMPORTANCE_RESAMPLED','CALL_AND_COUNTY_IMPORTANCE_RESAMPLED'].includes(d.conditioning)?'Range includes admitted evidence through the shared model. The status below distinguishes own counts from broader context.':d.conditioning==='VALIDATED_CALL_IMPORTANCE_RESAMPLED'?'Range reflects broader validated-call context through shared model factors; own county returns are not inferred.':d.conditioning==='LIVE_INFORMED_SCENARIO'?'Range reflects a model scenario, not an independently validated final-vote projection.':'Polling-based model / scenario range; own county returns are not inferred.'));
  section.append(detail);return section;
 }
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
  function observe({active=true,result,envelopes=[],live={},evidence=[],revision,pollingAt,context='PUBLIC',calculation=null,simulated:sampleSimulated=false}={}){
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
   const captured=calculation&&['CURRENT','AS_OF'].includes(calculation.state)&&/^MODEL_FRAME:\d+$/.test(calculation.input_version||'')&&iso(calculation.input_at)&&iso(calculation.completed_at)?{state:calculation.state,input_version:calculation.input_version,input_at:calculation.input_at,completed_at:calculation.completed_at,sources:(Array.isArray(calculation.sources)?calculation.sources:[]).filter(row=>code(row.code)&&iso(row.source_at)).slice(0,18).map(row=>({code:row.code,source_at:row.source_at,receipt_at:iso(row.receipt_at)?row.receipt_at:null,selected_hash:/^[a-f0-9]{64}$/.test(row.selected_hash||'')?row.selected_hash:null}))}:null;
   const e={calculation:captured,observed_at:new Date(at).toISOString(),window_started_at:new Date(at).toISOString(),context,kind,revision,polling_at:pollingAt,probabilities,simulated,
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
   // Grouped observations keep their window identity as their latest clock changes.
   row.dataset.historyEntry=JSON.stringify([e.context,e.simulated,e.window_started_at,['RETURNS','CALL','REEVALUATION'].includes(e.kind)?'GROUPED':e.kind,e.revision]);
   row.append(el('strong',(e.simulated?'SIMULATED · ':'')+historyTime(e.observed_at)+' · '+e.kind.replaceAll('_',' ').toLowerCase()));
   if(e.calculation?.state==='AS_OF')row.append(el('small','Last completed calculation · captured '+historyTime(e.calculation.input_at)+'; newer returns were processing.'));
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
 function rows(result,baseline,{year=2026,now=Date.now(),closes,evidence=[],simulated=false,watch=false,calculationAsOf=null}={}){
  if(year!==2026)return [];
  const current=new Map((result?.race_probabilities||[]).map(x=>[x.race_code,x]));
  const prior=new Map((baseline?.race_probabilities||[]).map(x=>[x.race_code,x]));
  const used=new Map((result?.county_results_update?.used||[]).map(x=>[x.code,x]));
  const callContext=result?.source_call_conditioning?.conditioned_covariance_applied===true;
  const specs=watch?(WATCH?.districts||[]).map(x=>({code:x.code,office:'House',key:x.code})): [...SENATE.map(state=>({code:state+'-SEN',office:'Senate',key:state==='OH'?'OH-special':state})),...HOUSE.map(code=>({code,office:'House',key:code}))];
  return specs.map((spec,order)=>{
   const state=spec.code.slice(0,2),entry=current.get(spec.code),base=prior.get(spec.code);
   const first=closes?.floorFor(spec.key),last=closes?.winnerFloorFor(spec.office,spec.key);
   const direct=state==='AK'?null:used.get(spec.code),ownCounts=Boolean(direct),called=state!=='AK'&&['D','R'].includes(entry?.provider_called_party)&&!(state==='NE'&&entry?.provider_called_party==='D');
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
   const displayRating=rating(pct,{positive:left,negative:state==='NE'?'Ricketts':'R',calledParty:called?entry.provider_called_party:null});
   if(state==='NE'&&displayRating.state==='forecast')displayRating.label='Paired · '+displayRating.label;
   return {...spec,state,order,left,pct,delta,status,sourceAt,ownCounts,called,calledParty:called?entry.provider_called_party:null,marginDistribution:marginSummary(entry,{raceCode:spec.code,called,pending:pct===null}),broadStateProxy:typeof entry?.source_method==='string'&&entry.source_method.includes('redrawn_state_distribution_proxy'),polled:entry?.polled===true,rating:displayRating,simulated:simulated||result?.county_results_update?.status==='SIMULATED_NATIONAL_REHEARSAL',
    calculationAsOf,
    count:direct&&finite(direct.counted_two_party_votes)?direct.counted_two_party_votes:null,
    performance:direct?.matched_performance||null,
    first,last,window,started:Number.isFinite(first)&&now>=first,
    note:[state==='ME'?'First-choice evidence; final RCV transfers separate':state==='NE'?'Independent; no assumed Democratic caucus':state==='AK'?'Lowest first-night priority; final RCV timing separate':'',state!=='AK'&&!ownCounts&&!called&&callContext?'Broader validated-call context; own county returns are not admitted':state!=='AK'&&!ownCounts&&(used.size||called)?'Forecast may reflect other admitted races':''].filter(Boolean).join(' · '),
    rank:state==='AK'?4:ownCounts||called?0:Number.isFinite(first)&&now>=first?1:2};
  }).sort((a,b)=>a.rank-b.rank||(a.first||Infinity)-(b.first||Infinity)||a.order-b.order);
 }
 // A modal may outlive a results redraw. Keep a semantic reading bookmark,
 // separate from the temporary DOM node and from all model/source evidence.
 function captureFocus(host,target=host?.ownerDocument.activeElement){
  if(!host||!target||!host.contains(target))return null;
  const pending=pendingViews.get(host);if(pending?.anchor===target&&pending.bookmark)return {...pending.bookmark};
  if(target.dataset.personalCardLink)return {kind:'card-link',race:target.dataset.personalCardLink};
  if(target.dataset.personalWatchReturn)return {kind:'watch-return',race:target.dataset.personalWatchReturn};
  const watch=target.closest('.early-watch');if(watch)return {kind:'watch',race:target.closest('[data-watch-race]')?.dataset.watchRace||null};
  if(target.dataset.personalJump)return {kind:'jump',race:target.dataset.personalJump};
  const card=target.closest('.personal-focus-card');
  if(card)return {kind:'race',race:card.dataset.race,disclosure:target.closest('summary')?.parentElement.dataset.disclosure||null};
  const history=target.closest('.personal-focus-history');
  if(history)return {kind:'history',entry:target.closest('.personal-focus-history-entry')?.dataset.historyEntry||null};
  if(target.closest('.personal-focus-rating-key'))return {kind:'ratings'};
  return null;
 }
 function focusTarget(host,bookmark){
  if(!host||!bookmark)return null;
  if(bookmark.kind==='card-link')return Array.from(host.querySelectorAll('[data-personal-card-link]')).find(x=>x.dataset.personalCardLink===bookmark.race);
  if(bookmark.kind==='watch-return')return Array.from(host.querySelectorAll('[data-personal-watch-return]')).find(x=>x.dataset.personalWatchReturn===bookmark.race);
  if(bookmark.kind==='watch')return Array.from(host.querySelectorAll('[data-watch-race]')).find(x=>x.dataset.watchRace===bookmark.race)?.querySelector('summary')||host.querySelector('.early-watch > details > summary');
  if(bookmark.kind==='jump')return Array.from(host.querySelectorAll('[data-personal-jump]')).find(x=>x.dataset.personalJump===bookmark.race);
  if(bookmark.kind==='ratings')return host.querySelector('.personal-focus-rating-key > summary');
  if(bookmark.kind==='history'){
   const history=host.querySelector('.personal-focus-history');
   const entry=Array.from(history?.querySelectorAll('.personal-focus-history-entry')||[]).find(e=>e.dataset.historyEntry===bookmark.entry);
   return entry?.querySelector('details > summary')||history?.querySelector(':scope > summary')||null;
  }
  if(bookmark.kind==='race'){
   const card=Array.from(host.querySelectorAll('.personal-focus-card')).find(c=>c.dataset.race===bookmark.race);
   const pending=pendingViews.get(host);if(pending){pending.bookmark={...bookmark};pending.anchor=card?.querySelector('h4')||null;return pending.anchor;}
   const disclosure=Array.from(card?.querySelectorAll('details')||[]).find(d=>d.dataset.disclosure===bookmark.disclosure);
   return disclosure?.querySelector(':scope > summary')||card?.querySelector('h4')||null;
  }
  return null;
 }

 // Preserve the actual disclosure DOM while a new input snapshot is computed.
 // Visibility keeps its layout, aria-hidden/inert remove stale current claims.
 // Only the reader whose hidden control moved to this heading may return.
 function setPending(host,message='Updating the model for the current inputs…'){
  if(!host)return;
  let state=pendingViews.get(host);
  if(!state){state={nodes:new Map(),notes:[],busy:host.getAttribute('aria-busy'),bookmark:captureFocus(host),anchor:null};pendingViews.set(host,state);}
  const doc=host.ownerDocument,active=doc.activeElement;
  const nodes=[...host.querySelectorAll('.personal-focus-card > :not(h4):not(nav):not(.personal-focus-pending-note),.personal-focus-next,.personal-focus-call-status,.early-watch-signals,.early-watch-race > summary > span,.early-watch-gauge,.early-watch-state,.early-watch-prior-warning,.early-watch-performance')];
  let readerHidden=false;
  for(const node of nodes){
   if(node.contains(active)){readerHidden=true;state.bookmark=captureFocus(host,active);}
   if(!state.nodes.has(node))state.nodes.set(node,{visibility:node.style.visibility,aria:node.getAttribute('aria-hidden'),inert:node.hasAttribute('inert')});
   node.style.visibility='hidden';node.setAttribute('aria-hidden','true');node.setAttribute('inert','');
  }
  if(!state.status){const p=doc.createElement('p');p.className='personal-focus-pending-message';p.setAttribute('role','status');p.style.cssText='position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';host.insertBefore(p,host.querySelector('h2')?.nextSibling||host.firstChild);state.status=p;}
  state.status.textContent=message+' Previous predictions are withheld until this update is checked.';host.setAttribute('aria-busy','true');
  for(const card of host.querySelectorAll('.personal-focus-card'))if(!card.querySelector('.personal-focus-pending-note')){
   const p=doc.createElement('p');p.className='personal-focus-pending-note';p.textContent='Forecast updating…';p.style.cssText='position:absolute;top:48px;left:16px;right:16px';card.style.position='relative';card.append(p);state.notes.push(p);
  }
  if(readerHidden&&state.bookmark?.race){state.anchor=Array.from(host.querySelectorAll('.personal-focus-card')).find(c=>c.dataset.race===state.bookmark.race)?.querySelector('h4')||null;state.anchor?.focus({preventScroll:true});}
 }
 function clearPending(host){
  const state=pendingViews.get(host);if(!state)return null;
  const bookmark=host.ownerDocument.activeElement===state.anchor?state.bookmark:null;
  for(const [node,old]of state.nodes){node.style.visibility=old.visibility;if(old.aria===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',old.aria);if(!old.inert)node.removeAttribute('inert');}
  for(const node of state.notes)node.remove();state.status?.remove();
  if(state.busy===null)host.removeAttribute('aria-busy');else host.setAttribute('aria-busy',state.busy);
  pendingViews.delete(host);return bookmark;
 }

 function focusReadingTarget(host,target){
  if(!target)return;
  target.focus({preventScroll:true});target.scrollIntoView({block:'start'});
  const toolbar=host.ownerDocument.querySelector('.en-toolbar'),top=(toolbar?.getBoundingClientRect().bottom||0)+8;
  const offset=target.getBoundingClientRect().top-top;
  if(offset<0)host.ownerDocument.defaultView.scrollBy(0,offset);
 }
 function activatePersonalDisclosure(host,summary,event){
  if(event.defaultPrevented)return;
  const detail=summary.parentElement;if(detail?.tagName!=='DETAILS')return;
  // An explicit activation can expand a card into a full grid row. Toggle
  // synchronously so its new geometry, not the old compact row, controls
  // alignment. Programmatic open-state restoration never enters this path.
  event.preventDefault();detail.open=!detail.open;summary.focus({preventScroll:true});
  const view=host.ownerDocument.defaultView,rect=summary.getBoundingClientRect();
  const top=Math.max(0,host.ownerDocument.querySelector('.en-toolbar')?.getBoundingClientRect().bottom||0)+8;
  if(rect.top<top||rect.bottom>view.innerHeight-8)view.scrollBy(0,rect.top-top);
 }
 function openRaceEvidence(host,code){
  const card=Array.from(host.querySelectorAll('.personal-focus-card')).find(x=>x.dataset.race===code);
  const detail=card?.querySelector('[data-disclosure="expectation"]');if(detail)detail.open=true;
  const pending=pendingViews.get(host);if(pending){pending.bookmark={kind:'race',race:code,disclosure:'expectation'};pending.anchor=card?.querySelector('h4')||null;focusReadingTarget(host,pending.anchor);return;}
  focusReadingTarget(host,detail?.querySelector(':scope > summary')||card?.querySelector('h4'));
 }
 function returnToWatch(host,code){
  const row=Array.from(host.querySelectorAll('[data-watch-race]')).find(x=>x.dataset.watchRace===code);
  if(row){host.querySelector('.early-watch-list').open=true;row.open=true;}
  const target=row?.querySelector(':scope > summary')||host.querySelector('.early-watch > h3');
  if(target?.tagName==='H3')target.tabIndex=-1;
  focusReadingTarget(host,target);
 }

 function watchSummary(data){
  const groups=[['Lean D','R','R wins in Lean D'],['Likely R','D','D wins in Likely R'],['Solid R','D','D wins in Solid R']];
  return groups.map(([cook,party,label])=>{const eligible=new Set((WATCH?.districts||[]).filter(x=>x.cook===cook).map(x=>x.code));const calls=data.filter(x=>eligible.has(x.code)&&x.calledParty===party).map(x=>x.code);return {label,party,total:eligible.size,calls,multiple:calls.length>=2};});
 }
 function renderWatch(doc,result,baseline,options,previous,el,host,personalCodes){
  const section=el('section','early-watch'),data=rows(result,baseline,{...options,watch:true}),simulated=data.some(x=>x.simulated);
  section.append(el('h3','',(simulated?'SIMULATED · ':'')+'Early House indicators'),el('p','methodline','Your 21-district watch · compare results with the reference expectations. A pattern across distinct races is more informative than one upset; it does not guarantee a national outcome.'));
  if(!WATCH){section.append(el('p','','Owner reference unavailable; the shared model remains separate.'));return section;}
  const broad=data.filter(x=>x.broadStateProxy&&!x.called);if(broad.length)section.append(el('p','early-watch-prior-warning',broad.length+' of 21 uncalled estimates use broad state priors for redrawn seats. These are not district-specific historical baselines; treat individual odds cautiously. District polling, where available, is separate.'));
  const signals=el('div','early-watch-signals');
  for(const g of watchSummary(data)){const box=el('div','early-watch-signal');box.dataset.multiple=String(g.multiple);box.append(el('strong','',g.calls.length+' / '+g.total+' · '+g.label),el('small','',g.calls.length?g.calls.join(', ')+' · validated '+g.party+' calls':'Awaiting validated '+g.party+' calls'));signals.append(box);}
  section.append(signals,el('p','methodline','Uncalled leads do not count as wins. These signals follow current validated calls and clear on retraction. Admitted returns and calls already affect the shared model once; the watch adds no second adjustment.'));
  const details=el('details','early-watch-list');details.open=Boolean(previous?.open);details.append(el('summary','','Inspect all 21 districts · current needles and reference expectations'));
  details.append(el('p','methodline',WATCH.source+'. Publisher date / version not supplied; not independently verified. Cook and FLIPR labels are their quoted reference bands, separate from our model bands. Selection does not promise fast returns; partial raw margins are not matched outperformance.'));
  const priorOpen=new Set(previous?.races||[]),refs=new Map(WATCH.districts.map(x=>[x.code,x]));
  for(const row of data){
   const ref=refs.get(row.code),item=el('details','early-watch-race');item.dataset.watchRace=row.code;item.open=priorOpen.has(row.code);
   const summary=el('summary','');summary.append(el('strong','',row.code),el('span','early-watch-rating',(simulated?'SIMULATED · ':'')+row.rating.label),el('span','',row.pct===null?'Model pending':(row.calculationAsOf?'Last completed · ':'')+'D '+row.pct.toFixed(1)+'% model chance'));item.append(summary);
   item.append(el('p','early-watch-reference','Owner reference · Cook '+ref.cook+' | FLIPR '+ref.flipr+' · R win '+ref.rep_win_pct.toFixed(1)+'% · projected '+ref.margin_side+'+'+ref.margin_points.toFixed(1)));
   if(row.broadStateProxy)item.append(el('p','early-watch-prior-warning','Broad state prior for redrawn geography · no district-specific historical baseline'+(row.polled?' · district polling also used.':'; no district poll in this estimate.')));
   const gauge=el('div','early-watch-gauge');gauge.setAttribute('role','img');gauge.setAttribute('aria-label',(row.calculationAsOf?'Last completed calculation; newer returns processing. ':'')+row.code+' '+row.rating.label+'; '+(row.pct===null?'model chance unavailable':'D model chance '+row.pct.toFixed(1)+' percent')+'; forecast unless validated call');if(row.pct!==null){const marker=el('span','');marker.style.left=row.pct+'%';gauge.append(marker);}item.append(gauge);
   item.append(el('p','early-watch-state',(row.calculationAsOf?'Last completed calculation · processing newer returns. ':'')+(simulated?'SIMULATED · ':'')+row.status+(row.sourceAt?' · '+(row.ownCounts?'Count':'Call')+' source time '+time(Date.parse(row.sourceAt)):'')),el('small','','Poll-close window · '+row.window+' · eligibility, not an arrival promise'));
   if(row.note)item.append(el('small','',row.note));
   if(row.performance&&Array.isArray(row.performance.difference_margin_scenarios)&&row.performance.difference_margin_scenarios.length===2&&row.performance.difference_margin_scenarios.every(finite))item.append(el('p','early-watch-performance','Matched-area performance · '+range(row.performance.difference_margin_scenarios)+' margin points vs expected. Inspect the shared race card for areas and assumptions.'));
   if(personalCodes.has(row.code)){
    const nav=el('nav','personal-focus-jumps'),button=el('button','','Inspect '+row.code+' needle & evidence');nav.setAttribute('aria-label',row.code+' shared race evidence');button.type='button';button.dataset.personalCardLink=row.code;
    button.addEventListener('click',()=>openRaceEvidence(host,row.code));nav.append(button);item.append(nav);
   }
   if(row.code!=='VA-02')item.append(el('small','','No additional county route is admitted for this watch. Statewide or partial district returns alone do not establish matched district performance.'));
   details.append(item);
  }
  section.append(details);return section;
 }

 // Ephemeral visible-reader geometry only; never model/source evidence.
 function captureReadingPosition(host){
  const node=host?.ownerDocument.activeElement,bookmark=captureFocus(host,node);if(!bookmark)return null;
  const rect=node.getBoundingClientRect(),view=host.ownerDocument.defaultView,top=(host.ownerDocument.querySelector('.en-toolbar')?.getBoundingClientRect().bottom||0)+8;
  return rect.top>=top-1&&rect.bottom<=view.innerHeight?{bookmark,top:rect.top}:null;
 }
 function restoreReadingPosition(host,saved){
  if(!saved)return false;const node=focusTarget(host,saved.bookmark);
  if(!node||host.ownerDocument.activeElement!==node||node.closest('[inert]'))return false;
  const delta=node.getBoundingClientRect().top-saved.top;if(!Number.isFinite(delta))return false;
  if(Math.abs(delta)>.1)host.ownerDocument.defaultView.scrollBy(0,delta);return true;
 }
 function render(host,result,baseline,options={}){
  if(!host)return;
  const priorReader=host.ownerDocument.activeElement,priorRect=priorReader&&host.contains(priorReader)?priorReader.getBoundingClientRect():null;
  const toolbarBottom=(host.ownerDocument.querySelector('.en-toolbar')?.getBoundingClientRect().bottom||0)+8;
  const pendingReaderVisible=pendingViews.has(host)&&priorRect&&priorRect.top>=toolbarBottom-1&&priorRect.bottom<=host.ownerDocument.defaultView.innerHeight;
  const resumed=clearPending(host),data=rows(result,baseline,options);host.hidden=!data.length;
  const watchOld=host.querySelector('.early-watch-list'),watchState={open:watchOld?.open,races:Array.from(watchOld?.querySelectorAll('[data-watch-race][open]')||[]).map(x=>x.dataset.watchRace)},watchFocus=captureFocus(host);
  const oldHistory=host.querySelector('.personal-focus-history'),active=host.ownerDocument.activeElement;
  const oldRatingKey=host.querySelector('.personal-focus-rating-key'),ratingKeyOpen=Boolean(oldRatingKey?.open),ratingKeyFocused=Boolean(oldRatingKey?.contains(active));
  const historyOpen=Boolean(oldHistory?.open),historyFocused=Boolean(oldHistory?.contains(active));
  const openHistorySources=new Set(Array.from(oldHistory?.querySelectorAll('.personal-focus-history-entry')||[]).filter(e=>e.querySelector('details')?.open).map(e=>e.dataset.historyEntry));
  const focusedHistoryEntry=historyFocused?active.closest('.personal-focus-history-entry')?.dataset.historyEntry:null;
  // Keep operator disclosure state by race identity, never by changing row order.
  const openPerformance=new Map(Array.from(host.querySelectorAll('.personal-focus-card')).map(c=>[c.dataset.race,new Set(Array.from(c.querySelectorAll('details[open]')).map(d=>d.dataset.disclosure))]));
  const activeCard=host.ownerDocument.activeElement?.closest?.('.personal-focus-card');
  const focusedRace=resumed?.kind==='race'?resumed.race:activeCard&&host.contains(activeCard)&&!active.dataset.personalWatchReturn?activeCard.dataset.race:null;
  const focusedDisclosure=resumed?.kind==='race'?resumed.disclosure:focusedRace?active.closest('summary')?.parentElement.dataset.disclosure:null;
  host.replaceChildren();if(!data.length)return;
  const doc=host.ownerDocument,el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const simulated=data.some(x=>x.simulated);
  host.append(el('h2','',(simulated?'SIMULATED · ':'')+'Your election-night needles'),el('p','methodline',simulated?'FICTIONAL COUNTS · NOT LIVE. These race needles share this simulated national update; the live dashboard is unchanged.':'Experimental, uncalibrated forecasts from the same national model. Own validated returns enter once; race probabilities are never averaged back into it. Order follows admitted evidence and poll-close windows, not a promise of when votes will arrive.'));
  const calls=result?.source_call_conditioning;
  if(calls?.status==='WITHHELD')host.append(el('p','personal-focus-call-status','Broader call update withheld: simulation support is insufficient or unsupported. Validated race winners remain fixed; other estimates retain the available polling and admitted-count context.'));
  else if(calls?.conditioned_covariance_applied===true)host.append(el('p','personal-focus-call-status','Validated calls inform related races through shared model factors, alongside admitted returns where available. This is experimental covariance transfer, not independent confirmation or calibrated accuracy.'));
  host.append(el('p','personal-focus-next','Focus now / next: '+data.filter(x=>x.state!=='AK').slice(0,3).map(x=>x.code+' · '+x.window).join(' | ')));
  const ratingKey=el('details','personal-focus-rating-key');ratingKey.open=ratingKeyOpen;ratingKey.append(el('summary','','How to read the ratings'),el('p','','Forecast bands use this same model chance: Safe 95%+, Likely 80%+, Leaning 60%+, otherwise Toss-up. A victory label requires a validated source call; a high chance or vote lead is not a call. Nebraska is a paired Osborn-versus-Ricketts forecast, not five-way win odds.'));host.append(ratingKey);if(ratingKeyFocused)ratingKey.querySelector('summary').focus({preventScroll:true});
  if(options.history){
   const history=renderHistory(doc,options.history,options.context||'PUBLIC',historyOpen);host.append(history);
   let historyTarget=history.querySelector('summary');
   for(const entry of history.querySelectorAll('.personal-focus-history-entry')){
    const source=entry.querySelector('details');source.open=openHistorySources.has(entry.dataset.historyEntry);
    if(entry.dataset.historyEntry===focusedHistoryEntry)historyTarget=source.querySelector('summary');
   }
   if(historyFocused)historyTarget?.focus({preventScroll:true});
  }
  host.append(renderWatch(doc,result,baseline,options,watchState,el,host,new Set(data.map(x=>x.code))));
  const nav=el('nav','personal-focus-jumps');nav.setAttribute('aria-label','Jump to your watch');
  for(const [key,label]of [['watch','Early House watch'],['TX-SEN','Texas Senate needle']]){const button=el('button','',label);button.type='button';button.dataset.personalJump=key;button.addEventListener('click',()=>{const target=key==='watch'?host.querySelector('.early-watch > h3'):host.querySelector('[data-race="TX-SEN"] h4');if(target){target.tabIndex=-1;focusReadingTarget(host,target);}});nav.append(button);}host.insertBefore(nav,host.querySelector('.personal-focus-next'));
  for(const office of ['Senate','House']){
   const group=el('section','');group.append(el('h3','',office==='Senate'?'Your eleven Senate races':'House power-flip watch'));
   const grid=el('div','personal-focus-grid');
   for(const row of data.filter(x=>x.office===office)){
    const card=el('article','personal-focus-card');card.dataset.race=row.code;
    const heading=el('h4','',row.code==='OH-SEN'?'Ohio · special Senate':row.code);heading.tabIndex=-1;card.append(heading);
    const badge=el('span','personal-focus-rating',(row.simulated?'SIMULATED · ':'')+row.rating.label);badge.dataset.state=row.rating.state;
    badge.title=row.rating.state==='called'?'Validated source call · unofficial':row.rating.state==='pending'?'No supported forecast rating':'Model forecast · not called';
    card.dataset.ratingSide=row.rating.side;card.dataset.ratingKind=row.rating.state;card.append(badge);
    card.append(el('small','',row.state==='AK'?'Late night · '+row.window:row.state==='KS'?'Counts eligible from · '+row.window:'Poll-close window · '+row.window));
    if(row.pct!==null){
     const chanceLabel=row.state==='NE'?'model chance vs Ricketts':'model win chance';
     const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 200 105');svg.setAttribute('role','img');svg.setAttribute('aria-label',(row.calculationAsOf?'Last completed calculation; newer returns processing. ':'')+row.code+' '+row.left+' '+chanceLabel+' '+row.pct.toFixed(1)+' percent · '+badge.textContent+' · '+badge.title);
     const node=(tag,attrs)=>{const n=doc.createElementNS(svg.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
     svg.append(node('path',{d:'M20 90 A80 80 0 0 1 100 10',stroke:'#ce6878',fill:'none','stroke-width':9}),node('path',{d:'M100 10 A80 80 0 0 1 180 90',stroke:row.left==='Osborn'?'#d2acff':'#57b4ff',fill:'none','stroke-width':9}),node('line',{x1:100,y1:90,x2:100,y2:18,stroke:'#fff0a4','stroke-width':4,transform:'rotate('+(-90+1.8*row.pct)+' 100 90)'}));
     const odds=el('strong','personal-focus-odds');odds.append(el('span','',row.left+' '+row.pct.toFixed(1)+'%'),el('small','',' · '+chanceLabel));
     card.append(svg,odds);
     card.append(el('small','',row.delta===null?'Baseline comparison unavailable':(row.delta>=0?'+':'')+row.delta.toFixed(1)+' probability points vs polling baseline'));
    }else card.append(el('strong','','Needle pending'));
    card.append(el('p','',(row.calculationAsOf?'Last completed calculation · processing newer returns. ':'')+(row.simulated?'SIMULATED · ':'')+row.status));
    if(row.count!==null)card.append(el('small','',row.count.toLocaleString('en-US')+' named-candidate '+row.left+'/R votes in admitted county evidence'));
    if(row.sourceAt)card.append(el('small','',(row.ownCounts?'Count':'Call')+' source time · '+time(Date.parse(row.sourceAt))));
    const p=row.performance,positive=p?.positive_candidate||'D',negative=p?.negative_candidate||'R';
    if(p&&finite(p.observed_margin_points)&&[p.expected_margin_scenarios,p.difference_margin_scenarios].every(x=>Array.isArray(x)&&x.length===2&&x.every(finite))){
     card.append(el('p','personal-focus-performance','Matched-area performance · '+range(p.difference_margin_scenarios,positive,negative)+' margin points vs expected'));
     const detail=el('details','');detail.dataset.disclosure='expectation';detail.append(el('summary','','What was expected here?'),el('p','','Observed '+margin(p.observed_margin_points,positive,negative)+'; expected '+range(p.expected_margin_scenarios,positive,negative)+' in the same reporting areas. Historical '+p.baseline_year+' local shares adjusted to the pre-results race expectation.'));
     detail.open=openPerformance.get(row.code)?.has('expectation')||false;
     detail.append(el('p','',p.scope));if(p.historical_transfer)detail.append(el('p','',p.historical_transfer+'; experimental and uncalibrated.'));
     if(p.directional_transfer_assumption)detail.append(el('p','',p.directional_transfer_assumption));
     const areas=el('details','personal-focus-areas');areas.dataset.disclosure='areas';areas.open=openPerformance.get(row.code)?.has('areas')||false;
     areas.append(el('summary','','Inspect '+(p.largest_reporting_units||[]).length+' reporting areas'));
     for(const u of p.largest_reporting_units||[])areas.append(el('small','',(u.county||'FIPS '+u.county_fips)+(row.office==='House'?' district part':'')+' · '+u.counted_two_party_votes.toLocaleString('en-US')+' '+positive+'/'+negative+' votes · observed '+margin(u.observed_margin_points,positive,negative)+'; expected '+range(u.expected_margin_scenarios,positive,negative)));
     detail.append(areas);
     detail.append(el('small','','Largest '+(p.largest_reporting_units||[]).length+' of '+p.reporting_units+' reporting areas shown. This does not extrapolate the raw margin statewide or call the race.'));
     card.append(detail);
    }
    if(row.marginDistribution)card.append(renderMarginSummary(doc,row,el,openPerformance.get(row.code)?.has('margin')||false));
    if(row.note)card.append(el('small','',row.note));
    if(row.code==='TX-SEN'||WATCH?.districts.some(x=>x.code===row.code)){
     const nav=el('nav','personal-focus-jumps'),button=el('button','',row.code==='TX-SEN'?'Early House watch':'Back to '+row.code+' in early House watch');nav.setAttribute('aria-label',row.code+' watch navigation');button.type='button';button.dataset.personalWatchReturn=row.code;
     button.addEventListener('click',()=>returnToWatch(host,row.code));nav.append(button);card.append(nav);
    }
    grid.append(card);
   }
   group.append(grid);host.append(group);
  }
  host.append(el('p','methodline','Probability changes are not vote-margin outperformance. Matched county performance remains the model evidence. NC01/AZ01 boundary contracts are still pending; existing TX and WA03 integrations remain available. KS uses the existing conservative final-call gate pending county-hours review. Experimental and uncalibrated; a forecast is not a result.'));
  for(const summary of host.querySelectorAll('.personal-focus-card summary'))summary.addEventListener('click',event=>activatePersonalDisclosure(host,summary,event));
  if(['watch','jump','card-link','watch-return'].includes(watchFocus?.kind))focusTarget(host,watchFocus)?.focus({preventScroll:true});
  if(focusedRace){const card=Array.from(host.querySelectorAll('.personal-focus-card')).find(c=>c.dataset.race===focusedRace),target=Array.from(card?.querySelectorAll('details')||[]).find(d=>d.dataset.disclosure===focusedDisclosure);(target?.querySelector('summary')||(focusedDisclosure?card?.querySelector('h4'):card?.querySelector('details > summary'))||card?.querySelector('h4'))?.focus({preventScroll:true});}
  if(pendingReaderVisible&&host.contains(doc.activeElement)){
   const rect=doc.activeElement.getBoundingClientRect(),top=(doc.querySelector('.en-toolbar')?.getBoundingClientRect().bottom||0)+8;
   if(rect.top<top||rect.bottom>doc.defaultView.innerHeight-8)doc.defaultView.scrollBy(0,rect.top-top);
  }
 }
 return Object.freeze({SENATE,HOUSE,rows,render,captureReadingPosition,restoreReadingPosition,setPending,clearPending,rating,marginSummary,watchSummary,WATCH,captureFocus,focusTarget,createHistory,HISTORY_KEY,HISTORY_LIMIT,HISTORY_BYTES});
});
