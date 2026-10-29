'use strict';
// Intentional contract: three original animation beats precede the complete
// owner image; skip/reduced motion reach that same complete presentation.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),scene=require('./election_night_celebration_scene.js');
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

const file=fs.readFileSync('assets/celebration-owner-abbott.jpg');assert.equal(file.length,371979);assert.equal(crypto.createHash('sha256').update(file).digest('hex'),'e9d6360032b79c75156b490aaf62bd9250479d54e4444225c5d6bc313dc29c3d');
const files={abbott:'abbott',graham:'graham',blansas:'kansas',mississippi:'mississippi'};let cases=0;
for(const reduced of [false,true])for(const [id,file]of Object.entries(files)){
 const {doc,media}=document(reduced),host=new Node('div',doc),art={url:'./assets/celebration-owner-'+file+'.jpg?v=deadbeef1234',alt:'Owner supplied fictional '+id+' art',aiGenerated:true};host.setAttribute('aria-hidden','true');
 scene.render(host,{id,phase:'announcement',ownerArtwork:art});assert.equal(host.hidden,true);assert.equal(host.children.length,0);
 for(const beat of [0,1,2]){scene.render(host,{id,phase:'scene',beat,preview:true,ownerArtwork:art});assert(find(host,node=>node.tagName==='svg'));assert.equal(find(host,node=>node.tagName==='img'),undefined);assert.equal(host.dataset.beat,String(beat));cases++;}
 scene.render(host,{id,phase:'complete',preview:true,ownerArtwork:art});const image=find(host,node=>node.tagName==='img'),caption=find(host,node=>node.tagName==='figcaption');assert.equal(image.getAttribute('src'),art.url);assert.equal(image.getAttribute('alt'),art.alt);assert.match(caption.textContent,/AI-GENERATED.*OWNER-SUPPLIED.*FICTIONAL.*SIMULATED PREVIEW.*NO REAL VICTORY CLAIM/);assert.equal(host.getAttribute('aria-hidden'),'false');assert.equal(host.dataset.celebrationScene,id);assert.equal(host.dataset.beat,'2');assert.equal(image.animations.length,0);assert.equal(media.listeners.size,1);cases++;
 image.emit('error');assert(find(host,node=>node.tagName==='svg'));assert.equal(find(host,node=>node.tagName==='img'),undefined);assert.equal(host.getAttribute('aria-hidden'),'true');assert.equal(image.listeners.get('error').size,0);cases++;
 scene.render(host,{id,phase:'complete',ownerArtwork:art});assert.equal(find(host,node=>node.tagName==='img'),undefined,'Known failure is not retried during the same playback');
 const changed={...art,url:art.url.replace('deadbeef1234','cafecafe5678')};scene.render(host,{id,phase:'complete',ownerArtwork:changed});assert.equal(find(host,node=>node.tagName==='img').getAttribute('src'),changed.url);
 scene.render(host,{id,phase:'complete',ownerArtwork:art});assert.equal(find(host,node=>node.tagName==='img'),undefined,'Returning to failed version keeps its failure state');
 scene.render(host,{id,phase:'announcement',ownerArtwork:art});scene.render(host,{id,phase:'complete',preview:false,ownerArtwork:art});assert(find(host,node=>node.tagName==='img'));assert.match(find(host,node=>node.tagName==='figcaption').textContent,/SOURCE-REPORTED CALL.*UNOFFICIAL/);cases++;
 scene.clear(host);assert.equal(host.hidden,true);assert.equal(host.children.length,0);assert.equal(media.listeners.size,0);assert.equal(host.getAttribute('aria-hidden'),'true');
 for(const bad of [null,{}, {url:'https://example.invalid/photo.jpg',alt:'outside'}, {url:'javascript:alert(1)',alt:'outside'}, {url:art.url+'?other=1',alt:'outside'}, {...art,alt:''}]){scene.render(host,{id,phase:'complete',ownerArtwork:bad});assert(find(host,node=>node.tagName==='svg'));assert.equal(find(host,node=>node.tagName==='img'),undefined);scene.clear(host);cases++;}
 for(const prior of [null,'true','false','']){if(prior!==null)host.setAttribute('aria-hidden',prior);else host.removeAttribute('aria-hidden');scene.render(host,{id,phase:'complete',ownerArtwork:art});scene.clear(host);assert.equal(host.hasAttribute('aria-hidden'),prior!==null);assert.equal(host.getAttribute('aria-hidden'),prior);cases++;}
 for(const replace of [false,true]){scene.render(host,{id,phase:'complete',ownerArtwork:art});const staleImage=find(host,node=>node.tagName==='img'),late=[...staleImage.listeners.get('error')][0];if(replace)scene.render(host,{id:'talarico',phase:'scene'});else scene.clear(host);const before=serialized(host);late();assert.equal(serialized(host),before);assert.equal(staleImage.listeners.get('error').size,0);scene.clear(host);cases++;}
 scene.render(host,{id,phase:'complete',ownerArtwork:art});const oldImage=find(host,node=>node.tagName==='img'),late=[...oldImage.listeners.get('error')][0];scene.render(host,{id,phase:'complete',ownerArtwork:art});const before=serialized(host);late();assert.equal(serialized(host),before,'Old image cannot replace a newer finale');scene.clear(host);cases++;
}
for(const [phase,beat,expected]of [['scene',0,'campaign-sign'],['scene',1,'voted-out-stamp'],['scene',2,'governor-victory-card'],['complete',0,'governor-victory-card']]){const {doc}=document(),host=new Node('div',doc);scene.render(host,{id:'abbott',phase,beat});assert(layer(host,expected),'No owner option preserves exact original SVG beat');scene.clear(host);}
{const {doc}=document(),host=new Node('div',doc);scene.render(host,{id:'talarico',phase:'complete',ownerArtwork:{url:'./assets/celebration-owner-abbott.jpg?v=deadbeef1234',alt:'Wrong story'}});assert(find(host,node=>node.tagName==='svg'));assert.equal(find(host,node=>node.tagName==='img'),undefined);}
console.log('Owner image finale PASS: '+cases+' focused contract cases; original bytes/animation-first/fullimage/AI-fiction/reduced-motion/ARIA/exactfallback/cache/retry/latefailure guards retained.');
