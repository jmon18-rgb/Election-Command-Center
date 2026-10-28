'use strict';
const closes=require('./election_night_poll_closings_2026.js');
const races=Object.freeze([
 {code:'NE-SEN',state:'NE',office:'Senate',key:'NE',independent:true,forecast_scope:'national_joint_draws',counties:93,url:'https://civicapi.org/api/v2/race/87254',reference:'data/nebraska_county_fips_reference.json',parser:'NebraskaCivicCountySource',controller:'enNebraskaSenateController'},
 {code:'SC-SEN',state:'SC',office:'Senate',key:'SC',forecast_scope:'national_joint_draws',counties:46,url:'https://civicapi.org/api/v2/race/87409',reference:'data/south_carolina_county_fips_reference.json',parser:'SouthCarolinaCivicCountySource',controller:'enSouthCarolinaSenateController'},
 {code:'VA-02',state:'VA',office:'House',key:'VA-02',forecast_scope:'national_joint_draws',counties:8,url:'https://enr.elections.virginia.gov/results/public/api/elections/virginia/2026-November-General/data/ballot-item/01000000-f030-c43d-fd71-08df1fee52e7',transport_url:'https://raw.githubusercontent.com/jmon18-rgb/Election-Command-Center/official-virginia-results-cache/data/virginia_house_02_official_latest.json',reference:'data/virginia_house_02_county_fips_reference.json',parser:'VirginiaOfficialCache',controller:'enVirginiaHouse02Controller'},
 {code:'AZ-06',state:'AZ',office:'House',key:'AZ-06',forecast_scope:'national_joint_draws',counties:5,url:'https://civicapi.org/api/v2/race/86922',reference:'data/arizona_house_06_county_fips_reference.json',parser:'WisconsinHouseCountySource',parser_scope:'AZ-06',controller:'enArizonaHouse06Controller'},
 {code:'PA-07',state:'PA',office:'House',key:'PA-07',forecast_scope:'national_joint_draws',counties:4,url:'https://civicapi.org/api/v2/race/87382',reference:'data/pennsylvania_house_07_county_fips_reference.json',parser:'WisconsinHouseCountySource',parser_scope:'PA-07',controller:'enPennsylvaniaHouse07Controller'},
 {code:'PA-08',state:'PA',office:'House',key:'PA-08',forecast_scope:'national_joint_draws',counties:5,url:'https://civicapi.org/api/v2/race/87383',reference:'data/pennsylvania_house_08_county_fips_reference.json',parser:'WisconsinHouseCountySource',parser_scope:'PA-08',controller:'enPennsylvaniaHouse08Controller'},
 {code:'MI-07',state:'MI',office:'House',key:'MI-07',forecast_scope:'national_joint_draws',counties:7,url:'https://civicapi.org/api/v2/race/87207',reference:'data/michigan_house_07_county_fips_reference.json',parser:'WisconsinHouseCountySource',parser_scope:'MI-07',controller:'enMichiganHouse07Controller'},
 {code:'OH-SEN',state:'OH',office:'Senate',key:'OH-special',forecast_scope:'national_joint_draws',counties:88,url:'https://civicapi.org/api/v2/race/87527',reference:'data/ohio_county_fips_reference.json',parser:'OhioCivicCountySource',controller:'enOhioSenateController'},
 {code:'ME-SEN',state:'ME',office:'Senate',key:'ME',forecast_scope:'national_joint_draws',counties:16,url:'https://civicapi.org/api/v2/race/87188',reference:'data/maine_county_fips_reference.json',parser:'MaineCivicCountySource',controller:'enMaineSenateController'},
 {code:'IA-SEN',state:'IA',counties:99,url:'https://civicapi.org/api/v2/race/87151',
  reference:'data/iowa_county_fips_reference.json',parser:'IowaCivicCountySource',controller:'enIowaPilotController'},
 {code:'KS-SEN',state:'KS',counties:105,url:'https://civicapi.org/api/v2/race/87162',
  reference:'data/kansas_county_fips_reference.json',parser:'KansasCivicCountySource',controller:'enKansasPilotController'},
 {code:'TX-SEN',state:'TX',counties:254,url:'https://civicapi.org/api/v2/race/87438',
  reference:'data/texas_county_fips_reference.json',parser:'TexasCivicCountySource',controller:'enTexasPilotController'},
 {code:'WI-01',state:'WI',office:'House',key:'WI-01',forecast_scope:'national_joint_draws',counties:5,url:'https://civicapi.org/api/v2/race/87483',reference:'data/wisconsin_house_01_county_fips_reference.json',parser:'WisconsinHouseCountySource',controller:'enWisconsinHouseController'}, {code:'WI-03',state:'WI',office:'House',key:'WI-03',forecast_scope:'national_joint_draws',counties:19,url:'https://civicapi.org/api/v2/race/87485',reference:'data/wisconsin_house_03_county_fips_reference.json',parser:'WisconsinHouseCountySource',parser_scope:'WI-03',controller:'enWisconsinHouse03Controller'},
 {code:'MI-04',state:'MI',office:'House',key:'MI-04',forecast_scope:'national_joint_draws',counties:6,url:'https://civicapi.org/api/v2/race/87204',reference:'data/michigan_house_04_county_fips_reference.json',parser:'WisconsinHouseCountySource',parser_scope:'MI-04',controller:'enMichiganHouse04Controller'},
 {code:'PA-10',state:'PA',office:'House',key:'PA-10',forecast_scope:'national_joint_draws',counties:3,url:'https://civicapi.org/api/v2/race/87385',reference:'data/pennsylvania_house_10_county_fips_reference.json',parser:'WisconsinHouseCountySource',parser_scope:'PA-10',controller:'enPennsylvaniaHouse10Controller'},
 {code:'NY-17',state:'NY',office:'House',key:'NY-17',forecast_scope:'national_joint_draws',counties:4,url:'https://civicapi.org/api/v2/race/87319',reference:'data/new_york_house_17_county_fips_reference.json',parser:'WisconsinHouseCountySource',parser_scope:'NY-17',controller:'enNewYorkHouse17Controller'},
 {code:'WA-03',state:'WA',office:'House',key:'WA-03',forecast_scope:'national_joint_draws',counties:7,url:'https://results.votewa.gov/results/public/api/elections/washington/20261103/data/ballot-item/54c40000-9064-bbec-4779-08df15c0a82a',transport_url:'https://raw.githubusercontent.com/jmon18-rgb/Election-Command-Center/official-results-cache/data/washington_house_03_official_latest.json',reference:'data/washington_house_03_county_fips_reference.json',parser:'WashingtonOfficialCache',controller:'enWashingtonHouse03Controller'}]);
