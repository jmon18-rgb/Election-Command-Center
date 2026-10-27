# Celebration production inventory - October 27, 2026

Review basis: `CELEBRATION_CREATIVE_BRIEF.md`, current player/index/assets and R6 PR488 head `2af0a7dbae24ab87deccfdec46ce41c82196a325`. Checkout during review: `c5666256ee2f519325958b7054b1030ae63a5539` (also includes separate R4 work). Parent subsequently verified R6 release on final main `7492ae1b`, Pages40562141170, all299 published files matched18:42:42Z and ordinary-browser new-three previews. This inventory distinguishes the released foundation/posters from the still-incomplete bespoke productions.

**Status meanings:** COMPLETE = the specified engineering function is implemented/tested, subject to its recorded release status. PARTIAL = a poster/three text beats/generic cue exists, but the requested distinct production does not. MISSING = the requested visual action, genre-specific music or optional upgrade is absent. Preview/synthetic safety tests never prove actual winner calls.

## October27 owner-art integration released

PR496 released at finalmain95c1116d/Pages40585515817SUCCESS; all314checked files match21:18:59.727Z and ordinary published previews passed. Exact-head33parents/44jobs41success3nonapplicableSKIP/0external passed. The candidate details below describe the released poster implementation; new protected release/publication requirements mentioned there were satisfied. Bespoke animation/music remains incomplete.

Three owner-supplied images are wired into the existing Kansas, Mississippi and Graham previews/earned presentation, with content-addressed local JPEGs, full-image mobile containment and explicit fictional-art attribution. Original bytes are preserved; missing JPEGs fall back to existing SVGs, then readable icon/text if both fail. These are poster improvements, not finished bespoke animation/music. Abbott retains the existing electoral-defeat scene. Exact triggers, source-call freshness, retraction/dedup, mute/skip/replay/reduced-motion and audio remain unchanged. Local1440/390 actual-browser and deterministic player checks pass; new exact-head CI/protected release/publication are still required.

## Shared foundation

| Item | Status | Evidence / remaining work |
| --- | --- | --- |
| Announcement before scenes, queue, mute, skip/replay, media-error fallback | COMPLETE foundation | Existing player and owner-supplied recording; existing deterministic/browser tests. Recording is generic, not newly recorded candidate-specific speech. |
| Exact-office/race, candidate constraints where named, final-close/freshness guards; retraction revocation | COMPLETE foundation | Existing `ElectionNightSignals` plus strict runtime source adapters; new R6 named TX requirements tested. Actual election delivery/calls remain unproven. |
| Desktop/mobile cards and 11 playable preview stories | COMPLETE foundation; PARTIAL production | Seven existing earned-event cards plus preview-only Tsunami; R6 adds three cards, totaling ten earned-event definitions and eleven stories. Actual Edge previews and parent final release verification passed; bespoke productions remain incomplete. |
| Reduced motion | COMPLETE foundation | Current shared beat animation is suppressed; retain this for all new scene layers. |
| Original musical cue | PARTIAL | Current WebAudio uses two repeated eight-note arpeggio patterns, transposed by roster position; Nebraska uses a triangle oscillator, others sine. This is a working original cue, not distinct stadium/disco/trap/blues/period productions. |
| Fish Head jaw movement | MISSING optional | No synchronized jaw animation found. Lower priority than distinct main scenes; do not imply lip-sync. |

## Event matrix

