'use strict';
// Presentation-only fixture. No event admission, source request or model draw.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),scene=require('./election_night_celebration_scene.js');
class Node{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes=new Map();this.dataset={};this.hidden=false;this.textContent='';this.animations=[];}
 setAttribute(name,value){this.attributes.set(name,String(value));}
 getAttribute(name){return this.attributes.get(name)??null;}
 hasAttribute(name){return this.attributes.has(name);}
 removeAttribute(name){this.attributes.delete(name);}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 replaceChildren(...nodes){for(const node of this.children)node.parentElement=null;this.children=[];this.append(...nodes);}
 animate(frames,options){const animation={frames,options,cancelled:false,cancel(){this.cancelled=true;}};this.animations.push(animation);return animation;}
}
function fixture(reduced=false){const media={matches:reduced,listeners:new Set(),addEventListener(type,fn){this.listeners.add(fn);},removeEventListener(type,fn){this.listeners.delete(fn);},reduce(){this.matches=true;for(const fn of this.listeners)fn({matches:true});}};const doc={defaultView:{matchMedia:()=>media},createElementNS:(ns,tag)=>{assert.equal(ns,'http://www.w3.org/2000/svg');return new Node(tag,doc);}};return {host:new Node('div',doc),media};}
const all=(host,predicate)=>[...(predicate(host)?[host]:[]),...host.children.flatMap(node=>all(node,predicate))],layer=(host,name)=>all(host,node=>node.getAttribute('data-layer')===name),text=host=>all(host,node=>node.tagName==='text').map(node=>node.textContent).join(' | '),animations=host=>all(host,()=>true).flatMap(node=>node.animations);
let groups=0;
// Reversing only the new dispatch and marked function recovers every byte of
// all original11 scene bodies/shared props/owner-image lifecycle, normalized
// solely for cross-platform Git line endings. No runtime Git dependency.
{
 const source=fs.readFileSync(path.join(root,'scripts/election_night_celebration_scene.js'),'utf8').replace(/\r\n/g,'\n');
 const dispatch="  if(host&&id==='michigan'&&['scene','complete'].includes(phase))return renderMichigan(host,{phase,beat,preview});\n";
 assert.equal(source.split(dispatch).length,2);const before=source.replace(dispatch,'').replace(/ \/\/ BEGIN MICHIGAN ORIGINAL SCENE\n[\s\S]*? \/\/ END MICHIGAN ORIGINAL SCENE\n/,'');
 assert.equal(crypto.createHash('sha256').update(before).digest('hex'),'02c07efabb90fb3174071bb8ea696a72409246684a23a6a2ea875f683b78c3ae');groups++;
}
for(const reduced of [false,true])for(const preview of [true,false]){
 const {host,media}=fixture(reduced);assert.equal(scene.render(host,{id:'michigan',phase:'announcement',preview}),false);assert.equal(host.children.length,0);assert.equal(host.hidden,true);assert.equal(media.listeners.size,0);
 for(const beat of [0,1,2]){
  assert.equal(scene.render(host,{id:'michigan',phase:'scene',beat,preview}),true);assert.equal(host.hidden,false);assert.equal(host.dataset.celebrationScene,'michigan');assert.equal(host.dataset.beat,String(beat));assert.equal(media.listeners.size,1);
  const svg=host.children[0];assert.equal(svg.tagName,'svg');assert.equal(svg.getAttribute('viewBox'),'0 0 980 540');assert.equal(svg.getAttribute('role'),'img');assert.match(svg.getAttribute('aria-label'),/Michigan fear-campaign machine satire/);
  assert.match(text(host),/FICTIONAL POLITICAL SATIRE/);assert.match(text(host),preview?/SIMULATED PREVIEW.*NO REAL VICTORY CLAIM/:/SOURCE-REPORTED CALL.*UNOFFICIAL/);
  assert.equal(all(host,node=>['image','img','iframe','script','foreignObject'].includes(node.tagName)).length,0);assert.doesNotMatch(text(host),/Muslim|Islam|terrorist|Rogers|El-Sayed|mosque|martyr/i,'Joke targets an invented panicmachine without religious/family allegations or fake candidate speech');
  if(beat===0){assert.match(text(host),/PANICCAST/);assert.equal(layer(host,'michigan-fear-dial').length,1);assert.equal(layer(host,'michigan-megaphone').length,3);assert.equal(layer(host,'michigan-ballot-mute').length,0);}
  if(beat===1){assert.match(text(host),/MUTE/);assert.equal(layer(host,'michigan-ballot-mute').length,1);for(const horn of layer(host,'michigan-megaphone'))assert.match(horn.getAttribute('style'),/scale\(\.78,\.16\)/,'Static/reduced-motion beat already shows the deflated final pose');}
  if(beat===2){assert.match(text(host),/FEAR CAMPAIGN:.*SIGNAL LOST/);assert.match(text(host),/ERROR:.*VOTERS NOT SCARED/);assert.equal(layer(host,'michigan-blue-mitten').length,1);assert.equal(layer(host,'michigan-blue-confetti').length,1);}
  assert.equal(animations(host).length>0,!reduced);
 }
 const old=animations(host);assert.equal(scene.render(host,{id:'michigan',phase:'complete',beat:0,preview}),true);assert.equal(host.dataset.beat,'2');assert(old.every(animation=>animation.cancelled));assert.equal(animations(host).length,0,'Complete/skip snapshot is stable, not an unbounded animation');assert.match(text(host),/SIGNAL LOST/);
 scene.clear(host);assert.equal(host.hidden,true);assert.equal(host.children.length,0);assert.equal(media.listeners.size,0);assert.equal(host.getAttribute('data-celebration-scene'),null);groups++;
}
{
 const {host,media}=fixture();scene.render(host,{id:'michigan',phase:'scene',beat:1});const running=animations(host);assert(running.length>0);media.reduce();assert(running.every(animation=>animation.cancelled));assert.match(text(host),/MUTE/);scene.clear(host);assert.equal(media.listeners.size,0);groups++;
}
{
 const {host,media}=fixture();scene.render(host,{id:'michigan',phase:'scene',beat:0});const running=animations(host);scene.render(host,{id:'ohio',phase:'scene',beat:0});assert(running.every(animation=>animation.cancelled));assert.equal(host.dataset.celebrationScene,'ohio');assert.equal(layer(host,'michigan-panic-machine').length,0);assert.equal(media.listeners.size,1);scene.clear(host);groups++;
}
{
 const {host,media}=fixture();for(const beat of [-1,3,NaN,'1',null]){assert.equal(scene.render(host,{id:'michigan',phase:'scene',beat}),false);assert.equal(host.children.length,0);assert.equal(media.listeners.size,0);}assert.equal(scene.render(host,{id:'michigan',phase:'unknown'}),false);assert.equal(scene.render(null,{id:'michigan',phase:'scene'}),false);groups++;
}
{
 const asset=fs.readFileSync(path.join(root,'assets/milestone-michigan.svg'),'utf8');assert.match(asset,/<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*viewBox="0 0 980 620"/);assert.match(asset,/aria-labelledby="michigan-title michigan-desc"/);assert.match(asset,/<title id="michigan-title">FEAR CAMPAIGN: SIGNAL LOST<\/title>/);assert.match(asset,/<desc id="michigan-desc">[^<]*fictional Michigan political satire/i);assert.match(asset,/VOTERS NOT SCARED/);assert.match(asset,/MUTE/);assert.match(asset,/NOT A RESULTS MAP OR A WINNER CLAIM/);assert.doesNotMatch(asset,/<(?:script|image|iframe|foreignObject|audio|video)\b|(?:href|onload|onclick)\s*=|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i);const ids=[...asset.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);assert.deepEqual(ids,['michigan-title','michigan-desc']);groups++;
}
assert.deepEqual(Object.keys(scene).sort(),['clear','render'],'No new authority or fetch API');
console.log(JSON.stringify({status:'PASS',groups,original11_source_inverse_byte_exact:true,michigan_beats:3,preview_and_unofficial_call_labels:true,reduced_motion_and_clear:true,local_svg_only:true,event_admission_tested:false,model_draws:0,source_requests:0}));
