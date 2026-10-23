/* Historical presidential-vs-Senate county vote margin comparison.
 * Read-only DESCRIPTIVE snapshot. Early geographic reporting is not random,
 * 2024 presidential and 2026 Senate nominees differ, and 2026 total ballots
 * counted/remaining are unknown. This must NEVER feed the model needle.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.NcHistoricalCountyComparison=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const historicalSHA='2fab44e9b12e03c0d88ef832c2e6dc8c569e2b020d64df06a8b551b62bbdb426';
 const original='https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2024_11_05/results_pct_20241105.zip';
 const latest='https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip';
 const unavailable=reason=>Object.freeze({ready:false,reason,may_move_national_needle:false});
 const ints=n=>Number.isSafeInteger(n)&&n>=0;
 const margin=(d,r)=>100*(d-r)/(d+r);
 function parse(csv){
  if(typeof csv!=='string'||csv.length>15000)
   throw Error('Missing or oversized certified historical baseline');
  const lines=csv.trim().split(/\r?\n/);
  if(lines.length!==103||
     !lines[0].includes(historicalSHA)||
     !lines[1].includes(original)||
     !lines[1].includes('contest group 1393')||
     !lines[1].includes('CERTIFIED statewide DEM 2715375 REP 2898423')||
     lines[2]!=='county_fips,president_2024_dem_votes,president_2024_rep_votes')
   throw Error('Unverified certified historical CSV provenance');
  const rows=new Map();
  let dem=0,rep=0;
  for(const line of lines.slice(3)){
   if(!/^37\d{3},\d+,\d+$/.test(line))
    throw Error('Invalid NC historical county row');
   const [fips,d,r]=line.split(',');
   const D=Number(d),R=Number(r);
   if(rows.has(fips)||!ints(D)||!ints(R)||D+R===0)
    throw Error('Duplicate or invalid official NC county vote counts');
   rows.set(fips,{dem:D,rep:R});
   dem+=D;rep+=R;
  }
  if(rows.size!==100||dem!==2715375||rep!==2898423)
   throw Error('Historical county roster or certified statewide totals mismatch');
  return rows;
 }
 function compare(prepared,csv){
  if(!prepared?.ready||prepared.race_key!=='NC-SEN'||
     prepared.source_url!==latest||
     !/^[0-9a-f]{64}$/.test(prepared.sha256||'')||
     !Number.isFinite(Date.parse(prepared.checked_at||''))||
     prepared.may_move_national_needle!==false||
     prepared.ballots_reported!==null||
     prepared.reporting_fraction!==null||
     !Array.isArray(prepared.rows))
   return unavailable('No source-verified NC 2026 Senate county returns for comparison');
  let historical;
  try{historical=parse(csv)}catch(error){return unavailable(error.message)}
  const seen=new Set(),rows=[];
  for(const row of prepared.rows){
   if(!row||!historical.has(row.fips)||seen.has(row.fips)||
      !Array.isArray(row.candidates))return unavailable('Invalid or duplicate county identity');
   seen.add(row.fips);
   const parties={DEM:0,REP:0};const counted=new Set();
   for(const cand of row.candidates){
    if(!cand||!ints(cand.votes)||typeof cand.party!=='string')
     return unavailable('Invalid official candidate row');
    if(['DEM','REP'].includes(cand.party)){
     if(counted.has(cand.party))
      return unavailable('Ambiguous major-party candidate identity');
     counted.add(cand.party);parties[cand.party]=cand.votes;
    }
   }
   if(counted.size!==2||parties.DEM+parties.REP===0)continue;
   const baseline=historical.get(row.fips);
   const current=margin(parties.DEM,parties.REP),old=margin(baseline.dem,baseline.rep);
   rows.push({fips:row.fips,reported_two_party_votes:parties.DEM+parties.REP,
    reported_2026_senate_margin_points:+current.toFixed(2),
    full_2024_presidential_margin_points:+old.toFixed(2),
    descriptive_difference_points:+(current-old).toFixed(2)});
  }
  if(!rows.length)return unavailable('No comparable reported Democratic and Republican county candidate totals');
  rows.sort((a,b)=>b.reported_two_party_votes-a.reported_two_party_votes||a.fips.localeCompare(b.fips));
  return Object.freeze({ready:true,status:'OBSERVED_PARTIAL_SENATE_VS_FULL_PRESIDENTIAL_DESCRIPTIVE_ONLY',
   county_count:rows.length,rows,source_sha256:prepared.sha256,
   original_presidential_url:original,baseline_sha256:historicalSHA,
   archive_checked_at:prepared.checked_at,
   estimated_ballots_remaining:null,percent_reporting:null,
   national_swing_estimate:null,may_move_national_needle:false});
 }
 function render(host,comparison,doc){
  if(!host||!doc)return false;
  host.replaceChildren();
  const add=(parent,tag,text)=>{
   const el=doc.createElement(tag);el.textContent=text;parent.appendChild(el);return el;
  };
  if(!comparison?.ready){
   add(host,'p',comparison?.reason||'Historical comparison unavailable');
   return false;
  }
  add(host,'h4','NC counties · partial 2026 Senate vs. full 2024 presidential margin');
  add(host,'p','DESCRIPTIVE ONLY · '+comparison.county_count+
   ' counties with observed D/R Senate candidate votes. 2026 counties are not confirmed complete. Reporting counties are not a representative sample.');
  add(host,'p','Difference below is Senate candidate votes currently reported minus FULL 2024 presidential two-party margin; different office, nominees, turnout and counting order. NOT a calibrated swing, race projection or remaining-ballot estimate.');
  const link=add(host,'a','2024 official NCSBE source archive ↗');
  link.href=comparison.original_presidential_url;link.rel='noopener noreferrer';link.target='_blank';
  add(host,'small','2024 ZIP SHA-256: '+comparison.baseline_sha256);
  add(host,'p','No geographic needle or national forecast adjustment from this comparison.');
  for(const row of comparison.rows){
   const section=doc.createElement('section');
   const sign=n=>(n>=0?'+':'')+n.toFixed(2);
   add(section,'strong','County FIPS '+row.fips+' · '+row.reported_two_party_votes.toLocaleString('en-US')+' reported 2026 Senate D/R candidate votes');
   add(section,'p','2026 partial Senate D−R: '+sign(row.reported_2026_senate_margin_points)+
    ' pts · 2024 full presidential D−R: '+sign(row.full_2024_presidential_margin_points)+
    ' pts · unadjusted difference: '+sign(row.descriptive_difference_points)+' pts');
   host.appendChild(section);
  }
  return true;
 }
 return Object.freeze({parse,compare,render});
});
