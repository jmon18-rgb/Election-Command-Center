const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const api=require('./election_night_live_coverage_506');
const ledger=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../data/election_night_source_coverage.json'),'utf8'));
const now=Date.parse('2026-11-04T00:45:00Z');
const absent=api.audit(ledger,{}, {},now);
assert.equal(absent.ready,true);
assert.deepEqual([absent.offices.House.total,absent.offices.Senate.total,absent.offices.Governor.total],[435,35,36]);
assert.equal(absent.senate.length,35);
assert.equal(absent.current_races_observed,0);
assert.equal(absent.offices.Senate.recent,0);
assert.equal(absent.offices.Senate.by_status.PRIMARY_NOT_LOADED,15);
assert.equal(absent.offices.Senate.by_status.SECONDARY_SOURCE_ID_UNKNOWN,2);
assert.equal(absent.missing_is_zero_votes,false);
assert.equal(absent.may_move_national_needle,false);
const snap=(office,races,as_of='2026-11-04T00:30:00Z')=>({
 api:1,year:2026,office,source:'state',as_of,races,stale:false});
const observed={Senate:snap('Senate',{
 NC:{total:100,called:false,cands:[{n:'A',p:'D',v:60},{n:'B',p:'R',v:40}]},
 GA:{total:0,called:false,cands:[]}
})};
const civic={
 'Senate|ME':{
 provider:'civicAPI',office:'Senate',key:'ME',race_id:87188,
 total:120,last_updated:'2026-11-04T00:30:00Z',
 source_url:'https://civicapi.org/api/v2/race/87188',
 candidates:[{name:'A',party:'D',votes:70},{name:'B',party:'R',votes:50}]
 }};
const live=api.audit(ledger,observed,civic,now);
assert.equal(live.ready,true);
assert.equal(live.current_races_observed,2);
assert.equal(live.offices.Senate.recent,2);
const senate=Object.fromEntries(live.senate.map(x=>[x.race,x.status]));
assert.equal(senate['Senate|NC'],'PRIMARY_OBSERVED_RECENT');
assert.equal(senate['Senate|GA'],'PRIMARY_PUBLISHED_NO_VOTES');
assert.equal(senate['Senate|ME'],'SECONDARY_OBSERVED_RECENT');
assert.equal(senate['Senate|MA'],'SECONDARY_SOURCE_ID_UNKNOWN');
assert.equal(senate['Senate|MS'],'SECONDARY_SOURCE_ID_UNKNOWN');
const late=api.audit(ledger,observed,civic,now+4*3600000);
assert.equal(late.offices.Senate.recent,0);
assert.equal(Object.fromEntries(late.senate.map(x=>[x.race,x.status]))['Senate|NC'],
 'PRIMARY_OBSERVED_STALE');
assert.equal(api.audit(ledger,{Senate:{...observed.Senate,stale:true}},civic,now).offices.Senate.recent,1);
assert.equal(api.audit(ledger,{Senate:snap('House',{NC:{total:100,called:false,cands:[]}})},civic,now).offices.Senate.recent,1);
const forged={...ledger,races:ledger.races.slice()};
forged.races[1]={...forged.races[1],id:forged.races[0].id};
assert.equal(api.audit(forged,observed,civic,now).ready,false);
assert.equal(api.audit({...ledger,races:ledger.races.slice(1)},observed,civic,now).ready,false);
function node(tag){return {tag,children:[],textContent:'',appendChild(n){this.children.push(n)},replaceChildren(){this.children=[]}}}
const summary=node('p'),details=node('div');
assert(api.render(summary,details,live,{createElement:node}));
assert.match(summary.children[0].textContent,/Senate 2\/35/);
assert.equal(details.children.length,36);
assert(details.children.some(x=>x.children[0]?.textContent==='NC'));
assert(!summary.children[0].textContent.includes('0 votes cast'));
console.log('506-race source-observed live coverage: exact identities, 35 Senate, stale and unknown distinctions passed');
