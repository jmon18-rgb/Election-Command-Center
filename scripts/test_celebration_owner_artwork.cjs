'use strict';
// Presentation/lifecycle contracts only. No call, image or audio is fabricated.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const scene=require('./election_night_celebration_scene.js');
class Node{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes=new Map();this.dataset={};this.listeners=new Map();this.hidden=false;this.textContent='';this.animations=[];}
 setAttribute(name,value){this.attributes.set(name,String(value));}
 getAttribute(name){return this.attributes.get(name)??null;}
 hasAttribute(name){return this.attributes.has(name);}
 removeAttribute(name){this.attributes.delete(name);}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 replaceChildren(...nodes){for(const node of this.children)node.parentElement=null;this.children=[];this.append(...nodes);}
 contains(target){return this===target||this.children.some(node=>node.contains(target));}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 emit(type){for(const fn of [...(this.listeners.get(type)||[])])fn({type});}
 animate(){const animation={cancelled:false,cancel(){this.cancelled=true;}};this.animations.push(animation);return animation;}
}
function document(reduced=false){
 const media={matches:reduced,listeners:new Set(),addEventListener(type,fn){this.listeners.add(fn);},removeEventListener(type,fn){this.listeners.delete(fn);}};
 const doc={defaultView:{matchMedia:()=>media},createElement:tag=>new Node(tag,doc),createElementNS:(ns,tag)=>new Node(tag,doc)};
 return {doc,media};
}
const find=(host,predicate)=>predicate(host)?host:host.children.map(node=>find(node,predicate)).find(Boolean);
const layer=(host,name)=>find(host,node=>node.getAttribute('data-layer')===name);
const serialized=host=>JSON.stringify({tag:host.tagName,attributes:[...host.attributes],text:host.textContent,children:host.children.map(serialized)});
const artwork={url:'assets/celebration-owner-abbott.jpg?v=ce0df48ef6a4',alt:'Owner-supplied AI-generated political satire showing Greg Abbott beside a fallen tree.'};
const file=fs.readFileSync('assets/celebration-owner-abbott.jpg');
assert.equal(file.length,371979,'Supplied artwork is retained without recompression or cropping');
assert.equal(crypto.createHash('sha256').update(file).digest('hex'),'e9d6360032b79c75156b490aaf62bd9250479d54e4444225c5d6bc313dc29c3d');

for(const reduced of [false,true])for(const phase of ['scene','complete'])for(const beat of [0,1,2]){
 const {doc,media}=document(reduced),host=new Node('div',doc);host.setAttribute('aria-hidden','true');
 assert.equal(scene.render(host,{id:'abbott',phase,beat,preview:true,ownerArtwork:artwork}),true);
 assert.equal(host.hidden,false);assert.equal(host.dataset.celebrationScene,'abbott');assert.equal(host.dataset.beat,String(phase==='complete'?2:beat));
 const image=find(host,node=>node.tagName==='img'),caption=find(host,node=>node.tagName==='figcaption');
 assert.equal(image.getAttribute('src'),artwork.url);assert.equal(image.getAttribute('alt'),artwork.alt);
 assert.match(caption.textContent,/AI-GENERATED.*FICTIONAL POLITICAL SATIRE.*SIMULATED PREVIEW.*NO REAL VICTORY CLAIM/);
 assert(layer(host,'owner-abbott-artwork'));assert.equal(find(host,node=>node.tagName==='svg'),undefined);
 assert.equal(host.getAttribute('aria-hidden'),'false','Artwork label and alt are exposed while displayed');
 assert.equal(image.animations.length,0,'Supplied image is presented unchanged without motion');
 assert.equal(media.listeners.size,1);
 scene.clear(host);assert.equal(host.hidden,true);assert.equal(host.children.length,0);assert.equal(media.listeners.size,0);
 assert.equal(host.getAttribute('aria-hidden'),'true','Clear restores prior accessibility state');
 assert.equal(image.listeners.get('error').size,0,'Clear detaches pending image failure handler');
}
for(const prior of [null,'true','false','']){
 const {doc}=document(),host=new Node('div',doc);if(prior!==null)host.setAttribute('aria-hidden',prior);
 scene.render(host,{id:'abbott',phase:'scene',ownerArtwork:artwork});scene.clear(host);
 assert.equal(host.hasAttribute('aria-hidden'),prior!==null);assert.equal(host.getAttribute('aria-hidden'),prior);
}

