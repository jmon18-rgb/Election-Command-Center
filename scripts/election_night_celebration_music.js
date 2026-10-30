/* Original event-specific compositions. No commercial recordings or song melodies.
 * Presentation only: callers own mute, queue, eligibility and cancellation. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.ElectionNightCelebrationMusic=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const THEMES=Object.freeze({
  talarico:{title:'Blue stadium fanfare',bpm:120,key:62,voice:'brass',kit:'march',melody:[0,7,4,12,9,7,4,2,0,4,7,14,12,9,7,12]},
  blexas:{title:'Two-star victory fanfare',bpm:126,key:65,voice:'brass',kit:'march',melody:[0,4,7,0,12,7,9,12,5,9,12,14,7,11,14,19]},
  abbott:{title:'The campaign-sign exit march',bpm:108,key:60,voice:'pluck',kit:'march',melody:[12,11,9,7,4,2,0,-1,0,4,7,9,7,4,2,0]},
  graham:{title:'Last-call disco',bpm:124,key:57,voice:'bright',kit:'disco',minor:true,melody:[0,7,10,12,10,7,3,7,5,12,10,7,3,5,7,10]},
  blansas:{title:'Prairie fife and drum',bpm:112,key:74,voice:'flute',kit:'march',melody:[0,2,4,7,4,2,0,4,5,9,7,5,4,2,7,0]},
  nebraska:{title:'Sideline brass and halftime bass',bpm:88,key:58,voice:'brass',kit:'trap',minor:true,melody:[0,0,7,10,12,10,7,3,5,5,12,15,14,10,7,0]},
  mississippi:{title:'Blue-river brass shuffle',bpm:106,key:65,voice:'brass',kit:'shuffle',melody:[0,3,5,6,7,10,12,10,7,6,5,3,0,3,5,0]},
  blue_corn:{title:'Electric harvest two-step',bpm:116,key:67,voice:'pluck',kit:'country',melody:[0,7,4,7,2,7,4,9,5,12,9,12,7,14,11,7]},
  maine:{title:'Broom-and-bells sendoff',bpm:132,key:69,voice:'bell',kit:'waltz',minor:true,melody:[0,3,7,12,10,7,5,8,12,17,15,12,7,10,14,7]},
  ohio:{title:'Buckeye blue-shock riff',bpm:128,key:52,voice:'bright',kit:'rock',minor:true,melody:[0,0,12,0,7,10,7,3,0,0,15,12,10,7,3,0]},
  tsunami:{title:'The rising tide finale',bpm:100,key:60,voice:'bell',kit:'swell',melody:[0,4,7,12,2,5,9,14,4,7,12,16,7,11,14,19]},
  michigan:{title:'FEAR CAMPAIGN: SIGNAL LOST',bpm:112,key:62,voice:'brass',kit:'industrial-funk',minor:true,melody:[0,3,7,10,9,7,5,3,0,7,12,10,7,3,0,12]},
  florida_senate:{title:'FLORIDA MAN HAS BREACHED THE MODEL',bpm:144,key:55,voice:'brass',kit:'swamp-launch',melody:[0,7,6,12,9,14,7,12]},
  louisiana_senate:{title:'THE CRAWFISH HAVE TAKEN THE SENATE',bpm:120,key:58,voice:'brass',kit:'crawfish-parade',melody:[7,4,9,12,14,9,7,12]}
 });
 const DURATION=7.05;
 function score(id){
  const theme=THEMES[id];if(!theme)return null;
  const events=[],beat=60/theme.bpm,add=(instrument,at,duration,note,level)=>{
   if(at>=DURATION-.12)return;events.push({instrument,at,duration:Math.min(duration,DURATION-at-.02),note,level});
  };
  if(id==='florida_senate'){
   // Beat 1: a suspiciously jaunty gator tiptoes toward the forbidden button.
   const creep=[0,-1,0,3,-2,0,7,6];
   for(let i=0;i<creep.length;i++){add('pluck',i*.27,.11,theme.key+creep[i],.038);add('hat',i*.27+.13,.035,0,.01);}
   for(const [at,step]of [[0,0],[.54,7],[1.08,0],[1.62,5]])add('bass',at,.2,theme.key-24+step,.045);
   for(const at of [.81,1.89])add('flute',at,.13,theme.key+19,.022);
   // Beat 2: one forbidden blue-button boop, then an original rocket ladder.
   add('bell',2.4,.18,theme.key+24,.045);add('kick',2.4,.16,38,.065);
   for(const [i,step]of [0,1,3,6,7,9,12,13,16,19,24,28].entries())add('bright',2.76+i*.13,.085,theme.key-5+step,.026);
   for(let i=0;i<7;i++)add('snare',3.36+i*.18,.055,0,.014+i*.002);
   // Beat 3: the model is breached; absurd space-brass confetti answers back.
   const hits=[0,.2,.4,.72,.96,1.2,1.52,1.8];
   hits.forEach((at,i)=>add('brass',4.8+at,.14,theme.key+theme.melody[i],.048));add('brass',6.85,.16,theme.key+12,.045);
   for(const [at,step]of [[0,0],[.32,7],[.64,0],[1.12,12],[1.44,9],[1.76,0]])add('bass',4.8+at,.18,theme.key-24+step,.06);
   for(let i=0;i<4;i++){add('kick',4.8+i*.48,.15,38,.075);add('snare',5.04+i*.48,.1,0,.035);}
   for(let i=0;i<17;i++)add('hat',4.8+i*.12,.035,0,.014);
   for(const at of [4.8,6])for(const step of [0,4,7])add('pad',at,.65,theme.key-12+step,.01);
   return {id,title:theme.title,bpm:theme.bpm,duration:DURATION,events:events.sort((a,b)=>a.at-b.at)};
  }
  if(id==='louisiana_senate'){
   // Beat 1: little claw-clicks over a comically oversized parade-bass strut.
   const claws=[0,3,7,3,2,5,9,5],clawTimes=[0,.16,.48,.64,1.12,1.28,1.6,1.76];
   clawTimes.forEach((at,i)=>add('pluck',at,.09,theme.key+12+claws[i],.03));
   for(let i=0;i<6;i++){add('bass',i*.4,.19,theme.key-24+(i%2?7:0),.055);add('kick',i*.4,.13,38,.065);}
   for(const at of [.3,1.1,1.9])add('snare',at,.075,0,.022);
   // Beat 2: the giant blue crawfish unfolds into its own original brass float.
   const parade=[0,4,7,12,9,7,5,14],paradeTimes=[0,.24,.48,.84,1.08,1.32,1.68,1.92];
   paradeTimes.forEach((at,i)=>add('brass',2.4+at,.15,theme.key+parade[i],.046));
   for(let i=0;i<6;i++){add('bass',2.4+i*.36,.18,theme.key-24+(i%2?12:5),.055);add('hat',2.58+i*.36,.04,0,.014);}
   for(const at of [2.4,3.12,3.84])add('kick',at,.14,38,.07);
   for(const at of [2.82,3.54,4.26])add('snare',at,.1,0,.032);
   // Beat 3: GEAUX BLUE! Call-and-answer horns, dancing claws and a big finish.
   for(let i=0;i<8;i++){const at=4.8+i*.24;add('brass',at,.14,theme.key+theme.melody[i],.05);add('pluck',at+.12,.075,theme.key+19-(i%3)*2,.022);}
   add('brass',6.85,.16,theme.key+12,.045);
   for(let i=0;i<6;i++){add('bass',4.8+i*.36,.18,theme.key-24+[0,7,12,5,7,0][i],.06);add('kick',4.8+i*.36,.13,38,.075);}
   for(const at of [5.04,5.76,6.48]){add('snare',at,.09,0,.036);add('snare',at+.12,.055,0,.018);}
   for(let i=0;i<13;i++)add('hat',4.92+i*.15,.035,0,.014);
   for(const at of [2.4,4.8,6.12])for(const step of [0,4,7])add('pad',at,.68,theme.key-12+step,.011);
   return {id,title:theme.title,bpm:theme.bpm,duration:DURATION,events:events.sort((a,b)=>a.at-b.at)};
  }
  if(id==='michigan'){
   // Three original scene cues: PANICCAST pulses, a ballot-stamp choke/rest,
   // then comic brass and industrial-funk confetti. No song tune or recording.
   for(let i=0;i<8;i++){add('bright',i*.22,.12,83+i%2,.028);add('hat',i*.22+.1,.035,0,.012);}
   add('snare',1.8,.22,0,.009);
   add('pluck',2.4,.1,theme.key+7,.032);add('pluck',2.52,.09,theme.key-5,.025);add('kick',2.7,.1,38,.055);
   for(const interval of [0,3,7])add('pad',3,.36,theme.key-12+interval,.01);
   // The deliberate quiet interval belongs to the composition, not app mute.
   const accents=[0,.18,.36,.72,.9,1.08,1.44,1.62,1.8];
   for(let i=0;i<accents.length;i++)add('brass',4.8+accents[i],.13,theme.key+theme.melody[i],.045);
   add('brass',6.85,.16,theme.key+12,.045);
   for(const [offset,interval]of [[0,0],[.28,7],[.72,0],[1.12,10],[1.56,7],[1.88,0]])add('bass',4.8+offset,.17,theme.key-24+interval,.06);
   for(let i=0;i<4;i++){add('kick',4.8+i*.56,.14,38,.075);add('snare',5.08+i*.56,.1,0,.035);}
   for(let i=0;i<15;i++)add('hat',4.8+i*.145,.035,0,.014);
   for(const at of [4.8,6.1])for(const interval of [0,3,7])add('pad',at,.45,theme.key-12+interval,.01);
   return {id,title:theme.title,bpm:theme.bpm,duration:DURATION,events:events.sort((a,b)=>a.at-b.at)};
  }
  const roots=[0,5,7,0],third=theme.minor?3:4;
  for(let bar=0;bar<4;bar++){
   const at=bar*1.7,root=roots[bar];for(const interval of [0,third,7])add('pad',at,1.58,theme.key-12+root+interval,.015);
  }
  for(let i=0;i*beat*.5<DURATION-.3;i++){
   const swing=theme.kit==='shuffle'&&i%2?beat*.12:0;
   add(theme.voice,i*beat*.5+swing,beat*.37,theme.key+theme.melody[i%theme.melody.length],theme.voice==='brass'?.05:.045);
  }
  for(let i=0;i*beat<DURATION-.15;i++){
   const at=i*beat,root=roots[Math.min(3,Math.floor(at/1.7))];
   add('bass',at,beat*.65,theme.key-24+root+(theme.kit==='disco'&&i%2?12:0),.065);
   if(theme.kit!=='waltz'||i%3===0)add('kick',at,.18,38,.11);
   if(theme.kit==='trap'?i%4===2:theme.kit==='waltz'?i%3!==0:i%2===1)add('snare',at,.14,0,.043);
   if(theme.kit==='disco'||theme.kit==='rock'||theme.kit==='trap'){
    add('hat',at+beat*.5,.055,0,.023);
    if(theme.kit==='trap'&&i%2)add('hat',at+beat*.75,.035,0,.015);
   }
   if(theme.kit==='march')add('snare',at+beat*.75,.07,0,.017);
  }
  if(theme.kit==='swell')add('swell',0,DURATION-.1,0,.026);
  return {id,title:theme.title,bpm:theme.bpm,duration:DURATION,events:events.sort((a,b)=>a.at-b.at)};
 }
 function play(ctx,id){
  const composition=score(id);if(!composition)return null;
  const start=ctx.currentTime+.025,sources=[],chains=[];
  const master=ctx.createGain(),limiter=ctx.createDynamicsCompressor();master.gain.value=.65;
  master.gain.setValueAtTime(.65,start);master.gain.setValueAtTime(.65,start+DURATION-.18);master.gain.linearRampToValueAtTime(0,start+DURATION);
  limiter.threshold.value=-16;limiter.ratio.value=6;master.connect(limiter);limiter.connect(ctx.destination);
  let stopped=false,pending=composition.events.length;
  const disconnect=chain=>{for(const n of chain)try{n.disconnect()}catch{}};
  const stop=()=>{if(stopped)return;stopped=true;for(const n of sources)try{n.stop()}catch{}for(const chain of chains)disconnect(chain);disconnect([master,limiter]);};
  try{
   for(const event of composition.events){
    const at=start+event.at,end=at+event.duration,gain=ctx.createGain(),filter=ctx.createBiquadFilter();
    const noise=['hat','snare','swell'].includes(event.instrument);let node;
    if(noise){
     node=ctx.createBufferSource();const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*event.duration),ctx.sampleRate),data=buffer.getChannelData(0);let seed=12345;
     for(let i=0;i<data.length;i++){seed=(1664525*seed+1013904223)>>>0;data[i]=seed/2147483648-1;}node.buffer=buffer;
     filter.type=event.instrument==='swell'?'lowpass':'highpass';filter.frequency.value=event.instrument==='hat'?6500:event.instrument==='snare'?1300:1800;
    }else{
     node=ctx.createOscillator();node.type=({brass:'sawtooth',bright:'square',pluck:'triangle',flute:'sine',bell:'sine',pad:'triangle',bass:'sine',kick:'sine'})[event.instrument];
     const hz=440*Math.pow(2,(event.note-69)/12);node.frequency.setValueAtTime(event.instrument==='kick'?135:hz,at);
     if(event.instrument==='kick')node.frequency.exponentialRampToValueAtTime(42,end);
     filter.type='lowpass';filter.frequency.value=event.instrument==='brass'?1800:event.instrument==='bright'?1300:3600;
    }
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(event.level,at+Math.min(.018,event.duration*.1));
    if(event.instrument==='swell'){gain.gain.linearRampToValueAtTime(event.level*1.8,end-.3);gain.gain.linearRampToValueAtTime(0,end);}
    else gain.gain.exponentialRampToValueAtTime(.0001,end);
    node.connect(filter);filter.connect(gain);gain.connect(master);const chain=[node,filter,gain];chains.push(chain);sources.push(node);
    node.onended=()=>{disconnect(chain);if(--pending===0)disconnect([master,limiter]);};node.start(at);node.stop(end);
   }
  }catch(error){stop();throw error;}
  return Object.freeze({id,title:composition.title,duration:DURATION,stop});
 }
 return Object.freeze({THEMES,score,play,DURATION});
});
