/* Soundtrack metadata and exact owner-requested site recording references.
 * No fetch, downloads, inferred license terms or winner eligibility here. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.ElectionNightCelebrationMusicChoices=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const CHOICES=Object.freeze(Object.fromEntries(Object.entries({
  "talarico": {
    "id": "talarico",
    "title": "The Eyes of Texas",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Blue stadium fanfare",
    "hint": "Built into the site; no import is needed. Your saved local file plays first; otherwise this site recording plays, with the original score as fallback."
  },
  "abbott": {
    "id": "abbott",
    "title": "Walk This Way",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "The campaign-sign exit march",
    "hint": "Built into the site; no import is needed. Your saved local file plays first; otherwise this site recording plays, with the original score as fallback."
  },
  "graham": {
    "id": "graham",
    "title": "Last Dance",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Last-call disco",
    "hint": "Built into the site; no import is needed. Your saved local file plays first; otherwise this site recording plays, with the original score as fallback."
  },
  "blansas": {
    "id": "blansas",
    "title": "John Brown’s Body",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Prairie fife and drum",
    "hint": "Built into the site; no import is needed. Your saved local file plays first; otherwise this site recording plays, with the original score as fallback."
  },
  "nebraska": {
    "id": "nebraska",
    "title": "Sideline brass and halftime bass",
    "artist": "Project original",
    "kind": "ORIGINAL_CUE",
    "fallback": "Sideline brass and halftime bass",
    "hint": "This original score is already available. Choose your own audio to replace it."
  },
  "mississippi": {
    "id": "mississippi",
    "title": "Union Dixie Trap",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Blue-river brass shuffle",
    "hint": "Built into the site; no import is needed. Your saved local file plays first; otherwise this site recording plays, with the original score as fallback."
  },
  "blue_corn": {
    "id": "blue_corn",
    "title": "It’s Corn",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Electric harvest two-step",
    "hint": "Built into the site; no import is needed. Your saved local file plays first; otherwise this site recording plays, with the original score as fallback."
  },
  "maine": {
    "id": "maine",
    "title": "Ding-Dong! The Witch Is Dead",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Broom-and-bells sendoff",
    "hint": "Built into the site; no import is needed. Your saved local file plays first; otherwise this site recording plays, with the original score as fallback."
  },
  "ohio": {
    "id": "ohio",
    "title": "Buckeye Battle Cry",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Buckeye blue-shock riff",
    "hint": "Built into the site; no import is needed. Your saved local file plays first; otherwise this site recording plays, with the original score as fallback."
  },
  "blexas": {
    "id": "blexas",
    "title": "We Are the Champions",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Two-star victory fanfare",
    "hint": "Built into the site; no import is needed. Your saved local file plays first; otherwise this site recording plays, with the original score as fallback."
  },
  "tsunami": {
    "id": "tsunami",
    "title": "Wipe Out",
    "artist": "The Surfaris",
    "kind": "CREATIVE_SUGGESTION",
    "fallback": "The rising tide finale",
    "hint": "Suggested track for your local audio file; the original score plays until you choose a file."
  },
  "michigan": {
    "id": "michigan",
    "title": "FEAR CAMPAIGN: SIGNAL LOST",
    "artist": "Project original",
    "kind": "ORIGINAL_CUE",
    "fallback": "FEAR CAMPAIGN: SIGNAL LOST",
    "hint": "This original score is already available. Choose your own audio to replace it."
  },
  "florida_senate": {
    "id": "florida_senate",
    "title": "FLORIDA MAN HAS BREACHED THE MODEL",
    "artist": "Project original",
    "kind": "ORIGINAL_CUE",
    "fallback": "FLORIDA MAN HAS BREACHED THE MODEL",
    "hint": "An original gator sneak, forbidden-button boop and rocket-brass finale. Your own saved audio can replace it."
  },
  "louisiana_senate": {
    "id": "louisiana_senate",
    "title": "Neck in LSU’s Death Valley",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "THE CRAWFISH HAVE TAKEN THE SENATE",
    "hint": "Built into the site; no import is needed. Your saved local file plays first; otherwise this site recording plays, with the original score as fallback."
  }
}).map(([id,row])=>[id,Object.freeze(row)])));
 const BUNDLED=Object.freeze(Object.fromEntries(Object.entries({
  "ohio": {
    "schema": "site-builtin-celebration-track-v1",
    "id": "ohio",
    "title": "Buckeye Battle Cry",
    "src": "./assets/celebration-audio/ohio-81a3bd69e70e8a14.mp3",
    "type": "audio/mpeg",
    "bytes": 688870,
    "sha256": "81a3bd69e70e8a14c08ce80b54922e5bd53a6a0fd112be0acec39b3c21ce7500"
  },
  "graham": {
    "schema": "site-builtin-celebration-track-v1",
    "id": "graham",
    "title": "Last Dance",
    "src": "./assets/celebration-audio/graham-20f5631487da03e2.mp3",
    "type": "audio/mpeg",
    "bytes": 5263915,
    "sha256": "20f5631487da03e29aba8d505ed1fcee3bc491ebe0ceb800bb0817f963f32f66"
  },
  "blansas": {
    "schema": "site-builtin-celebration-track-v1",
    "id": "blansas",
    "title": "John Brown’s Body",
    "src": "./assets/celebration-audio/blansas-a3c5d7fd565dc945.mp3",
    "type": "audio/mpeg",
    "bytes": 2657051,
    "sha256": "a3c5d7fd565dc945495c44d4689b4ba1afab09db57641245ff3799886aa77664"
  },
  "blue_corn": {
    "schema": "site-builtin-celebration-track-v1",
    "id": "blue_corn",
    "title": "It’s Corn",
    "src": "./assets/celebration-audio/blue-corn-d7a4150df752408f.mp3",
    "type": "audio/mpeg",
    "bytes": 4232600,
    "sha256": "d7a4150df752408f6ba26180554402e9c0f8c5856134f1ae503f0cc56eec1add"
  },
  "talarico": {
    "schema": "site-builtin-celebration-track-v1",
    "id": "talarico",
    "title": "The Eyes of Texas",
    "src": "./assets/celebration-audio/talarico-48e8b057d64f240d.mp3",
    "type": "audio/mpeg",
    "bytes": 1009012,
    "sha256": "48e8b057d64f240d52b7a1fcaa8599e463f04a74751bf5bb1669b0fd6686b320"
  },
  "mississippi": {
    "schema": "site-builtin-celebration-track-v1",
    "id": "mississippi",
    "title": "Union Dixie Trap",
    "src": "./assets/celebration-audio/mississippi-23c808dfaa31c0e0.mp3",
    "type": "audio/mpeg",
    "bytes": 2234349,
    "sha256": "23c808dfaa31c0e0b752ba6b4899917326c52ff0def5e74ce954649da26aabfe"
  },
  "maine": {
    "schema": "site-builtin-celebration-track-v1",
    "id": "maine",
    "title": "Ding-Dong! The Witch Is Dead",
    "src": "./assets/celebration-audio/maine-4fff395ae450c272.mp3",
    "type": "audio/mpeg",
    "bytes": 3927908,
    "sha256": "4fff395ae450c272c0b9e83fd90c87081f5c4905b1ffb879c054afad56ec7811"
  },
  "louisiana_senate": {
    "schema": "site-builtin-celebration-track-v1",
    "id": "louisiana_senate",
    "title": "Neck in LSU’s Death Valley",
    "src": "./assets/celebration-audio/louisiana-senate-86bb90b9bafe6f1b.mp3",
    "type": "audio/mpeg",
    "bytes": 506242,
    "sha256": "86bb90b9bafe6f1bc1f6c7a2446b2643e3afe88d3dc06ef4bc9bd6cc8d361931"
  },
  "blexas": {
    "schema": "site-builtin-celebration-track-v1",
    "id": "blexas",
    "title": "We Are the Champions",
    "src": "./assets/celebration-audio/blexas-41f3d0e67727f8b8.mp3",
    "type": "audio/mpeg",
    "bytes": 2691543,
    "sha256": "41f3d0e67727f8b8b3def63d5077342f06e2d5296a3c273a934fe0e988e1cb65"
  },
  "abbott": {
    "schema": "site-builtin-celebration-track-v1",
    "id": "abbott",
    "title": "Walk This Way",
    "src": "./assets/celebration-audio/abbott-0ebc3f04d2484a6d.mp3",
    "type": "audio/mpeg",
    "bytes": 5850729,
    "sha256": "0ebc3f04d2484a6db99600ff819c10438a3beeed3566db4b03fa7b5151642fcf"
  }
}).map(([id,row])=>[id,Object.freeze(row)])));
 function bundledForEvent(id){return Object.prototype.hasOwnProperty.call(BUNDLED,id)?BUNDLED[id]:null;}
 function forEvent(id){return Object.prototype.hasOwnProperty.call(CHOICES,id)?CHOICES[id]:null;}
 return Object.freeze({CHOICES,forEvent,BUNDLED,bundledForEvent});
});
