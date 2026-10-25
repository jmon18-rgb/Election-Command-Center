/* Timed presentation only. Call eligibility belongs to ElectionNightSignals. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightCelebrationPlayer=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const STORIES=Object.freeze({
  graham:[['🪩','LAST CALL, LINDSEY','The farewell tour has one final stop.'],['💃','THE VIP LIST HAS CHANGED','South Carolina takes the spotlight.'],['🫖','LOL, GRAHAM','Please collect your tea on the way out.']],
  blexas:[['🤘','HOOK ’EM BLUE','One enormous state.'],['⭐ ⭐','TWO BLUE STARS','Two separate statewide calls.'],['💙','BLEXAS','Texas has entered the group chat.']],
  blue_corn:[['🌽','SOMETHING IN THE CORN','The field has a new color.'],['🔵','BLUE KERNELS EVERYWHERE','Please remain corny.'],['🌽','BLUE CORN','An entirely normal harvest.']],
  blansas:[['📜','JOHN BROWN HAS ENTERED','Kansas history takes the stage.'],['🌊','THE INK IS BLUE','A blue wave crosses the prairie.'],['💙','BLANSAS','1859 meets election night.']],
  maine:[['🧹','A BROOM WITH A VIEW','Maine prepares a sendoff.'],['🌬️','CHANGE IN THE AIR','Please secure all pointy hats.'],['💙','DING-DONG IN MAINE','The next chapter starts here.']],
  nebraska:[['🏈','UPSET ON THE PRAIRIE','The scoreboard needs a moment.'],['🌽','CORN-FED REBELLION','The establishment calls a timeout.'],['🎉','OSBORN WINS','Independent winner. No assumed caucus.']],
  ohio:[['🌰','A BUCKEYE UNDER PRESSURE','Something is about to crack.'],['⚡','BLUE-SHOCK','The comeback gets a thunderclap.'],['💙','OH! THAT HAPPENED','Ohio takes its victory lap.']],
  tsunami:[['🌊','A VERY LARGE WAVE','Preview the grand finale.'],['🌊 🌊','PLEASE SECURE YOUR LAWN SIGNS','The tide has theatrical ambitions.'],['💙','BLUE TSUNAMI','Preview only until national conditions can be verified.']]
 });
 function create({render=()=>{},announce=done=>done(),music=()=>{},valid=()=>true,
  setTimer=setTimeout,clearTimer=clearTimeout,onIdle=()=>{}}={}){
  let active=null,queue=[],timer=null,token=0;
  function clear(){if(timer!==null)clearTimer(timer);timer=null;}
  function state(){return {active:active?.item.id||null,preview:active?.demo||false,pending:queue.length};}
  function next(){
   clear();music(null);token++;
   active=null;
   while(queue.length){
    const entry=queue.shift();
    if(!entry.demo&&!valid(entry.item))continue;
    active=entry;break;
   }
   if(!active){onIdle();return;}
   const current=token,entry=active;
   render(entry.item,entry.demo,'announcement',null);
   let started=false;
   function scene(index){
    if(current!==token||active!==entry)return;
    if(!entry.demo&&!valid(entry.item)){render(entry.item,false,'revoked',null);next();return;}
    const frames=STORIES[entry.item.id];
    if(index>=frames.length){render(entry.item,entry.demo,'complete',frames.at(-1));next();return;}
    render(entry.item,entry.demo,'scene',frames[index]);
    timer=setTimer(()=>scene(index+1),2400);
   }
   function begin(){
    if(started||current!==token||active!==entry)return;
    if(!entry.demo&&!valid(entry.item)){render(entry.item,false,'revoked',null);next();return;}
    started=true;clear();music(entry.item.id);scene(0);
   }
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
  function stop(){clear();token++;queue=[];active=null;music(null);}
  function revoke(id){
   queue=queue.filter(x=>x.demo||x.item.id!==id);
   if(active&&!active.demo&&active.item.id===id){render(active.item,false,'revoked',null);next();}
  }
  return Object.freeze({enqueue,stop,revoke,state});
 }
 return Object.freeze({STORIES,create});
});
