#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {revision,inspect}=require('./check_election_night_asset_versions.cjs');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const load=name=>fs.readFileSync(path.join(root,name.slice(2)));
const real=inspect(html,load);
assert.equal(real.ok,true,real.errors.join('\\n'));
assert(real.scanned>=20,'Expected active Election Night and forecast scripts');
assert.equal(real.updates.length,0);
const fakeA=Buffer.from('window.a=true;');
const fakeB=Buffer.from('window.b=true;');
const a=revision(fakeA),b=revision(fakeB);
const scriptA='./scripts/a.js?v='+a;
const scriptB='./scripts/b.js?v='+b;
const sample='<script src="'+scriptA+'"></script>\\n'.repeat(8)+
 '<script src="'+scriptB+'"></script>';
const dup=inspect(sample,name=>name.includes('/a.js')?fakeA:fakeB);
assert(!dup.ok);assert(dup.errors.some(x=>x.includes('Duplicate external script')));
const good=Array.from({length:8},(_,i)=>{
 const name='./scripts/file'+i+'.js';
 return '<script src="'+name+'?v='+revision(Buffer.from('asset'+i))+'"></script>';
}).join('\\n');
const fixture=name=>Buffer.from('asset'+Number(name.match(/file(\\d+)/)[1]));
assert(inspect(good,fixture).ok);
const wrong=good.replace(/v=[a-f0-9]{12}/,'v=000000000000');
assert(!inspect(wrong,fixture).ok);
const fixed=inspect(wrong,fixture,{fix:true});
assert(fixed.ok);assert.equal(fixed.updates.length,1);
assert.equal(fixed.html,good);
assert(inspect(good.replace('./scripts/file0.js','../private.js'),fixture).errors.some(x=>/Unsafe/.test(x)));
assert(inspect(good,()=>{throw Error('missing')}).errors.some(x=>/Unreadable/.test(x)));
assert(!inspect(good.replace(/\\?v=[0-9a-f]{12}/,''),fixture).ok);
console.log('Immutable asset versions: full index, duplicates, stale hashes, repair and invalid paths PASS');
