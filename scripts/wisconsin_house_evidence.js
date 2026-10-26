// Headless WI-01 county input for the ONE national needle; no extra race panel.
(function(root){
 'use strict';
 function create({code='WI-01',fetchJSON,fetchSource,isActive=()=>true,sourceGeneration=()=>0,onUpdate=()=>{},onValidated=()=>{}}){
  const sizes={'WI-01':5,'WI-03':19},size=sizes[code];if(!size)throw Error('Unsupported House evidence scope');
  const source=root.WisconsinHouseCountySource?.forRace(code),revision=root.CompetitiveSourceRevision?.create(code),prefix='data/wisconsin_house_'+code.slice(3)+'_';
  if(!source||!revision)throw Error('WI-01 source/revision contract unavailable');
  let inputs=null,evidence=null,busy=false,lastAttempt=-Infinity,lastGeneration=null,evidenceKey='';
  let phase='Waiting for '+code+' county source';
  const status=()=>({phase,evidence,evidenceKey,busy});
  function publish(){const key=evidence?JSON.stringify(evidence.snapshot):'',changed=key!==evidenceKey;evidenceKey=key;onUpdate(status(),changed);}
  async function tick(force=false){
   const generation=sourceGeneration();
   if(evidence&&(Date.now()-Date.parse(evidence.snapshot.snapshot_updated_at)>180*60000||generation!==lastGeneration||!isActive())){
    evidence=null;phase='Source inactive, stale or interrupted';publish();
   }
   if(!isActive()||busy||Date.now()-lastAttempt<(force?5000:Date.now()<Date.parse('2026-11-03T05:00:00Z')?600000:60000))return false;
   busy=true;lastAttempt=Date.now();phase='Checking '+code+' county source';publish();
   try{
    if(!inputs){
     const [history,reference]=await Promise.all([fetchJSON(prefix+'2024_county_baseline_official.json'),fetchJSON(prefix+'county_fips_reference.json')]);
     const names=new Map(reference?.counties?.map(c=>[c.fips,c.county]));
     if(history.race_code!==code||history.map_comparability!=='boundaries_unchanged_per_2026_census'||history.counties?.length!==size||names.size!==size||history.counties.some(c=>names.get(c.county_fips)!==c.county))throw Error('Independent WI-01 district-part geography unavailable');
     inputs={reference,baseline_year:2024,baseline:{race_code:code,geography_scope:'district_parts',counties:history.counties.map(c=>({county:c.county,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}}))}};
    }
    const raw=await fetchSource(source.URL);
    if(!isActive()||generation!==sourceGeneration())throw Error('Reply invalidated by archive mode or outage');
    const parsed=source.parse(raw,inputs.reference);evidence=null;lastGeneration=generation;
    if(parsed.status==='TEST_DATA_NOT_LIVE'){phase='Provider TEST DATA · excluded from national outlook';return true;}
    revision.accept(parsed);
    if(!parsed.live_votes_accepted){phase='No genuine post-close '+code+' counts reported';return true;}
    evidence={...inputs,snapshot:parsed};phase=code+' validated district-part counts · experimental national input';onValidated();return true;
   }catch(error){evidence=null;phase=code+' source unavailable · '+error.message;return false;}
   finally{busy=false;publish();}
  }
  const timer=setInterval(()=>tick(),60000);return Object.freeze({tick,status,destroy:()=>clearInterval(timer)});
 }
 root.WisconsinHouseEvidence=Object.freeze({create});
})(window);
