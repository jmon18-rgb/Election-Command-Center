// One additional Maine first-choice Senate input to the existing national model. No race panel. One-minute extra route floor, shared pool; existing fast routes unchanged.
(function(root){
 'use strict';
 function create({fetchJSON,fetchSource,isActive=()=>true,sourceGeneration=()=>0,onUpdate=()=>{},onValidated=()=>{}}){
  const cache=root.MaineCivicCountySource,revision=root.CompetitiveSourceRevision?.create('ME-SEN');
  if(!cache||!revision)throw Error('Maine source helpers unavailable');
  const close=root.ElectionNightPollClosings2026.floorFor('ME-SEN');
  let inputs=null,evidence=null,evidenceKey='',busy=false,lastAttempt=-Infinity,failures=0,timer=null,stopped=false,lastGeneration=null,wasPreclose=Date.now()<close;
  let phase='Waiting for civicAPI ME-SEN source';
  const cadence=()=>Date.now()<close?600000:60000;
  const status=()=>({phase,evidence,evidenceKey,busy,automatic_poll_interval_ms:cadence(),transport_delay:'Named-candidate first choices only; not a final ranked-choice outcome. Assumed 5-point transfer uncertainty, uncalibrated; provider speed unproven.'});
  function publish(){const key=evidence?JSON.stringify(evidence.snapshot):'',changed=key!==evidenceKey;evidenceKey=key;onUpdate(status(),changed);}
  function schedule(){
   if(timer!==null)clearTimeout(timer);if(stopped)return;
   const now=Date.now(),due=Math.max(cadence(),Math.min(300000,60000*2**failures));
   const delay=isActive()&&!busy&&!root.document?.hidden?Math.max(50,Math.min(due,Number.isFinite(lastAttempt)?lastAttempt+due-now:50,now<close?close-now:Infinity)):60000;
   timer=setTimeout(async()=>{try{await tick();}finally{schedule();}},delay);
  }
  async function tick(force=false){
   const now=Date.now(),generation=sourceGeneration();if(wasPreclose&&now>=close){failures=0;wasPreclose=false;}
   
   if(evidence&&(!isActive()||lastGeneration!==generation||now-Date.parse(evidence.snapshot.snapshot_updated_at)>180*60000)){
    evidence=null;phase='civicAPI input inactive or stale';publish();
   }
   const minimum=force?60000:Math.max(cadence(),Math.min(300000,60000*2**failures));
   if(!isActive()||root.document?.hidden||busy||now-lastAttempt<minimum)return false;
   busy=true;lastAttempt=now;phase='Checking civicAPI ME-SEN county cache';publish();
   try{
    if(!inputs){
     const [history,reference]=await Promise.all([fetchJSON('data/maine_senate_2020_county_baseline_official.json'),fetchJSON('data/maine_county_fips_reference.json')]);
     const names=new Map(reference?.counties?.map(c=>[c.fips,c.county]));
     if(history.race_code!=='ME-SEN'||history.baseline_year!==2020||history.round!==1||history.counties?.length!==16||names.size!==16||history.counties.some(c=>names.get(c.county_fips)!==c.county))throw Error('Independent Maine county baseline unavailable');
     inputs={reference,baseline_year:2020,baseline:{counties:history.counties,statewide:history.statewide,state_unallocated_uocava:history.state_unallocated_uocava}};
    }
    const raw=await fetchSource(cache.URL);
    if(!isActive()||root.document?.hidden||generation!==sourceGeneration())throw Error('Official response interrupted by archive mode');
    const parsed=await cache.parse(raw,inputs.reference);evidence=null;failures=0;
    if(!isActive()||root.document?.hidden||generation!==sourceGeneration())throw Error('Official verification interrupted by archive mode');
    lastGeneration=generation;
    if(parsed.status==='TEST_DATA_NOT_LIVE'){phase='civicAPI ME-SEN unavailable · '+parsed.reason;return true;}
    revision.accept(parsed);
    if(!parsed.live_votes_accepted){phase='No genuine post-close civicAPI ME-SEN counts';return true;}
    evidence={...inputs,snapshot:parsed};onValidated();phase='ME-SEN civicAPI first-choice counts · source '+new Date(parsed.snapshot_updated_at).toLocaleTimeString()+' · first choices; not final RCV'+' · experimental';return true;
   }catch(error){evidence=null;failures=Math.min(3,failures+1);phase='civicAPI ME-SEN unavailable · '+error.message;return false;}
   finally{lastAttempt=Date.now();busy=false;publish();schedule();}
  }
  schedule();return Object.freeze({tick,status,destroy(){stopped=true;if(timer!==null)clearTimeout(timer);}});
 }
 root.MaineSenateEvidence=Object.freeze({create});
})(window);
