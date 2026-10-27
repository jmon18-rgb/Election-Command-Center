'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),z=require('node:zlib');
const adapter=require('./civicapi_state_batch.js'),signals=require('./election_night_signals.js');
const nowcast=require('./election_night_nowcast.js'),fixture=require('./alaska_senate_test_fixture.cjs');
const actual=JSON.parse(z.gunzipSync(fs.readFileSync(require.resolve('../data/alaska_senate_sources/2026-current-civic-full.json.gz'))));
const item={office:'Senate',key:'AK'},now=Date.parse('2026-11-04T06:15:00Z');
function row(candidates){return {country:'US',province:'AK',municipality:null,district:null,id:86916,
 election_date:actual.election_date,election_name:'Alaska US Senate',type:'US Senate',election_type:'General',candidates};}
assert.equal(adapter.select(item,{count:1,races:[row(actual.candidates)]}),null,'Saved actual wrong-affiliation source is excluded, not repaired by party summing');
const search=row(fixture.candidates());
const good={...search,election_type:search.type,test_data:false,round:1,percent_reporting:70,
 last_updated:'2026-11-04T06:10:00Z',candidates:fixture.candidates(510,490)};
const parsed=adapter.validate(item,search,good,now);assert.equal(parsed.total,1000);
assert.equal(parsed.party_aggregation_allowed,false);assert.equal(parsed.final_rcv_verified,false);
for(const mutate of [d=>d.candidates[3].party='Republican',d=>d.candidates[3].candidate_id=219760,
 d=>d.candidates[0].candidate_id='219759',d=>d.candidates.pop(),d=>d.candidates[0].name='Other Democrat',
 d=>d.round=2,d=>delete d.round,d=>delete d.test_data]){
 const d=structuredClone(good);mutate(d);assert.equal(adapter.validate(item,search,d,now),null);
}
// A future provider correction could pass the identity contract, but does not
// establish final RCV call semantics or a regional remaining-vote estimator.
const flagged=structuredClone(good);flagged.candidates[0].winner=true;
assert.equal(adapter.validate(item,search,flagged,now).called,null);
const legacy={...parsed,called:'Daniel J. Jr. Sullivan',candidates:[{name:'Daniel J. Jr. Sullivan',party:'R',votes:700},{name:'Mary Peltola',party:'D',votes:300}]};
assert.equal(signals.validatedCall(legacy,now),null,'Cached old incorrect party/call data cannot award a Republican Senate seat');
assert.equal(nowcast.observed(item,null,legacy),null,'No aggregate-party nowcast from state-only first choices');
const priors={schema_version:'experimental-race-odds-v1',can_infer_chamber_control:false,records:[{
 office:'senate',race_code:'AK-SEN',dem_minus_rep:1,sigma_points:6,dem_beats_rep_pct:55,provider_called_party:'R'}]};
assert.equal(nowcast.estimate(priors,item,null,legacy,now).mode,'polls_only');
console.log('AK official/native identity conflict, distinct Sullivans, six-name roster, first-choice call/cache exclusion and no party-aggregate forecast PASS; synthetic corrected-party fixture is not actual delivery');
