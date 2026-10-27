// One additional Ohio special-Senate input to the existing national model. No race panel. One-minute extra route floor, shared pool; existing fast routes unchanged.
(function(root){
 'use strict';
 function create({fetchJSON,fetchSource,isActive=()=>true,sourceGeneration=()=>0,onUpdate=()=>{},onValidated=()=>{}}){
  const cache=root.OhioCivicCountySource,revision=root.CompetitiveSourceRevision?.create('OH-SEN');
  if(!cache||!revision)throw Error('Ohio source helpers unavailable');
  const close=root.ElectionNightPollClosings2026.floorFor('OH-SEN');
  let inputs=null,evidence=null,evidenceKey='',busy=false,lastAttempt=-Infinity,failures=0,timer=null,stopped=false,lastGeneration=null,wasPreclose=Date.now()<close;
  let phase='Waiting for civicAPI OH-SEN source';
  const cadence=()=>Date.now()<close?600000:60000;
  const status=()=>({phase,evidence,evidenceKey,busy,automatic_poll_interval_ms:cadence(),transport_delay:'Combined county counts; historical 2024 regular-seat composition is a scenario for the 2026 special seat, not official remaining ballots. Experimental; provider speed and calibration unproven.'});
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
   busy=true;lastAttempt=now;phase='Checking civicAPI OH-SEN county cache';publish();
   try{
    if(!inputs){
     const [history,reference]=await Promise.all([fetchJSON('data/ohio_senate_2024_county_baseline_official.json'),fetchJSON('data/ohio_county_fips_reference.json')]);
     const names=new Map(reference?.counties?.map(c=>[c.fips,c.county]));
     if(history.schema!=='official-ohio-senate-county-baseline-v1'||history.year!==2024||history.state!=='OH'||history.office!=='US Senate'||history.counties?.length!==88||names.size!==88||history.source_sha256!=='ef2f8050e1779a905d602ce34facad510394ac5500ae76ce374f7f73420115e8'||history.county_reference_sha256!==reference.source_sha256||reference.source_sha256!=='3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'||history.counties.some(c=>names.get(c.fips)!==c.county)||history.counties.reduce((n,c)=>n+c.dem_votes,0)!==2650949||history.counties.reduce((n,c)=>n+c.rep_votes,0)!==2857383)throw Error('Independent Ohio county baseline unavailable');
     inputs={reference,baseline_year:2024,baseline:{counties:history.counties.map(c=>({county:c.county,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}}))}};
    }
    const raw=await fetchSource(cache.URL);
    if(!isActive()||root.document?.hidden||generation!==sourceGeneration())throw Error('Provider response interrupted by archive mode');
    const parsed=await cache.parse(raw,inputs.reference);evidence=null;failures=0;
    if(!isActive()||root.document?.hidden||generation!==sourceGeneration())throw Error('Provider verification interrupted by archive mode');
    lastGeneration=generation;
    if(parsed.status==='TEST_DATA_NOT_LIVE'){phase='civicAPI OH-SEN unavailable · provider test data excluded';return true;}
    revision.accept(parsed);
    if(!parsed.live_votes_accepted){phase='No genuine post-close civicAPI OH-SEN counts';return true;}
    evidence={...inputs,snapshot:parsed};onValidated();phase='OH-SEN civicAPI special-Senate county counts · source '+new Date(parsed.snapshot_updated_at).toLocaleTimeString()+' · experimental';return true;
   }catch(error){evidence=null;failures=Math.min(3,failures+1);phase='civicAPI OH-SEN unavailable · '+error.message;return false;}
   finally{busy=false;publish();schedule();}
  }
  schedule();return Object.freeze({tick,status,destroy(){stopped=true;if(timer!==null)clearTimeout(timer);}});
 }
 root.OhioSenateEvidence=Object.freeze({create});
})(window);
