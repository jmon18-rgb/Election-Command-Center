/* Track references for the private local-file picker. No recordings, network,
 * downloads, rights grant, playback default or winner eligibility here. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.ElectionNightCelebrationMusicChoices=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const CHOICES=Object.freeze(Object.fromEntries(Object.entries({
  "talarico": {
    "id": "talarico",
    "title": "The Eyes of Texas",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Blue stadium fanfare",
    "hint": "Owner-selected track. Your saved local file plays first; otherwise the original score remains available."
  },
  "abbott": {
    "id": "abbott",
    "title": "Walk This Way",
    "artist": "Aerosmith",
    "kind": "OWNER_REQUEST",
    "fallback": "The campaign-sign exit march",
    "hint": "Suggested track for your local audio file; the original score plays until you choose a file."
  },
  "graham": {
    "id": "graham",
    "title": "Last Dance",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Last-call disco",
    "hint": "Owner-selected track. Your saved local file plays first; otherwise the original score remains available."
  },
  "blansas": {
    "id": "blansas",
    "title": "John Brown’s Body",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Prairie fife and drum",
    "hint": "Owner-selected track. Your saved local file plays first; otherwise the original score remains available."
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
    "hint": "Owner-selected track. Your saved local file plays first; otherwise the original score remains available."
  },
  "blue_corn": {
    "id": "blue_corn",
    "title": "It’s Corn",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Electric harvest two-step",
    "hint": "Owner-selected track. Your saved local file plays first; otherwise the original score remains available."
  },
  "maine": {
    "id": "maine",
    "title": "Ding-Dong! The Witch Is Dead",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Broom-and-bells sendoff",
    "hint": "Owner-selected track. Your saved local file plays first; otherwise the original score remains available."
  },
  "ohio": {
    "id": "ohio",
    "title": "Buckeye Battle Cry",
    "artist": "Owner-supplied recording",
    "kind": "OWNER_REQUEST",
    "fallback": "Buckeye blue-shock riff",
    "hint": "Owner-selected track. Your saved local file plays first; otherwise the original score remains available."
  },
  "blexas": {
    "id": "blexas",
    "title": "We Are the Champions",
    "artist": "Queen",
    "kind": "CREATIVE_SUGGESTION",
    "fallback": "Two-star victory fanfare",
    "hint": "Suggested track for your local audio file; the original score plays until you choose a file."
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
    "title": "THE CRAWFISH HAVE TAKEN THE SENATE",
    "artist": "Project original",
    "kind": "ORIGINAL_CUE",
    "fallback": "THE CRAWFISH HAVE TAKEN THE SENATE",
    "hint": "An original claw-click, parade-bass and comic Mardi Gras brass cue. Your own saved audio can replace it."
  }
}).map(([id,row])=>[id,Object.freeze(row)])));
 function forEvent(id){return Object.prototype.hasOwnProperty.call(CHOICES,id)?CHOICES[id]:null;}
 return Object.freeze({CHOICES,forEvent});
});
