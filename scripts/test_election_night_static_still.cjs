'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

// Extract the actual page binding so the regression cannot pass against a
// separate copy of the helper. The optional root supports isolated task review.
const root=process.env.DASHBOARD_TEST_ROOT||path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const marker='function enFishPrepareStill(host){';
const start=index.indexOf(marker),end=index.indexOf('\nfunction enFishApplyAnimation(){',start);
assert(start>=0&&end>start,'Actual static-picture preparation binding must exist');
assert.equal(index.indexOf(marker,start+marker.length),-1,'Preparation binding is unique');
const source=index.slice(start,end);
const realm={};vm.createContext(realm);vm.runInContext(source,realm);
const prepare=realm.enFishPrepareStill;

function fixture(){
 let resolve,reject;
 const decoded=new Promise((a,b)=>{resolve=a;reject=b;});
 const image={complete:false,naturalWidth:0,loading:'lazy',src:'original.jpg',
  getAttribute(){return this.src;},decode(){return decoded;}};
 const host={dataset:{animate:'false',photoReady:'false'},image,
  querySelector(){return this.image;}};
 return{image,host,resolve,reject};
}

async function main(){
 // Static selection starts completion without making an undecoded image visible.
 let f=fixture();prepare(f.host);
 assert.equal(f.image.loading,'eager');assert.equal(f.host.dataset.photoReady,'false');
 f.image.complete=true;f.image.naturalWidth=360;f.resolve();await Promise.resolve();
 assert.equal(f.host.dataset.photoReady,'true','Same-source/node completed image becomes ready');

 f=fixture();prepare(f.host);f.image.complete=true;f.image.naturalWidth=360;
 f.image.src='replacement.jpg';f.resolve();await Promise.resolve();
 assert.equal(f.host.dataset.photoReady,'false','Old-source decode cannot ready a replacement source');

 f=fixture();prepare(f.host);f.image.complete=true;f.image.naturalWidth=360;
 f.host.image={};f.resolve();await Promise.resolve();
 assert.equal(f.host.dataset.photoReady,'false','Detached old node cannot ready its replacement');

 f=fixture();prepare(f.host);f.image.complete=true;f.reject(new Error('Unavailable fixture'));
 await Promise.resolve();
 assert.equal(f.host.dataset.photoReady,'false','A broken image keeps the static SVG fallback');

 f=fixture();f.host.dataset.animate='true';prepare(f.host);
 assert.equal(f.image.loading,'lazy','Animated default does not hydrate the optional still');
 assert.equal(f.host.dataset.photoReady,'false');

 f=fixture();prepare(f.host);f.host.dataset.animate='true';
 f.image.complete=true;f.image.naturalWidth=360;f.resolve();await Promise.resolve();
 assert.equal(f.host.dataset.animate,'true','Late decode never changes the newer animation preference');
 assert.equal(f.host.dataset.photoReady,'true','Only readiness may complete after a preference change');

 f=fixture();f.image.decode=()=>{throw new Error('Unsupported decoder fixture');};
 assert.doesNotThrow(()=>prepare(f.host));
 assert.equal(f.host.dataset.photoReady,'false','Synchronous decoder failure keeps the SVG fallback');
 f=fixture();f.image.decode=undefined;f.image.complete=true;f.image.naturalWidth=360;
 assert.doesNotThrow(()=>prepare(f.host));
 assert.equal(f.host.dataset.photoReady,'true','A ready image also works without the optional decode API');

 console.log('Static Fish still binding PASS: 7 actual-page async groups; same source/node, pending/error fallback, animated default, late preference and unavailable decoder. No network/audio operations.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
