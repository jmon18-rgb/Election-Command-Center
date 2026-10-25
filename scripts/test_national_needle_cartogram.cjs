'use strict';
const assert=require('node:assert/strict');
const map=require('./national_needle_cartogram.js');

const coords=map.COORDS;
assert.equal(coords.length,50,'all 50 voting states');
assert.equal(new Set(coords.map(x=>x[0])).size,50,'no duplicate states');
assert.equal(new Set(coords.map(x=>x.slice(1).join(','))).size,50,'no overlapping tiles');
const senate=[{office:'senate',race_code:'NC-SEN',dem_beats_rep_pct:54.4},
 {office:'senate',race_code:'NE-SEN',dem_beats_rep_pct:60.2},
 {office:'senate',race_code:'OH-SEN',dem_beats_rep_pct:19.1,
  provider_called_party:'R'}];
const s=map.build(senate);
const by=(data,st)=>data.tiles.find(x=>x.state===st);
assert.equal(s.contested,3);
assert.equal(s.races,3);
assert.equal(by(s,'NC').band,'toss-up');
assert.equal(by(s,'OH').band,'lean-r');
assert.equal(by(s,'ME').band,'missing');
assert.match(map.display(by(s,'NE').race),/Independent\/D-side/);
assert.equal(by(s,'OH').race.provider_called_party,'R');

const house=[{office:'house',race_code:'NC-07',dem_beats_rep_pct:61},
 {office:'house',race_code:'NC-01',dem_beats_rep_pct:51.5},
 {office:'house',race_code:'NC-02',dem_beats_rep_pct:1},
 {office:'house',race_code:'AK-01',dem_beats_rep_pct:94},
 {office:'house',race_code:'NC-99',dem_beats_rep_pct:50},
 {office:'house',race_code:'NH-03',dem_beats_rep_pct:50},
 {office:'senate',race_code:'NC-SEN',dem_beats_rep_pct:50}];
const h=map.build(house,'house');
assert.equal(h.races,4,'valid exact districts only');
assert.equal(by(h,'NC').race.race_code,'NC-01','closest House race per state');
assert.equal(by(h,'AK').race.race_code,'AK-01','at large model district 01');
assert.equal(by(h,'NC').contests.length,3);
assert.equal(by(h,'NH').band,'missing');
assert.equal(map.normalize({office:'senate',race_code:'NC-SEN',
 dem_beats_rep_pct:101},'senate'),null);
assert.equal(map.normalize({office:'senate',race_code:'NC-SEN',
 dem_beats_rep_pct:40,provider_called_party:'unknown'},'senate').provider_called_party,null,
 'partial-vote lead cannot become a call');
assert.equal(map.normalize({office:'house',race_code:'CA-53',
 dem_beats_rep_pct:45},'house'),null,'current House district range');

class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.style={};
  this.events={};this.className='';this.textContent='';}
 append(...children){this.children.push(...children)}
 appendChild(el){this.children.push(el);return el}
 replaceChildren(...children){this.children=[...children]}
 setAttribute(k,v){this.attributes[k]=v}
 addEventListener(k,f){this.events[k]=f}
 get text(){return this.textContent+this.children.map(x=>x.text).join(' ')}
 descendants(){return [this,...this.children.flatMap(x=>x.descendants())]}
}
const document={createElement:tag=>new Element(tag)};
const host=new Element('section');
let opened=null;
map.render(host,senate,document,{available:true,modelAsOf:'2026-10-25',
 onOpen:race=>{opened=race.race_code}});
assert.equal(host.descendants().filter(x=>x.className.includes('en-nmap-state')).length,50);
const buttons=()=>host.descendants().filter(x=>x.tagName==='button');
assert.match(host.text,/No race \/ pending/);
assert.doesNotMatch(host.text,/Source-reported R winner flag/,'not preselected');
buttons().find(x=>x.attributes['aria-label']?.startsWith('OH, ')).events.click();
assert.match(host.text,/source-reported R winner flag/i);
buttons().find(x=>x.textContent==='Explore OH-SEN in model').events.click();
assert.equal(opened,'OH-SEN');
buttons().find(x=>x.textContent==='House tipping districts').events.click();
assert.match(host.text,/0 modeled House districts/,'do not carry Senate forecasts into House view');
assert.equal(host.__needleMode,'house');
map.render(host,house,document,{available:true});
buttons().find(x=>x.attributes['aria-label']?.startsWith('NC, ')).events.click();
assert.match(host.text,/NC-01/,'closest eligible House seat appears in detail');
map.render(host,house,document,{available:false});
assert.doesNotMatch(host.text,/NC-01/,'fail closed when current linked snapshot unavailable');
assert.match(host.text,/Linked model pending/);
assert.equal(host.__needleMode,'house','preserve mode across refresh');
console.log('national needle cartogram: 50 states, exact district keys, modes, model gating and DOM interactions passed');
