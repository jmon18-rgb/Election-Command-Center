// One additional AZ-06 House input to the existing national model. No race panel. One-minute extra route floor, shared pool; existing fast routes unchanged.
(function(root){
 'use strict';
 function create({fetchJSON,fetchSource,isActive=()=>true,sourceGeneration=()=>0,onUpdate=()=>{},onValidated=()=>{}}){
  const cache=root.WisconsinHouseCountySource?.forRace('AZ-06'),revision=root.CompetitiveSourceRevision?.create('AZ-06');
  if(!cache||!revision)throw Error('AZ-06 source helpers unavailable');
  const close=root.ElectionNightPollClosings2026.floorFor('AZ-06');
  let inputs=null,evidence=null,evidenceKey='',busy=false,lastAttempt=-Infinity,failures=0,timer=null,stopped=false,lastGeneration=null,wasPreclose=Date.now()<close;
  let phase='Waiting for civicAPI AZ-06 source';
  const cadence=()=>Date.now()<close?600000:60000;
  const status=()=>({phase,evidence,evidenceKey,busy,automatic_poll_interval_ms:cadence(),transport_delay:'District-part D/R turnout scenario, not official remaining ballots. Same-provider coverage does not resolve latency risk; experimental and uncalibrated.'});
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
   busy=true;lastAttempt=now;phase='Checking civicAPI AZ-06 county cache';publish();
   try{
    if(!inputs){
     const [history,reference]=await Promise.all([fetchJSON('data/arizona_house_06_2024_county_baseline_official.json'),fetchJSON('data/arizona_house_06_county_fips_reference.json')]);
     const names=new Map(reference?.counties?.map(c=>[c.fips,c.county]));
     if(history.race_code!=='AZ-06'||history.historical_election!=='2024-11-05'||history.map_relation!=='boundaries_unchanged_per_2026_census'||history.counties?.length!==5||names.size!==5||history.original_sha256!=='2c08341131d940e5efbb92631a23d24d2c3d0b3007145ad0ad3da7547d84c53c'||reference.source_sha256!=='3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'||history.counties.some(c=>names.get(c.county_fips)!==c.county)||history.counties.reduce((n,c)=>n+c.dem_votes,0)!==204774||history.counties.reduce((n,c)=>n+c.rep_votes,0)!==215596)throw Error('Independent AZ-06 district-part baseline unavailable');
     inputs={reference,baseline_year:2024,baseline:{race_code:'AZ-06',geography_scope:'district_parts',counties:history.counties.map(c=>({county:c.county,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}}))}};
    }
    const raw=await fetchSource(cache.URL);
    if(!isActive()||root.document?.hidden||generation!==sourceGeneration())throw Error('Provider response interrupted by archive mode');
    const parsed=await cache.parse(raw,inputs.reference);evidence=null;failures=0;
    if(!isActive()||root.document?.hidden||generation!==sourceGeneration())throw Error('Provider verification interrupted by archive mode');
    lastGeneration=generation;
    if(parsed.status==='TEST_DATA_NOT_LIVE'){phase='civicAPI AZ-06 unavailable · provider test data excluded';return true;}
    revision.accept(parsed);
    if(!parsed.live_votes_accepted){phase='No genuine post-close civicAPI AZ-06 counts';return true;}
    evidence={...inputs,snapshot:parsed};onValidated();phase='AZ-06 civicAPI district-part counts · source '+new Date(parsed.snapshot_updated_at).toLocaleTimeString()+' · experimental';return true;
   }catch(error){evidence=null;failures=Math.min(3,failures+1);phase='civicAPI AZ-06 unavailable · '+error.message;return false;}
   // Queue wait is not transport spacing. Start the floor after completion so
   // a delayed shared-pool request cannot be followed by an immediate retry.
   finally{lastAttempt=Date.now();busy=false;publish();schedule();}
  }
  schedule();return Object.freeze({tick,status,destroy(){stopped=true;if(timer!==null)clearTimeout(timer);}});
 }
 root.ArizonaHouse06Evidence=Object.freeze({create});
})(window);
