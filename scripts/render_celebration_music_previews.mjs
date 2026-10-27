// Render the SAME production scores for local listening; no outside media/data.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_URL||'playwright');
const root=resolve(import.meta.dirname,'..'),dir=resolve(root,'artifacts/readiness/music-previews');mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
try{
 const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 await page.setContent('<!doctype html><title>Original celebration score rendering</title>');
 await page.addScriptTag({content:readFileSync(resolve(root,'scripts/election_night_celebration_music.js'),'utf8')});
 const ids=await page.evaluate(()=>Object.keys(ElectionNightCelebrationMusic.THEMES));const receipt=[];
 for(const id of ids){
  const result=await page.evaluate(async id=>{
   const rate=24000,context=new OfflineAudioContext(2,Math.ceil(rate*7.2),rate);ElectionNightCelebrationMusic.play(context,id);
   const rendered=await context.startRendering(),left=rendered.getChannelData(0),right=rendered.getChannelData(1);let peak=0,sum=0;
   const bytes=new Uint8Array(44+left.length*4),view=new DataView(bytes.buffer),word=(at,s)=>{for(let i=0;i<s.length;i++)bytes[at+i]=s.charCodeAt(i)};
   word(0,'RIFF');view.setUint32(4,bytes.length-8,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,bytes.length-44,true);
   for(let i=0;i<left.length;i++)for(let channel=0;channel<2;channel++){const v=channel?right[i]:left[i];peak=Math.max(peak,Math.abs(v));sum+=v*v;view.setInt16(44+i*4+channel*2,Math.round(Math.max(-1,Math.min(1,v))*32767),true);}
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   return {id,title:ElectionNightCelebrationMusic.THEMES[id].title,seconds:left.length/rate,peak,rms:Math.sqrt(sum/(left.length*2)),base64:btoa(binary)};
  },id);
  if(!(result.peak<.98&&result.rms>.003))throw Error('Invalid rendered mix: '+id);
  writeFileSync(resolve(dir,id+'.wav'),Buffer.from(result.base64,'base64'));delete result.base64;receipt.push(result);
 }
 const stoppedPeak=await page.evaluate(async()=>{const c=new OfflineAudioContext(1,24000,24000),h=ElectionNightCelebrationMusic.play(c,'graham');h.stop();const b=await c.startRendering();return b.getChannelData(0).reduce((m,x)=>Math.max(m,Math.abs(x)),0);});
 if(stoppedPeak!==0)throw Error('Stopped cue leaked audio');
 writeFileSync(resolve(dir,'rendered-scores.json'),JSON.stringify({at:new Date().toISOString(),source:'production original WebAudio scores',stopped_cue_peak:stoppedPeak,subjective_listening_review:'not claimed by numeric checks',receipt},null,2));console.log(JSON.stringify(receipt));
}finally{await browser.close()}
