/* Timed presentation only. Call eligibility belongs to ElectionNightSignals. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightCelebrationPlayer=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const STORIES=Object.freeze({
  graham:[['🪩','LAST CALL, GRAHAM','The farewell tour has one final stop.'],['💃','THE VIP LIST HAS CHANGED','South Carolina takes the spotlight.'],['🫖','LOL, GRAHAM','Please collect your tea on the way out.']],
  blexas:[['🤘','HOOK ’EM BLUE','One enormous state.'],['⭐ ⭐','TWO BLUE STARS','Two separate statewide calls.'],['💙','BLEXAS','Texas has entered the group chat.']],
  blue_corn:[['🌽','SOMETHING IN THE CORN','The field has a new color.'],['🔵','BLUE KERNELS EVERYWHERE','Please remain corny.'],['🌽','BLUE CORN','An entirely normal harvest.']],
  blansas:[['📜','JOHN BROWN HAS ENTERED','Kansas history takes the stage.'],['🌊','THE INK IS BLUE','A blue wave crosses the prairie.'],['💙','BLANSAS','1859 meets election night.']],
  maine:[['🧹','A BROOM WITH A VIEW','Maine prepares a sendoff.'],['🌬️','CHANGE IN THE AIR','Please secure all pointy hats.'],['💙','DING-DONG IN MAINE','The next chapter starts here.']],
  nebraska:[['🏈','UPSET ON THE PRAIRIE','The scoreboard needs a moment.'],['🌽','CORN-FED REBELLION','The establishment calls a timeout.'],['🎉','OSBORN WINS','Independent winner. No assumed caucus.']],
  ohio:[['🌰','A BUCKEYE UNDER PRESSURE','Something is about to crack.'],['⚡','BLUE-SHOCK','The comeback gets a thunderclap.'],['💙','OH! THAT HAPPENED','Ohio takes its victory lap.']],
  talarico:[['🤘','HOOK ’EM BLUE','Raise the blue horns, Texas.'],['⭐','TALARICO TAKES THE STAGE','One Senate call. One enormous victory lap.'],['💙','TEXAS SENATE: TALARICO','The governor race has its own story.']],
  abbott:[['🌳','THE CAMPAIGN HAS A PROBLEM','Fictional election-night artwork. Not a real event.'],['💙','TIMBER, INCUMBENT','A theatrical send-off for an era of Texas politics.'],['🎉','TEXAS GOVERNOR FLIPS','An election defeat. A new chapter.']],
  mississippi:[['🌊','A CHANGE IN THE CURRENT','Mississippi turns the page.'],['📦','STRAIGHT INTO STORAGE','The retired mascot gets a very blue sendoff.'],['💙','MISSISSIPPI SENATE FLIPS','Leave the old symbols behind.']],
  tsunami:[['🌊','A VERY LARGE WAVE','Preview the grand finale.'],['🌊 🌊','PLEASE SECURE YOUR LAWN SIGNS','The tide has theatrical ambitions.'],['💙','BLUE TSUNAMI','Preview only until national conditions can be verified.']],
  michigan:[['📡','FEAR CAMPAIGN: SIGNAL LOST','The panic machine has a customer-service issue.'],['🔇','MICHIGAN PRESSES MUTE','Your fear subscription has been cancelled.'],['💙','ERROR: VOTERS NOT SCARED','Michigan declines the fear subscription.']],
  florida_senate:[['🐊','THE ALLIGATOR HAS THE LAUNCH CODES','Someone left the enormous blue button unattended.'],['🚀','FLORIDA HAS LEFT THE GROUP CHAT','The peninsula is now a spacecraft. Please remain Floridian.'],['🛸','FLORIDA MAN HAS BREACHED THE MODEL','Check the alligator’s credentials. Immediately.']],
  louisiana_senate:[['🦞','THE CRAWFISH HAVE SEIZED THE FLOAT','A routine parade has become a constitutional inconvenience.'],['🎺','GEAUX COMPLETELY OFF THE RAILS','The brass band has obtained launch clearance.'],['💙','THE CRAWFISH HAVE TAKEN THE SENATE','The gumbo is now in charge of the space program.']]
 });
 function create({render=()=>{},announce=done=>done(),music=()=>{},valid=()=>true,
  setTimer=setTimeout,clearTimer=clearTimeout,onIdle=()=>{},reducedMotion=()=>false}={}){
  let active=null,queue=[],timer=null,token=0;
  function clear(){if(timer!==null)clearTimer(timer);timer=null;}
  function state(){return {active:active?.item.id||null,preview:active?.demo||false,pending:queue.length};}
  function next(reason='next'){
   clear();music(null,reason==='complete'&&!queue.length?'finale':'next');token++;
   active=null;
   while(queue.length){
    const entry=queue.shift();
    if(!entry.demo&&!valid(entry.item))continue;
    active=entry;break;
   }
   if(!active){onIdle();return;}
   const current=token,entry=active;
   render(entry.item,entry.demo,'announcement',null);
   let started=false,finaleShown=false;
   function scene(index){
    if(current!==token||active!==entry)return;
    if(!entry.demo&&!valid(entry.item)){render(entry.item,false,'revoked',null);next();return;}
    const frames=STORIES[entry.item.id];
    if(index>=frames.length){
     if(finaleShown)return;finaleShown=true;clear();
     render(entry.item,entry.demo,'complete',frames.at(-1));
     // A queued next story must not erase the owner-photo finale in the same
     // task before the browser can paint it. Single final stories persist.
     if(queue.length){timer=setTimer(()=>{
      if(current!==token||active!==entry)return;
      if(!entry.demo&&!valid(entry.item)){render(entry.item,false,'revoked',null);next();return;}
      next('complete');
     },2400);}else next('complete');
     return;
    }
    render(entry.item,entry.demo,'scene',frames[index]);
    timer=setTimer(()=>scene(index+1),2400);
   }
   function begin(){
    if(started||current!==token||active!==entry)return;
    if(!entry.demo&&!valid(entry.item)){render(entry.item,false,'revoked',null);next();return;}
    started=true;clear();music(entry.item.id);
    let reduced=false;try{reduced=reducedMotion()===true;}catch{}
    scene(reduced?STORIES[entry.item.id].length:0);
   }
   entry.finish=()=>{
    if(current!==token||active!==entry)return false;
    if(finaleShown)return false;
    if(!entry.demo&&!valid(entry.item)){render(entry.item,false,'revoked',null);next();return false;}
    if(!started){started=true;clear();music(entry.item.id);}
    scene(STORIES[entry.item.id].length);return true;
   };
   // Media ended/error/autoplay rejection may finish announcement; a bounded
   // fallback ensures that a stalled recording cannot deadlock the queue.
   timer=setTimer(begin,5500);
   try{announce(begin,entry.demo);}catch{begin();}
  }
  function enqueue(item,demo=false){
   if(!item||!Object.hasOwn(STORIES,item.id)||(!demo&&!valid(item)))return false;
   if(demo){stop();}
   if(!demo&&(active?.item.id===item.id||queue.some(x=>x.item.id===item.id)))return false;
   if(queue.length>=16)return false;
   queue.push({item,demo});if(!active)next();return true;
  }
  function stop(){clear();token++;queue=[];active=null;music(null,'stop');}
  function revoke(id){
   queue=queue.filter(x=>x.demo||x.item.id!==id);
   if(active&&!active.demo&&active.item.id===id){render(active.item,false,'revoked',null);next();}
  }
  function skip(){return Boolean(active?.finish?.());}
  return Object.freeze({enqueue,stop,revoke,state,skip});
 }
 return Object.freeze({STORIES,create});
});