| Event | Current visual / trigger | Requested production still missing | Audio status |
| --- | --- | --- | --- |
| Talarico / Texas Senate | R6 exact named-winner requirement; original static blue-horns/star poster and three text/emoji beats | RELEASED in PR490: original animated horns, five stars across illustrative Texas and a staged Senate victory card; recorded exact-head CI and publication evidence in readiness-progress.md | Generic original cue only. Original stadium-band fanfare missing; requested commercial/fight-song recording not cleared. |
| Texas governor / Abbott | R6 Democratic governor winner plus Greg Abbott opponent; separate from Senate; static concession-podium/parade poster | PARTIAL: podium character/silhouette, blue parade crossing and concession backdrop roll-up | Generic cue only; original parade/departure arrangement missing. No cleared Walk This Way recording. Satire must target election loss, never disability. |
| BLEXAS bonus | Existing two-office Democratic-call bonus; static two-star Texas poster and three beats | PARTIAL: distinct two-star/combined-win bonus finale; must not substitute for either separate event | Generic cue; optional distinct bonus fanfare missing. |
| Graham / South Carolina | Existing Darline opponent guard; R6 surname-only player/alt/poster correction | PARTIAL: fictional neon-nightclub caricature/spotlight, collapsing VIP sign and theatrical lighting. Current cracker poster/icon bounce does not deliver it | Original disco/club farewell cue missing. No sexuality/private-conduct/real-venue assertions. |
| BLANSAS / Kansas | Existing Democratic Senate trigger, historical John Brown portrait/local fallback and three text beats | PARTIAL: stylized John Brown/Confederate-symbol action, blue cartoon splashes, Kansas transformation and finale | Original period-inspired instrumental missing; no cleared historical recording supplied. No realistic gore. |
| Nebraska / Osborn | Existing independent Dan Osborn trigger; static tractor/cornfield art plus generic football/corn beats; no assumed caucus | PARTIAL: sad fictional sideline/coach Tom Osborne character, absurd scoreboard and blue confetti. Must clearly distinguish coach Osborne from candidate Osborn | Triangle-oscillator generic cue only; original football-band/trap treatment missing; fight-song rights not established. |
| Mississippi Senate | R6 generic Democratic exact-race trigger; static retired-mascot/crate/wave poster and three beats; current invalid source stays excluded | PARTIAL: wave actually washes mascot prop from pedestal into storage; no injury to people | Original brass/blues sting missing. |
| BLUE CORN / Iowa | Existing any-of Senate/governor Democratic call; corn poster and three beats | PARTIAL: blue-kernel/cornfield transformation remains largely static | Generic cue; distinct corn-themed production finishing remains. |
| Maine | Existing Democratic call against Susan Collins; witch/broom poster and three beats | PARTIAL: staged broom/sendoff action remains static | Generic cue; distinct finishing remains. |
| BUCKEYE BLUE-SHOCK / Ohio | Existing Ohio-special Democratic trigger; cracked-nut/lightning poster and three beats | PARTIAL: actual crack/lightning/victory action missing. Brief says retain existing direction until a replacement is selected | Generic cue; specific new storyboard/music not supplied. |
| Blue Tsunami | Existing preview-only finale; no automatic forecast-based earning | PARTIAL: full wave finale/production still missing. Do not add an earned trigger from odds or partial leads | Generic cue; distinct finale missing. Any future earned condition needs reviewed national call/control accounting. |

Static posters and bouncing emoji do not complete bespoke productions. The Talarico candidate adds distinct SVG actions; its music remains the existing generic original cue.

## Current candidate: Talarico original SVG stadium scene

This is first in both the current Texas-first R6 priority and the brief's production order. Its exact named-winner guard and original horns/star artwork already exist, so it can deliver a visible improvement without new sourcing or media dependencies.

1. Add a presentation-only optional SVG scene renderer for `talarico` using the existing three shared scene beats. Keep the player queue, timers, eligibility and audio-failure behavior unchanged. Other events retain the current fallback until their own slices are ready.
2. Beat 1: original electric-blue horns gesture rises into stadium lights; use the original repository horns path, not an external image.
3. Beat 2: an illustrative Texas silhouette gains staggered blue stars. Reuse the existing original BLEXAS shape as celebration artwork only; do not depict it as a reporting map. Label this Texas **Senate**, not the two-race bonus.
4. Beat 3: the exact Texas Senate/Talarico victory card assembles; preserve explicit PREVIEW labeling for rehearsal. Candidate and office text remain driven by the already-approved event, never by raw untrusted provider HTML.
5. Keep one contained aspect ratio on 1440px/390px, readable text, keyboard skip/replay, and a meaningful static view when reduced motion is enabled. Remove animations/layers on skip, revoke, archive switch and replacement preview; no late callback may restart a stopped scene.
6. Give this event a short original WebAudio stadium-fanfare arrangement after the announcement, or explicitly mark its music finishing partial. No external recording, no imitation/import of The Eyes of Texas, and no extra audio request. Existing sound-off/autoplay recovery remains authoritative.

### Acceptance for that slice

- Test all three distinct scene beats/layers and actual motion when enabled; verify static reduced-motion rendering and no narrow-screen overflow.
- Test preview does not earn the event; an exact post-close Talarico call can earn it; wrong candidate/office, stale/preclose data and retraction cannot sustain it.
- Exercise queued events, duplicate suppression, mute, blocked/failed audio, skip, replay, archive transition and missing optional scene-renderer fallback. Preserve the existing11-story preview test and all other event safety tests.
- Visually inspect desktop/mobile scenes and audibly assess any new original cue. Scheduled oscillator nodes alone do not establish subjective musical quality.
- Record original-code artwork/audio provenance and immutable script/changed-art revisions; pass exact-head workflows, published-byte checks and published behavior before a completed-release claim.
- Completion of this slice means Talarico's distinct production is ready; it does not mark the entire celebration roster complete or establish a real election result.

Following slices: Kansas/Graham requested actions and the separately prioritized governor/Mississippi productions, then Nebraska and remaining retained roster, using the current roadmap's latest priority decisions. Commercial-song upgrades stay optional and rights-dependent.
