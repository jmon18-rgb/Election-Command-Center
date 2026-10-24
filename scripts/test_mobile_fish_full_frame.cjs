#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
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
assert.match(html,/https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/d\/d4\/Realistic_Fish_Head\.jpg/,
 'Preserve the attributed Fish Head original still');
assert.match(html,/@media\(prefers-reduced-motion:reduce\)\{#electionNight \.en-fish-stage\{animation:none\}\}/,
 'Respect reduced motion');
console.log('Mobile Fish Head full-mouth containment and screen controls PASS');
