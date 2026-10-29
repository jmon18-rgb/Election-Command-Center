'use strict';
// Nested dependency repair must precede the worker entry's own index stamp.
// These mutations are entirely synthetic and never rewrite real assets/index.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const worker=require('./check_joint_model_worker_assets.cjs'),outer=require('./check_election_night_asset_versions.cjs');
const real=fs.readFileSync(path.join(__dirname,'joint_model_worker.js'),'utf8');
const actual=worker.inspect(real,name=>fs.readFileSync(path.join(__dirname,name+'.js')));
assert.equal(actual.ok,true,actual.errors.join('\n'));assert.equal(actual.changed,false);
const assets=Object.fromEntries(worker.names.map((name,i)=>[name,Buffer.from('/* FICTIONAL STATIC ASSET '+i+' */\nwindow.label="'+name+'";\n')]));
const read=name=>{assert(Object.hasOwn(assets,name),'Only fixed declared asset names may be read');return assets[name];};
const imports=worker.names.map(name=>({name,stamp:worker.revision(assets[name])}));
const model=imports.filter(row=>['source_call_conditioning','chamber_control_model','national_county_likelihood'].includes(row.name)).map(row=>'./scripts/'+row.name+'.js?v='+row.stamp).join('|');
const make=(rows=imports,revision=model)=>'/* FICTIONAL WORKER */\nconst IMPORTS=Object.freeze(('+JSON.stringify(rows)+').map(Object.freeze));\nconst MODEL_REVISION='+JSON.stringify(revision)+';\n';
const original=make();assert.equal(worker.inspect(original,read).ok,true);assert.equal(worker.inspect(original,read,{fix:true}).source,original,'No-op repair is byte-preserving');
let mutations=0;
for(const mutate of [
 rows=>{rows[0].stamp='000000000000';},
 rows=>{rows.reverse();},
 rows=>{rows.splice(2,1);},
 rows=>{rows.push({...rows[0]});},
 rows=>{rows[1].name='https://untrusted.invalid/model';},
 rows=>{rows[2].name='../private-context';},
 rows=>{rows[3].stamp='not-a-git-revision';}
]){
 const rows=structuredClone(imports);mutate(rows);const bad=make(rows);
 assert.equal(worker.inspect(bad,read).ok,false);const fixed=worker.inspect(bad,read,{fix:true});
 assert.equal(fixed.ok,true);assert.equal(fixed.changed,true);assert.equal(fixed.source,original,'Repair reinstates only exact ordered fixed dependency pins');mutations++;
}
for(const value of ['old-model',model.split('|').reverse().join('|'),model.replace(/v=[a-f0-9]{12}/,'v=000000000000'),'https://untrusted.invalid/model.js']){
 const bad=make(imports,value);assert.equal(worker.inspect(bad,read).ok,false);assert.equal(worker.inspect(bad,read,{fix:true}).source,original);mutations++;
}
for(const bad of [original.replace('const IMPORTS=','const RENAMED='),original.replace('const MODEL_REVISION=','const RENAMED='),
 original.replace('"name":','name:'),original.replace('const MODEL_REVISION="','const MODEL_REVISION="bad\\escape')]){
 const check=worker.inspect(bad,read,{fix:true});assert.equal(check.ok,false);assert.equal(check.source,bad,'Malformed markers/JSON are never partly rewritten');mutations++;
}
assert.equal(worker.inspect(original,()=>{throw Error('not readable');},{fix:true}).ok,false);
assert.equal(worker.inspect(null,read).ok,false);
const unicode='/* exact UTF-8: naïve 🌊 */\n';
const bytes=Buffer.from(unicode),independent=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex').slice(0,12);
assert.equal(worker.revision(bytes),independent);assert.equal(worker.revision(unicode),independent,'UTF-8 byte length defines Git identity');

// A changed nested helper requires BOTH its import pin and the outer worker
// entry stamp to advance, even when the three-core model revision is unchanged.
for(const changedName of ['election_night_poll_closings_2026','chamber_control_model']){
 const changed={...assets,[changedName]:Buffer.concat([assets[changedName],Buffer.from('// FICTIONAL CHANGE\n')])},readChanged=name=>changed[name];
 assert.equal(worker.inspect(original,readChanged).ok,false);const repaired=worker.inspect(original,readChanged,{fix:true}).source;
 assert.notEqual(repaired,original);assert.equal(worker.inspect(repaired,readChanged).ok,true);
 const workerPath='./scripts/joint_model_worker.js',scriptNames=Array.from({length:7},(_,i)=>'./scripts/fixture'+i+'.js');
 const fixtures=Object.fromEntries(scriptNames.map((name,i)=>[name,Buffer.from('fixture '+i)]));
 const index=[...scriptNames,workerPath].map(name=>'<script src="'+name+'?v='+outer.revision(name===workerPath?Buffer.from(original):fixtures[name])+'"></script>').join('\n');
 const readOuter=name=>name===workerPath?Buffer.from(repaired):fixtures[name];
 const staleOuter=outer.inspect(index,readOuter);assert.equal(staleOuter.ok,false);assert.equal(staleOuter.updates.length,1);assert.equal(staleOuter.updates[0].name,workerPath);
 const final=outer.inspect(index,readOuter,{fix:true});assert.equal(final.ok,true);assert.equal(outer.inspect(final.html,readOuter).ok,true);mutations++;
}
console.log('Worker asset identity PASS: exact6 imports, '+mutations+' stale/order/path/manifest mutations, UTF-8 Git bytes, and nested-dependency-before-entry stamp repair. No real files rewritten.');
