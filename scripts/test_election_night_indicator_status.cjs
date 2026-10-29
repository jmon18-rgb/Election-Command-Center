'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ROOT=path.resolve(__dirname,'..'),script=n=>path.join(ROOT,'scripts',n),load=n=>JSON.parse(fs.readFileSync(path.join(ROOT,'data',n+'.json'),'utf8'));
const api=require('./election_night_indicator_status.js');
const bridge=require(script('national_county_likelihood.js')),closes=require(script('election_night_poll_closings_2026.js'));
let groups=0;const check=(name,fn)=>{fn();groups++;};
const now=Date.parse('2026-11-04T03:10:00Z'),asOf='2026-11-04T03:05:00Z';
const raw={verified:true,provider:'civicAPI',asOf,total:100000,d:30000,r:68000,precincts:14,stale:false};
const clone=x=>JSON.parse(JSON.stringify(x));
// Fictional counts over the installed independently matched geography. This
// invokes the actual count compiler/diagnostic; it is not a calibration case.
function compile(code,surprise=4){
 const stem=code==='VA-02'?'virginia_house_02':code==='PA-07'?'pennsylvania_house_07':code==='SC-SEN'?'south_carolina':'ohio';
 const reference=load(stem+'_county_fips_reference');
 const historical=load(code==='VA-02'?'virginia_house_02_2024_county_baseline_official':code==='PA-07'?'pennsylvania_house_07_2024_county_baseline_official':code==='SC-SEN'?'south_carolina_senate_2020_county_baseline_official':'ohio_senate_2024_county_baseline_official');
 const baseline={...historical,counties:historical.counties.map(c=>c.records?c:{...c,records:{total:{dem_votes:c.dem_votes,rep_votes:c.rep_votes}}})};
 const totals=c=>c.records.total||{dem_votes:c.records.absentee.dem_votes+c.records.election_day.dem_votes,rep_votes:c.records.absentee.rep_votes+c.records.election_day.rep_votes};
 const d=baseline.counties.reduce((s,c)=>s+totals(c).dem_votes,0),n=baseline.counties.reduce((s,c)=>s+totals(c).dem_votes+totals(c).rep_votes,0),mean=100*(2*d/n-1),shift=surprise/200;
 const byName=new Map(reference.counties.map(c=>[c.county,c.fips]));
 const counties=baseline.counties.map(c=>{const b=totals(c),n=Math.floor((b.dem_votes+b.rep_votes)*.25),d=Math.round(n*Math.min(.999,Math.max(.001,b.dem_votes/(b.dem_votes+b.rep_votes)+shift)));return {county:c.county,county_fips:byName.get(c.county),dem_votes:d,rep_votes:n-d,other_votes:0};});
 const url=code==='VA-02'?'https://enr.elections.virginia.gov/results/public/api/elections/virginia/2026-November-General/data/ballot-item/01000000-f030-c43d-fd71-08df1fee52e7':'https://civicapi.org/api/v2/race/'+({'PA-07':87382,'SC-SEN':87409,'OH-SEN':87527}[code]);
 const envelope={baseline,reference,baseline_year:code==='SC-SEN'?2020:2024,snapshot:{race_code:code,source_url:url,status:'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED',live_votes_accepted:true,county_identities_matched:reference.counties.length,snapshot_updated_at:asOf,counties}};
 const c=bridge.compile(envelope,{now});const {logLikelihood,describePerformance,...row}=c;
 return {...row,matched_performance:describePerformance(mean)};
}
const va=compile('VA-02'),pa=compile('PA-07'),sc=compile('SC-SEN'),oh=compile('OH-SEN');
const at=(code,matched,extra={})=>api.assess(code,{now,matched,matchedCurrent:true,...extra});
check('one deduplicated chronological watch includes all old rows and FL special',()=>{
 const early=require(script('election_night_early_signals.js')),watch=require(script('house_early_watch_reference.js'));
 const expected=new Set([...early.records.map(x=>x.code),...watch.districts.map(x=>x.code),'FL-SEN']);
 assert.equal(api.records.length,expected.size);assert.deepEqual(new Set(api.records.map(x=>x.code)),expected);
 assert.equal(api.records.find(x=>x.code==='FL-SEN').key,'FL-special');assert.equal(api.records.filter(x=>x.code==='VA-02').length,1);
 assert(Object.isFrozen(api.records));assert(Object.isFrozen(api.records.find(x=>x.code==='VA-02').reference));
});
check('three requested races have raw display but no invented matched route',()=>{
 for(const code of ['KY-06','IN-05','FL-SEN']){const spec=api.records.find(x=>x.code===code);assert.equal(spec.matched_route,false);assert.equal(spec.missing_inputs.length,4);
  const result=api.assess(code,{now,observation:raw});assert.equal(result.status,'RAW_RETURNS_ONLY');assert(result.raw.raw_margin_points<0);assert.equal(result.matched,null);assert.equal(result.canMoveNationalNeedle,false);}
});
check('precinct percentage never substitutes for ballot/matched coverage',()=>{
 for(const precincts of [0,79,80,100,null]){const r=api.assess('KY-06',{now,observation:{...raw,precincts}});assert.equal(r.status,'RAW_RETURNS_ONLY');assert.equal(r.noticeable,false);}
});
check('red raw margin can coexist with local positive matched surprise without a call',()=>{
 const result=at('VA-02',va,{observation:raw});assert.equal(result.status,'PROVISIONAL_MATCHED_OVERPERFORMANCE');assert.equal(result.provisional_direction,'POSITIVE');assert.equal(result.calledParty,null);assert.equal(result.canTriggerEarnedCelebration,false);assert(result.matched.difference_margin_scenarios[0]>=3);
});
check('existing actual compiler supplies matched coverage and scenario caveats',()=>{
 const result=at('VA-02',va);assert.equal(result.matched.reporting_units,va.reporting_counties);assert.equal(result.matched.counted_two_party_votes,va.counted_two_party_votes);assert.equal(result.matched.historical_reference_turnout_fraction,va.reference_turnout_fraction);
 assert(result.matched.largest_reporting_area_vote_fraction>0&&result.matched.largest_reporting_area_vote_fraction<=1);assert.match(result.matched.uncertainty,/NOT_CONFIDENCE/);assert.match(result.matched.coverage,/NOT_PERCENT_BALLOTS/);
});
check('expected composition alone is not overperformance',()=>{
 const r=at('VA-02',compile('VA-02',0));assert.equal(r.status,'MATCHED_WITHIN_METHOD_RANGE');assert.equal(r.noticeable,false);
});
check('all scenarios must exceed noticeable threshold',()=>{
 for(const range of [[2.999,7],[-7,-2.999],[-1,7],[-7,1]]){const x=clone(va),p=x.matched_performance;p.difference_margin_scenarios=range;p.expected_margin_scenarios=[p.observed_margin_points-range[1],p.observed_margin_points-range[0]];const r=at('VA-02',x);assert.equal(r.noticeable,false);}
});
check('threshold equality and opposite direction are explicit',()=>{
 for(const [range,direction]of [[[3,5],'POSITIVE'],[[-5,-3],'NEGATIVE']]){const x=clone(va),p=x.matched_performance;p.difference_margin_scenarios=range;p.expected_margin_scenarios=[p.observed_margin_points-range[1],p.observed_margin_points-range[0]];assert.equal(at('VA-02',x).provisional_direction,direction);}
});
check('freshness/error/inactive/correction removal withdraw signal',()=>{
 const stale=clone(va);stale.as_of='2026-11-03T23:05:00Z';assert.equal(at('VA-02',stale).status,'INVALID_MATCHED_EVIDENCE');
 assert.equal(at('VA-02',va,{error:true,matchedCurrent:false}).status,'SOURCE_ERROR');assert.equal(at('VA-02',va,{active:false}).status,'INACTIVE');assert.equal(at('VA-02',null).matched,null);
 assert.equal(api.summarize([at('VA-02',va),at('SC-SEN',sc)]).stage,'STORM_BREWING');
 assert.equal(api.summarize([at('VA-02',null),at('SC-SEN',sc)]).stage,'LOCAL_OVERPERFORMANCE');
});
check('current admission assertion is mandatory even when native clock is fresh',()=>{
 for(const matchedCurrent of [undefined,false,null,1,'true']){const r=api.assess('VA-02',{now,matched:va,matchedCurrent,observation:raw});assert.equal(r.status,'MATCHED_RECHECK_REQUIRED');assert.equal(r.matched,null);assert.equal(r.noticeable,false);assert(r.raw);}
 // The coordinator, not this pure diagnostic module, evaluates the actual
 // stricter receipt/parser or pending/ASOF state and sends false here.
 for(const boundary of ['EXPIRED_VA_COLLECTOR_RECEIPT','ASOF_CALCULATION','PENDING_CURRENT_FRAME','CHANGED_BASIS_OR_OPTIONS']){
  const r=at('VA-02',va,{matchedCurrent:false});assert.equal(r.status,'MATCHED_RECHECK_REQUIRED',boundary);
  assert.equal(api.summarize([r,at('SC-SEN',sc)]).stage,'LOCAL_OVERPERFORMANCE',boundary);
 }
});
check('matched identity/source/scenario arithmetic malformed data fails closed',()=>{
 const mutations=[x=>x.code='IN-05',x=>x.schema='poll-mean',x=>x.source_url+='?other=1',x=>x.independence='RACE_POSTERIOR',x=>x.reporting_counties=2,x=>x.counted_two_party_votes=9999,x=>x.reference_turnout_fraction=.0049,x=>x.matched_performance.calibrated=true,x=>x.matched_performance.difference_margin_scenarios[0]+=1,x=>x.matched_performance.reporting_units++,x=>x.matched_performance.largest_reporting_units[0].county_fips='unknown'];
 for(const change of mutations){const x=clone(va);change(x);assert.equal(at('VA-02',x).status,'INVALID_MATCHED_EVIDENCE');}
 assert.equal(at('IN-05',{...va,code:'IN-05'}).status,'INVALID_MATCHED_EVIDENCE');
});
check('no timestamp-source outage admits raw cached votes',()=>{
 for(const change of [x=>x.verified=false,x=>x.stale=true,x=>x.total=1,x=>x.asOf='2026-11-04T04:00:00Z',x=>x.d=-1,x=>x.precincts=101]){const o=clone(raw);change(o);assert.equal(api.assess('KY-06',{now,observation:o}).status,'INVALID_SOURCE');}
 assert.equal(api.assess('KY-06',{now,error:true,observation:raw}).raw,null);
 assert.equal(api.assess('KY-06',{now:closes.floorFor('KY-06')-1,observation:raw}).status,'WAITING_FOR_POLLS');
});
check('one state cannot produce a multi-state milestone via duplicates',()=>{
 const row=at('VA-02',va);assert.equal(api.summarize([row,row,row]).stage,'LOCAL_OVERPERFORMANCE');
 const altered=clone(row);altered.matched.source_at='2026-11-04T03:06:00Z';const result=api.summarize([row,altered,at('SC-SEN',sc)]);assert.deepEqual(result.conflicts,['VA-02']);assert.equal(result.stage,'LOCAL_OVERPERFORMANCE');
});
check('opposing qualified state prevents storm and no model/call change emitted',()=>{
 const red=at('OH-SEN',compile('OH-SEN',-4)),result=api.summarize([at('VA-02',va),at('SC-SEN',sc),red]);assert.equal(result.stage,'MIXED_LOCAL_SIGNALS');assert.equal(result.canMoveNationalNeedle,false);assert.equal(result.canTriggerEarnedCelebration,false);assert.equal(result.calibrated,false);
});
check('stronger stage requires at least5 points across3 states',()=>{
 const strong=['VA-02','SC-SEN','PA-07'].map(code=>at(code,compile(code,6)));assert.equal(api.summarize(strong).stage,'STRONGER_PATTERN');assert.equal(api.summarize(strong.slice(0,2)).stage,'STORM_BREWING');
});
check('validated calls remain a separate upstream contract, not required for performance',()=>{
 const r=at('VA-02',va,{calledParty:'D'});assert.equal(r.status,'VALIDATED_CALL');assert.equal(r.calledParty,'D');assert(r.matched);assert.equal(r.canTriggerEarnedCelebration,false);
 assert.equal(api.summarize([r,at('SC-SEN',sc)]).stage,'STORM_BREWING','A call must not remove an otherwise current matched comparison');
 const callOnly=at('VA-02',null,{calledParty:'D'});assert.equal(callOnly.status,'VALIDATED_CALL');assert.equal(callOnly.matched,null);assert.equal(api.summarize([callOnly,at('SC-SEN',sc)]).stage,'LOCAL_OVERPERFORMANCE','Calls alone never supply performance');
});
check('called matched rows retain current/scenario/error/conflicting-state gates',()=>{
 const red=at('OH-SEN',compile('OH-SEN',-4),{calledParty:'R'});assert.equal(red.status,'VALIDATED_CALL');assert.equal(red.provisional_direction,'NEGATIVE');assert.equal(api.summarize([at('VA-02',va,{calledParty:'D'}),at('SC-SEN',sc),red]).stage,'MIXED_LOCAL_SIGNALS');
 const recheck=at('VA-02',va,{calledParty:'D',matchedCurrent:false});assert.equal(recheck.matched,null);assert.equal(recheck.noticeable,false);assert.equal(api.summarize([recheck,at('SC-SEN',sc)]).stage,'LOCAL_OVERPERFORMANCE');
 const stale=clone(va);stale.as_of='2026-11-03T23:05:00Z';assert.equal(at('VA-02',stale,{calledParty:'D'}).matched,null);
});
check('independently current official matched source survives broad-provider outage only',()=>{
 const r=at('VA-02',va,{error:true,observation:raw});assert.equal(r.status,'PROVISIONAL_MATCHED_OVERPERFORMANCE');assert(r.matched);assert.equal(r.raw,null);assert.equal(r.raw_source_unavailable,true);
 assert.equal(at('VA-02',va,{error:true,matchedCurrent:false}).status,'SOURCE_ERROR');
 const bad=clone(va);bad.source_url='https://untrusted.example/counts';assert.equal(at('VA-02',bad,{error:true}).status,'SOURCE_ERROR');
 assert.equal(at('SC-SEN',sc,{error:true}).status,'SOURCE_ERROR','Same-provider errors cannot use the independent official exception');
});
check('input immutability and bounded public projection',()=>{
 const input=clone(va),before=JSON.stringify(input),r=at('VA-02',input);assert.equal(JSON.stringify(input),before);assert(Object.isFrozen(r.matched.difference_margin_scenarios));
 assert(!/dem_votes|rep_votes|counties\"|logLikelihood|describePerformance|flipr/.test(JSON.stringify(r)));
 assert.equal(api.assess('XX-01',{now}).status,'INVALID');
});
fs.mkdirSync(path.join(ROOT,'artifacts/readiness/early-indicator-portable'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'artifacts/readiness/early-indicator-portable/classifier-proof-called-retention.json'),JSON.stringify({status:'PASS',groups,watch_rows:api.records.length,
 actual_compiler_routes:['VA-02','PA-07','SC-SEN','OH-SEN'],fictional_counts:true,source_requests:0,model_draws:0,
 scope:'Pure display classifier and existing matched diagnostics; no actual2026 delivery/calibration/human acceptance'},null,2)+'\n');
console.log('Unified early-watch matched-performance classifier PASS ('+groups+' groups, '+api.records.length+' rows; no draws or source requests)');
