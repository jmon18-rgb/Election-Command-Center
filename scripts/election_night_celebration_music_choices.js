/* Track references for the private local-file picker. No recordings, network,
 * downloads, rights grant, playback default or winner eligibility here. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.ElectionNightCelebrationMusicChoices=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const CHOICES=Object.freeze(Object.fromEntries(Object.entries({
  "talarico": {
    "id": "talarico",
    "title": "The Eyes of Texas",
    "artist": "University of Texas Longhorn Band",
    "kind": "OWNER_REQUEST",
    "fallback": "Blue stadium fanfare",
    "hint": "Suggested track for your local audio file; the original score plays until you choose a file."
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
    "artist": "Donna Summer",
    "kind": "CREATIVE_SUGGESTION",
    "fallback": "Last-call disco",
    "hint": "Suggested track for your local audio file; the original score plays until you choose a file."
  },
  "blansas": {
    "id": "blansas",
    "title": "John Brown’s Body / Glory, Hallelujah",
    "artist": "Traditional melody · a new project arrangement",
    "kind": "HISTORICAL_COMPOSITION_CANDIDATE",
    "fallback": "Prairie fife and drum",
    "hint": "Traditional-song reference; the original score plays until you choose your audio."
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
    "title": "Hit the Road Jack",
    "artist": "Ray Charles",
    "kind": "CREATIVE_SUGGESTION",
    "fallback": "Blue-river brass shuffle",
    "hint": "Suggested track for your local audio file; the original score plays until you choose a file."
  },
  "blue_corn": {
    "id": "blue_corn",
    "title": "Electric harvest two-step",
    "artist": "Project original",
    "kind": "ORIGINAL_CUE",
    "fallback": "Electric harvest two-step",
    "hint": "This original score is already available. Choose your own audio to replace it."
  },
  "maine": {
    "id": "maine",
    "title": "Ding-Dong! The Witch Is Dead",
    "artist": "The Wizard of Oz film cast",
    "kind": "CREATIVE_SUGGESTION",
    "fallback": "Broom-and-bells sendoff",
    "hint": "Suggested track for your local audio file; the original score plays until you choose a file."
  },
  "ohio": {
    "id": "ohio",
    "title": "Thunderstruck",
    "artist": "AC/DC",
    "kind": "CREATIVE_SUGGESTION",
    "fallback": "Buckeye blue-shock riff",
    "hint": "Suggested track for your local audio file; the original score plays until you choose a file."
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
  }
}).map(([id,row])=>[id,Object.freeze(row)])));
 function forEvent(id){return Object.prototype.hasOwnProperty.call(CHOICES,id)?CHOICES[id]:null;}
 return Object.freeze({CHOICES,forEvent});
});
