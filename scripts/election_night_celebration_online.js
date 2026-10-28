/* Optional visible official YouTube players. The ad-free original/local-file
   path is the default; reading preferences never connects a player. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightCelebrationOnline=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const DEFAULTS=Object.freeze({
  talarico:Object.freeze({id:'v087M-InmIM',title:'The Eyes of Texas · University of Texas Longhorn Band'}),
  abbott:Object.freeze({id:'gkWCLjxQqjU',title:'Walk This Way · Aerosmith'})
 });
 const KEY='bluewaves_celebration_music_v1';
 const validId=id=>typeof id==='string'&&/^[\w-]{11}$/.test(id);
 function videoId(value){
  try{
   const url=new URL(value);
   if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
   const host=url.hostname.toLowerCase();let id=null;
   if(host==='youtu.be')id=url.pathname.slice(1);
   if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host)){
    if(url.pathname==='/watch')id=url.searchParams.get('v');
    else if(/^\/(embed|shorts)\//.test(url.pathname))id=url.pathname.split('/')[2];
   }
   return validId(id)?id:null;
  }catch{return null;}
 }
 function read(storage,ids){
  // YouTube ads interrupt the requested soundtrack. Fresh profiles use the
  // ad-free local/original path; an explicit saved YouTube choice remains valid.
  const settings={mode:'original',videos:{}};
  try{
   const saved=JSON.parse(storage.getItem(KEY)||'null');
   if(saved?.mode==='youtube')settings.mode='youtube';
   for(const id of ids)if(validId(saved?.videos?.[id]))settings.videos[id]=saved.videos[id];
  }catch{}
  return settings;
 }
 function save(storage,settings){try{storage.setItem(KEY,JSON.stringify(settings));}catch{}}
 function track(id,settings){
  const custom=settings.videos[id];
  return validId(custom)?{id:custom,title:'Your YouTube selection'}:DEFAULTS[id]||null;
 }
 function clear(host){if(host){host.replaceChildren();host.hidden=true;}}
 function mount(host,track){
  clear(host);if(!host||!validId(track?.id))return false;
  const frame=host.ownerDocument.createElement('iframe');
  frame.title=track.title+' · YouTube player';
  frame.src='https://www.youtube-nocookie.com/embed/'+track.id+'?autoplay=1&playsinline=1&controls=1';
  frame.allow='autoplay; encrypted-media; picture-in-picture';
  frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.allowFullscreen=true;host.append(frame);host.hidden=false;
  // Keep the official player visible when opted-in playback starts, including
  // when opening the music disclosure moved it above the current scroll.
  host.scrollIntoView({block:'nearest'});return true;
 }
 return Object.freeze({DEFAULTS,KEY,videoId,read,save,track,clear,mount});
});
