(function(root,factory){const api=factory(root);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.IowaNeedleView=api;
})(typeof window!=='undefined'?window:null,function(root){
 'use strict';
 function create(host,{fetchJSON,fetchSource,readPrior,isActive=()=>true,sourceGeneration=()=>0,onValidated=()=>{}}){
  const source=root.IowaCivicCountySource,model=root.IowaCountyNeedle;
  if(!host||!source||!model)throw Error('Iowa needle modules unavailable');
  const revision=root.CompetitiveSourceRevision?.create('IA-SEN')||null;
  let data=null,dataPromise=null,busy=false,lastAttempt=-Infinity,lastGeneration=null;
  let preview=false,step=0,projection=null,phase='Waiting for live results',stamp='',modeVersion=0,lastSourceTime=0,lastAccepted=null;
  host.innerHTML=`<div class="iowa-needle-head"><div><span class="label">COMPETITIVE RACE · EXPERIMENTAL</span>
   <h2 data-iowa="title">Iowa Senate · 2026</h2><p data-iowa="state" role="status"></p></div>
   <div><button type="button" data-iowa="refresh">Check live source</button>
   <button type="button" data-iowa="preview">Historical scenario</button>
   <button type="button" data-iowa="next" hidden>Next update</button></div></div>
   <div class="iowa-needle-body"><div><svg viewBox="0 0 280 165" role="img" aria-label="Iowa race probability needle">
   <path d="M30 140 A110 110 0 0 1 140 30" stroke="#ce6878"/>
   <path d="M140 30 A110 110 0 0 1 250 140" stroke="#57b4ff"/>
   <line data-iowa="pointer" x1="140" y1="140" x2="140" y2="38" stroke="#fff0a4" stroke-width="4"/>
   <circle cx="140" cy="140" r="7" fill="#fff0a4"/>
   <text x="28" y="160">R favored</text><text x="192" y="160">D favored</text></svg>
   <strong data-iowa="chance">—</strong><span data-iowa="chance-label"> Democratic win chance</span></div>
   <div><p data-iowa="margin"></p><p data-iowa="votes"></p><p data-iowa="remaining"></p>
   <p data-iowa="band"></p><small data-iowa="stamp"></small></div></div>
   <p data-iowa="scope"></p><small>Experimental model, not independently calibrated or a race call.
   Unseen voting-method mix and remaining ballots are modeled. Iowa pilot totals are separate from the national tally and control odds.
   Source: <a data-iowa="source-link" href="https://civicapi.org" target="_blank" rel="noopener noreferrer">civicAPI</a>.</small>`;
  const get=k=>host.querySelector('[data-iowa="'+k+'"]');
  const number=n=>Math.round(n).toLocaleString('en-US');
  const margin=n=>Math.abs(n)<.05?'Even':(n>0?'D +':'R +')+Math.abs(n).toFixed(1);
  function render(){
   get('title').textContent=preview?'Iowa Senate · 2022 historical scenario':'Iowa Senate · 2026';
   get('state').textContent=phase;get('next').hidden=!preview;
   get('preview').textContent=preview?'Return to live':'Historical scenario';
   get('refresh').disabled=busy||preview;
   const certified=preview&&projection?.status==='CERTIFIED_HISTORICAL_OUTCOME';
   get('chance-label').textContent=certified?' Historical outcome':' Democratic win chance';
   get('source-link').href=preview?'https://sos.iowa.gov/elections/pdf/2022/general/canvsummary.pdf':'https://civicapi.org';
   get('source-link').textContent=preview?'Iowa Secretary of State':'civicAPI';
   get('scope').textContent=preview?
    'Certified 2022 votes revealed under an assumed absentee-first order, not actual election-night timestamps. This never updates live counts.':
    'County returns inform a separate race forecast. Provider test data and unavailable sources do not move this needle.';
   get('pointer').style.visibility=projection?'visible':'hidden';
   get('stamp').textContent=stamp;
   if(!projection){
    get('chance').textContent='—';for(const k of ['margin','votes','remaining','band'])get(k).textContent='';return;
   }
   const p=projection.dem_win_probability;
   get('chance').textContent=certified?(p>.5?'D won':'R won'):
    p<.01?'<1%':p>.99?'>99%':(100*p).toFixed(0)+'%';
   const angle=Math.PI*(1-p);
   get('pointer').setAttribute('x2',String(140+102*Math.cos(angle)));
   get('pointer').setAttribute('y2',String(140-102*Math.sin(angle)));
   get('margin').textContent=(certified?'Certified historical margin: ':'Modeled final margin: ')+margin(projection.projected_margin_points);
   get('votes').textContent=number(projection.counted_dem_votes+projection.counted_rep_votes)+
    ' two-party votes counted · '+projection.reporting_counties+'/99 counties reporting votes';
   const remainingBand=projection.modeled_remaining_two_party_votes_band;
   get('remaining').textContent=certified?'Certified final count · no modeled votes remaining':
    'Estimated two-party votes remaining: '+number(projection.modeled_remaining_two_party_votes)+
    (Array.isArray(remainingBand)?' · turnout scenario range '+remainingBand.map(number).join('–'):'');
   get('band').textContent='Scenario uncertainty band: '+projection.scenario_margin_band.map(margin).join(' to ');
  }
  async function inputs(){
   if(data)return data;
   if(!dataPromise)dataPromise=Promise.all([
    fetchJSON('data/iowa_senate_county_modes_official.json'),fetchJSON('data/iowa_county_fips_reference.json')
   ]).then(([history,reference])=>{
    if(history?.years?.['2022']?.counties?.length!==99||reference?.counties?.length!==99)
     throw Error('Iowa historical/source inputs unavailable');
    data={history,reference};return data;
   }).catch(error=>{dataPromise=null;throw error;});
   return dataPromise;
  }
  async function tick(force=false){
   if(preview)return false;
   if(!isActive()){
    projection=null;stamp='';phase='Select 2026 Results to check the live source';render();return false;
   }
   if(busy)return false;
   const generation=sourceGeneration();
   if(projection&&lastSourceTime&&Date.now()-lastSourceTime>180*60000){projection=null;phase='Source snapshot is stale';render();}
   if(lastGeneration!==null&&generation!==lastGeneration){projection=null;phase='Provider outage · source recheck required';render();}
   const interval=Date.now()<Date.parse('2026-11-03T05:00:00Z')?600000:60000;
   if(Date.now()-lastAttempt<(force?5000:interval))return false;
   const version=modeVersion;
   lastAttempt=Date.now();busy=true;phase='Checking Iowa county source';render();
   try{
    const {history,reference}=await inputs();
    const raw=await fetchSource(source.URL);
    if(version!==modeVersion||preview)return false;
    if(!isActive()){
     projection=null;stamp='';phase='Select 2026 Results to check the live source';return false;
    }
    if(generation!==sourceGeneration())throw Error('Provider reply invalidated by source outage');
    const parsed=source.parse(raw,reference);
    lastGeneration=generation;projection=null;stamp=raw.last_updated?'Provider snapshot: '+raw.last_updated:'';
    if(parsed.status==='TEST_DATA_NOT_LIVE'){phase='Provider TEST DATA · excluded from the live needle';}
    else{
     if(!revision)throw Error('County source revision guard unavailable');
     revision.accept(parsed);
     const time=Date.parse(parsed.snapshot_updated_at);
     const signature=JSON.stringify([...parsed.counties].sort((a,b)=>a.county.localeCompare(b.county))
      .map(r=>[r.county,r.dem_votes,r.rep_votes,r.other_votes]));
     if(lastAccepted&&(time<lastAccepted.time||(time===lastAccepted.time&&signature!==lastAccepted.signature)))
      throw Error('County vote revision requires a newer provider publication time');
     // A validated zero-count withdrawal is also a publication watermark.
     lastSourceTime=time;lastAccepted={time,signature};
     if(!parsed.live_votes_accepted){phase='No genuine post-close votes reported yet';return true;}
     const prior=readPrior();
     if(!prior||!Number.isFinite(prior.margin)||!Number.isFinite(prior.sigma))throw Error('Current Iowa linked-model prior unavailable');
     projection=model.forecast({baseline:history.years['2022'],observations:parsed.counties,
      prior_margin_points:prior.margin,prior_sigma_points:prior.sigma});
     phase='2026 source-validated returns · experimental forecast';onValidated();
    }
    return true;
   }catch(error){if(version===modeVersion&&!preview){projection=null;phase='Source unavailable · '+error.message;stamp='No current live estimate';}return false;}
   finally{busy=false;render();if(version!==modeVersion&&!preview)queueMicrotask(()=>tick(true));}
  }
  async function showPreview(){
   const version=++modeVersion;preview=true;projection=null;phase='Loading historical scenario';render();
   try{
    const {history}=await inputs();if(version!==modeVersion||!preview)return;
    const cells=history.years['2022'].counties.flatMap(c=>['absentee','election_day'].map(mode=>({
     county:c.county,mode,...c.records[mode]}))).sort((a,b)=>Number(b.mode==='absentee')-Number(a.mode==='absentee'));
    const fraction=[.1,.25,.5,.75,1][step%5],observations=new Map();
    for(const r of cells.slice(0,Math.ceil(cells.length*fraction))){
     if(!observations.has(r.county))observations.set(r.county,{county:r.county,dem_votes:0,rep_votes:0});
     const row=observations.get(r.county);row.dem_votes+=r.dem_votes;row.rep_votes+=r.rep_votes;
    }
    projection=model.forecast({baseline:history.years['2020'],observations:[...observations.values()],
     prior_margin_points:0,prior_sigma_points:6});
    phase='HISTORICAL SCENARIO · update '+(step%5+1)+'/5';
    stamp='Official 2022 final votes, staged under assumed order; neutral prior stress test';
    if(step%5===4){
     const d=history.years['2022'].statewide.dem_votes,r=history.years['2022'].statewide.rep_votes;
     const finalMargin=100*(d-r)/(d+r);
     projection={...projection,status:'CERTIFIED_HISTORICAL_OUTCOME',counted_dem_votes:d,counted_rep_votes:r,
      dem_win_probability:d>r?1:0,projected_margin_points:finalMargin,modeled_remaining_two_party_votes:0,
      modeled_remaining_two_party_votes_band:[0,0],
      scenario_margin_band:[finalMargin,finalMargin]};
     phase='HISTORICAL CERTIFIED RESULT · not a live forecast';stamp='Official 2022 Iowa Senate canvass';
    }
    render();
   }catch(error){if(version===modeVersion){projection=null;phase='Historical scenario unavailable · '+error.message;render();}}
  }
  get('refresh').addEventListener('click',()=>tick(true));
  get('preview').addEventListener('click',()=>{
   if(preview){modeVersion++;preview=false;projection=null;stamp='';lastAttempt=-Infinity;tick(true);}
   else{step=0;showPreview();}
  });
  get('next').addEventListener('click',()=>{step++;showPreview();});
  const timer=setInterval(()=>tick(),60000);render();
  return Object.freeze({tick,status:()=>({preview,phase,projection,busy}),destroy:()=>clearInterval(timer)});
 }
 return Object.freeze({create});
});
