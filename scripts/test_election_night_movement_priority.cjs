'use strict';
// Focused source/DOM mechanics only. No app bootstrap, worker, network or vote inference.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
// Minimal element fixture only. Native DOM/keyboard/geometry are verified by the separate browser fixture.
class ElementFixture{
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.className='';this.id='';this.hidden=false;this.attributes={};this.value='';}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.value='';this.children=[...nodes];}
 set textContent(value){this.value=String(value);this.children=[];}
 get textContent(){return this.value+this.children.map(x=>x.textContent).join('');}
 setAttribute(name,value){this.attributes[name]=String(value);}
 getAttribute(name){return this.attributes[name]??null;}
 querySelectorAll(selector){const all=[];const walk=node=>{for(const child of node.children){all.push(child);walk(child);}};walk(this);
  const simple=(n,s)=>s.startsWith('#')?n.id===s.slice(1):s.startsWith('.')?n.className.split(' ').includes(s.slice(1)):n.tagName===s.toUpperCase();
  const patterns=selector.split(',').map(s=>s.trim());return all.filter(n=>patterns.some(s=>{const parts=s.split(' ');if(parts.length===1)return simple(n,s);return parts.length===2&&simple(n,parts[1])&&all.some(parent=>simple(parent,parts[0])&&parent.querySelectorAll(parts[1]).includes(n));}));
 }
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
class MechanicsDOM{
 constructor(){const body=new ElementFixture('body'),box=new ElementFixture('div'),feed=new ElementFixture('div');box.id='enActivityBox';feed.id='enActivityFeed';box.append(feed);body.append(box);
  const document={body,createElement:tag=>new ElementFixture(tag),querySelector:s=>body.querySelector(s),querySelectorAll:s=>body.querySelectorAll(s)};this.window={document,close(){}};
 }
}

