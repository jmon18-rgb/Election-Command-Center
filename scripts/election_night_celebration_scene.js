/* Original repository SVG scene layers; presentation only, never call eligibility.
 * Horns path: assets/milestone-talarico.svg. Illustrative Texas outline:
 * assets/milestone-blexas.svg. No external image/audio or reporting geography. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightCelebrationScene=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg',states=new WeakMap();let serial=0;
 const horns='M375 383L357 175Q355 143 376 142Q397 141 401 169L421 273 430 257Q446 240 462 258L473 278 478 263Q493 244 513 259L528 277 550 155Q555 130 575 136Q595 141 591 167L579 341Q578 410 531 431L443 431Q397 416 375 383Z';
 const texas='M311 115L650 117 650 220 731 221 692 284 639 281 606 352 549 425 466 396 419 346 329 346 329 257 311 257Z';
 const star='M0-20L6-7 21-6 10 3 13 18 0 10-13 18-10 3-21-6-6-7Z';
 function clear(host){
  if(!host)return;
  const state=states.get(host);
  if(state){for(const animation of state.animations)try{animation.cancel()}catch{}
   state.media?.removeEventListener?.('change',state.onMotionChange);states.delete(host);}
  host.replaceChildren();host.hidden=true;
  host.removeAttribute('data-celebration-scene');host.removeAttribute('data-beat');
 }
 function render(host,{id,phase,beat=0,preview=true}={}){
  clear(host);
  if(!host||id!=='talarico'||!['scene','complete'].includes(phase))return false;
  const index=phase==='complete'?2:beat;
  if(!Number.isInteger(index)||index<0||index>2)return false;
  const doc=host.ownerDocument,uid='talarico-stadium-'+(++serial);
  const el=(tag,attrs={},text)=>{const n=doc.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;};
  const text=(label,x,y,size=30,fill='#e9f8ff')=>el('text',{x,y,'text-anchor':'middle','font-family':'Arial,sans-serif','font-size':size,'font-weight':800,fill},label);
  const svg=el('svg',{viewBox:'0 0 980 540',role:'img','aria-label':'Texas Senate celebration - '+(preview?'simulated preview':'source-reported unofficial call'),'data-scene':'talarico','data-beat':index});
  const defs=el('defs'),gradient=el('linearGradient',{id:uid,x2:0,y2:1});
  gradient.append(el('stop',{offset:0,'stop-color':'#06142c'}),el('stop',{offset:1,'stop-color':'#07558c'}));defs.append(gradient);svg.append(defs);
  svg.append(el('rect',{width:980,height:540,rx:24,fill:'url(#'+uid+')'}),
   el('path',{d:'M55 0L370 430H200Z M925 0L610 430H780Z',fill:'#29aaff',opacity:.18,'data-layer':'stadium-lights'}),
   text('TEXAS · U.S. SENATE',490,43,22,'#a7dcff'));
  const animated=[];
  if(index===0){
   const hand=el('g',{'data-layer':'blue-horns',style:'transform-box:fill-box;transform-origin:center'});
   hand.append(el('path',{d:horns,fill:'#168de4',stroke:'#a5e7ff','stroke-width':10,'stroke-linejoin':'round'}),
    el('path',{d:'M427 319Q482 293 543 321M438 355L529 355',fill:'none',stroke:'#064574','stroke-width':9,'stroke-linecap':'round'}));svg.append(hand);
   animated.push({node:hand,frames:[{transform:'translateY(42px) scale(.75)',opacity:0},{transform:'translateY(0) scale(1.04)',opacity:1},{transform:'translateY(0) scale(1)',opacity:1}],duration:1100});
   svg.append(text('HOOK ’EM BLUE',490,478,40));
  }else if(index===1){
   svg.append(el('path',{d:texas,fill:'#087bc8',stroke:'#abeaff','stroke-width':9,'stroke-linejoin':'round','data-layer':'texas-silhouette'}));
   const stars=el('g',{'data-layer':'spreading-stars'});
   [[380,180],[500,190],[600,240],[430,285],[540,345]].forEach(([x,y],i)=>{
    const position=el('g',{transform:'translate('+x+' '+y+')'}),burst=el('g',{'data-layer':'blue-star',style:'transform-box:fill-box;transform-origin:center'});
    burst.append(el('path',{d:star,fill:'#d9f6ff',stroke:'#5ed1ff','stroke-width':2}));position.append(burst);stars.append(position);
    animated.push({node:burst,frames:[{transform:'scale(.1)',opacity:0},{transform:'scale(1.35)',opacity:1},{transform:'scale(1)',opacity:1}],duration:650,delay:i*170});
   });svg.append(stars,text('ONE SENATE RACE. A VERY BIG STATE.',490,478,29));
  }else{
   const card=el('g',{'data-layer':'senate-victory-card',style:'transform-box:fill-box;transform-origin:center'});
   card.append(el('rect',{x:115,y:120,width:750,height:290,rx:28,fill:'#087ccb',stroke:'#a5e7ff','stroke-width':7}),
    text('JAMES TALARICO',490,215,48),text('TEXAS SENATE',490,286,38,'#a7e6ff'),text('HOOK ’EM BLUE',490,351,32));svg.append(card,text('THE GOVERNOR RACE HAS ITS OWN STORY.',490,478,26));
   animated.push({node:card,frames:[{transform:'translateY(26px) scale(.9)',opacity:0},{transform:'translateY(0) scale(1)',opacity:1}],duration:850});
  }
  svg.append(text(preview?'SIMULATED PREVIEW · NO REAL VICTORY CLAIM':'SOURCE-REPORTED CALL · UNOFFICIAL',490,518,17,'#b9d9ed'));
  host.append(svg);host.hidden=false;host.dataset.celebrationScene='talarico';host.dataset.beat=String(index);
  const media=doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)'),state={animations:[],media,onMotionChange:null};
  state.onMotionChange=e=>{if(e.matches){for(const animation of state.animations)try{animation.cancel()}catch{}state.animations=[];}};
  media?.addEventListener?.('change',state.onMotionChange);states.set(host,state);
  if(phase==='scene'&&!media?.matches){for(const a of animated){
   if(typeof a.node.animate==='function')state.animations.push(a.node.animate(a.frames,{duration:a.duration,delay:a.delay||0,easing:'ease-out',fill:'both'}));
  }}
  return true;
 }
 return Object.freeze({render,clear});
});
