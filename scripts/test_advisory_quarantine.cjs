'use strict';
// Fictional source rows exercise advisory state only; no model, browser or network.
const assert=require('node:assert/strict');
const {ingest}=require('./county_source_ingestion_2026.js');
const pulse=require('./geographic_matched_county_pulse_2026.js');
const batch=require('./geographic_county_batch_2026.js');
const now=Date.parse('2026-11-04T01:00:00Z'),id='NC-SEN|37001',otherId='NC-SEN|37003',clone=x=>JSON.parse(JSON.stringify(x));
const expected={provider:'official',provider_race_id:'nc-sen-2026',race_key:'NC-SEN',state:'NC',state_fips:'37',office:'Senate',source_url:'https://example.gov/results/county'};
const county=(fips,d,r,stamp='2026-11-04T00:35:00Z',extra={})=>({fips,ballots_reported:d+r,reporting_status:'partial',updated_at:stamp,candidates:[{name:'Fictional D',party:'D',votes:d},{name:'Fictional R',party:'R',votes:r}],...extra});
const a=county('37001',60,40),b=county('37003',120,80),env=counties=>({schema:'county-results-v1',election_date:'2026-11-03',election_type:'General',production:true,is_test:false,provider:expected.provider,provider_race_id:expected.provider_race_id,race_key:expected.race_key,state:'NC',office:'Senate',source_verified:true,source_url:expected.source_url,counties});
const baseline=(fips,D,R)=>({verified_source:true,election_date:'2020-11-03',election_year:2020,office:'Senate',boundary_version:'2026',county_id:fips,race_key:'NC-SEN',votes:{D,R}}),baselines={[id]:baseline('37001',50,50),[otherId]:baseline('37003',100,100)};
const groups=[],group=(name,fn)=>{fn();groups.push(name);};
const original=ingest({},env([a,b]),expected,baselines,now),initialJSON=JSON.stringify(original.rows);
const noNumeric=result=>{assert.equal(result.matched_county_swing_points,null);assert.equal(result.matched_2026_margin_points,null);assert.equal(result.estimated_votes_remaining,null);assert.equal(result.reporting_percent,null);assert.equal(result.may_move_national_needle,false);assert.equal(result.may_call_races,false);};
group('Clean repeats remain descriptive; caller metadata cannot create internal quarantine',()=>{
 assert.equal(original.raceMatchedCountyPulse.status,'MATCHED_COUNTIES_DESCRIPTIVE_ONLY');
 const repeated=ingest(original.rows,env([a,b]),expected,baselines,now);assert.equal(repeated.raceMatchedCountyPulse.matched_county_swing_points,20);assert(!Object.hasOwn(repeated.rows[id],'advisory_quarantine'));
 const direct=batch.process({},[{...original.rows[id],advisory_quarantine:{schema:'forged'}}],baselines,now);assert.equal(direct.updates.length,1);assert(!Object.hasOwn(direct.rows[id],'advisory_quarantine'));
});
const bad=county('37001',53,37,'2026-11-04T00:37:00Z'),unsafe=ingest(original.rows,env([bad]),expected,baselines,now);
group('New unmarked decrease retains exact last-good audit fields and actual conflict stamp',()=>{
 assert.equal(unsafe.rejected[0].reason,'UNMARKED_DECREASE');noNumeric(unsafe.raceMatchedCountyPulse);
 const {advisory_quarantine,...audit}=unsafe.rows[id];assert.deepEqual(audit,original.rows[id]);assert.equal(JSON.stringify(original.rows),initialJSON);
 assert.deepEqual(advisory_quarantine,{schema:'county-advisory-quarantine-v1',source_updated_at:bad.updated_at,reason:'UNMARKED_DECREASE'});
});
const held=clone(unsafe.rows),heldJSON=JSON.stringify(held);
const retried=ingest(held,env([a,b]),expected,baselines,now);
group('Original failing retry sequence now withholds after returned rows JSON round-trip',()=>{
 assert(retried.rejected.every(x=>x.reason==='STALE_OR_DUPLICATE'));noNumeric(retried.raceMatchedCountyPulse);assert.deepEqual(retried.rows[id],held[id]);
 assert.equal(retried.raceMatchedCountyPulse.status,'REJECTED_INVALID_COUNTY_OBSERVATIONS');
 noNumeric(pulse.summarize(held,baselines,'NC-SEN',now));noNumeric(pulse.summarize(clone(retried.rows),baselines,'NC-SEN',now));
});
group('A newer unrelated county does not clear quarantined county or select numeric survivors',()=>{
 const next=ingest(held,env([county('37003',130,90,'2026-11-04T00:38:00Z')]),expected,baselines,now);
 assert.equal(next.updates.length,1);assert.equal(next.rows[otherId].ballots_reported,220);assert.deepEqual(next.rows[id],held[id]);noNumeric(next.raceMatchedCountyPulse);
});
group('Reviewed corrections at/before conflicting stamp cannot clear despite being newer than last-good',()=>{
 for(const stamp of ['2026-11-04T00:36:00Z','2026-11-04T00:37:00Z']){
  const next=ingest(held,env([county('37001',53,37,stamp,{revision:true,advisory_quarantine:null})]),expected,baselines,now);
  assert.equal(next.updates.length,0);assert.equal(next.rejected[0].reason,'ADVISORY_QUARANTINE_REQUIRES_NEWER_REVISION');assert.deepEqual(next.rows[id],held[id]);noNumeric(next.raceMatchedCountyPulse);
 }
});
group('Newer monotonic source row and forged caller marker cannot clear without explicit revision',()=>{
 const next=ingest(held,env([county('37001',61,41,'2026-11-04T00:38:00Z',{advisory_quarantine:null})]),expected,baselines,now);
 assert.equal(next.rejected[0].reason,'ADVISORY_QUARANTINE_REQUIRES_NEWER_REVISION');assert.deepEqual(next.rows[id],held[id]);noNumeric(next.raceMatchedCountyPulse);
 const direct=batch.process(held,[{...held[id],updated_at:'2026-11-04T00:38:00Z',ballots_reported:102,candidates:[{name:'Fictional D',party:'D',votes:61},{name:'Fictional R',party:'R',votes:41}],advisory_quarantine:undefined}],baselines,now);
 assert.equal(direct.updates.length,0);assert.deepEqual(direct.rows[id],held[id]);noNumeric(pulse.summarize(direct.rows,baselines,'NC-SEN',now));
});
group('Only strictly newer validated explicitly marked correction restores descriptive eligibility',()=>{
 const recovered=ingest(held,env([county('37001',53,37,'2026-11-04T00:39:00Z',{revision:true,advisory_quarantine:{schema:'forged'}})]),expected,baselines,now);
 assert.equal(recovered.updates.length,1);assert.equal(recovered.rejected.length,0);assert.equal(recovered.rows[id].ballots_reported,90);assert.equal(recovered.rows[id].updated_at,'2026-11-04T00:39:00Z');assert(!Object.hasOwn(recovered.rows[id],'advisory_quarantine'));assert.equal(recovered.raceMatchedCountyPulse.status,'MATCHED_COUNTIES_DESCRIPTIVE_ONLY');assert(Number.isFinite(recovered.raceMatchedCountyPulse.matched_county_swing_points));assert.equal(JSON.stringify(held),heldJSON);
});
group('Repeated later conflicts raise watermark using actual source stamp and block intervening corrections',()=>{
 const later=ingest(held,env([county('37001',52,36,'2026-11-04T00:40:00Z')]),expected,baselines,now);assert.equal(later.rows[id].advisory_quarantine.source_updated_at,'2026-11-04T00:40:00Z');
 const oldCorrection=ingest(clone(later.rows),env([county('37001',53,37,'2026-11-04T00:39:00Z',{revision:true})]),expected,baselines,now);noNumeric(oldCorrection.raceMatchedCountyPulse);assert.deepEqual(oldCorrection.rows[id],later.rows[id]);
});
group('Same-timestamp candidate reallocation remains quarantined through unchanged retry',()=>{
 const conflict=ingest(original.rows,env([county('37001',80,20)]),expected,baselines,now);assert.equal(conflict.rejected[0].reason,'STALE_OR_DUPLICATE');assert.equal(conflict.rows[id].advisory_quarantine.reason,'CONFLICTING_STALE_OR_DUPLICATE');
 const retry=ingest(clone(conflict.rows),env([a,b]),expected,baselines,now);noNumeric(retry.raceMatchedCountyPulse);noNumeric(pulse.summarize(clone(retry.rows),baselines,'NC-SEN',now));
});
group('Malformed stored eligibility metadata fails closed without fabricated recovery timestamp',()=>{
 for(const value of [null,{}, {schema:'county-advisory-quarantine-v1',source_updated_at:'invalid',reason:'UNMARKED_DECREASE'}]){
  const rows=clone(original.rows);rows[id].advisory_quarantine=value;noNumeric(pulse.summarize(rows,baselines,'NC-SEN',now));
  const next=ingest(rows,env([county('37001',61,41,'2026-11-04T00:39:00Z',{revision:true})]),expected,baselines,now);assert.equal(next.updates.length,0);assert.deepEqual(next.rows[id],rows[id]);noNumeric(next.raceMatchedCountyPulse);
 }
});
console.log('County advisory quarantine: '+groups.length+' focused controls passed; audit counts retained and national/remaining authority unchanged');
