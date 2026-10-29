'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
let root=__dirname;while(!fs.existsSync(path.join(root,'index.html')))root=path.dirname(root);
const text=fs.readFileSync(path.join(root,'index.html'),'utf8'),start=text.indexOf('function enIndicatorSyncControls(){'),end=text.indexOf('\nfunction enIndicatorPublish(',start);
assert(start>=0&&end>start,'Actual installed control-state function required');const source=text.slice(start,end).trim();
const state={year:2024,pending:false,hidden:true,hasWatch:false,privateEnabled:true,privateRemember:false,hostMissing:false},open={disabled:false,title:''},preview={disabled:false,title:''};
const host={get hidden(){return state.hidden;},querySelector:s=>{assert.equal(s,'.early-watch');return state.hasWatch?{}:null;}};
const sandbox={$:id=>id==='#enEarlyWatchOpen'?open:id==='#enEarlyWeatherPreview'?preview:id==='#enPersonalFocus'?(state.hostMissing?null:host):null};
Object.defineProperties(sandbox,{enModeYear:{get:()=>state.year},jointModelPending:{get:()=>state.pending}});vm.createContext(sandbox);vm.runInContext(source,sandbox);
const sync=()=>sandbox.enIndicatorSyncControls(),preferences=()=>JSON.stringify([state.year,state.privateEnabled,state.privateRemember]);let groups=0;
const check=(name,fn)=>{fn();groups++;};
check('archive disables both inert controls with2026instruction and unchanged preferences',()=>{const before=preferences();sync();assert.equal(open.disabled,true);assert.equal(preview.disabled,true);assert.match(open.title,/2026/);assert.match(preview.title,/2026/);assert.equal(preferences(),before);});
check('normal2026accepted watch enables both controls',()=>{state.year=2026;state.hidden=false;state.hasWatch=true;sync();assert.equal(open.disabled,false);assert.equal(preview.disabled,false);});
check('pending disables onlyOpen and preserves independent fictional preview',()=>{state.pending=true;const before=preferences();sync();assert.equal(open.disabled,true);assert.equal(preview.disabled,false);assert.match(open.title,/prepar|updat|finish|wait/i);assert.equal(preferences(),before);});
check('recovered actual watch re-enablesOpen',()=>{state.pending=false;sync();assert.equal(open.disabled,false);assert.equal(preview.disabled,false);});
check('no rendered watch or hidden livehost cannot advertiseOpen action',()=>{for(const [hidden,hasWatch,missing]of [[false,false,false],[true,true,false],[false,true,true]]){state.hidden=hidden;state.hasWatch=hasWatch;state.hostMissing=missing;sync();assert.equal(open.disabled,true);assert.equal(preview.disabled,false);}});

// The same existing reader guard protects the newly relocated panel's
// immediate pending-state write. These are invocation/eligibility assertions;
// actual viewport preservation is checked in the real-worker browser drill.
const readerTrace=[],renderTrace=[];
sandbox.document={get hidden(){return state.documentHidden===true;}};
sandbox.enIsVisible=()=>state.pageVisible===true;
sandbox.enIndicatorRenderPoop=value=>{renderTrace.push(JSON.parse(JSON.stringify(value)));readerTrace.push({kind:'withhold'});};
sandbox.jointPreserveSnapshotReader=(action,enabled)=>{readerTrace.push({kind:'guard',enabled});const value=action();readerTrace.push({kind:'complete'});return value;};
const clearTrace=()=>{readerTrace.length=0;renderTrace.length=0;};
check('visible2026 pending wraps exactly one immediate withhold in the existing enabled reader guard',()=>{
 Object.assign(state,{year:2026,pending:true,hidden:false,hasWatch:true,hostMissing:false,documentHidden:false,pageVisible:true});clearTrace();const before=preferences();sync();
 assert.deepEqual(readerTrace,[{kind:'guard',enabled:true},{kind:'withhold'},{kind:'complete'}]);assert.deepEqual(renderTrace,[{active:true,current:false,context:null}]);assert.equal(open.disabled,true);assert.equal(preview.disabled,false);assert.equal(preferences(),before);
});
check('hidden inactive and missing-visibility contexts explicitly disable restoration while still withholding the meter',()=>{
 for(const config of [{documentHidden:true,pageVisible:true},{documentHidden:false,pageVisible:false},{documentHidden:false,pageVisible:true,missingVisibility:true}]){
  Object.assign(state,{year:2026,pending:true},config);clearTrace();const visible=sandbox.enIsVisible;if(config.missingVisibility)delete sandbox.enIsVisible;const before=preferences();sync();sandbox.enIsVisible=visible;
  assert.deepEqual(readerTrace,[{kind:'guard',enabled:false},{kind:'withhold'},{kind:'complete'}]);assert.deepEqual(renderTrace,[{active:true,current:false,context:null}]);assert.equal(preferences(),before);
 }
});
check('archive clears the meter with restoration disabled and retains ordinary archive control semantics',()=>{
 Object.assign(state,{year:2024,pending:false,documentHidden:false,pageVisible:true});clearTrace();const before=preferences();sync();assert.deepEqual(readerTrace,[{kind:'guard',enabled:false},{kind:'withhold'},{kind:'complete'}]);assert.deepEqual(renderTrace,[{active:false,current:false,context:null}]);assert.equal(open.disabled,true);assert.equal(preview.disabled,true);assert.equal(preferences(),before);
});
check('optional reader-helper absence keeps immediate failclosed withholding and acceptedCURRENT does not invoke either path',()=>{
 const preserve=sandbox.jointPreserveSnapshotReader;delete sandbox.jointPreserveSnapshotReader;Object.assign(state,{year:2026,pending:true,documentHidden:false,pageVisible:true});clearTrace();const before=preferences();sync();assert.deepEqual(readerTrace,[{kind:'withhold'}]);assert.deepEqual(renderTrace,[{active:true,current:false,context:null}]);assert.equal(open.disabled,true);assert.equal(preview.disabled,false);assert.equal(preferences(),before);sandbox.jointPreserveSnapshotReader=preserve;
 state.pending=false;clearTrace();sync();assert.deepEqual(readerTrace,[]);assert.deepEqual(renderTrace,[]);assert.equal(open.disabled,false);assert.equal(preview.disabled,false);
});

const proof={status:'PASS',groups,source:'Actual tracked index enIndicatorSyncControls',source_sha256:crypto.createHash('sha256').update(source).digest('hex'),network_requests:0,model_draws:0,original_year_and_private_preferences_preserved:true,fictional_pending_preview_preserved:true};
const out=process.env.TEST_PROOF_PATH||path.join(root,'artifacts/readiness/indicator-control-states.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
