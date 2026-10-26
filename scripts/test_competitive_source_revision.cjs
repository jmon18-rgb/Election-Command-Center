'use strict';
const assert=require('node:assert/strict'),{create}=require('./competitive_source_revision.js');
const clock=()=>Date.parse('2026-11-04T03:10:00Z');
const store=()=>{const rows=new Map();return {getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v),rows};};
const ids={'IA-SEN':87151,'KS-SEN':87162,'TX-SEN':87438,'WI-01':87483,'WI-03':87485};
function input(code,stamp='2026-11-04T03:00:00Z',votes=10){
 const reference=require('../data/'+({'IA-SEN':'iowa','KS-SEN':'kansas','TX-SEN':'texas','WI-01':'wisconsin_house_01','WI-03':'wisconsin_house_03'})[code]+'_county_fips_reference.json');
 return {status:votes?'VALIDATED_COUNTY_COUNTS_METHOD_MIX_UNRESOLVED':'NO_REPORTED_VOTES',
  source_url:'https://civicapi.org/api/v2/race/'+ids[code],race_code:code,snapshot_updated_at:stamp,
  county_identities_matched:reference.counties.length,live_votes_accepted:votes>0,
  counties:reference.counties.map(c=>({county_fips:c.fips,dem_votes:votes,rep_votes:votes,other_votes:0}))};
}
const storage=store();
for(const code of Object.keys(ids)){
 const a=create(code,{storage,now:clock});a.accept(input(code));
 a.accept(input(code,'2026-11-04T03:01:00Z',0));
 const reloaded=create(code,{storage,now:clock});
 assert.throws(()=>reloaded.accept(input(code)),/requires a newer/,'Reload cannot restore counts older than a valid zero withdrawal');
 assert.throws(()=>reloaded.accept(input(code,'2026-11-04T03:01:00Z')),/requires a newer/,'Changed same-clock counts remain rejected after reload');
 reloaded.accept(input(code,'2026-11-04T03:02:00Z'));
 assert(reloaded.status().durable);
 const reordered=input(code,'2026-11-04T03:02:00Z');reordered.counties.reverse();reloaded.accept(reordered);
 assert.throws(()=>a.accept(input(code,'2026-11-04T03:01:30Z')),/requires a newer/,'Another tab reads the newer durable revision');
 const before=JSON.stringify([...storage.rows]);
 for(const mutate of [x=>x.status='TEST_DATA_NOT_LIVE',x=>x.source_url+='?light=',x=>x.race_code='wrong',
  x=>x.counties.pop(),x=>x.counties[0].county_fips=x.counties[1].county_fips,
  x=>x.counties[0].dem_votes=-1,x=>x.live_votes_accepted=false,x=>x.snapshot_updated_at='2026-11-05T03:00:00Z']){
  const bad=input(code,'2026-11-04T03:03:00Z');mutate(bad);assert.throws(()=>reloaded.accept(bad));
 }
 assert.equal(JSON.stringify([...storage.rows]),before,'Invalid/test inputs never modify durable source state');
}
assert.equal(storage.rows.size,Object.keys(ids).length,'Race scopes never share a revision key');
const unavailable={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');}};
const transient=create('IA-SEN',{storage:unavailable,now:clock});transient.accept(input('IA-SEN','2026-11-04T03:01:00Z',0));
assert.equal(transient.status().durable,false);assert.throws(()=>transient.accept(input('IA-SEN')),/requires a newer/);
const malformed=store(),subject=create('TX-SEN',{storage:malformed,now:clock});malformed.setItem(subject.key,'{broken');
subject.accept(input('TX-SEN'));assert(subject.status().durable,'Corrupt cached metadata cannot substitute for independently validated current input');
const rollbackStore=store();
create('TX-SEN',{storage:rollbackStore,now:()=>Date.parse('2026-11-04T03:40:00Z')}).accept(input('TX-SEN','2026-11-04T03:30:00Z',0));
const clockReset=create('TX-SEN',{storage:rollbackStore,now:()=>Date.parse('2026-11-04T03:00:00Z')});
assert.throws(()=>clockReset.accept(input('TX-SEN')),/requires a newer/,'A viewer clock rollback cannot erase a valid newer source revision');
for(const code of ['NC-SEN','__proto__','constructor'])assert.throws(()=>create(code),/Unsupported/);
console.log('Competitive source revisions survive reload/other tabs, reject test and rollback inputs, and retain in-session protection when storage is blocked PASS');