const inWindow=now=>Number.isFinite(now)&&now>=Date.parse('2026-10-26T00:00:00Z')&&now<=Date.parse('2026-11-04T17:00:00Z');
function assess(row,now=Date.now()){
 const expected=races.find(r=>r.code===row?.code);if(!expected)throw Error('Unknown competitive source scope');
 const nationalOnly=expected.forecast_scope==='national_joint_draws',p=row.projection,hasProjection=p!==null&&p!==undefined,violations=[];
 const positive=expected.independent?row.counted_osborn_votes:row.counted_dem_votes,negative=expected.independent?row.counted_ricketts_votes:row.counted_rep_votes;
 const total=positive+negative,stamp=Date.parse(row.source_stamp||'');
 const liveInput=row.http===200&&row.source_url===expected.url&&row.source_test_data===false&&
  row.source_identity_validated===true&&row.live_votes_accepted===true&&row.parsed_counties===expected.counties&&
  (!expected.independent||(row.candidate_contrast==='NE_OSBORN_RICKETTS_V1'&&row.caucus_credit_assumed===false&&!Object.hasOwn(row,'counted_dem_votes')))&&
  [positive,negative,total].every(n=>Number.isSafeInteger(n)&&n>=0)&&total>0&&
  Number.isFinite(stamp)&&/(?:Z|[+-]\d\d:\d\d)$/.test(row.source_stamp||'')&&
  now-stamp<=180*60000&&closes.allowed(expected.code,total,row.source_stamp,now);
 if(hasProjection){
  if(!liveInput)violations.push('Forecast shown without genuine validated non-test input');
  if(row.preview===true)violations.push('Historical preview is not a live forecast');
  const probability=expected.independent?p.osborn_vs_ricketts_probability:p.dem_win_probability;
  if(!Number.isFinite(probability)||probability<0||probability>1||
   (expected.independent?p.counted_osborn_votes:p.counted_dem_votes)!==positive||(expected.independent?p.counted_ricketts_votes:p.counted_rep_votes)!==negative||
   expected.independent&&(Object.hasOwn(p,'dem_win_probability')||Object.hasOwn(p,'counted_dem_votes')||Object.hasOwn(p,'counted_rep_votes')||p.independent_senate_credit!=='no_credit'))
   violations.push('Displayed forecast disagrees with accepted source counts');
  if(p.interval_calibrated!==false||p.may_move_national_needle!==nationalOnly)
   violations.push('Unsupported calibration or national-update claim');
  if(!Number.isFinite(p.modeled_remaining_two_party_votes)||p.modeled_remaining_two_party_votes<0||
   !Array.isArray(p.modeled_remaining_two_party_votes_band)||p.modeled_remaining_two_party_votes_band.length!==2||
   !p.modeled_remaining_two_party_votes_band.every(n=>Number.isFinite(n)&&n>=0)||
   p.modeled_remaining_two_party_votes_band[0]>p.modeled_remaining_two_party_votes_band[1])
   violations.push('Invalid modeled remaining-vote range');
 }
 if(typeof row.national_unchanged!=='boolean')violations.push('National-state observation missing');
 if(row.national_evidence_validated===true&&!liveInput)violations.push('Test/invalid counts admitted as national evidence');
 if(row.national_unchanged===false&&row.national_contract_validated!==true)violations.push('National change lacks independently matched current source evidence');
 if(nationalOnly&&hasProjection&&row.national_evidence_validated!==true)violations.push('Joint House probability lacks admitted source evidence');
 if(liveInput&&!hasProjection&&!nationalOnly)violations.push('Validated live votes did not produce the race forecast');
 const status=violations.length?'SAFETY_OR_FORECAST_FAILURE':
  liveInput&&hasProjection?'ACTUAL_LIVE_INPUT_FORECAST_OBSERVED_NOT_CALIBRATED':
  row.source_test_data===true?'TEST_DATA_EXCLUDED_NOT_LIVE':
  liveInput&&nationalOnly&&!hasProjection?'VALIDATED_COUNTS_AWAITING_NATIONAL_ELIGIBILITY':row.http!==200?'TRANSPORT_UNAVAILABLE':row.parse_error?'SOURCE_CONTRACT_REJECTED':'NO_GENUINE_POST_CLOSE_VOTES';
 // An operational alert threshold, not a provider SLA or a reason to accept
 // unverified counts. Use final statewide poll closure, not the early zone.
 const close=closes.winnerFloorFor(expected.office||'Senate',expected.key||expected.state);
 const deliveryOverdue=inWindow(now)&&Number.isFinite(close)&&now>=close+90*60000&&!liveInput;
 return {...row,status,violations,live_input_validated:liveInput,actual_live_input_forecast_observed:liveInput&&hasProjection&&!violations.length,
  actual_live_input_national_update_observed:liveInput&&row.national_evidence_validated===true&&!violations.length,
  prolonged_delivery_gap:deliveryOverdue,delivery_alert_grace_minutes:90,interval_calibrated:false};
}
function nationalProof(rows,admitted){
 const entries=Array.isArray(admitted)?admitted:[],validated=[];
 if(entries.length>races.length||new Set(entries.map(e=>e.code)).size!==entries.length)return {contract_validated:false,validated_codes:[]};
 for(const e of entries){
  const row=rows.find(r=>r.code===e.code),expected=races.find(r=>r.code===e.code);
  if(row&&expected&&row.http===200&&row.source_test_data===false&&row.source_identity_validated===true&&row.live_votes_accepted===true&&
   row.source_url===expected.url&&row.source_url===e.source_url&&row.source_stamp===e.as_of&&row.parsed_counties===expected.counties&&
   Number.isSafeInteger(e.counted_two_party_votes)&&e.counted_two_party_votes>0&&(expected.independent?row.counted_osborn_votes+row.counted_ricketts_votes:row.counted_dem_votes+row.counted_rep_votes)===e.counted_two_party_votes&&(!expected.independent||(e.candidate_contrast==='NE_OSBORN_RICKETTS_V1'&&row.caucus_credit_assumed===false)))validated.push(e.code);
 }
 return {contract_validated:entries.length>0&&validated.length===entries.length,validated_codes:validated};
}
function summarize(rows,now=Date.now()){
 if(!Array.isArray(rows)||rows.length!==races.length||new Set(rows.map(r=>r.code)).size!==races.length)throw Error('All declared competitive sources required');
 const sources=rows.map(r=>assess(r,now));
 const failure=sources.some(r=>r.violations.length);
 return {generated_at:new Date(now).toISOString(),status:failure?'ACTION_REQUIRED':
  sources.some(r=>r.prolonged_delivery_gap)?'SOURCE_AVAILABILITY_REVIEW_REQUIRED':
  sources.every(r=>r.actual_live_input_forecast_observed)?'LIVE_INPUT_FORECAST_OBSERVED_NOT_CALIBRATED':'LIVE_DELIVERY_UNPROVEN',
  scope:'Actual deployed browser and real provider responses only; no source fixtures or virtual election clock',
  attribution:'Public election counts via attributed civicAPI (https://civicapi.org/api-documentation) plus independent official Virginia results (https://www.elections.virginia.gov/results/) and Washington Secretary of State (https://results.votewa.gov), both official feeds via separate owned caches with additional delay; no publication-speed guarantee',
  interval_calibrated:false,sources};
}
module.exports=Object.freeze({races,inWindow,assess,summarize,nationalProof});
