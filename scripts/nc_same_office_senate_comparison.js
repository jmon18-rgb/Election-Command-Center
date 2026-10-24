/* NC source-attributed 2022 SENATE baseline vs partial 2026 Senate returns.
 * DESCRIPTIVE research only: counties report in nonrandom order, turnout and
 * candidates differ; even same-office comparisons do not identify the
 * outstanding ballots or calibrated voting shift.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.NcSameOfficeSenateComparison=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const ZIP_SHA='2024bf67243ef173f54e625c3bace4c8b6f80947fa7d67df26796c2c85d3e9f1';
 const SOURCE='https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2022_11_08/results_pct_20221108.zip';
 const CURRENT='https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip';
 const fail=reason=>Object.freeze({ready:false,reason,may_move_national_needle:false});
 const valid=n=>Number.isSafeInteger(n)&&n>=0;
 const pct=(d,r)=>100*(d-r)/(d+r);
 function parse(csv){
  if(typeof csv!=='string'||csv.length>15000)throw Error('Missing/oversized 2022 Senate baseline');
  const lines=csv.trim().split(/\r?\n/);
  if(lines.length!==103||!lines[0].includes(ZIP_SHA)||
     !lines[1].includes(SOURCE)||!lines[1].includes('group 1378')||
     !lines[1].includes('OFFICIAL DEM 1784049 REP 1905786')||
     lines[2]!=='county_fips,senate_2022_dem_votes,senate_2022_rep_votes')
    throw Error('2022 Senate historical source identity does not match pinned official ZIP');
  const rows=new Map();let dem=0,rep=0;
  for(const line of lines.slice(3)){
   if(!/^37\d{3},\d+,\d+$/.test(line))throw Error('Invalid 2022 Senate county row');
   const [fips,d,r]=line.split(',');
   const D=Number(d),R=Number(r);
   if(rows.has(fips)||!valid(D)||!valid(R)||D+R===0)
    throw Error('Duplicate or invalid 2022 Senate county vote row');
   rows.set(fips,{dem:D,rep:R});
   dem+=D;rep+=R;
  }
  if(rows.size!==100||dem!==1784049||rep!==1905786)
   throw Error('2022 Senate county totals differ from official statewide count');
  return rows;
 }
 function compare(prepared,csv){
  if(!prepared?.ready||prepared.race_key!=='NC-SEN'||
     prepared.source_url!==CURRENT||
     !/^[0-9a-f]{64}$/.test(prepared.sha256||'')||
     !Number.isFinite(Date.parse(prepared.checked_at||''))||
     prepared.may_move_national_needle!==false||
     prepared.ballots_reported!==null||prepared.reporting_fraction!==null||
     !Array.isArray(prepared.rows))return fail('No approved 2026 NC Senate county candidate counts');
  let baseline;try{baseline=parse(csv)}catch(e){return fail(e.message)}
  const rows=[],seen=new Set();
  // These are the 2022 *historical* county electorate weights, NOT a
  // denominator for ballots reported or remaining in the 2026 election.
  const pastStateTwoParty=1784049+1905786;
  let matchedBaselineVotes=0,weightedGapNumerator=0;
  for(const row of prepared.rows){
   if(!row||!baseline.has(row.fips)||seen.has(row.fips)||!Array.isArray(row.candidates))
    return fail('Bad, missing, or duplicated NC county identity');
   seen.add(row.fips);
   const major=new Map();
   for(const person of row.candidates){
    if(!person||!valid(person.votes)||typeof person.party!=='string')
     return fail('Invalid source candidate count');
    if(person.party==='DEM'||person.party==='REP'){
     if(major.has(person.party))return fail('Ambiguous major party candidate');
     major.set(person.party,person.votes);
    }
   }
   if(!major.has('DEM')||!major.has('REP')||
      major.get('DEM')+major.get('REP')===0)continue;
   const past=baseline.get(row.fips);
   const current=pct(major.get('DEM'),major.get('REP'));
   const previous=pct(past.dem,past.rep);
   const weight=past.dem+past.rep;
   matchedBaselineVotes+=weight;
   weightedGapNumerator+=(current-previous)*weight;
   rows.push({fips:row.fips,
    partial_senate_2026_two_party_votes:major.get('DEM')+major.get('REP'),
    historical_2022_senate_two_party_votes:weight,
    partial_senate_2026_dem_margin_points:+current.toFixed(2),
    full_senate_2022_dem_margin_points:+previous.toFixed(2),
    unadjusted_descriptive_difference_points:+(current-previous).toFixed(2)});
  }
  if(!rows.length)return fail('No county with both parties reporting 2026 Senate candidates');
  rows.sort((a,b)=>b.partial_senate_2026_two_party_votes-a.partial_senate_2026_two_party_votes||a.fips.localeCompare(b.fips));
  return Object.freeze({ready:true,status:'2026_PARTIAL_VERSUS_2022_FULL_SENATE_DESCRIPTIVE_ONLY',
   source_url:SOURCE,historical_sha256:ZIP_SHA,county_count:rows.length,rows,
   total_historical_2022_counties:100,
   historical_2022_statewide_two_party_votes:pastStateTwoParty,
   matched_historical_2022_two_party_votes:matchedBaselineVotes,
   historical_electorate_covered_pct:
    +(100*matchedBaselineVotes/pastStateTwoParty).toFixed(2),
   historical_weighted_matched_county_difference_points:
    +(weightedGapNumerator/matchedBaselineVotes).toFixed(2),
   historical_exposure_is_not_current_ballot_reporting:true,
   coverage_level:matchedBaselineVotes/pastStateTwoParty<0.2?
    'THIN_HISTORICAL_GEOGRAPHY':'PARTIAL_HISTORICAL_GEOGRAPHY',
   statewide_senate_swing_estimate:null,estimated_ballots_remaining:null,
   percent_reporting:null,may_move_national_needle:false});
 }
 function render(host,prepared,doc){
  if(!host||!doc)return false;host.replaceChildren();
  const add=(el,tag,value)=>{const child=doc.createElement(tag);child.textContent=value;el.appendChild(child);return child};
  if(!prepared?.ready){add(host,'p',prepared?.reason||'2022 Senate comparison unavailable');return false}
  add(host,'h4','NC counties · partial 2026 Senate vs full 2022 Senate (same office)');
  add(host,'p','DESCRIPTIVE ONLY · '+prepared.county_count+' counties. The 2022 Senate election is a same-office comparison, but the 2026 county totals are incomplete or of unknown reporting completeness. Reported counties are not representative.');
  add(host,'p','The unadjusted differences are NOT statewide swings, ballot projections or probability updates. Senate nominees, voters, turnout and reporting order differ between cycles.');
  add(host,'p',prepared.historical_electorate_covered_pct.toFixed(2)+
   '% of the VERIFIED 2022 statewide Senate two-party vote came from these '+prepared.county_count+
   ' counties. This is historical GEOGRAPHIC EXPOSURE, NOT the percent of 2026 ballots counted.');
  add(host,'p','The 2022-electorate-weighted difference across the matched counties is '+
   (prepared.historical_weighted_matched_county_difference_points>=0?'+':'')+
   prepared.historical_weighted_matched_county_difference_points.toFixed(2)+
   ' points, a biased DESCRIPTION of reported partial county returns, NOT a statewide swing or predictive needle.');
  if(prepared.coverage_level==='THIN_HISTORICAL_GEOGRAPHY')
   add(host,'p','LIMITED COVERAGE: these counties accounted for less than 20% of the full 2022 Senate two-party electorate.');
  const link=add(host,'a','Original 2022 NCSBE Senate archive ↗');
  link.href=prepared.source_url;link.target='_blank';link.rel='noopener noreferrer';
  add(host,'small','2022 official archive SHA-256: '+prepared.historical_sha256);
  for(const row of prepared.rows){
   const section=doc.createElement('section');const fmt=v=>(v>=0?'+':'')+v.toFixed(2);
   add(section,'strong','County FIPS '+row.fips+' · '+row.partial_senate_2026_two_party_votes.toLocaleString('en-US')+' observed 2026 Senate D/R votes');
   add(section,'p','2026 partial Senate D−R: '+fmt(row.partial_senate_2026_dem_margin_points)+
    ' pts · 2022 full Senate D−R: '+fmt(row.full_senate_2022_dem_margin_points)+
    ' pts · unadjusted difference: '+fmt(row.unadjusted_descriptive_difference_points)+' pts');
   host.appendChild(section);
  }
  return true;
 }
 return Object.freeze({parse,compare,render});
});
