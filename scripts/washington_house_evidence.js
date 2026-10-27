// One independent official House input to the existing national model. No race panel.
(function(root){
 'use strict';
 function create({fetchJSON,fetchSource,isActive=()=>true,sourceGeneration=()=>0,onUpdate=()=>{}}){
  const cache=root.WashingtonOfficialCache,revision=root.CompetitiveSourceRevision?.create('WA-03');
  const remainingRevision=root.WashingtonRemainingSource?.createRevision();
  if(!cache||!revision)throw Error('Official Washington source helpers unavailable');
  const close=root.ElectionNightPollClosings2026.floorFor('WA-03');
  let inputs=null,evidence=null,evidenceKey='',busy=false,lastAttempt=-Infinity,failures=0,timer=null,stopped=false,lastGeneration=null,wasPreclose=Date.now()<close;
  let phase='Waiting for official WA-03 source';
  const cadence=()=>Date.now()<close?600000:60000;
  const status=()=>({phase,evidence,evidenceKey,busy,automatic_poll_interval_ms:cadence(),transport_delay:'Checked once a minute. Collection and delivery can add several minutes; speed versus publications unproven.'});
  function publish(){const key=evidence?JSON.stringify(evidence.snapshot):'',changed=key!==evidenceKey;evidenceKey=key;onUpdate(status(),changed);}
  function schedule(){
   if(timer!==null)clearTimeout(timer);if(stopped)return;
   const now=Date.now(),due=Math.max(cadence(),Math.min(300000,60000*2**failures));
   const delay=isActive()&&!busy&&!root.document?.hidden?Math.max(50,Math.min(due,Number.isFinite(lastAttempt)?lastAttempt+due-now:50,now<close?close-now:Infinity)):60000;
   timer=setTimeout(async()=>{try{await tick();}finally{schedule();}},delay);
  }
  async function tick(force=false){
   const now=Date.now(),generation=sourceGeneration();if(wasPreclose&&now>=close){failures=0;wasPreclose=false;}
   const receiptLimit=now<Date.parse('2026-11-04T17:00:00Z')?15*60000:30*60000;
   if(evidence&&(!isActive()||lastGeneration!==generation||now-Date.parse(evidence.snapshot.collection_fetched_at)>receiptLimit||now-Date.parse(evidence.snapshot.snapshot_updated_at)>180*60000)){
    evidence=null;phase='Official input inactive or stale';publish();
   }
   const minimum=force?60000:Math.max(cadence(),Math.min(300000,60000*2**failures));
   if(!isActive()||root.document?.hidden||busy||now-lastAttempt<minimum)return false;
   busy=true;lastAttempt=now;phase='Checking official WA-03 county cache';publish();
   try{
    if(!inputs){
     const [history,reference]=await Promise.all([fetchJSON('data/washington_house_03_2024_county_baseline_official.json'),fetchJSON('data/washington_house_03_county_fips_reference.json')]);
     const names=new Map(reference?.counties?.map(c=>[c.fips,c.county]));
     if(history.race_code!=='WA-03'||history.map_comparability!=='boundaries_unchanged_per_2026_census'||history.counties?.length!==7||names.size!==7||history.counties.some(c=>names.get(c.county_fips)!==c.county))throw Error('Independent WA district-part baseline unavailable');
     inputs={reference,baseline_year:2024,baseline:{race_code:'WA-03',geography_scope:'district_parts',counties:history.counties.map(c=>({county:c.county,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}}))}};
     try{const [geometry,bridge]=await Promise.all([fetchJSON('data/washington_house_03_remaining_geography.json'),fetchJSON('data/house_geography_bridge.json')]);
      inputs.remaining_geography={...geometry,...bridge.districts?.find(c=>c.race_code_2026==='WA-03')};
     }catch{} // Optional remaining metadata never removes the validated count path.
    }
    if(!isActive()||root.document?.hidden||generation!==sourceGeneration())throw Error('Official request interrupted during reference loading');
    const raw=await fetchSource(cache.fetchURL());
    if(!isActive()||root.document?.hidden||generation!==sourceGeneration())throw Error('Official response interrupted by archive mode');
    const parsed=await cache.parse(raw,inputs.reference);evidence=null;failures=0;
    if(!isActive()||root.document?.hidden||generation!==sourceGeneration())throw Error('Official verification interrupted by archive mode');
    lastGeneration=generation;
    if(parsed.status==='SOURCE_UNAVAILABLE'){phase='Official WA-03 unavailable · '+parsed.reason;return true;}
    revision.accept(parsed);
    if(parsed.remaining_revision&&remainingRevision){try{remainingRevision.accept(parsed.remaining_revision,parsed.remaining_revision);}
     catch(error){delete parsed.official_remaining;parsed.remaining_status='REMAINING_EXCLUDED: '+error.message;}}
    if(!parsed.live_votes_accepted){phase='No genuine post-close official WA-03 counts';return true;}
    evidence={...inputs,snapshot:parsed};phase='WA-03 official counts · source '+new Date(parsed.snapshot_updated_at).toLocaleTimeString()+' · collected '+new Date(parsed.collection_fetched_at).toLocaleTimeString()+' · experimental';return true;
   }catch(error){evidence=null;failures=Math.min(3,failures+1);phase='Official WA-03 unavailable · '+error.message;return false;}
   finally{busy=false;publish();schedule();}
  }
  schedule();return Object.freeze({tick,status,destroy(){stopped=true;if(timer!==null)clearTimeout(timer);}});
 }
 root.WashingtonHouseEvidence=Object.freeze({create});
})(window);
