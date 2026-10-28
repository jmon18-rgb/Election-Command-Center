// One additional Nebraska Senate input to the existing national model. Shared personal race marginal. One-minute extra route floor, shared pool; existing fast routes unchanged.
(function(root){
 'use strict';
 function create({fetchJSON,fetchSource,isActive=()=>true,sourceGeneration=()=>0,onUpdate=()=>{},onValidated=()=>{}}){
  const cache=root.NebraskaCivicCountySource,revision=root.CompetitiveSourceRevision?.create('NE-SEN');
  if(!cache||!revision)throw Error('Nebraska source helpers unavailable');
  const close=root.ElectionNightPollClosings2026.floorFor('NE-SEN');
  let inputs=null,evidence=null,evidenceKey='',busy=false,lastAttempt=-Infinity,failures=0,timer=null,stopped=false,lastGeneration=null,wasPreclose=Date.now()<close;
  let phase='Waiting for civicAPI NE-SEN source';
  const cadence=()=>Date.now()<close?600000:60000;
  const status=()=>({phase,evidence,evidenceKey,busy,automatic_poll_interval_ms:cadence(),transport_delay:'Combined county counts; historical 2024 Osborn/Fischer county support is an experimental different-seat/opponent transfer to 2026 Osborn/Ricketts, not official remaining ballots. Experimental; provider speed and calibration unproven.'});
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
   busy=true;lastAttempt=now;phase='Checking civicAPI NE-SEN county cache';publish();
   try{
    if(!inputs){
     const [history,reference]=await Promise.all([fetchJSON('data/nebraska_senate_2024_candidate_reference.json'),fetchJSON('data/nebraska_county_fips_reference.json')]);
     const names=new Map(reference?.counties?.map(c=>[c.fips,c.county]));
     if(history.schema!=='nebraska-2024-six-year-senate-historical-preparation-v1'||history.election_date!=='2024-11-05'||history.counties?.length!==93||names.size!==93||history.source_decoded_sha256!=='4887fb1caab820ab737adaaff9b73ee601e37a707fb0002d8901fd674e8efbe9'||history.independent_census_sha256!==reference.source_sha256||reference.source_sha256!=='3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'||history.same_Senate_seat_as_2026!==false||history.counties.some(c=>names.get(c.fips)!==c.county||![c.dan_osborn,c.deb_fischer,c.write_in_scatterings].every(n=>Number.isSafeInteger(n)&&n>=0))||history.counties.reduce((n,c)=>n+c.dan_osborn,0)!==436493||history.counties.reduce((n,c)=>n+c.deb_fischer,0)!==499124||history.counties.reduce((n,c)=>n+c.write_in_scatterings,0)!==2719)throw Error('Independent Nebraska candidate-transfer reference unavailable');
     inputs={reference,baseline_year:2024,baseline_scenario:'EXPERIMENTAL_OSBORN_2024_TO_2026_DIFFERENT_SEAT',baseline:history};
    }
    const raw=await fetchSource(cache.URL);
    if(!isActive()||root.document?.hidden||generation!==sourceGeneration())throw Error('Provider response interrupted by archive mode');
    const parsed=await cache.parse(raw,inputs.reference);evidence=null;failures=0;
    if(!isActive()||root.document?.hidden||generation!==sourceGeneration())throw Error('Provider verification interrupted by archive mode');
    lastGeneration=generation;
    if(parsed.status==='TEST_DATA_NOT_LIVE'){phase='civicAPI NE-SEN unavailable · provider test data excluded';return true;}
    revision.accept(parsed);
    if(parsed.contrast_supported!==true){phase='NE counts withheld: another candidate leads outside the reviewed Osborn/Ricketts contrast';return true;}
    if(!parsed.live_votes_accepted){phase='No genuine post-close civicAPI NE-SEN counts';return true;}
    evidence={...inputs,snapshot:parsed};onValidated();phase='NE-SEN civicAPI Senate county counts · source '+new Date(parsed.snapshot_updated_at).toLocaleTimeString()+' · experimental';return true;
   }catch(error){evidence=null;failures=Math.min(3,failures+1);phase='civicAPI NE-SEN unavailable · '+error.message;return false;}
   // Queue wait is not transport spacing. Start the floor after completion so
   // a delayed shared-pool request cannot be followed by an immediate retry.
   finally{lastAttempt=Date.now();busy=false;publish();schedule();}
  }
  schedule();return Object.freeze({tick,status,destroy(){stopped=true;if(timer!==null)clearTimeout(timer);}});
 }
 root.NebraskaSenateEvidence=Object.freeze({create});
})(window);
