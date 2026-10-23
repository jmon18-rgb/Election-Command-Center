const assert=require('node:assert/strict');
const {calculate}=require('./county_swing_2026');
const row={verified_source:true,is_test:false,election_date:'2026-11-03',
 county_id:'51107',race_key:'VA-SEN',updated_at:'2026-11-04T01:00:00Z',
 candidates:[{party:'D',votes:60},{party:'R',votes:40}]};
const base={verified_source:true,election_date:'2024-11-05',
 boundary_version:'2026',county_id:'51107',race_key:'VA-SEN',votes:{D:50,R:50}};
const result=calculate(row,base);
assert.equal(result.swing,0.2);
assert.equal(result.mode,'VERIFIED_COUNTY_SWING_ONLY');
assert.equal(calculate({...row,is_test:true},base),null);
assert.equal(calculate(row,{...base,boundary_version:'2024'}),null);
assert.equal(calculate(row,{...base,county_id:'51059'}),null);
assert.equal(calculate({...row,candidates:[{party:'D',votes:0},{party:'R',votes:0}]},base),null);
assert.equal(calculate(row,{...base,verified_source:false}),null);
console.log('County geographic swing guard passed');
