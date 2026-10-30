#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('@media(max-width:620px){#electionNight .en-fish-bumper-side');
assert(start>0,'Expected small-screen Fish Head styling');
const end=html.indexOf('\n@media(prefers-reduced-motion:reduce)',start);
assert(end>start,'Fish mobile media-query terminator must exist');
const mobile=html.slice(start,end);
const image=mobile.match(/#electionNight \.en-fish-art img\{([^}]*)\}/)?.[1];
assert(image,'Fish image must have dedicated mobile presentation');
assert.match(image,/object-fit:\s*contain(?:;|$)/,
 'Mobile Fish Head image must fit in full, not crop mouth');
assert.doesNotMatch(image,/object-fit:\s*cover/,
 'No zooming that hides Fish Head mouth');
assert.match(image,/height:\s*auto/,
 'Intrinsic image ratio must be retained');
assert.match(image,/max-height:\s*min\(38dvh,260px\)/,
 'Viewport-constrained mobile image must fit above controls');
assert.match(mobile,/\.en-fish-screen-controls button\{width:100%\}/,
 'Mobile dismiss and replay controls must remain tappable');
// Owner explicitly restored the exact original image as a local static asset.
// Only the former remote-src sentinel changes; all containment/control checks
// above and the reduced-motion assertion below retain their original contract.
const originalBytes=fs.readFileSync(path.join(__dirname,'../assets/fish-head-original.jpg'));
const originalSource=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/fish-head-original.source.json'),'utf8'));
const originalSHA='d75b2b704124d775e880ad9a8b42d76a4816b8f3c23139578b7375ff7cc79c06';
const attribute=(tag,name)=>tag.match(new RegExp('\\b'+name+'="([^"]*)"'))?.[1];
function assertOriginalPhoto(markup,bytes,source){
 assert.equal(bytes.length,41844,'Retain the exact original image size');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),originalSHA,'Retain unchanged original JPEG bytes');
 assert.equal(source.file,'fish-head-original.jpg');assert.equal(source.bytes,41844);assert.equal(source.sha256,originalSHA);
 assert.equal(source.width,478);assert.equal(source.height,569);assert.equal(source.author,'HandyGames');
 assert.equal(source.original_url,'https://upload.wikimedia.org/wikipedia/commons/d/d4/Realistic_Fish_Head.jpg');
 assert.equal(source.source_file,'https://commons.wikimedia.org/wiki/File:Realistic_Fish_Head.jpg');
 assert.equal(source.license,'CC BY 3.0');assert.equal(source.license_url,'https://creativecommons.org/licenses/by/3.0/');
 assert.match(source.changes,/^None; exact JPEG bytes/);
 const originals=(markup.match(/<img\b[^>]*>/g)||[]).filter(tag=>/\bclass="[^"]*\ben-fish-still\b/.test(tag));
 assert.equal(originals.length,2,'Both announcement surfaces retain an original-image node');
 for(const tag of originals){assert.match(attribute(tag,'src'),/^\.\/assets\/fish-head-original\.jpg(?:\?v=[a-f0-9]+)?$/,'Use the LOCAL exact original, not a remote dependency or substitute');assert.equal(attribute(tag,'loading'),'eager');assert.match(attribute(tag,'alt'),/Fish Head/);}
 assert(originals.some(tag=>attribute(tag,'id')==='enCelebrationFish'),'Celebration original retains its phase-controlled image identity');
 for(const id of ['enFishTalking','enCelebrationFishTalking']){const wrapper=(markup.match(/<\w+\b[^>]*>/g)||[]).find(tag=>attribute(tag,'id')===id);assert(wrapper,id+' remains present');assert.equal(attribute(wrapper,'data-static-original'),'true');assert.equal(attribute(wrapper,'data-animate'),'false');}
 const credit=markup.match(/<p\b[^>]*class="en-fish-attribution"[^>]*>([\s\S]*?)<\/p>/)?.[1];assert(credit,'Original attribution remains available');assert.match(credit,/HandyGames.*CC BY 3\.0/);assert(credit.includes('href="'+source.source_file+'"'));assert(credit.includes('href="'+source.license_url+'"'));
 const clips=['enFishAudio','enCelebrationAnnouncement'].map(id=>(markup.match(/<audio\b[^>]*>/g)||[]).find(tag=>attribute(tag,'id')===id));
 for(const clip of clips)assert.equal(attribute(clip,'src'),'./assets/audio/breaking-news-in-the-2026-midterm-elections.mp3','Both surfaces retain the original native recording');
}
assertOriginalPhoto(html,originalBytes,originalSource);
// Bounded negative controls: an old remote src or an altered/re-encoded photo
// must fail this replacement sentinel. Inputs stay in RAM; production is intact.
const oldRemote=html.replace(/(src=")\.\/assets\/fish-head-original\.jpg(?:\?v=[a-f0-9]+)?/,'$1'+originalSource.original_url);
assert.throws(()=>assertOriginalPhoto(oldRemote,originalBytes,originalSource),/LOCAL exact original/);
const changedBytes=Buffer.from(originalBytes);changedBytes[changedBytes.length-1]^=1;
assert.throws(()=>assertOriginalPhoto(html,changedBytes,originalSource),/unchanged original JPEG bytes/);
assert.throws(()=>assertOriginalPhoto(html,originalBytes,{...originalSource,license:'UNESTABLISHED'}));
assert.match(html,/@media\(prefers-reduced-motion:reduce\)\{#electionNight \.en-fish-stage\{animation:none\}\}/,
 'Respect reduced motion');
console.log('Mobile Fish Head full-mouth containment and screen controls PASS; exact local original JPEG, both nodes/native recordings, source/license and negative controls retained');
