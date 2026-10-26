/* Bounded transport for real Election Night supplementary requests.
 * One shared pool across parallel/manual sweeps. Never fabricates votes.
 * The source-generation check rejects responses begun before a 429/5xx outage.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightTransport=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 function createPool(maxActive=4,maxQueued=64,{priorityReserve=0}={}){
  if(!Number.isInteger(maxActive)||maxActive<1||maxActive>4||
     !Number.isInteger(maxQueued)||maxQueued<0||maxQueued>64||
     !Number.isInteger(priorityReserve)||priorityReserve<0||priorityReserve>Math.min(2,maxQueued))
   throw Error('Election Night transport must remain bounded');
  let active=0,peak=0,completed=0,failed=0;
  const queue=[];
  function start(job){
   active++;
   peak=Math.max(peak,active);
   function finish(){
    active--;
    if(queue.length)start(queue.shift());
   }
   Promise.resolve().then(job.task).then(
    value=>{completed++;finish();job.resolve(value)},
    error=>{failed++;finish();job.reject(error)}
   );
  }
  function run(task,{priority=false}={}){
   if(typeof task!=='function'||typeof priority!=='boolean')return Promise.reject(Error('Valid transport task/priority required'));
   return new Promise((resolve,reject)=>{
    const job={task,resolve,reject,priority};
    if(active<maxActive)start(job);
    else if(queue.length<maxQueued&&(priority||queue.filter(j=>!j.priority).length<maxQueued-priorityReserve)){
     // Priority affects waiting work only. Never exceed the shared cap or
     // abort a running result request; retain FIFO within each class.
     const before=priority?queue.findIndex(j=>!j.priority):-1;
     if(before<0)queue.push(job);else queue.splice(before,0,job);
    }
    else reject(Error('Election Night source request queue saturated'));
   });
  }
  function status(){return Object.freeze({
   active,queued:queue.length,peak,completed,failed,
   concurrency_limit:maxActive,queue_limit:maxQueued,priority_queue_reserve:priorityReserve,
   priority_queued:queue.filter(j=>j.priority).length
  })}
  return Object.freeze({run,status});
 }
 function generation(breaker){
  const state=breaker?.status?.();
  return Number.isSafeInteger(state?.generation)&&state.generation>=0?
   state.generation:0;
 }
 function sameGeneration(breaker,started){
  const state=breaker?.status?.();
  return Number.isSafeInteger(started)&&started>=0&&
   generation(breaker)===started&&state?.blocked!==true;
 }
 return Object.freeze({createPool,generation,sameGeneration});
});
