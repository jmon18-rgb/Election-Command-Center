#!/usr/bin/env node
'use strict';
/* All examples in this test are fabricated, not subscription CSV exports.
 * Only the parser and same-draw model invariants are committed to GitHub.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const reader=require('./private_senate_fundamentals.js');
const engine=require('./chamber_control_model.js');
const csv=(header,lines)=>'X.1,X.2,~~~Section~~~,X.3,X.4\n'+header+'\n'+lines.join('\n')+'\n';
const f=csv('Race,Polls,Simple,Fancy,Blended',[
 'MN,D +2@@2,D +7@@7,D +9@@9,D +60@@60',
 'NC,D +4@@4,D +10@@10,D +11@@11,R +25@@-25',
 'GA,D +3@@3,D +4@@4,D +12@@12,R +20@@-20',
 'ME,D +1@@1,D +2@@2,R +3@@-3,D +30@@30'
]);
// Change the POLLS component only, not the Blended fundamentals section.
const fAlt=f.replace('MN,D +2@@2,','MN,R +25@@-25,')
 .replace('NC,D +4@@4,','NC,R +25@@-25,')
 .replace('GA,D +3@@3,','GA,R +25@@-25,');
const e=csv('Race,FLIPR Classic,Unadjusted,Adjusted,FLIPR Deluxe',[
 'MN,D +1@@1,D +8@@8,D +15@@15,R +55@@-55',
 'NC,D +2@@2,D +10@@10,D +15@@15,D +55@@55',
 'GA,D +3@@3,D +7@@7,D +20@@20,R +50@@-50',
 'ME,D +1@@1,D +2@@2,D +10@@10,D +35@@35'
]);
const eAlt=e.replace('MN,D +1@@1,','MN,R +25@@-25,')
 .replace('R +55@@-55','D +55@@55')
 .replace('R +50@@-50','D +50@@50');
const hf=csv('Race,Polls,Simple,Fancy,Blended',[
 'AK-1,R +2@@-2,R +10@@-10,R +5@@-5,D +50@@50',
 'AL-2,D +4@@4,D +8@@8,D +9@@9,R +50@@-50',
 'CA-48,D +1@@1,D +7@@7,D +4@@4,D +50@@50',
 'PA-10,D +2@@2,D +3@@3,D +6@@6,D +20@@20'
]);
assert.equal(reader.parse(f).kind,'senateFundamentals');
assert.equal(reader.parse(e).kind,'senateExperts');
assert.equal(reader.parse(hf).kind,'houseFundamentals');
assert.equal(reader.parse(hf).states['AK-01'].fancy,-5);
assert.equal(reader.parse(e).states.MN.unadjusted,8);
assert.equal(reader.parse(f).states.MN.fancy,9);
assert.equal(reader.parse(f).states.MN.blended,60);
assert.throws(()=>reader.parse('district,tipping,vpi\nTX-1,2,5'),/Race header/);
assert.throws(()=>reader.parse(f.replace('D +7@@7','D +7@@-7')),/Inconsistent/);
assert.throws(()=>reader.parse(f.replace('GA,D +3@@3,','MN,D +3@@3,')),/Duplicate race/);
assert.throws(()=>reader.parse(f.replace('D +9@@9','D +9@@500')),/Invalid CSV margin/);
assert.throws(()=>reader.parse('X\nRace,Polls,Simple,Fancy,Blended\n'),/no usable/);
let p=reader.accept(null,reader.parse(f));
p=reader.accept(p,reader.parse(e));
p=reader.accept(p,reader.parse(hf));
assert.equal(Object.keys(p.senateFundamentals).length,4);
assert.equal(Object.keys(p.senateExperts).length,4);
assert.equal(Object.keys(p.houseFundamentals).length,4);
assert.throws(()=>reader.accept(null,{kind:'forecasts',states:{}}),/Unrecognized/);
const from=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',n+'.json'),'utf8'));
const source={seats:from('seat_universe'),history:from('house_history_2024_staging'),
 geography:from('house_geography_bridge'),senateHistory:from('senate_history_2020_2022_2024'),
 odds:from('race_probabilities'),polls:from('polling_estimates'),
 presidential:from('presidential_2024_by_2026_district_staging')};
const baseline=engine.prepare(source,{senatePriorMode:'current_2026'});
const withSenate=reader.apply(baseline,p,{includeHouse:false});
assert.deepEqual(withSenate.house,baseline.house,'Senate-only private data cannot alter House model');
assert.deepEqual(withSenate.governors,baseline.governors,'Private imports cannot affect governors');
assert.deepEqual(withSenate.assumptions,baseline.assumptions,
 'Externally imported candidate context must not alter shared uncertainty');
assert.equal(withSenate.private_imported_context.matched_senate_races,4);
assert.equal(withSenate.private_imported_context.matched_house_races,0);
assert(withSenate.senate.find(r=>r.code==='MN-SEN').mean!==baseline.senate.find(r=>r.code==='MN-SEN').mean);
assert(withSenate.senate.filter(r=>!p.senateFundamentals[r.state]&&!p.senateExperts[r.state])
 .every(r=>r.mean===baseline.senate.find(x=>x.code===r.code).mean));
assert(withSenate.senate.filter(r=>!p.senateFundamentals[r.state]&&!p.senateExperts[r.state])
 .every(r=>r.sigma===baseline.senate.find(x=>x.code===r.code).sigma));
const altered=reader.accept(reader.accept(null,reader.parse(fAlt)),reader.parse(eAlt));
assert.deepEqual(reader.apply(baseline,altered).senate,withSenate.senate,
 'Silver polls, FLIPR Classic and FLIPR Deluxe final odds must never become model priors');
const housePollMargins=Object.fromEntries(source.odds.records.filter(r=>r.office==='house')
 .map(r=>[r.race_code,r.dem_minus_rep]));
const withHouse=reader.apply(baseline,p,{includeHouse:true,housePollMargins});
assert.equal(withHouse.private_imported_context.matched_house_races,4);
assert(withHouse.house.some(r=>r.private_context_anchor_points!==undefined));
assert.deepEqual(withHouse.senate,withSenate.senate,
 'Enabling additional House context must not change Senate candidate marginals');
assert(withHouse.house.filter(r=>!p.houseFundamentals[r.code])
 .every(r=>r.mean===baseline.house.find(x=>x.code===r.code).mean));
const opts={seed:20261103,samples:3000};
const b=engine.simulate(baseline,opts),alt=engine.simulate(withSenate,opts);
assert.equal(alt.house_dem_control_pct,b.house_dem_control_pct);
assert.deepEqual(alt.race_probabilities.filter(r=>r.office==='house'),
 b.race_probabilities.filter(r=>r.office==='house'));
assert.equal(alt.race_probabilities.length,b.race_probabilities.length);
// Persist private candidate fundamentals locally, not on the public server.
// These tests use an in-memory fake Storage object (NO paid source data).
const storageBacking=new Map();
const storage={
 getItem:key=>storageBacking.has(key)?storageBacking.get(key):null,
 setItem:(key,val)=>{storageBacking.set(key,String(val));},
 removeItem:key=>{storageBacking.delete(key);}
};
const importAt='2026-10-14T18:00:00Z';
const saved=reader.saveDevice(storage,p,{enabled:true,includeHouse:true},importAt);
assert.equal(saved.rows,8);
assert(storageBacking.has(reader.STORAGE_KEY));
const restored=reader.restoreDevice(storage,'2026-10-17T18:00:00Z');
assert.equal(JSON.stringify(restored.data),JSON.stringify(p),
 'JSON storage roundtrip must preserve values regardless of safe null-prototype parser');
assert.deepEqual(restored.settings,{enabled:true,includeHouse:true});
assert.equal(restored.imported_at,new Date(importAt).toISOString());
assert.equal(restored.warning,false);
assert.equal(restored.expired,false);
assert.equal(restored.age_days,3);
const warning=reader.restoreDevice(storage,'2026-10-25T18:00:00Z');
assert.equal(warning.warning,true);
assert.equal(warning.expired,false);
const expired=reader.restoreDevice(storage,'2026-11-19T18:00:00Z');
assert.equal(expired.expired,true,'Do not auto-activate stale personal priors');
assert.equal(expired.warning,true);
const inactive=reader.saveDevice(storage,p,{enabled:false,includeHouse:false},importAt);
assert.equal(inactive.rows,8);
assert.deepEqual(reader.restoreDevice(storage,importAt).settings,
 {enabled:false,includeHouse:false});
assert.throws(()=>reader.restoreDevice(storage,'2026-10-12T00:00:00Z'),/date is invalid/);
const attack=storageBacking.get(reader.STORAGE_KEY);
storageBacking.set(reader.STORAGE_KEY,attack.replace(reader.VERSION,'unknown-version'));
assert.throws(()=>reader.restoreDevice(storage,importAt),/schema mismatch/);
storageBacking.set(reader.STORAGE_KEY,'{not json');
assert.throws(()=>reader.restoreDevice(storage,importAt),/unreadable/);
storageBacking.set(reader.STORAGE_KEY,attack);
reader.clearDevice(storage);
assert.equal(reader.restoreDevice(storage,importAt),null);
assert.equal(storageBacking.has(reader.STORAGE_KEY),false);
assert.equal(typeof reader.STORAGE_KEY,'string');
console.log('Private Senate/House CSV context parser and no-target-leakage invariants PASS');
