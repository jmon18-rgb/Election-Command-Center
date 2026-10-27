'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {inspect:inspectSource}=require('./inspect_washington_remaining_ballots.cjs');
const c=require('../data/washington_county_remaining_source_contract.json');
const inspect=(input,now)=>inspectSource(input,now,c.source_url);
const raw=fs.readFileSync(c.original_file);assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),c.original_sha256);
const actual=JSON.parse(raw),now=Date.parse('2026-11-04T04:20:00Z');
assert.throws(()=>inspectSource(actual,now,c.source_url.replace('20261103','20241105')));
assert.throws(()=>inspectSource(actual,now));
let result=inspect(actual,now);assert.equal(result.counties.length,39);assert.equal(result.wa03.length,7);
assert(result.counties.every(x=>x.reported_estimate===0&&!x.review_eligible&&x.exclusion_reason==='MISSING_OR_INVALID_REPORT_CLOCK'));
// Entirely SYNTHETIC later snapshots exercise semantics, not actual delivery.
function fixture(){const d=structuredClone(actual);for(const x of d.data[0].groups[0].children){x.value=123;x.lastUpdated='2026-11-04T04:10:00Z';}return d;}
const mutate=fn=>{const d=fixture();fn(d.data[0].groups[0].children,d);return d;};
result=inspect(fixture(),now);assert(result.wa03.every(x=>x.review_eligible&&x.scope==='WHOLE_COUNTY_ESTIMATE_NOT_DISTRICT_PART'&&!x.may_move_national_needle));assert.equal(result.may_move_national_needle,false);
assert(inspect(fixture(),Date.parse('2026-11-04T03:00:00Z')).counties.every(x=>!x.review_eligible));
for(const [at,reason] of [[null,'MISSING_OR_INVALID_REPORT_CLOCK'],['2026-11-31T04:10:00Z','MISSING_OR_INVALID_REPORT_CLOCK'],['2026-11-04T03:59:59Z','PRE_CLOSE'],['2026-11-04T04:30:00Z','FUTURE_CLOCK'],['2026-11-04T04:00:00Z','STALE_REPORT_CLOCK']]){
 const clock=reason==='STALE_REPORT_CLOCK'?now+1800000:now;
 assert.equal(inspect(mutate(a=>a[0].lastUpdated=at),clock).counties[0].exclusion_reason,reason);
}
for(const fn of [a=>a.pop(),a=>a[1]=structuredClone(a[0]),a=>a[0].id='unknown',a=>a[0].name[0].text='Clark County',a=>a[0].value=-1,a=>a[0].value=.5,a=>a[0].children=[],(a,d)=>d.data[0].id='other-statistic'])assert.throws(()=>inspect(mutate(fn),now));
const zero=inspect(mutate(a=>a[0].value=0),now).counties[0];assert(zero.review_eligible&&!zero.may_move_national_needle); // A timestamped zero is still no final-call or district inference.
assert.deepEqual(inspect(mutate(a=>a.reverse()),now).wa03.map(x=>x.county_fips).sort(),c.wa03_county_fips.slice().sort());
const wa03=require('../data/washington_house_03_county_fips_reference.json').counties;
assert.deepEqual(c.wa03_county_fips.slice().sort(),wa03.map(x=>x.fips).sort());
for(const x of wa03)assert(c.counties.some(p=>p.county_fips===x.fips&&p.name===x.county+' County'));
console.log('PASS: actual null-clock template excluded; synthetic clock/matrix/identity/estimate checks; no district allocation/model admission');