let ROOT=__dirname;while(!fs.existsSync(path.join(ROOT,'index.html'))){const parent=path.dirname(ROOT);assert.notEqual(parent,ROOT);ROOT=parent;}
const args={'--index':path.join(ROOT,'index.html'),'--bridge':path.join(ROOT,'scripts/house_at_large_bridge.js'),'--output':path.join(ROOT,'artifacts/readiness/movement-priority-mechanics-'+Date.now()+'.json')},seen=new Set();for(let i=2;i<process.argv.length;i++){const k=process.argv[i];assert(['--index','--bridge','--output'].includes(k));assert(!seen.has(k)&&process.argv[i+1]);seen.add(k);args[k]=path.resolve(process.argv[++i]);}
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),text=p=>fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
// Exact retained4c22 function blocks, not a copied website or a runtime ignored-file dependency.
const base="\nfunction enCompareSnapshots(previous,next){\n if(!previous||!next||previous.year!==2026||next.year!==2026||\n   previous.office!==next.office)return [];\n const changes=[];\n for(const [id,r] of Object.entries(next.races||{})){\n  const old=previous.races?.[id];\n  if(!old&&r.total<=0)continue;\n  const delta=r.total-(old?.total||0);\n  const previousLeader=enCurrentLeader(old),nextLeader=enCurrentLeader(r);\n  const leaderChanged=Boolean(previousLeader&&nextLeader&&previousLeader.p!==nextLeader.p);\n  const oldCands=new Map((old?.cands||[]).map(c=>[c.n+'|'+c.p,c.v]));\n  const candidateChanged=Boolean(old)&&\n   (r.cands.length!==old.cands.length||r.cands.some(c=>oldCands.get(c.n+'|'+c.p)!==c.v));\n  if(old&&delta===0&&!candidateChanged&&!leaderChanged)continue;\n  changes.push({at:next.as_of,key:id,office:next.office,\n    prior:old?.total||0,current:r.total,delta,\n    newRace:!old||(old.total===0&&r.total>0),leaderChanged,candidateChanged,\n    fingerprint:r.cands.map(c=>[c.n,c.p,c.v].join(':')).sort().join(',')});\n }\n for(const [id,r] of Object.entries(previous.races||{})){\n  if(r.total>0&&!Object.prototype.hasOwnProperty.call(next.races,id))\n   changes.push({at:next.as_of,key:id,office:next.office,prior:r.total,current:null,\n     delta:0,withdrawn:true,leaderChanged:false,newRace:false});\n }\n return changes.sort((a,b)=>Number(b.withdrawn)-Number(a.withdrawn)||\n   Number(b.leaderChanged)-Number(a.leaderChanged)||\n   Number(b.newRace)-Number(a.newRace)||Math.abs(b.delta)-Math.abs(a.delta)).slice(0,30);\n}\n/* Browser-local interruption recovery:\n\nfunction enResumeMovementValid(row){\n return Boolean(row&&['House','Senate','Governor'].includes(row.office)&&\n  typeof row.key==='string'&&row.key.length<=30&&\n  (row.office==='House'?/^[A-Z]{2}-\\d{2}$/.test(row.key):\n   row.office==='Senate'?/^[A-Z]{2}(?:-special)?$/.test(row.key):\n   /^[A-Z]{2}$/.test(row.key))&&\n  Number.isSafeInteger(row.prior)&&row.prior>=0&&\n  (row.current===null||Number.isSafeInteger(row.current)&&row.current>=0)&&\n  Number.isSafeInteger(row.delta)&&\n  ['newRace','leaderChanged','candidateChanged','withdrawn'].every(k=>\n    row[k]===undefined||typeof row[k]==='boolean')&&\n  (row.at===null||typeof row.at==='string'&&row.at.length<=60)&&\n  (row.fingerprint===undefined||typeof row.fingerprint==='string'&&row.fingerprint.length<=2500));\n}\nfunction enResumeSave(){\n if(Date.now()<Date.parse('2026-11-03T05:00:00Z'))return false;\n const snapshots=Object.create(null);\n for(const office of ['House','Senate','Governor']){\n  const d=enOfficeSnapshots[office];\n  if(d&&enSourceValid(d,2026,office))snapshots[office]=d;\n }\n if(!Object.keys(snapshots).length)return false;\n const movements=enMovements.filter(enResumeMovementValid).slice(0,70);\n const envelope={schema_version:1,election:'2026-11-03',\n   saved_at:new Date(Date.now()).toISOString(),snapshots,movements};\n try{\n  const value=JSON.stringify(envelope);\n  if(value.length>850000)return false;\n  localStorage.setItem(enResumeKey,value);\n  return true;\n }catch{return false}\n}\nfunction enResumeRestore(){\n try{\n  if(Date.now()<Date.parse('2026-11-03T05:00:00Z'))return false;\n  const raw=localStorage.getItem(enResumeKey);\n  if(!raw||raw.length>850000)return false;\n  const doc=JSON.parse(raw),time=Date.parse(doc?.saved_at||'');\n  if(doc?.schema_version!==1||doc.election!=='2026-11-03'||\n    !Number.isFinite(time)||time>Date.now()+60000||\n    Date.now()-time>enResumeWindowMs||\n    !doc.snapshots||Array.isArray(doc.snapshots)||\n    typeof doc.snapshots!=='object'||\n    !Array.isArray(doc.movements)||doc.movements.length>70)return false;\n  const offices=Object.keys(doc.snapshots);\n  if(!offices.length||offices.length>3||\n    !offices.every(office=>['House','Senate','Governor'].includes(office)&&\n      enSourceValid(doc.snapshots[office],2026,office))||\n    !doc.movements.every(enResumeMovementValid))return false;\n  // Atomic restore: no partially trusted office payload survives validation.\n  const hydrated=Object.create(null);\n  for(const office of offices)hydrated[office]=doc.snapshots[office];\n  enOfficeSnapshots=hydrated;\n  enMovements=doc.movements.slice(0,70);\n  enRestoredAt=doc.saved_at;\n  enResumePendingOffices=new Set(offices);\n  if(enModeYear===2026)enData=enOfficeSnapshots[enOffice]||null;\n  return true;\n }catch{return false}\n}\n\nfunction enSnapshotCompatible(\n\nfunction enBuildActivityCsv(events=enMovements){\n const records=[['source','election_year','office','race','event_at',\n   'event','votes_before','votes_after','net_vote_change','lead_changed',\n   'candidate_votes_revised','source_note',...(window.OfficialAdmissionAudit?.headers||[])]];\n for(const event of (Array.isArray(events)?events:[]).filter(enResumeMovementValid)){\n  const kind=event.withdrawn?'REMOVED FROM SOURCE':\n   event.leaderChanged?'VOTE LEAD FLIPPED':\n   event.newRace?'FIRST VOTES':\n   event.delta<0?'NET DOWNWARD REVISION':\n   event.delta>0?'MORE VOTES REPORTED':'CANDIDATE VOTES REVISED';\n  records.push(['Open America',2026,event.office,event.key,event.at||'',\n   kind,event.prior,event.current,event.delta,\n   event.leaderChanged?'YES':'NO',event.candidateChanged?'YES':'NO',\n   'Observed in this browser, not official certification']);\n }\n for(const row of enOfficialAdmissionAudit?.csvRows()||[])records.push(row);\n return records.length>1?enCsv(records.map(row=>[...row,...Array(Math.max(0,records[0].length-row.length)).fill('')])):'';\n}\nfunction enRenderExportControls(\n\nfunction enRenderMovement(){\n const host=$('#enActivityFeed');host.replaceChildren();\n $('#enActivityBox').hidden=enModeYear!==2026;\n if(enModeYear!==2026)return;\n if(!enMovements.length){\n  host.append(elt('div','en-message','No changes between 2026 snapshots observed in this browser session yet. Live updates are not replayed retroactively.'));\n  return;\n }\n const visible=enMovements.filter(x=>x.office===enOffice).slice(0,8);\n if(!visible.length){host.append(elt('div','en-message','No new reporting movements in this office yet.'));return}\n for(const x of visible){\n  const row=elt('div','en-activity-item'),heading=elt('strong','',x.key+(x.withdrawn?' · REMOVED FROM FEED':'')+(x.newRace?' · NEW REPORTING':'')+(x.leaderChanged?' · LEAD CHANGED':'')),\n    diff=elt('span',x.delta<0?'en-revision':'',x.withdrawn?'Race no longer present in the source; do not count its old votes as a zero':\n      x.newRace?x.current.toLocaleString()+' first reported votes':\n      x.delta<0?Math.abs(x.delta).toLocaleString()+' votes revised downward':\n      x.delta>0?'+'+x.delta.toLocaleString()+' recorded votes since prior update':\n      'Candidate totals revised; total ballots unchanged');\n  row.append(heading,diff);host.append(row);\n }\n}\n\nfunction enCurrentRaces(";
const html=text(args['--index']),bridge=require(args['--bridge']);
function extract(s,a,b){const i=s.indexOf('\n'+a),j=s.indexOf('\n'+b,i+1);assert(i>=0&&j>i);return s.slice(i+1,j);}
const movement=extract(html,'// Display-only movement order.','function enCurrentRaces('),legacy=extract(base,'function enRenderMovement(','function enCurrentRaces(');
const producer=extract(html,'function enCompareSnapshots(','/* Browser-local interruption recovery:');
const rawCSV=extract(html,'function enBuildActivityCsv(','function enRenderExportControls(');
for(const [a,b]of [['function enCompareSnapshots(','/* Browser-local interruption recovery:'],['function enResumeMovementValid(','function enSnapshotCompatible('],['function enBuildActivityCsv(','function enRenderExportControls(']])assert.equal(extract(html,a,b),extract(base,a,b));
const shared=[
 extract(html,'function enHouseSourceItem(','function enLiveRaceItem('),
 extract(html,'function enWatchId(','function enWatchLoad('),
 extract(html,'function enLeaders(','function enCurrentLeader('),
 extract(html,'function enCurrentLeader(','function enLeadInfo('),
 extract(html,'function enResumeMovementValid(','function enResumeSave('),
 extract(html,'function enCsvCell(','// CSV is another public-facing'),
 producer,rawCSV
].join('\n');
const groups=[],forbidden=[];
function check(name,fn){fn();groups.push(name);}
function setup(renderer){
 const dom=new MechanicsDOM(),document=dom.window.document;
 const state={ranked:[],rankCalls:0};
 const trap=name=>(..._)=>{forbidden.push(name);throw Error('Forbidden action '+name);};
 const ctx=vm.createContext({document,window:{HouseAtLargeBridge:bridge},$:(s)=>document.querySelector(s),
  elt:(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n;},
  smartRaceRanked:()=>{state.rankCalls++;return state.ranked;},enMovements:[],enOffice:'House',enModeYear:2026,enOfficialAdmissionAudit:null,
  fetch:trap('fetch'),Worker:trap('Worker'),jointSimulate:trap('model'),setTimeout:trap('timer'),setInterval:trap('timer'),localStorage:{setItem:trap('storage')},
  Math:Object.assign(Object.create(Math),{random:trap('RNG')})});
 vm.runInContext(shared+'\n'+renderer,ctx);return{dom,document,ctx,state,keys:()=>[...document.querySelectorAll('.en-activity-item strong')].map(n=>n.textContent.split(' · ')[0])};
}
const f=setup(movement),old=setup(legacy),plain=x=>JSON.parse(JSON.stringify(x));
const event=(key,extra={})=>({office:'House',key,at:'2026-11-04T02:00:00Z',prior:100,current:101,delta:1,newRace:false,leaderChanged:false,candidateChanged:true,...extra});
const row=(key,score,office='House')=>({office,key,editorScore:score});
const snapshot=(time,races)=>({year:2026,office:'House',as_of:time,races});
const race=(d,r)=>({total:d+r,cands:[{n:'D candidate',p:'D',v:d},{n:'R candidate',p:'R',v:r}]});
const producerFacts={};
check('Actual producer field origin and overlapping revision/lead tiers',()=>{
 const prior=snapshot('2026-11-04T01:00:00Z',{'MI-07':race(60,40)}),at='2026-11-04T01:05:00Z';
 const same=f.ctx.enCompareSnapshots(prior,snapshot(at,{'MI-07':race(40,60)}))[0];
 assert.equal(same.at,at);assert.equal(same.delta,0);assert.equal(same.candidateChanged,true);assert.equal(same.leaderChanged,true);assert.equal(f.ctx.enMovementPriorityTier(same),0);
 const down=f.ctx.enCompareSnapshots(prior,snapshot(at,{'MI-07':race(40,50)}))[0];assert(down.delta<0);assert.equal(f.ctx.enMovementPriorityTier(down),0);
 const withdrawn=f.ctx.enCompareSnapshots(prior,snapshot(at,{}))[0];assert.equal(withdrawn.withdrawn,true);assert.equal(f.ctx.enMovementPriorityTier(withdrawn),0);
 const flipped=f.ctx.enCompareSnapshots(prior,snapshot(at,{'MI-07':race(60,80)}))[0];assert(flipped.delta>0);assert.equal(flipped.leaderChanged,true);assert.equal(f.ctx.enMovementPriorityTier(flipped),1);
 const first=f.ctx.enCompareSnapshots(snapshot(prior.as_of,{'MI-07':race(0,0)}),snapshot(at,{'MI-07':race(60,40)}))[0];assert.equal(first.newRace,true);assert.equal(f.ctx.enMovementPriorityTier(first),2);
 const added=f.ctx.enCompareSnapshots(prior,snapshot(at,{'MI-07':race(70,45)}))[0];assert.equal(f.ctx.enMovementPriorityTier(added),3);
 assert.equal(f.ctx.enCompareSnapshots(prior,snapshot(at,prior.races)).length,0);
 Object.assign(producerFacts,{record_at_is_next_as_of:true,delta0_can_also_change_leader:true,prior_zero_to_positive_is_first_reporting:true,no_timestamp_only_event:true});
});
check('Tier precedence beats age and current race score',()=>{
 const events=[event('MI-01',{at:'2026-11-04T05:00:00Z'}),event('MI-02',{newRace:true,at:'2026-11-04T04:00:00Z'}),event('MI-03',{leaderChanged:true,at:'2026-11-04T03:00:00Z'}),event('MI-04',{delta:-1,at:'2026-11-04T01:00:00Z'})];
 const actual=f.ctx.enPriorityMovementEvents(events,'House',[row('MI-01',1000000)]);assert.deepEqual(Array.from(actual,x=>x.key),['MI-04','MI-03','MI-02','MI-01']);
});
check('Within-tier valid newest time precedes exact editorScore then stable original order',()=>{
 const events=[event('MI-01',{at:null}),event('MI-02',{at:'not-a-time'}),event('MI-03'),event('MI-04'),event('MI-05',{at:'2026-11-04T03:00:00Z'}),event('MI-06')];
 const ranked=[row('MI-01',99999),row('MI-03',20),row('MI-04',30),row('MI-06',30)];
 assert.deepEqual(Array.from(f.ctx.enPriorityMovementEvents(events,'House',ranked),x=>x.key),['MI-05','MI-04','MI-06','MI-03','MI-01','MI-02']);
 assert.deepEqual(Array.from(f.ctx.enPriorityMovementEvents([event('MI-03'),event('MI-04')],'House',[row('MI-03',NaN),row('MI-04',Infinity)]),x=>x.key),['MI-03','MI-04']);
});
check('Exact existing House at-large, office and special-seat identity',()=>{
 assert.equal(bridge.sourceKey('AK-01'),'AK-00');
 const events=[event('MI-07'),event('AK-00')];
 assert.deepEqual(Array.from(f.ctx.enPriorityMovementEvents(events,'House',[row('AK-01',100),row('MI-07',50),row('MI-07',999,'Senate')]),x=>x.key),['AK-00','MI-07']);
 const senate=[event('FL',{office:'Senate'}),event('FL-special',{office:'Senate'})];
 assert.deepEqual(Array.from(f.ctx.enPriorityMovementEvents(senate,'Senate',[row('FL',999,'Governor'),row('FL-special',20,'Senate')]),x=>x.key),['FL-special','FL']);
 assert.equal(f.ctx.enPriorityMovementEvents(senate,'House',[]).length,0);
 const saved=f.ctx.window.HouseAtLargeBridge;f.ctx.window.HouseAtLargeBridge=null;assert.deepEqual(Array.from(f.ctx.enPriorityMovementEvents(events,'House',[row('AK-00',20)]),x=>x.key),['AK-00','MI-07']);f.ctx.window.HouseAtLargeBridge=saved;
});
const routine=Array.from({length:69},(_,i)=>event('MI-'+String(i%13+1).padStart(2,'0'),{at:new Date(Date.parse('2026-11-04T05:00:00Z')-i*60000).toISOString(),prior:100+i,current:101+i}));
const critical=event('MI-14',{at:'2026-11-04T01:00:00Z',withdrawn:true,delta:0,current:null});
const chronological=[...routine,critical],before=JSON.stringify(chronological);
check('Original-window counterexample and priority cap8 without changing any stored event',()=>{
 old.ctx.enMovements=chronological;old.ctx.enRenderMovement();assert.equal(old.keys().includes('MI-14'),false,'Actual old renderer misses older withdrawal behind69 routine events');
 f.ctx.enMovements=chronological;f.ctx.enRenderMovement();assert.equal(f.keys().length,8);assert.equal(f.keys()[0],'MI-14');assert.equal(JSON.stringify(chronological),before);assert.equal(f.ctx.enMovements,chronological);
 assert.equal(chronological.length,70);for(let i=0;i<chronological.length;i++)assert.equal(f.ctx.enMovements[i],chronological[i]);
});
check('CSV bytes and chronological/resume source order remain unchanged',()=>{
 old.ctx.enMovements=chronological;f.ctx.enMovements=chronological;
 assert.equal(f.ctx.enBuildActivityCsv(),old.ctx.enBuildActivityCsv());assert.equal(JSON.stringify(chronological),before);
 const csv=f.ctx.enBuildActivityCsv();assert(csv.indexOf('"MI-01"')<csv.indexOf('"MI-14"'),'Priority display never reorders CSV');
 assert.equal(chronological.filter(x=>f.ctx.enResumeMovementValid(x)).length,70);
 const repeated=[event('MI-07',{delta:-1,at:'2026-11-04T01:00:00Z'}),event('MI-07',{delta:0,at:'2026-11-04T02:00:00Z'})];
 assert.equal(f.ctx.enPriorityMovementEvents(repeated,'House',[]).length,2,'Distinct historical events for a race are not deduplicated');
});
check('Actual renderer retains raw wording, displays priority hint and exact record timestamp safely',()=>{
 f.ctx.enMovements=[event('MI-07',{delta:0,at:'2026-11-04T02:00:00-05:00'}),event('MI-08',{at:null}),event('MI-09',{at:'<img src=x onerror=bad()>'})];f.ctx.enOffice='House';f.ctx.enRenderMovement();
 const host=f.document.querySelector('#enActivityFeed');assert(host.textContent.includes('Priority order: revisions, lead changes, first reports, added votes.'));
 assert(host.textContent.includes('Candidate totals revised; total ballots unchanged'));assert(host.textContent.includes('Snapshot record time · 2026-11-04T02:00:00-05:00'));
 assert.equal(host.querySelector('time').getAttribute('datetime'),'2026-11-04T02:00:00-05:00');assert.equal(host.querySelectorAll('small').length,2);assert(host.textContent.includes('Snapshot record time unknown'));
 assert.equal(host.querySelectorAll('img,script,iframe').length,0);assert(!/winner|elected|called|probability/i.test(host.textContent),'Movement display does not invent calls or forecasts');
});
check('Empty/current-office/archive behavior and native output stay bounded',()=>{
 f.ctx.enMovements=[];f.ctx.enRenderMovement();assert(f.document.body.textContent.includes('No changes between 2026 snapshots'));assert(!f.document.body.textContent.includes('Priority order'));
 f.ctx.enMovements=[event('TX',{office:'Governor'})];f.ctx.enRenderMovement();assert(f.document.body.textContent.includes('No new reporting movements in this office yet.'));
 const calls=f.state.rankCalls;f.ctx.enModeYear=2024;f.ctx.enRenderMovement();assert.equal(f.document.querySelector('#enActivityBox').hidden,true);assert.equal(f.state.rankCalls,calls);assert.equal(f.document.querySelector('#enActivityFeed').children.length,0);
 f.ctx.enModeYear=2026;f.ctx.enOffice='Governor';f.ctx.enRenderMovement();assert.equal(f.document.querySelector('#enActivityBox').hidden,false);assert.deepEqual(f.keys(),['TX']);
});
check('No model/source/storage/timer/RNG side effects in exercised extracted functions',()=>{
 assert.deepEqual(forbidden,[]);assert.equal(JSON.stringify(chronological),before);
});
const result={status:'PASS_FOCUSED_SOURCE_AND_ELEMENT_MECHANICS_NOT_NATIVE_BROWSER_ACCEPTANCE',at:new Date().toISOString(),groups,source:{candidate:{path:args['--index'],sha256:sha(fs.readFileSync(args['--index']))},baseline:{kind:'Embedded exact original4c22 function blocks only',sha256:sha(Buffer.from(base))},bridge:{path:args['--bridge'],sha256:sha(fs.readFileSync(args['--bridge']))},producer_source_sha256:sha(Buffer.from(producer)),renderer_source_sha256:sha(Buffer.from(movement)),legacy_renderer_source_sha256:sha(Buffer.from(legacy))},producer_facts:producerFacts,old_counterexample:{old_actual_renderer_omits_older_withdrawal:true,candidate_first_row_is_same_withdrawal:true,stored_events:70,display_rows:8},protected_contract:{raw_events_identity_and_values:true,CSV_bytes_and_order_exact:true,resume_comparison_sources_unchanged:true,no_call_events_or_statistical_thresholds:true},activity:{network_requests:0,worker_runs:0,model_draws:0,tracked_mutations:0,source_or_queue_admissions:0},limits:['Synthetic mechanics and extracted actual producer/renderer with minimal element fixture; no native DOM, physical geometry or accepted3k output claim','Rank inputs are explicit mechanical current-score fixtures; production uses existing smartRaceRanked read path','Timestamp is retained next.as_of record data, not newly verified publication or client observation time']};
fs.mkdirSync(path.dirname(args['--output']),{recursive:true});fs.writeFileSync(args['--output'],JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,groups:groups.length,proof:{path:args['--output'],sha256:sha(fs.readFileSync(args['--output']))},source:result.source,activity:result.activity}));
f.dom.window.close();old.dom.window.close();