for(const [phase,beat,expected]of [['scene',0,'campaign-sign'],['scene',1,'voted-out-stamp'],['scene',2,'governor-victory-card'],['complete',0,'governor-victory-card']]){
 const {doc}=document(),host=new Node('div',doc);host.setAttribute('aria-hidden','true');
 scene.render(host,{id:'abbott',phase,beat,preview:false,ownerArtwork:artwork});
 assert.match(find(host,node=>node.tagName==='figcaption').textContent,/SOURCE-REPORTED CALL.*UNOFFICIAL/);
 const image=find(host,node=>node.tagName==='img');image.emit('error');
 assert(layer(host,expected),'Failure preserves original fallback at the same scene beat');
 assert.equal(find(host,node=>node.tagName==='img'),undefined);assert.equal(host.getAttribute('aria-hidden'),'true');
 assert.equal(host.dataset.beat,String(phase==='complete'?2:beat));assert.equal(image.listeners.get('error').size,0);
 scene.clear(host);
}
for(const [phase,beat,expected]of [['scene',0,'falling-tree'],['scene',1,'voted-out-stamp'],['complete',0,'governor-victory-card']]){
 const {doc}=document(),host=new Node('div',doc);scene.render(host,{id:'abbott',phase,beat});
 assert(layer(host,expected),'No owner option preserves the original SVG path');assert.equal(find(host,node=>node.tagName==='img'),undefined);
 scene.clear(host);
}
{
 const {doc}=document(),host=new Node('div',doc);host.setAttribute('aria-hidden','true');
 scene.render(host,{id:'abbott',phase:'scene',beat:0,ownerArtwork:artwork});find(host,node=>node.tagName==='img').emit('error');
 for(const [phase,beat,expected]of [['scene',1,'voted-out-stamp'],['scene',2,'governor-victory-card'],['complete',0,'governor-victory-card']]){
  scene.clear(host);scene.render(host,{id:'abbott',phase,beat,ownerArtwork:artwork});
  assert(layer(host,expected),'Known failed artwork uses the correct fallback synchronously on every later beat');
  assert.equal(find(host,node=>node.tagName==='img'),undefined,'No repeated image request/placeholder while the same playback continues');
 }
 const changed={...artwork,url:'assets/celebration-owner-abbott.jpg?v=deadbeef1234'};
 scene.render(host,{id:'abbott',phase:'scene',ownerArtwork:changed});assert.equal(find(host,node=>node.tagName==='img').getAttribute('src'),changed.url,'A changed artwork version may load immediately');
 scene.render(host,{id:'abbott',phase:'scene',ownerArtwork:artwork});assert(layer(host,'campaign-sign'),'Switching back does not forget that this URL failed during this playback');
 scene.render(host,{id:'abbott',phase:'announcement',ownerArtwork:artwork});scene.render(host,{id:'abbott',phase:'scene',ownerArtwork:artwork});
 assert.equal(find(host,node=>node.tagName==='img').getAttribute('src'),artwork.url,'A new announcement/playback retries the original artwork instead of caching failure permanently');
 scene.clear(host);
}
for(const bad of [null,{}, {url:'https://example.invalid/photo.jpg',alt:'outside'}, {url:'javascript:alert(1)',alt:'outside'}, {url:'assets/celebration-owner-abbott.jpg?other=1',alt:'outside'}, {url:artwork.url,alt:''}]){
 const {doc}=document(),host=new Node('div',doc);scene.render(host,{id:'abbott',phase:'scene',ownerArtwork:bad});
 assert(layer(host,'campaign-sign'),'Unsupported optional artwork uses the original scene, never an external request');
 scene.clear(host);
}
{
 const {doc}=document(),host=new Node('div',doc);scene.render(host,{id:'abbott',phase:'announcement',ownerArtwork:artwork});
 assert.equal(host.hidden,true);assert.equal(host.children.length,0,'Scene image cannot precede the announcement');
 scene.render(host,{id:'talarico',phase:'scene',ownerArtwork:artwork});assert.equal(host.dataset.celebrationScene,'talarico');assert.equal(find(host,node=>node.tagName==='img'),undefined,'Optional Abbott artwork does not replace another story');
}
for(const replace of [false,true]){
 const {doc}=document(),host=new Node('div',doc);scene.render(host,{id:'abbott',phase:'scene',ownerArtwork:artwork});
 const image=find(host,node=>node.tagName==='img'),late=[...image.listeners.get('error')][0];
 if(replace)scene.render(host,{id:'talarico',phase:'scene'});else scene.clear(host);
 const before=serialized(host);late();assert.equal(serialized(host),before,'Late image failure cannot repaint a cleared/replaced host');
 scene.clear(host);
}
{
 const {doc}=document(),host=new Node('div',doc);scene.render(host,{id:'abbott',phase:'scene',beat:0,ownerArtwork:artwork});
 const old=find(host,node=>node.tagName==='img'),late=[...old.listeners.get('error')][0];
 scene.render(host,{id:'abbott',phase:'complete',ownerArtwork:artwork});const before=serialized(host);late();assert.equal(serialized(host),before,'An old-beat failure cannot replace a newer owner-image finale');
 scene.clear(host);
}
console.log('Owner Abbott artwork: pinned original bytes, AI-fiction labels, announcement order, local-only option, exact-beat SVG fallback/later-beat failure cache/new-playback retry, reduced-motion/ARIA cleanup and stale-image guards PASS');
