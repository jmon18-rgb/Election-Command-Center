// One additional SouthCarolina Senate input to the existing national model. Shared personal race marginal. One-minute extra route floor, shared pool; existing fast routes unchanged.
(function(root){
 'use strict';
 function create({fetchJSON,fetchSource,isActive=()=>true,sourceGeneration=()=>0,onUpdate=()=>{},onValidated=()=>{}}){
  const cache=root.SouthCarolinaCivicCountySource,revision=root.CompetitiveSourceRevision?.create('SC-SEN');
  if(!cache||!revision)throw Error('SouthCarolina source helpers unavailable');
  const close=root.ElectionNightPollClosings2026.floorFor('SC-SEN');
  let inputs=null,evidence=null,evidenceKey='',busy=false,lastAttempt=-Infinity,failures=0,timer=null,stopped=false,lastGeneration=null,wasPreclose=Date.now()<close;
  let phase='Waiting for civicAPI SC-SEN source';
  const cadence=()=>Date.now()<close?600000:60000;
  const status=()=>({phase,evidence,evidenceKey,busy,automatic_poll_interval_ms:cadence(),transport_delay:'Combined county counts; historical 2020 county composition is a scenario for 2026, not official remaining ballots. Experimental; provider speed and calibration unproven.'});
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
   busy=true;lastAttempt=now;phase='Checking civicAPI SC-SEN county cache';publish();
   try{
    if(!inputs){
     const [history,reference]=await Promise.all([fetchJSON('data/south_carolina_senate_2020_county_baseline_official.json'),fetchJSON('data/south_carolina_county_fips_reference.json')]);
     const names=new Map(reference?.counties?.map(c=>[c.fips,c.county]));
     if(history.schema!=='official-south-carolina-senate-county-baseline-v1'||history.year!==2020||history.state!=='SC'||history.office!=='US Senate'||history.counties?.length!==46||names.size!==46||history.original_sha256!=='58df7eaff97162cf27be2bb4d526b363888c09e0f662231a3ca09cff9c9f3f99'||history.independent_census_sha256!==reference.source_sha256||reference.source_sha256!=='3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'||history.counties.some(c=>names.get(c.fips)!==c.county)||history.counties.reduce((n,c)=>n+c.dem_votes,0)!==1110828||history.counties.reduce((n,c)=>n+c.rep_votes,0)!==1369137||history.counties.reduce((n,c)=>n+c.other_votes,0)!==35139)throw Error('Independent South Carolina county baseline unavailable');
     inputs={reference,baseline_year:2020,baseline:{counties:history.counties.map(c=>({county:c.county,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}}))}};
    }
    const raw=await fetchSource(cache.URL);
    if(!isActive()||root.document?.hidden||generation!==sourceGeneration())throw Error('Provider response interrupted by archive mode');
    const parsed=await cache.parse(raw,inputs.reference);evidence=null;failures=0;
    if(!isActive()||root.document?.hidden||generation!==sourceGeneration())throw Error('Provider verification interrupted by archive mode');
    lastGeneration=generation;
    if(parsed.status==='TEST_DATA_NOT_LIVE'){phase='civicAPI SC-SEN unavailable · provider test data excluded';return true;}
    revision.accept(parsed);
    if(!parsed.live_votes_accepted){phase='No genuine post-close civicAPI SC-SEN counts';return true;}
    evidence={...inputs,snapshot:parsed};onValidated();phase='SC-SEN civicAPI Senate county counts · source '+new Date(parsed.snapshot_updated_at).toLocaleTimeString()+' · experimental';return true;
   }catch(error){evidence=null;failures=Math.min(3,failures+1);phase='civicAPI SC-SEN unavailable · '+error.message;return false;}
   // Queue wait is not transport spacing. Start the floor after completion so
   // a delayed shared-pool request cannot be followed by an immediate retry.
   finally{lastAttempt=Date.now();busy=false;publish();schedule();}
  }
  schedule();return Object.freeze({tick,status,destroy(){stopped=true;if(timer!==null)clearTimeout(timer);}});
 }
 root.SouthCarolinaSenateEvidence=Object.freeze({create});
})(window);
