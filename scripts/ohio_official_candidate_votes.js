/* Approved Ohio NIST 2026 unofficial candidate counts — separate from
 * the national live election needle, winner calls or ballots remaining.
 * A source ZIP/XML with candidate totals alone cannot estimate turnout.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.OhioOfficialCandidateVotes=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const SOURCE='https://liveresults.ohiosos.gov/Api/v1/download?filename=VSSC1622XmlFileBlob';
 const LIVE=Date.parse('2026-11-04T00:30:00Z');
 const fail=reason=>Object.freeze({ready:false,reason,may_move_national_needle:false});
 const validInt=n=>Number.isSafeInteger(n)&&n>=0;
 const keys=new Set(['OH-SEN-special','OH-GOV',
  ...Array.from({length:15},(_,i)=>'OH-'+String(i+1).padStart(2,'0'))]);
 const allFips=new Set(Array.from({length:88},(_,i)=>'39'+String(i*2+1).padStart(3,'0')));
 function canonical(id){
  return id==='OH-SEN-special'?'Senate|OH-special':
    id==='OH-GOV'?'Governor|OH':'House|'+id;
 }
 function prepare(snapshot,review,now=Date.now()){
  if(!review||review.schema!=='ohio-nist-2026-live-approval-v1'||
     review.enabled!==true||
     review.real_results_publication_reviewed!==true||
     review.source_url!==SOURCE||!Array.isArray(review.approved_contests)||
     Object.keys(review.county_gpunit_to_fips||{}).length!==88||
     new Set(Object.values(review.county_gpunit_to_fips||{})).size!==88||
     Object.values(review.county_gpunit_to_fips||{}).some(x=>!allFips.has(x)))
   return fail('Official 2026 Ohio results are not independently approved');
  const reviewed=Date.parse(review.source_reviewed_at||'');
  if(!Number.isFinite(reviewed)||reviewed<LIVE||reviewed>now+5*60000)
   return fail('Ohio source approval did not occur after genuine Election Night publication');
  if(!snapshot||snapshot.schema!=='ohio-nist-candidate-county-2026-v1'||
    snapshot.status!=='INDEPENDENTLY_REVIEWED_UNOFFICIAL_CANDIDATE_COUNTS_NO_RACE_CALLS'||
    snapshot.election_date!=='2026-11-03'||snapshot.state!=='OH'||
    snapshot.source?.url!==SOURCE||
    !/^[0-9a-f]{64}$/.test(snapshot.source?.xml_sha256||'')||
    snapshot.source?.approval_reviewed_at!==review.source_reviewed_at||
    snapshot.ballots_remaining!==null||snapshot.reporting_fraction!==null||
    snapshot.independently_certified_winner_calls!==false||
    snapshot.may_move_national_needle!==false||
    !Array.isArray(snapshot.races)||snapshot.races.length<1||
    snapshot.races.length>17||snapshot.races.length!==review.approved_contests.length)
   return fail('Ohio candidate source integrity or no-ballot protections failed');
  const observed=Date.parse(snapshot.source.generated_at||'');
  if(!Number.isFinite(observed)||observed<LIVE-5*60000||
     observed>now+5*60000||now-observed>30*60000)
   return fail('Official Ohio NIST candidate snapshot is stale or future-dated');
  const permitted=new Map();
  for(const item of review.approved_contests){
   if(!item||!keys.has(item.race_key)||permitted.has(item.race_key))
    return fail('Invalid independent Ohio contest approval');
   permitted.set(item.race_key,item);
  }
  const races=[],seenRaces=new Set();
  for(const item of snapshot.races){
   if(!item||!keys.has(item.race_key)||seenRaces.has(item.race_key)||
      !permitted.has(item.race_key)||item.dashboard_race_id!==canonical(item.race_key)||
      item.office!==(item.race_key==='OH-SEN-special'?'Senate':
        item.race_key==='OH-GOV'?'Governor':'House')||
      !Array.isArray(item.counties)||!item.counties.length||
      item.counties.length>88||item.reported_county_count!==item.counties.length)
    return fail('Unapproved or duplicated Ohio contest in published candidate snapshot');
   seenRaces.add(item.race_key);
   const seenCounties=new Set(),byName=new Map();
   let countyTotal=0;
   for(const county of item.counties){
    if(!county||!allFips.has(county.county_fips)||seenCounties.has(county.county_fips)||
       !Array.isArray(county.candidates)||county.candidates.length<1||
       county.candidates.length>24)
     return fail('Unknown or duplicated Ohio county candidate source');
    seenCounties.add(county.county_fips);
    const unique=new Set();
    for(const candidate of county.candidates){
     if(!candidate||typeof candidate.name!=='string'||!candidate.name.trim()||
        !['DEM','REP','OTHER'].includes(candidate.party)||!validInt(candidate.votes)||
        candidate.votes>5_000_000)
      return fail('Invalid Ohio official candidate row');
     const id=candidate.name.trim().toLowerCase()+'|'+candidate.party;
     if(unique.has(id))return fail('Duplicated Ohio candidate county tally');
     unique.add(id);
     byName.set(id,{name:candidate.name,party:candidate.party,
       votes:(byName.get(id)?.votes||0)+candidate.votes});
     countyTotal+=candidate.votes;
    }
   }
   if(!validInt(countyTotal)||countyTotal<1||
      ![...byName.values()].some(x=>x.party==='DEM')||
      ![...byName.values()].some(x=>x.party==='REP'))
    return fail('Missing observed two-party Ohio county candidate totals');
   const ordered=[...byName.values()].sort((a,b)=>b.votes-a.votes);
   races.push({race_id:item.dashboard_race_id,county_rows:item.counties.length,
     votes_for_listed_candidates:countyTotal,candidates:ordered});
  }
  return Object.freeze({ready:true,
   status:'OFFICIAL_OHIO_CANDIDATE_COUNTS_NO_RACE_CALLS',
   source_url:SOURCE,generated_at:snapshot.source.generated_at,
   xml_sha256:snapshot.source.xml_sha256,
   races:races.sort((a,b)=>(a.race_id==='Senate|OH-special'?-1:b.race_id==='Senate|OH-special'?1:
    a.race_id.localeCompare(b.race_id))),
   ballots_remaining:null,reporting_fraction:null,
   may_move_national_needle:false});
 }
 function render(host,result,doc){
  if(!host||!doc)return false;
  host.replaceChildren();
  const add=(into,tag,value)=>{
   const el=doc.createElement(tag);el.textContent=value;into.appendChild(el);return el;
  };
  if(!result?.ready){add(host,'p',result?.reason||'Ohio official 2026 results not approved');return false}
  add(host,'h4','Ohio · reviewed official-source candidate votes (unofficial)');
  const anchor=add(host,'a','Ohio Secretary of State XML source ↗');
  anchor.href=result.source_url;anchor.target='_blank';anchor.rel='noopener noreferrer';
  add(host,'p','Source-generated '+result.generated_at+
   '. County candidate totals only: NOT verified ballots remaining, percent reporting, certified calls or model odds.');
  add(host,'small','Original XML SHA-256: '+result.xml_sha256);
  for(const race of result.races){
   const section=doc.createElement('section');
   add(section,'strong',race.race_id+' · '+race.county_rows+
     ' counties with candidate source rows · '+
     race.votes_for_listed_candidates.toLocaleString('en-US')+' listed candidate votes');
   for(const c of race.candidates){
    add(section,'p',c.name+' ('+c.party+'): '+c.votes.toLocaleString('en-US'));
   }
   host.appendChild(section);
  }
  return true;
 }
 return Object.freeze({prepare,render});
});
