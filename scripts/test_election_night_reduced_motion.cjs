'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.DASHBOARD_TEST_ROOT||path.resolve(__dirname,'..');
const index=fs.readFileSync(process.env.DASHBOARD_TEST_INDEX||path.join(root,'index.html'),'utf8');
const start=index.indexOf('const enCelebrationMotionQuery='),end=index.indexOf("$('#enCelebrationSound').addEventListener",start);
assert(start>=0&&end>start,'Actual current-query reduced-motion binding must exist');
const source=index.slice(start,end),Player=require(path.join(root,'scripts/election_night_celebration_player.js'));
const query={matches:false,addEventListener(type,listener){assert.equal(type,'change');this.listener=listener;}},stage={dataset:{phase:''}},trace=[],stops=[];
let done=null,pauses=0,nextTimer=0,skips=0;
const player=Player.create({reducedMotion:()=>query.matches,valid:()=>true,setTimer:()=>++nextTimer,clearTimer:()=>{},announce:callback=>{done=callback;},music:()=>{},render:(item,demo,phase)=>{stage.dataset.phase=phase;trace.push({id:item.id,phase});if(phase!=='announcement')pauses++;}});
const surface={window:{matchMedia:()=>query},$:(id)=>{assert.equal(id,'#enCelebrationStage');return stage;},enCelebrationPlayer:{skip(){skips++;return player.skip();}},enAnnouncementMotionStop:kind=>stops.push(kind)};
vm.createContext(surface);vm.runInContext(source,surface);

// A real announcement survives a newly delivered reduced-motion event. The
// existing player callback then chooses the finale after announcement completion.
player.enqueue({id:'abbott'},true);query.matches=true;
const originalDone=done;query.listener({matches:true});
assert.equal(stage.dataset.phase,'announcement');assert.equal(done,originalDone);
assert.equal(pauses,0);assert.equal(skips,0);assert.deepEqual(stops,['bulletin','celebration']);
done();assert.equal(stage.dataset.phase,'complete');
assert.deepEqual(trace.map(row=>row.phase),['announcement','complete']);

// An old event saying "reduce" may arrive after the user changes back. It has
// no authority over a new preview's current scene, and cannot stop its analysis.
query.matches=false;player.enqueue({id:'graham'},true);done();
assert.equal(stage.dataset.phase,'scene');stops.length=0;
query.listener({matches:true});assert.equal(stage.dataset.phase,'scene');
assert.equal(skips,0);assert.deepEqual(stops,[]);

// The current query, rather than the old event payload, controls a midscene
// preference change. It immediately reaches the supplied-picture finale.
query.matches=true;query.listener({matches:false});
assert.equal(stage.dataset.phase,'complete');assert.equal(skips,1);
assert.deepEqual(stops,['bulletin','celebration']);

// A queued earlier event delivered during a replacement announcement cannot
// skip that clip or consume its completion callback.
player.enqueue({id:'mississippi'},true);const replacementDone=done,beforePause=pauses;
query.listener({matches:true});assert.equal(stage.dataset.phase,'announcement');
assert.equal(pauses,beforePause);assert.equal(done,replacementDone);assert.equal(skips,1);
done();assert.equal(stage.dataset.phase,'complete');const completed=trace.length;
done();query.listener({matches:true});assert.equal(trace.length,completed);
assert.equal(skips,1,'Complete/idle phases must not invoke skip');
player.stop();
console.log('Reduced-motion binding PASS: announcement-first, deferred replacement event, current query authority, stale false-current no-op, midscene immediate finale and duplicate completion safety.');
