/* Fish motion follows the actual announcement's audio energy, not phonemes.
 * No recording/fetch/storage; stopped or reduced-motion media stays still. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.ElectionNightAnnouncementMotion=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 function capture(audio,context){
  if(!context||context.state!=='running'||typeof audio.captureStream!=='function'||typeof context.createMediaStreamSource!=='function')return null;
  const stream=audio.captureStream();
  try{if(!stream.getAudioTracks().length){for(const track of stream.getTracks())track.stop();return null;}
   const source=context.createMediaStreamSource(stream);return{context,source,stream};
  }catch(error){for(const track of stream.getTracks())try{track.stop();}catch{}throw error;}
 }
 function create({audio,element,getContext=()=>null,isActive=()=>true,
  motionQuery=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null,
  requestFrame=callback=>requestAnimationFrame(callback),cancelFrame=id=>cancelAnimationFrame(id)}={}){
  let frame=null,epoch=0,analyser=null,binding=null,silent=null,samples=null,destroyed=false;
  const still=()=>{if(element){element.style.setProperty('--fish-speech-level','0');element.dataset.speaking='false';}};
  function stop(){epoch++;if(frame!==null)cancelFrame(frame);frame=null;
   try{binding?.source.disconnect();}catch{}try{analyser?.disconnect();}catch{}try{silent?.disconnect();}catch{}
   for(const track of binding?.stream?.getTracks?.()||[])try{track.stop();}catch{}
   binding=null;analyser=null;silent=null;samples=null;still();
  }
  function active(){try{return !destroyed&&audio&&!audio.paused&&!audio.ended&&!audio.muted&&audio.volume!==0&&!motionQuery?.matches&&isActive()===true;}catch{return false;}}
  function start(){stop();if(!element||!active())return false;
   try{binding=capture(audio,getContext());if(!binding)return false;analyser=binding.context.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.45;
    // This captured copy is analysis only. The original media element retains
    // its native output, unaffected by a suspended/failed analysis context.
    silent=binding.context.createGain();silent.gain.value=0;binding.source.connect(analyser);analyser.connect(silent);silent.connect(binding.context.destination);samples=new Uint8Array(analyser.fftSize);
   }catch{stop();return false;}
   const current=epoch;
   const paint=()=>{frame=null;if(current!==epoch)return;if(!active()){stop();return;}
    if(binding.context.state!=='running'){stop();return;}
    try{analyser.getByteTimeDomainData(samples);let energy=0;for(const value of samples)energy+=((value-128)/128)**2;const level=Math.min(1,Math.sqrt(energy/samples.length)*5);element.style.setProperty('--fish-speech-level',level.toFixed(3));element.dataset.speaking=String(level>.015);}catch{stop();return;}
    frame=requestFrame(paint);
   };
   frame=requestFrame(paint);return true;
  }
  const onMotion=()=>{if(motionQuery?.matches)stop();else if(active())start();};
  const events=[['playing',start],['pause',stop],['ended',stop],['error',stop],['emptied',stop]];
  for(const [event,listener]of events)audio?.addEventListener?.(event,listener);motionQuery?.addEventListener?.('change',onMotion);still();
  return Object.freeze({start,stop,destroy(){stop();destroyed=true;for(const [event,listener]of events)audio?.removeEventListener?.(event,listener);motionQuery?.removeEventListener?.('change',onMotion);},state(){return Object.freeze({running:frame!==null,method:analyser?'ACTUAL_AUDIO_ENERGY':'STATIC_NO_ANALYSER'});}});
 }
 return Object.freeze({create});
});
