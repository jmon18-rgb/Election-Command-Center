(function(root){
 'use strict';
 function create(host,{fetchJSON,fetchSource,readPrior,isActive=()=>true,sourceGeneration=()=>0,onValidated=()=>{}}){
  const source=root.TexasCivicCountySource,model=root.IowaCountyNeedle;
  if(!host||!source||!model)throw Error('Texas forecast modules unavailable');
  const revision=root.CompetitiveSourceRevision?.create('TX-SEN')||null;
  let inputs=null,busy=false,lastAttempt=-Infinity,lastAccepted=null,lastGeneration=null,projection=null;
  let phase='Waiting for genuine Texas county returns';
  host.innerHTML=`<div class="iowa-needle-head"><div><span class="label">COMPETITIVE RACE · EXPERIMENTAL</span>
   <h2>Texas Senate · 2026</h2><p data-tx="state" role="status"></p></div>
   <button type="button" data-tx="refresh">Check live source</button></div>
   <div class="iowa-needle-body"><div><svg viewBox="0 0 280 165" role="img" aria-label="Texas race probability needle">
   <path d="M30 140 A110 110 0 0 1 140 30" stroke="#ce6878"/><path d="M140 30 A110 110 0 0 1 250 140" stroke="#57b4ff"/>
   <line data-tx="pointer" x1="140" y1="140" x2="140" y2="38" stroke="#fff0a4" stroke-width="4"/>
   <text x="28" y="160">R favored</text><text x="192" y="160">D favored</text></svg>
   <strong data-tx="chance">—</strong><span> Democratic win chance</span></div>
   <div><p data-tx="margin"></p><p data-tx="votes"></p><p data-tx="remaining"></p><small data-tx="stamp"></small></div></div>
   <small>Experimental race forecast, not calibrated or a race call. The 2024 Senate baseline has no voting-method split; 2026 turnout is uncertain.
   Remaining votes and ranges are modeled, not official ballots outstanding. Separate from national counts and control odds.
   Source: <a href="https://civicapi.org" target="_blank" rel="noopener noreferrer">civicAPI</a>.</small>`;
  const get=k=>host.querySelector('[data-tx="'+k+'"]'),number=n=>Math.round(n).toLocaleString('en-US');
  const margin=n=>(n>=0?'D +':'R +')+Math.abs(n).toFixed(1);
  function render(){
   get('state').textContent=phase;get('refresh').disabled=busy;get('pointer').style.visibility=projection?'visible':'hidden';
   if(!projection){get('chance').textContent='—';for(const k of ['margin','votes','remaining','stamp'])get(k).textContent='';return;}
   const p=projection.dem_win_probability,angle=Math.PI*(1-p);
   get('chance').textContent=p<.01?'<1%':p>.99?'>99%':(100*p).toFixed(0)+'%';
   get('pointer').setAttribute('x2',String(140+102*Math.cos(angle)));get('pointer').setAttribute('y2',String(140-102*Math.sin(angle)));
   get('margin').textContent='Modeled final margin: '+margin(projection.projected_margin_points)+
    ' · scenario band '+projection.scenario_margin_band.map(margin).join(' to ');
   get('votes').textContent=number(projection.counted_dem_votes+projection.counted_rep_votes)+' two-party votes counted · '+projection.reporting_counties+'/254 counties reporting votes';
   get('remaining').textContent='Estimated two-party votes remaining: '+number(projection.modeled_remaining_two_party_votes)+
    ' · turnout scenario range '+projection.modeled_remaining_two_party_votes_band.map(number).join('–');
   get('stamp').textContent='Provider race snapshot: '+new Date(lastAccepted.time).toISOString();
  }
  async function tick(force=false){
   const generation=sourceGeneration();
   if(lastAccepted&&Date.now()-lastAccepted.time>180*60000){projection=null;phase='Texas source snapshot is stale';render();}
   if(lastGeneration!==null&&lastGeneration!==generation){projection=null;phase='Provider outage · recheck required';render();}
   if(!isActive()){projection=null;phase='Select 2026 Results to check Texas';render();return false;}
   if(busy||Date.now()-lastAttempt<(force?5000:Date.now()<Date.parse('2026-11-03T05:00:00Z')?600000:60000))return false;
   busy=true;lastAttempt=Date.now();phase='Checking Texas county source';render();
   try{
    if(!inputs){
     const [history,reference]=await Promise.all([fetchJSON('data/texas_senate_2024_county_baseline_official.json'),fetchJSON('data/texas_county_fips_reference.json')]);
     const counties=history?.counties,expected=new Map(reference?.counties?.map(c=>[c.fips,c.county]));
     if(!counties||counties.length!==254||expected.size!==254||new Set(counties.map(c=>c.county_fips)).size!==254||
      counties.some(c=>expected.get(c.county_fips)!==c.county))throw Error('Texas historical/source geography unavailable');
     inputs={reference,baseline:{counties:counties.map(c=>({county:c.county,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}}))}};
    }
    const raw=await fetchSource(source.URL);
    if(!isActive()||generation!==sourceGeneration())throw Error('Source reply invalidated by mode change or outage');
    const parsed=source.parse(raw,inputs.reference);projection=null;lastGeneration=generation;
    if(parsed.status==='TEST_DATA_NOT_LIVE'){phase='Provider TEST DATA · excluded from the Texas needle';return true;}
    if(!revision)throw Error('County source revision guard unavailable');
    revision.accept(parsed);
    const time=Date.parse(parsed.snapshot_updated_at),signature=JSON.stringify([...parsed.counties].sort((a,b)=>a.county.localeCompare(b.county)).map(c=>[c.county,c.dem_votes,c.rep_votes,c.other_votes]));
    if(lastAccepted&&(time<lastAccepted.time||time===lastAccepted.time&&signature!==lastAccepted.signature))throw Error('County revision requires a newer publication time');
    // Do not let cached positive counts undo a newer validated withdrawal.
    lastAccepted={time,signature};
    if(!parsed.live_votes_accepted){phase='No genuine post-close Texas votes reported yet';return true;}
    let prior=readPrior();
    if(!prior){
     phase='Waiting for linked race model';render();
     prior=await root.CompetitiveNeedlePrior?.waitFor(readPrior,{isCurrent:()=>isActive()&&generation===sourceGeneration()});
     if(!isActive()||generation!==sourceGeneration())throw Error('Source reply invalidated while waiting for the model');
     revision.accept(parsed);
    }
    if(!prior||!Number.isFinite(prior.margin)||!Number.isFinite(prior.sigma))throw Error('Current Texas linked-model prior unavailable');
    projection=model.forecast({baseline:inputs.baseline,observations:parsed.counties,expected_county_count:254,
     prior_margin_points:prior.margin,prior_sigma_points:prior.sigma});
    phase='2026 source-validated returns · experimental Texas forecast';onValidated();return true;
   }catch(error){projection=null;phase='Texas source unavailable · '+error.message;return false;}
   finally{busy=false;render();}
  }
  get('refresh').addEventListener('click',()=>tick(true));const timer=setInterval(()=>tick(),60000);render();
  return Object.freeze({tick,status:()=>({projection,phase,busy}),destroy:()=>clearInterval(timer)});
 }
 root.TexasNeedleView=Object.freeze({create});
})(window);
