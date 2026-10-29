// Exact independently observed public VA02 contract; counts-only, not a race-call source.
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./election_night_poll_closings_2026.js'):root?.ElectionNightPollClosings2026,typeof module!=='undefined'&&module.exports?require('./virginia_official_usage.js'):root?.VirginiaOfficialUsage);if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.VirginiaOfficialHouseSource=api;})(typeof window!=='undefined'?window:null,function(closes,usage){'use strict';
 const PIN={"url":"https://enr.elections.virginia.gov/results/public/api/elections/virginia/2026-November-General/data/ballot-item/01000000-f030-c43d-fd71-08df1fee52e7","contest_id":"01000000-f030-c43d-fd71-08df1fee52e7","election_id":"01000000-ebdd-00dc-0143-08df1fee4ade","jurisdiction_id":"d2c804ee-4ec2-46bb-91d7-5b41526eab03","candidates":[{"nativeId":"cs268","id":"01000000-f030-c43d-fdbd-08df1fee52e7","name":"Elaine G. Luria","party":"D","isWriteIn":false,"key":"dem_votes"},{"nativeId":"cs269","id":"01000000-f030-c43d-fdea-08df1fee52e7","name":"Jen A. Kiggans","party":"R","isWriteIn":false,"key":"rep_votes"},{"nativeId":"cs270","id":"01000000-f030-c43d-fdfc-08df1fee52e7","name":"Geral D. \"Bishop\" Staten","party":"I","isWriteIn":false,"key":"other_votes"},{"nativeId":"cs271","id":"01000000-f030-c43d-fe0d-08df1fee52e7","name":"J. Matt Baker","party":"I","isWriteIn":false,"key":"other_votes"},{"nativeId":"wi-cc134","id":"01000000-f030-c43d-fe27-08df1fee52e7","name":"Write-In","party":null,"isWriteIn":true,"key":"other_votes"}],"methods":{"01000000-7e9f-e426-690e-08df1ff2f08c":"Early Voting","01000000-ebdd-00dc-4756-08df1ff2fa9f":"Election Day","01000000-ebdd-00dc-b411-08df1ff307f8":"Mailed Absentee","01000000-7e9f-e426-c574-08df1ff3147a":"Provisional","01000000-7e9f-e426-e846-08df1ff31b09":"Post-Election"},"localities":[{"id":"6eb727a2-6f16-4571-be8a-23ef6cf88072","name":"ACCOMACK COUNTY","shortName":"accomack-county","mapFeatureId":"001","parentBallotItemId":"01000000-f030-c43d-9f22-08df1fee4fe4"},{"id":"43e4f3d9-a3fe-4b3d-af24-4a5d94ff819c","name":"CHESAPEAKE CITY","shortName":"chesapeake-city","mapFeatureId":"550","parentBallotItemId":"01000000-f030-c43d-f5b6-08df1fee5143"},{"id":"e6f3b03d-2353-414d-86c8-322bafb186af","name":"FRANKLIN CITY","shortName":"franklin-city","mapFeatureId":"620","parentBallotItemId":"01000000-f030-c43d-1c38-08df1fee50c6"},{"id":"f64f237f-7a20-475a-a9db-778ca8c9510f","name":"ISLE OF WIGHT COUNTY","shortName":"isle-of-wight-county","mapFeatureId":"093","parentBallotItemId":"01000000-f030-c43d-3fe2-08df1fee515e"},{"id":"c01e1a57-9ead-4806-a5aa-ccdf30105b3c","name":"NORTHAMPTON COUNTY","shortName":"northampton-county","mapFeatureId":"131","parentBallotItemId":"01000000-f030-c43d-a726-08df1fee512f"},{"id":"d71d41d3-92a1-471b-85eb-1d95b17695a0","name":"SOUTHAMPTON COUNTY","shortName":"southampton-county","mapFeatureId":"175","parentBallotItemId":"01000000-f030-c43d-ea55-08df1fee50c9"},{"id":"45d6077a-75e8-4ff0-9dc8-3ba3280d84ea","name":"SUFFOLK CITY","shortName":"suffolk-city","mapFeatureId":"800","parentBallotItemId":"01000000-f030-c43d-0c4b-08df1fee4fa7"},{"id":"f3edd419-1070-4351-aa2d-fd7cce002e6a","name":"VIRGINIA BEACH CITY","shortName":"virginia-beach-city","mapFeatureId":"810","parentBallotItemId":"01000000-f030-c43d-538f-08df1fee4fea"}]};

 const URL=PIN.url,count=x=>Number.isSafeInteger(x)&&x>=0;
 const IDENTITY=typeof usage?.freeze==='function'?usage.freeze({...PIN,jurisdiction_short_name:'virginia',election_date:'2026-11-03',election_name:'2026 November General',contest_name:'Member, House of Representatives (2nd District)',overview_public_election_id:'2026-November-General',model_method_scope:'Combined historical locality totals; reported live methods preserved but not separately modeled'}):null;
 function text(x){const rows=Array.isArray(x)?x.filter(r=>r?.languageId==='en'):[];if(rows.length!==1||typeof rows[0].text!=='string'||rows[0].text.length>256)throw Error('Missing/duplicate official English identity');return rows[0].text;}
 function totals(options){
  if(!Array.isArray(options)||options.length!==5)throw Error('Incomplete official VA02 roster');
  const seen=new Set(),out={dem_votes:0,rep_votes:0,other_votes:0},methods=Object.fromEntries(Object.values(PIN.methods).map(n=>[n,{dem_votes:0,rep_votes:0,other_votes:0}]));
  for(const c of options){
   const cfg=PIN.candidates.find(x=>x.nativeId===c?.nativeId);
   if(!cfg||seen.has(c.nativeId)||c.id!==cfg.id||text(c.name)!==cfg.name|| (c.party?.abbreviation??null)!==cfg.party||c.isWriteIn!==cfg.isWriteIn||c.isQualifiedWriteIn!==false||!count(c.voteCount))throw Error('Official VA02 native candidate identity/count changed');
   seen.add(c.nativeId);out[cfg.key]+=c.voteCount;
   if(!Array.isArray(c.groupResults)||c.groupResults.length!==5)throw Error('Missing official vote-method matrix');
   let sum=0;const groups=new Set();
   for(const g of c.groupResults){const name=PIN.methods[g.groupId];if(!name||groups.has(g.groupId)||text(g.groupName)!==name||!count(g.voteCount))throw Error('Official vote-method identity/count changed');groups.add(g.groupId);sum+=g.voteCount;methods[name][cfg.key]+=g.voteCount;}
   if(!count(sum)||sum!==c.voteCount)throw Error('Official candidate/method totals disagree');
  }
  if(!count(out.dem_votes+out.rep_votes+out.other_votes))throw Error('Unsafe official vote aggregate');
  return {...out,methods};
 }
 function clockCurrent(s,now,fresh=true){const t=Date.parse(s);return Number.isFinite(now)&&/(?:Z|[+-]\d\d:\d\d)$/.test(s||'')&&Number.isFinite(t)&&t<=now+15*60000&&(!fresh||now-t<=180*60000);}
 function clock(s,now,fresh=true){const t=Date.parse(s);if(!clockCurrent(s,now,fresh))throw Error('Missing/future/stale official VA publication time');return t;}
 function publicationProblem(stamp,electionAsOf,published,lastUpdated,now){
  for(const value of [stamp,electionAsOf,published,lastUpdated])if(!clockCurrent(value,now))return 'Missing/future/stale official VA publication time';
  return Date.parse(published)<Date.parse(stamp)||Date.parse(published)<Date.parse(lastUpdated)?'Official publication precedes source clocks':null;
 }
 function postcloseCurrent(total,stamp,now){return count(total)&&Boolean(closes.allowed('VA-02',total,stamp,now));}
 function currentClocks(value,now){try{return Number.isFinite(now)&&value&&publicationProblem(value.snapshot_updated_at,value.election_as_of,value.source_published_at,value.source_last_updated,now)===null&&
  postcloseCurrent(value.total_votes,value.snapshot_updated_at,now)&&postcloseCurrent(value.total_votes,value.source_last_updated,now)&&Array.isArray(value.localities)&&value.localities.every(row=>count(row.total_votes)&&clockCurrent(row.reported_at,now,row.total_votes>0)&&(row.total_votes===0||postcloseCurrent(row.total_votes,row.reported_at,now)));}catch{return false;}}
 function parse(raw,reference,{source_url=URL,now=Date.now(),typedUsage=false}={}){
  if(typedUsage&&(!IDENTITY||typeof usage?.captureNative!=='function'))throw Error('Typed VA source projection helper unavailable');
  const e=raw?.election,b=raw?.ballotItemWithBreakdown;
  if(source_url!==URL||!Number.isFinite(now)||[raw,e,b].some(x=>x&&['test_data','mock','is_test','test','is_mock','isTest'].some(k=>x[k]===true)))throw Error('Unverified official VA source/clock/test status');
  if(raw?.jurisdiction?.shortName!=='virginia'||raw.jurisdiction.id!==PIN.jurisdiction_id||e?.id!==PIN.election_id||e.electionDate!=='2026-11-03'||text(e.name)!=='2026 November General'||e.isPrimary!==false||e.isProduction!==true||typeof e.isOfficialResults!=='boolean'||b?.id!==PIN.contest_id||text(b.name)!=='Member, House of Representatives (2nd District)'||b.contestType!=='Candidate'||b.rankedChoiceSummaryResults!==null||b.breakdownResultCount!==8||!Array.isArray(b.breakdownResults)||b.breakdownResults.length!==8||b.reportingStatus?.totalUnits!==8)throw Error('Wrong official Virginia election/contest/production identity');
  const stamp=b.reportingStatus.asOf,published=e.publishDate;const problem=publicationProblem(stamp,e.asOf,published,e.lastUpdated,now);if(problem)throw Error(problem);
  if(!Array.isArray(reference?.counties)||reference.counties.length!==8)throw Error('Missing independent Virginia county-equivalent reference');
  const byName=new Map(reference.counties.map(c=>[c.county.toUpperCase(),c.fips]));
  if(byName.size!==8||new Set(byName.values()).size!==8||[...byName.values()].some(f=>!/^51\d{3}$/.test(f)))throw Error('Invalid Virginia independent reference');
  const summary=totals(b.summaryResults?.ballotOptions),overview=raw.ballotItems?.filter(x=>x.id===PIN.contest_id);
  if(!Array.isArray(overview)||overview.length!==1||overview[0].publishPublicElectionId!=='2026-November-General'||text(overview[0].name)!==text(b.name)||overview[0].voteTotal!==b.voteTotal||JSON.stringify(totals(overview[0].summaryResults?.ballotOptions))!==JSON.stringify(summary))throw Error('Official VA overview/detail disagreement');
  const seen=new Set();const counties=b.breakdownResults.map(r=>{
   const name=text(r.locality?.name),cfg=PIN.localities.find(c=>c.name===name);
   if(!cfg||seen.has(name)||!byName.has(name)||r.locality.id!==cfg.id||r.locality.shortName!==cfg.shortName||r.locality.mapFeatureId!==cfg.mapFeatureId||r.parentBallotItemId!==cfg.parentBallotItemId||byName.get(name)!=='51'+cfg.mapFeatureId.padStart(3,'0'))throw Error('Unmatched/duplicate official VA district-part locality');
   seen.add(name);const v=totals(r.ballotOptions),n=v.dem_votes+v.rep_votes+v.other_votes;
   if(!count(r.voteTotal)||r.voteTotal!==n)throw Error('Official VA locality total disagreement');
   clock(r.precinctReportingStatus?.asOf,now,n>0);
   if(n>0&&!postcloseCurrent(n,r.precinctReportingStatus.asOf,now))throw Error('Pre-close official VA locality counts');
   return {county:reference.counties.find(x=>x.fips===byName.get(name)).county,county_fips:byName.get(name),...v,vote_method:'combined_from_reported_methods',completion_verified:false};
  });
  for(const key of ['dem_votes','rep_votes','other_votes']){
   if(counties.reduce((n,c)=>n+c[key],0)!==summary[key])throw Error('Official VA locality/district totals disagree');
   for(const method of Object.keys(summary.methods))if(counties.reduce((n,c)=>n+c.methods[method][key],0)!==summary.methods[method][key])throw Error('Official VA locality/district methods disagree');
  }
  const total=summary.dem_votes+summary.rep_votes+summary.other_votes;
  if(!count(b.voteTotal)||b.voteTotal!==total||!postcloseCurrent(total,stamp,now)||!postcloseCurrent(total,e.lastUpdated,now))throw Error('Pre-close official VA counts or wrong total');
  const parsed={status:total?'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED':'NO_REPORTED_VOTES',source_url:URL,race_code:'VA-02',snapshot_updated_at:stamp,source_last_updated:e.lastUpdated,source_published_at:published,timestamp_scope:'official_contest_reporting_snapshot_not_independent_locality_batch_capture',county_identities_matched:8,counties,live_votes_accepted:total>0,source_test_data:false,method_split_reported:true,model_method_scope:'Combined historical locality totals; reported live methods preserved but not separately modeled',completion_verified:false,may_move_national_needle:false,authoritative_race_call:false};if(!typedUsage)return parsed;const native_usage=usage.captureNative(raw,parsed,IDENTITY);return {...parsed,native_usage};
 }
 return Object.freeze({URL,parse,clockCurrent,currentClocks,IDENTITY});
});
