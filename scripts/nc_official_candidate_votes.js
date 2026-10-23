/* NC official ZIP candidate-count display, separate from ballots processed.
 * Exact-source evidence is pinned OUTSIDE the fetched snapshot in approved
 * deployment config. A ZIP candidate sum is not a ballot denominator.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.NcOfficialCandidateVotes=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const okInt=n=>Number.isSafeInteger(n)&&n>=0;
 const fail=reason=>Object.freeze({ready:false,reason,may_move_national_needle:false});
 const FILE='https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip';
 const DATE='2026-11-03',MEMBER='results_pct_20261103.txt';
 function prepare(input,expected,now=Date.now()){
  if(!expected||expected.mode!=='nc-candidate-only'||expected.reviewed!==true||
    expected.verified_source_url!==FILE||
    !/^[0-9a-f]{64}$/.test(expected.verified_archive_sha256||'')||
    !['Senate','House','Governor'].includes(expected.office)||
    !/^NC-(?:SEN|GOV|\d{2})$/.test(expected.race_key||'')||
    typeof expected.contest_name!=='string'||!expected.contest_name.trim()||
    typeof expected.contest_group_id!=='string'||!expected.contest_group_id.trim())
   return fail('Independent official ZIP and race identity review not approved');
  if(!input||input.schema!=='nc-official-candidate-votes-v1'||
    input.election_date!==DATE||input.state!=='NC'||
    input.source?.url!==expected.verified_source_url||
    input.source?.sha256!==expected.verified_archive_sha256||
    input.source?.archive_member!==MEMBER||
    input.source?.contest_name!==expected.contest_name||
    input.source?.contest_group_id!==expected.contest_group_id||
    input.race_key!==expected.race_key||input.office!==expected.office||
    input.ballots_reported!==null||input.reporting_fraction!==null||
    input.may_move_national_needle!==false||
    !Array.isArray(input.counties)||input.counties.length<1||input.counties.length>100)
   return fail('Candidate-only results identity or missing-ballot safeguards failed');
  const observed=Date.parse(input.archive_checked_at||'');
  const first=Date.parse('2026-11-03T05:00:00Z');
  if(!Number.isFinite(observed)||observed<first||observed>now+15*60000||
    now-observed>120*60000)return fail('Official ZIP observation is stale or future-dated');
  const seen=new Set(),rows=[];
  for(const county of input.counties){
   if(!county||typeof county.county_id!=='string'||
      !/^37\d{3}$/.test(county.county_id)||seen.has(county.county_id)||
      !Array.isArray(county.candidates)||county.candidates.length<2||
      county.candidates.length>30)return fail('Invalid or duplicate NC county');
   seen.add(county.county_id);
   let total=0;
   const names=new Set(),candidates=[];
   for(const candidate of county.candidates){
    if(!candidate||typeof candidate.name!=='string'||!candidate.name.trim()||
      typeof candidate.party!=='string'||!okInt(candidate.votes)||
      names.has(candidate.name.trim().toLowerCase()))
      return fail('Invalid or duplicate official candidate');
    names.add(candidate.name.trim().toLowerCase());
    total+=candidate.votes;
    candidates.push({name:candidate.name,party:candidate.party,votes:candidate.votes});
   }
   if(!Number.isSafeInteger(total)||total===0||total>20_000_000)
    return fail('Invalid county contest vote totals');
   rows.push({fips:county.county_id,total,candidates});
  }
  return Object.freeze({ready:true,race_key:expected.race_key,
    source_url:FILE,sha256:input.source.sha256,
    checked_at:input.archive_checked_at,rows,
    ballots_reported:null,reporting_fraction:null,
    may_move_national_needle:false});
 }
 function render(host,prepared,doc){
  if(!host||!doc)return false;
  host.replaceChildren();
  const append=(parent,tag,value)=>{
   const node=doc.createElement(tag);node.textContent=value;
   parent.appendChild(node);return node;
  };
  if(!prepared?.ready){
   append(host,'p',prepared?.reason||'No approved ZIP candidate totals');
   return false;
  }
  append(host,'h4',prepared.race_key+' · unofficial official-source candidate counts');
  const a=append(host,'a','NCSBE original archive ↗');
  a.href=prepared.source_url;a.target='_blank';a.rel='noopener noreferrer';
  append(host,'p','ZIP retrieved at '+prepared.checked_at+
   '. This is a retrieval time, NOT a source-reported update time.');
  append(host,'p','County candidate votes only. Ballots remaining, percent reporting, winner calls and national probabilities are NOT available from this feed.');
  append(host,'small','Source SHA-256: '+prepared.sha256);
  for(const county of prepared.rows){
   const section=doc.createElement('section');
   append(section,'strong','County FIPS '+county.fips+
    ' · votes for listed candidates '+county.total.toLocaleString('en-US'));
   for(const c of county.candidates){
    append(section,'p',c.name+' ('+c.party+'): '+c.votes.toLocaleString('en-US'));
   }
   host.appendChild(section);
  }
  return true;
 }
 return Object.freeze({prepare,render});
});
