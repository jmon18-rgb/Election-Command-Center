/* Original repository SVG scene layers and optional owner-supplied artwork;
 * presentation only, never call eligibility.
 * Horns path: assets/milestone-talarico.svg. Illustrative Texas outline:
 * assets/milestone-blexas.svg. No external image/audio or reporting geography. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightCelebrationScene=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg',states=new WeakMap(),failedArtwork=new WeakMap();let serial=0;
 const horns='M375 383L357 175Q355 143 376 142Q397 141 401 169L421 273 430 257Q446 240 462 258L473 278 478 263Q493 244 513 259L528 277 550 155Q555 130 575 136Q595 141 591 167L579 341Q578 410 531 431L443 431Q397 416 375 383Z';
 const texas='M311 115L650 117 650 220 731 221 692 284 639 281 606 352 549 425 466 396 419 346 329 346 329 257 311 257Z';
 const star='M0-20L6-7 21-6 10 3 13 18 0 10-13 18-10 3-21-6-6-7Z';
 function clear(host){
  if(!host)return;
  const state=states.get(host);
  if(state){for(const animation of state.animations)try{animation.cancel()}catch{}
   state.media?.removeEventListener?.('change',state.onMotionChange);state.dispose?.();
   if(state.restoreAria){if(state.restoreAria.present)host.setAttribute('aria-hidden',state.restoreAria.value);else host.removeAttribute('aria-hidden');}
   states.delete(host);}
  host.replaceChildren();host.hidden=true;
  host.removeAttribute('data-celebration-scene');host.removeAttribute('data-beat');
 }
 function render(host,{id,phase,beat=0,preview=true,ownerArtwork=null}={}){
  // A new playback may retry its artwork. Per-beat clears must retain known
  // failures so later beats use their SVG immediately instead of flickering.
  if(host&&phase==='announcement')failedArtwork.delete(host);
  clear(host);
  const ownerFiles={abbott:'celebration-owner-abbott.jpg',graham:'celebration-owner-graham.jpg',blansas:'celebration-owner-kansas.jpg',mississippi:'celebration-owner-mississippi.jpg'};
  const ownerFile=ownerFiles[id],ownerUrl=ownerArtwork?.url;
  const ownerPath=typeof ownerUrl==='string'?(ownerUrl.startsWith('./')?ownerUrl.slice(2):ownerUrl):'';
  const ownerMatch=ownerPath.match(/^assets\/([^?]+)(?:\?v=[a-f0-9]{8,64})?$/);
  if(host&&phase==='complete'&&ownerFile&&ownerMatch?.[1]===ownerFile&&typeof ownerArtwork.alt==='string'&&ownerArtwork.alt.trim()&&ownerArtwork.alt.length<=500&&!failedArtwork.get(host)?.has(ownerUrl))return renderOwnerArtwork(host,{id,phase,beat,preview,ownerArtwork});
  if(host&&id==='abbott'&&['scene','complete'].includes(phase))return renderAbbott(host,{phase,beat,preview});
  if(host&&id==='mississippi'&&['scene','complete'].includes(phase))return renderMississippi(host,{phase,beat,preview});
  if(host&&id==='blansas'&&['scene','complete'].includes(phase))return renderKansas(host,{phase,beat,preview});
  if(host&&id==='graham'&&['scene','complete'].includes(phase))return renderGraham(host,{phase,beat,preview});
  if(host&&id==='nebraska'&&['scene','complete'].includes(phase))return renderNebraska(host,{phase,beat,preview});
  if(host&&id==='blue_corn'&&['scene','complete'].includes(phase))return renderIowa(host,{phase,beat,preview});
  if(host&&id==='maine'&&['scene','complete'].includes(phase))return renderMaine(host,{phase,beat,preview});
  if(host&&['ohio','blexas','tsunami'].includes(id)&&['scene','complete'].includes(phase))return renderFinalRoster(host,{id,phase,beat,preview});
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
  return finish(host,svg,animated,'talarico',index,phase);
 }
 function finish(host,svg,animated,id,index,phase){
  host.append(svg);host.hidden=false;host.dataset.celebrationScene=id;host.dataset.beat=String(index);
  const doc=host.ownerDocument;
  const media=doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)'),state={animations:[],media,onMotionChange:null};
  state.onMotionChange=e=>{if(e.matches){for(const animation of state.animations)try{animation.cancel()}catch{}state.animations=[];}};
  media?.addEventListener?.('change',state.onMotionChange);states.set(host,state);
  if(phase==='scene'&&!media?.matches){for(const a of animated){
   if(typeof a.node.animate==='function')state.animations.push(a.node.animate(a.frames,{duration:a.duration,delay:a.delay||0,easing:'ease-out',fill:'both'}));
  }}
  return true;
 }
 function renderOwnerArtwork(host,{id,phase,beat,preview,ownerArtwork}){
  const index=2,doc=host.ownerDocument,figure=doc.createElement('figure'),image=doc.createElement('img'),caption=doc.createElement('figcaption');
  figure.className='en-celebration-owner-art';figure.setAttribute('data-layer','owner-'+id+'-artwork');
  image.className='en-celebration-owner-image';image.setAttribute('alt',ownerArtwork.alt);image.setAttribute('decoding','async');
  caption.className='en-celebration-owner-label';caption.textContent=((id==='abbott'||ownerArtwork.aiGenerated===true)?'AI-GENERATED · ':'')+'OWNER-SUPPLIED · FICTIONAL POLITICAL SATIRE · '+(preview?'SIMULATED PREVIEW · NO REAL VICTORY CLAIM':'SOURCE-REPORTED CALL · UNOFFICIAL');
  figure.append(image,caption);
  const restoreAria={present:host.hasAttribute('aria-hidden'),value:host.getAttribute('aria-hidden')};
  host.setAttribute('aria-hidden','false');finish(host,figure,[],id,index,phase);
  const state=states.get(host);state.restoreAria=restoreAria;
  const fail=()=>{
   if(states.get(host)!==state||!host.contains(image))return;
   if(!failedArtwork.has(host))failedArtwork.set(host,new Set());failedArtwork.get(host).add(ownerArtwork.url);
   render(host,{id,phase,beat,preview,ownerArtwork:null});
  };
  state.dispose=()=>image.removeEventListener('error',fail);image.addEventListener('error',fail);
  image.setAttribute('src',ownerArtwork.url);return true;
 }
 function renderAbbott(host,{phase,beat,preview}){
  const index=phase==='complete'?2:beat;if(!Number.isInteger(index)||index<0||index>2)return false;
  const doc=host.ownerDocument,el=(tag,attrs={},label)=>{const n=doc.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(label!==undefined)n.textContent=label;return n;};
  const text=(label,x,y,size=28,color='#e9f8ff')=>el('text',{x,y,'text-anchor':'middle','font-family':'Arial,sans-serif','font-size':size,'font-weight':800,fill:color},label);
  const svg=el('svg',{viewBox:'0 0 980 540',role:'img','aria-label':'Fictional Texas governor campaign sign crushed by a falling tree','data-scene':'abbott','data-beat':index}),animated=[];
  svg.append(el('rect',{width:980,height:540,rx:24,fill:'#071d32'}),text('TEXAS · GOVERNOR',490,43,23,'#9bdcff'));
  if(index<2){
   svg.append(el('path',{d:'M0 470Q230 410 490 460T980 440V540H0Z',fill:'#12405a'}));
   const sign=el('g',{'data-layer':'campaign-sign',style:'transform-box:fill-box;transform-origin:center bottom;'+(index===1?'transform:rotate(13deg)':'')});
   sign.append(el('path',{d:'M580 330V470M770 330V470',stroke:'#9cb1ba','stroke-width':10}),el('rect',{x:515,y:260,width:320,height:120,rx:10,fill:'#8a344a',stroke:'#d0a1aa','stroke-width':5}),text('ABBOTT',675,310,40),text('CAMPAIGN',675,347,22));svg.append(sign);
   const position=el('g',{transform:'translate(250 470)'}),tree=el('g',{'data-layer':'falling-tree',style:'transform-box:fill-box;transform-origin:center bottom;transform:rotate('+(index===1?68:0)+'deg)'});
   tree.append(el('path',{d:'M-16 0L-12-220 12-220 20 0Z',fill:'#8a674b'}),el('path',{d:'M0-200L-55-258M0-218L54-278',stroke:'#8a674b','stroke-width':15}),el('ellipse',{cx:0,cy:-265,rx:110,ry:83,fill:'#208c85'}),el('ellipse',{cx:-55,cy:-234,rx:70,ry:55,fill:'#34a6a2'}));position.append(tree);svg.append(position);
   if(index===0){svg.append(text('THE CAMPAIGN HAS A PROBLEM',490,110,31));animated.push({node:tree,frames:[{transform:'rotate(-3deg)'},{transform:'rotate(4deg)'},{transform:'rotate(0deg)'}],duration:1400});}
   else{
    animated.push({node:tree,frames:[{transform:'rotate(0deg)'},{transform:'rotate(68deg)'}],duration:1050});
    const stamp=el('g',{'data-layer':'voted-out-stamp',style:'transform-box:fill-box;transform-origin:center'});stamp.append(el('rect',{x:520,y:180,width:320,height:64,rx:8,fill:'#087ccb'}),text('VOTED OUT',680,225,36));svg.append(stamp);
    animated.push({node:stamp,frames:[{opacity:0,transform:'scale(1.5)'},{opacity:1,transform:'scale(1)'}],duration:450,delay:950});
   }
  }else{
   const card=el('g',{'data-layer':'governor-victory-card',style:'transform-box:fill-box;transform-origin:center'});
   card.append(el('rect',{x:110,y:130,width:760,height:280,rx:25,fill:'#087ccb',stroke:'#96e5ff','stroke-width':6}),text('TIMBER, INCUMBENT.',490,225,45),text('TEXAS GOVERNOR',490,292,34,'#b3ecff'),text('A NEW CHAPTER',490,350,32));svg.append(card);
   animated.push({node:card,frames:[{opacity:0,transform:'translateY(25px)'},{opacity:1,transform:'translateY(0)'}],duration:650});
  }
  svg.append(text('A VERY BAD NIGHT FOR LAWN SIGNS.',490,487,21,'#a8d7e9'),text(preview?'SIMULATED PREVIEW · NO REAL VICTORY CLAIM':'SOURCE-REPORTED CALL · UNOFFICIAL',490,520,17,'#b9d9ed'));
  return finish(host,svg,animated,'abbott',index,phase);
 }
 // Original prop/wave shapes adapted from assets/milestone-mississippi.svg.
 // No people, new media requests, eligibility or call interpretation here.
 function renderMississippi(host,{phase,beat,preview}){
  const index=phase==='complete'?2:beat;if(!Number.isInteger(index)||index<0||index>2)return false;
  const doc=host.ownerDocument,el=(tag,attrs={},label)=>{const n=doc.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(label!==undefined)n.textContent=label;return n;};
  const text=(label,x,y,size=28,color='#e9f8ff')=>el('text',{x,y,'text-anchor':'middle','font-family':'Arial,sans-serif','font-size':size,'font-weight':800,fill:color},label);
  const svg=el('svg',{viewBox:'0 0 980 540',role:'img','aria-label':'Fictional Mississippi Senate celebration: a retired mascot prop swept into storage; '+(preview?'simulated preview':'source-reported unofficial call'),'data-scene':'mississippi','data-beat':index}),animated=[];
  svg.append(el('rect',{width:980,height:540,rx:24,fill:'#071d32'}),text('MISSISSIPPI · U.S. SENATE',490,43,23,'#9bdcff'));
  if(index<2){
   svg.append(text(index===0?'A CHANGE IN THE CURRENT':'STRAIGHT INTO STORAGE',490,105,35),el('path',{d:'M0 440Q230 410 490 445T980 430V540H0Z',fill:'#123d55'}));
   const pedestal=el('g',{'data-layer':'empty-pedestal'});pedestal.append(el('rect',{x:160,y:340,width:170,height:90,fill:'#63788b'}),el('rect',{x:143,y:327,width:204,height:22,fill:'#9db1c2'}),text('PAST ITS TIME',245,389,18));svg.append(pedestal);
   const prop=el('g',{'data-layer':'retired-mascot-prop',style:'transform-origin:0 0;transform:'+(index===0?'translate(245px,168px)':'translate(700px,250px) rotate(24deg) scale(.65)')});
   prop.append(el('path',{d:'M-56 0H56L39-57H-39Z',fill:'#bd6b64'}),el('path',{d:'M-76 0H76V15H-76Z',fill:'#904c4a'}),el('circle',{cy:48,r:34,fill:'#d8c5ac'}),el('path',{d:'M-28 51Q0 124 28 51L18 97H-18Z',fill:'#e4e8e8'}),el('path',{d:'M-32 90L-56 157H56L32 90',fill:'#a35553'}));svg.append(prop);
   const wave=el('g',{'data-layer':'blue-storage-wave'});wave.append(el('path',{d:'M-160 430Q40 270 210 355Q290 263 380 320Q340 365 390 409Q520 448 980 415V462H-160Z',fill:'#168de4',stroke:'#73d7ff','stroke-width':5}));svg.append(wave);
   if(index===0)animated.push({node:wave,frames:[{transform:'translateX(-30px)'},{transform:'translateX(0)'}],duration:1400});
   else{
    animated.push({node:prop,frames:[{transform:'translate(245px,168px)'},{transform:'translate(470px,140px) rotate(12deg) scale(.85)'},{transform:'translate(700px,250px) rotate(24deg) scale(.65)'}],duration:1450});
    animated.push({node:wave,frames:[{transform:'translateX(-430px)'},{transform:'translateX(0)'}],duration:1200});
   }
   const crate=el('g',{'data-layer':'mascot-storage-crate'});crate.append(el('rect',{x:555,y:333,width:280,height:118,rx:5,fill:'#866546',stroke:'#c39a64','stroke-width':6}),el('path',{d:'M555 355H835M555 430H835',stroke:'#543c2a','stroke-width':5}),text('RETIRED MASCOT',695,391,22,'#fff0c9'),text('STORAGE',695,420,22,'#fff0c9'));svg.append(crate,text('A CARTOON PROP. A ONE-WAY TICKET.',490,485,22,'#a8d7e9'));
  }else{
   const card=el('g',{'data-layer':'mississippi-victory-card',style:'transform-box:fill-box;transform-origin:center'});
   card.append(el('rect',{x:100,y:135,width:780,height:275,rx:25,fill:'#087ccb',stroke:'#96e5ff','stroke-width':6}),text('MISSISSIPPI',490,220,54),text('SENATE FLIPS BLUE',490,291,39,'#c4efff'),text('TURN THE PAGE',490,353,33));svg.append(card,text('OUTDATED SYMBOLS BELONG IN STORAGE.',490,478,24,'#a8d7e9'));
   animated.push({node:card,frames:[{opacity:0,transform:'translateY(24px) scale(.95)'},{opacity:1,transform:'translateY(0) scale(1)'}],duration:750});
  }
  svg.append(text(preview?'SIMULATED PREVIEW · NO REAL VICTORY CLAIM':'SOURCE-REPORTED CALL · UNOFFICIAL',490,520,17,'#b9d9ed'));
  return finish(host,svg,animated,'mississippi',index,phase);
 }
 // Original satirical ghost vocabulary from assets/milestone-blansas.svg.
 // Original civilian John Brown silhouette and Harpers Ferry engine-house cue.
 // Brown's1859 story is distinct from the later Civil War/Union-blue satire.
 function renderKansas(host,{phase,beat,preview}){
  const index=phase==='complete'?2:beat;if(!Number.isInteger(index)||index<0||index>2)return false;
  const doc=host.ownerDocument,el=(tag,attrs={},label)=>{const n=doc.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(label!==undefined)n.textContent=label;return n;};
  const text=(label,x,y,size=28,color='#e9f8ff')=>el('text',{x,y,'text-anchor':'middle','font-family':'Arial,sans-serif','font-size':size,'font-weight':800,fill:color},label);
  const svg=el('svg',{viewBox:'0 0 980 540',role:'img','aria-label':'Fictional Kansas Senate ghost-story satire: abolitionist John Brown with swept white hair, long beard and civilian frock coat beside an1859 Harpers Ferry engine house; later Union-blue symbolism is a fictional juxtaposition, not a claim that Brown served in the Civil War; '+(preview?'simulated preview':'source-reported unofficial call'),'data-scene':'blansas','data-beat':index}),animated=[];
  svg.append(el('rect',{width:980,height:540,rx:24,fill:'#101d32'}),el('path',{d:'M0 450Q245 405 490 445T980 430V540H0Z',fill:'#153b52'}),text('KANSAS · U.S. SENATE',490,43,23,'#9bdcff'));
  if(index<2){
   svg.append(text(index===0?'JOHN BROWN HAS ENTERED':'THE INK IS BLUE',490,101,36),el('rect',{x:75,y:140,width:830,height:310,rx:18,fill:'#203146',stroke:'#8bbbd6','stroke-width':5,'data-layer':'kansas-poster-board'}));
   const ferry=el('g',{'data-layer':'harpers-ferry-1859'});
   ferry.append(el('path',{d:'M95 241L227 183 360 241Z',fill:'#ad795e',stroke:'#e0b18b','stroke-width':4}),el('rect',{x:107,y:241,width:240,height:167,fill:'#8d5147',stroke:'#d8a48e','stroke-width':4}),el('path',{d:'M190 214V176H211V214M205 170V145',stroke:'#b3c8cf','stroke-width':7,fill:'none'}),el('path',{d:'M129 408V296Q129 261 164 261T199 296V408M223 408V296Q223 261 258 261T293 296V408',fill:'#253645',stroke:'#d8a48e','stroke-width':7}),el('path',{d:'M118 250H337M118 319H337M118 365H337',stroke:'#b37162','stroke-width':3,opacity:.6}),text('HARPERS FERRY',211,219,19,'#f6dfc1'),text('1859',226,435,26,'#f6dfc1'));svg.append(ferry);
   const emblem=el('g',{'data-layer':'old-rebel-emblem'});emblem.append(el('rect',{x:599,y:192,width:253,height:188,rx:13,fill:'#8d3e4d',stroke:'#c28b98','stroke-width':4}),el('path',{d:'M625 217L827 350M827 217L625 350',stroke:'#c6a7ad','stroke-width':14}),text('JOHNNY REB',726,416,28,'#efcbd0'));svg.append(emblem);
   if(index===1){
    const ink=el('g',{'data-layer':'kansas-ink-wash'});ink.append(el('rect',{x:576,y:171,width:302,height:255,rx:15,fill:'#087ccb',stroke:'#77d8ff','stroke-width':4}),text('UNION BLUE',727,301,38,'#e2f7ff'),text('THE INK IS BLUE',727,344,23,'#bdefff'));
    for(const x of [637,682,727,772,817])ink.append(el('path',{d:star,transform:'translate('+x+' 230) scale(.6)',fill:'#dbf7ff'}));svg.append(ink);
    animated.push({node:ink,frames:[{opacity:0,transform:'translateX(-160px)'},{opacity:1,transform:'translateX(0)'}],duration:850});
    [[560,190],[870,220],[840,427]].forEach(([x,y],i)=>{const drop=el('g',{transform:'translate('+x+' '+y+')'}),splash=el('g',{'data-layer':'blue-ink-splash',style:'transform-box:fill-box;transform-origin:center'});splash.append(el('path',{d:'M0-25L8-10 27-9 15 4 20 24 0 15-20 24-15 4-27-9-8-10Z',fill:'#5dd2ff'}));drop.append(splash);svg.append(drop);animated.push({node:splash,frames:[{opacity:0,transform:'scale(.1)'},{opacity:1,transform:'scale(1.3)'},{opacity:1,transform:'scale(1)'}],duration:600,delay:300+i*180});});
   }
   const position=el('g',{transform:'translate(399 285)'}),ghost=el('g',{'data-layer':'john-brown-ghost',style:'transform-box:fill-box;transform-origin:center'});
   ghost.append(
    el('path',{d:'M-136 154L-124 91Q-113 48-64 34L-31 24H33L66 35Q113 46 125 90L137 154Z',fill:'#172736',stroke:'#8ec0d4','stroke-width':5,'data-layer':'civilian-frock-coat'}),
    el('path',{d:'M-57 38L-29 26 0 61 30 26 59 39 33 87 0 69-34 87Z',fill:'#ecdfca'}),
    el('path',{d:'M-76 43L-27 28-40 102-12 152H-90ZM76 43L28 28 39 102 12 152H91Z',fill:'#334553',stroke:'#6d8b99','stroke-width':3}),
    el('path',{d:'M-14 57L0 50 16 57 5 77 12 117H-12L-5 77Z',fill:'#161c24'}),
    el('path',{d:'M-75-35Q-95-46-88-67Q-105-87-85-102Q-99-127-74-132Q-77-152-51-145Q-35-165-15-150Q7-167 25-149Q49-164 58-143Q84-146 80-122Q102-111 85-93Q98-73 78-48L72-31Z',fill:'#e5e5dc',stroke:'#9aaeb3','stroke-width':4,'data-layer':'john-brown-swept-hair'}),
    el('path',{d:'M-58-101Q-23-124 3-115Q31-123 59-99L64-45Q60-4 32 17L-28 17Q-60-3-64-45Z',fill:'#d6af88',stroke:'#6c655f','stroke-width':3}),
    el('path',{d:'M-63-96L-40-118-19-110 0-128 24-112 44-117 66-91-48-98Z',fill:'#f0eee2'}),
    el('path',{d:'M-52-67L-14-76M14-76L51-66',fill:'none',stroke:'#edece1','stroke-width':12,'stroke-linecap':'round'}),
    el('path',{d:'M-48-62L-20-65M20-65L47-61',fill:'none',stroke:'#413e3c','stroke-width':4,'stroke-linecap':'round'}),
    el('circle',{cx:-31,cy:-61,r:3.5,fill:'#172431'}),el('circle',{cx:31,cy:-61,r:3.5,fill:'#172431'}),
    el('path',{d:'M3-68L-7-34 12-29M-47-38L-36-26M38-26L48-40',fill:'none',stroke:'#8a715e','stroke-width':4,'stroke-linecap':'round'}),
    el('path',{d:'M-63-35L-48-13-24-20 0-10 24-20 49-13 64-35Q68 3 50 42Q39 69 14 84L-6 91Q-34 80-49 52Q-66 25-64 8Z',fill:'#e5e4d8',stroke:'#adbab7','stroke-width':3,'data-layer':'john-brown-long-beard'}),
    el('path',{d:'M-30-18Q0-38 31-18M-21-11L-2-8 21-12',fill:'none',stroke:'#b8c1b9','stroke-width':6,'stroke-linecap':'round'}),
    el('path',{d:'M-42 3L-29 42M-22 4L-12 65M0 1V77M21 4L12 66M43 3L29 42',fill:'none',stroke:'#bbc9c4','stroke-width':3,'stroke-linecap':'round'})
   );position.append(ghost);svg.append(position);
   if(index===0)animated.push({node:ghost,frames:[{opacity:0,transform:'translateY(35px)'},{opacity:1,transform:'translateY(0)'}],duration:900});
   svg.append(text('FICTIONAL GHOST STORY · NOT A HISTORICAL SCENE',490,483,22,'#a8d7e9'));
  }else{
   const card=el('g',{'data-layer':'kansas-victory-card',style:'transform-box:fill-box;transform-origin:center'});card.append(el('rect',{x:100,y:135,width:780,height:275,rx:25,fill:'#087ccb',stroke:'#96e5ff','stroke-width':6}),text('BLANSAS',490,220,62),text('KANSAS SENATE',490,288,39,'#c4efff'),text('THE INK IS BLUE',490,353,33));svg.append(card,text("JOHN BROWN'S GHOST APPROVES · SATIRE",490,478,24,'#a8d7e9'));
   animated.push({node:card,frames:[{opacity:0,transform:'scale(.9)'},{opacity:1,transform:'scale(1)'}],duration:750});
  }
  svg.append(text(preview?'SIMULATED PREVIEW · NO REAL VICTORY CLAIM':'SOURCE-REPORTED CALL · UNOFFICIAL',490,520,17,'#b9d9ed'));
  return finish(host,svg,animated,'blansas',index,phase);
 }
 function renderGraham(host,{phase,beat,preview}){
  const index=phase==='complete'?2:beat;if(!Number.isInteger(index)||index<0||index>2)return false;
  const doc=host.ownerDocument,el=(tag,attrs={},label)=>{const n=doc.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(label!==undefined)n.textContent=label;return n;};
  const text=(label,x,y,size=28,color='#f5efff')=>el('text',{x,y,'text-anchor':'middle','font-family':'Arial,sans-serif','font-size':size,'font-weight':800,fill:color},label);
  const svg=el('svg',{viewBox:'0 0 980 540',role:'img','aria-label':'Fictional Graham election-stage farewell, not a real venue or conduct; '+(preview?'simulated preview':'source-reported unofficial call'),'data-scene':'graham','data-beat':index}),animated=[];
  svg.append(el('rect',{width:980,height:540,rx:24,fill:'#1c1735'}),text('SOUTH CAROLINA · U.S. SENATE',490,43,23,'#cbb3ff'));
  const lights=el('g',{'data-layer':'theatrical-spotlights',style:'transform-box:fill-box;transform-origin:center top'});lights.append(el('path',{d:'M80 80L410 455H130Z',fill:'#ca72e5',opacity:.2}),el('path',{d:'M900 80L570 455H850Z',fill:'#63bdff',opacity:.2}));svg.append(lights);
  if(index<2){
   animated.push({node:lights,frames:[{transform:'rotate(-4deg)'},{transform:'rotate(4deg)'},{transform:'rotate(0deg)'}],duration:1700});
   if(index===0){
    const ball=el('g',{'data-layer':'farewell-disco-ball',style:'transform-box:fill-box;transform-origin:center'});ball.append(el('path',{d:'M490 65V108',stroke:'#b6a6cd','stroke-width':6}),el('circle',{cx:490,cy:180,r:70,fill:'#a1a6c1',stroke:'#e2deff','stroke-width':4}),el('path',{d:'M430 150H550M422 180H558M430 210H550M465 115Q445 180 465 245M490 110V250M515 115Q535 180 515 245',stroke:'#525e88','stroke-width':4}));svg.append(ball);
    animated.push({node:ball,frames:[{transform:'rotate(-6deg)'},{transform:'rotate(6deg)'},{transform:'rotate(0deg)'}],duration:1600});
    const marquee=el('g',{'data-layer':'graham-neon-marquee'});marquee.append(el('rect',{x:130,y:300,width:720,height:105,rx:18,fill:'#312345',stroke:'#e4a5f3','stroke-width':6}),text('LAST CALL, GRAHAM',490,367,46));svg.append(marquee);
   }else{
    svg.append(el('rect',{x:110,y:145,width:760,height:100,rx:18,fill:'#32224e',stroke:'#bc8ce6','stroke-width':5}),text('THE VIP LIST HAS CHANGED',490,208,38));
    const pass=el('g',{'data-layer':'incumbent-stage-pass',style:'transform-box:fill-box;transform-origin:center;transform:translateX(400px) rotate(12deg) scale(.65);opacity:.5'});pass.append(el('rect',{x:160,y:280,width:320,height:100,rx:13,fill:'#704166',stroke:'#dbabd0','stroke-width':4}),text('INCUMBENT PASS',320,340,28));svg.append(pass);
    animated.push({node:pass,frames:[{transform:'translateX(0) rotate(0deg) scale(1)',opacity:1},{transform:'translateX(400px) rotate(12deg) scale(.65)',opacity:.5}],duration:1300});
    const exit=el('g',{'data-layer':'stage-exit'});exit.append(el('rect',{x:790,y:275,width:110,height:115,rx:9,fill:'#075984',stroke:'#8bd7ff','stroke-width':4}),text('EXIT',845,344,29));svg.append(exit,text('SOUTH CAROLINA TAKES THE SPOTLIGHT',490,435,25,'#cbb3ff'));
   }
  }else{
   const card=el('g',{'data-layer':'graham-finale',style:'transform-box:fill-box;transform-origin:center'});card.append(el('rect',{x:100,y:140,width:780,height:270,rx:25,fill:'#245689',stroke:'#c49bf4','stroke-width':6}),text('SOUTH CAROLINA',490,221,48),text('A NEW HEADLINER',490,290,37,'#d9d4ff'),text('LOL, GRAHAM',490,355,38));svg.append(card);
   animated.push({node:card,frames:[{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'translateY(0)'}],duration:750});
  }
  svg.append(text('FICTIONAL STAGE · NOT A REAL VENUE',490,480,22,'#c1b2db'),text(preview?'SIMULATED PREVIEW · NO REAL VICTORY CLAIM':'SOURCE-REPORTED CALL · UNOFFICIAL',490,520,17,'#c5d1ed'));
  return finish(host,svg,animated,'graham',index,phase);
 }
 // Football satire: coach Tom Osborne is distinct from candidate Dan Osborn.
 function renderNebraska(host,{phase,beat,preview}){
  const index=phase==='complete'?2:beat;if(!Number.isInteger(index)||index<0||index>2)return false;
  const doc=host.ownerDocument,el=(tag,attrs={},label)=>{const n=doc.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(label!==undefined)n.textContent=label;return n;};
  const text=(label,x,y,size=28,color='#f5f5e4')=>el('text',{x,y,'text-anchor':'middle','font-family':'Arial,sans-serif','font-size':size,'font-weight':800,fill:color},label);
  const svg=el('svg',{viewBox:'0 0 980 540',role:'img','aria-label':'Nebraska football satire; fictional reaction of coach Tom Osborne, distinct from candidate Dan Osborn; '+(preview?'simulated preview':'source-reported unofficial call'),'data-scene':'nebraska','data-beat':index}),animated=[];
  svg.append(el('rect',{width:980,height:540,rx:24,fill:'#152f34'}),text('NEBRASKA · INDEPENDENT SENATE',490,43,23,'#b7e1e4'),el('path',{d:'M25 400Q250 370 490 400T955 400V465H25Z',fill:'#8f7b37'}));
  const corn=el('g',{'data-layer':'cornfield',stroke:'#c9b35c','stroke-width':7,fill:'none'});for(const x of [65,125,185,795,855,915])corn.append(el('path',{d:`M${x} 450V275M${x} 330q-35-35-35-10M${x} 360q35-35 35-10`}));svg.append(corn);
  if(index===0){
   const coach=el('g',{'data-layer':'coach-tom-osborne',style:'transform-box:fill-box;transform-origin:center bottom'});
   coach.append(el('path',{d:'M365 403L380 300Q490 260 600 300L615 403Z',fill:'#ad3e45',stroke:'#e9c3ad','stroke-width':4}),el('ellipse',{cx:490,cy:215,rx:68,ry:76,fill:'#dfb595'}),el('path',{d:'M420 190Q422 120 490 120Q558 120 558 190Z',fill:'#ad3e45'}),el('rect',{x:415,y:177,width:175,height:18,rx:8,fill:'#d7b99b'}),el('path',{d:'M450 215h25m30 0h25m-60 54q20-25 40 0',stroke:'#4d3f3e','stroke-width':6,fill:'none','stroke-linecap':'round'}));svg.append(coach);
   animated.push({node:coach,frames:[{transform:'rotate(0deg)'},{transform:'rotate(-4deg)'},{transform:'rotate(-2deg)'}],duration:1400});
   svg.append(text('COACH TOM OSBORNE',490,350,29),text('FICTIONAL SIDELINE REACTION',490,435,23,'#d5dcbd'));
  }else if(index===1){
   const board=el('g',{'data-layer':'absurd-scoreboard',style:'transform-box:fill-box;transform-origin:center'});board.append(el('rect',{x:205,y:120,width:570,height:260,rx:16,fill:'#061f2d',stroke:'#75c9e4','stroke-width':5}),text('UPSET ON THE PRAIRIE',490,173,32),text('ESTABLISHMENT    0',490,248,35,'#d0dce2'),text('CORN                    1',490,314,35,'#f0d77c'));svg.append(board,text('COMEDY SCOREBOARD · NOT VOTE TOTALS',490,430,22,'#d5dcbd'));
   animated.push({node:board,frames:[{transform:'translateY(-40px)',opacity:0},{transform:'translateY(0)',opacity:1}],duration:900});
   const confetti=el('g',{'data-layer':'blue-confetti',style:'transform-box:fill-box;transform-origin:center'});for(let i=0;i<16;i++)confetti.append(el('rect',{x:70+i*55,y:85+(i%4)*66,width:10,height:19,rx:2,fill:i%2?'#68ceff':'#b9e9ff',transform:`rotate(${i*17} ${70+i*55} ${85+(i%4)*66})`}));svg.append(confetti);
   animated.push({node:confetti,frames:[{transform:'translateY(-70px)',opacity:0},{transform:'translateY(0)',opacity:1}],duration:1400});
  }else{
   const card=el('g',{'data-layer':'nebraska-independent-finale',style:'transform-box:fill-box;transform-origin:center'});card.append(el('rect',{x:105,y:120,width:770,height:290,rx:23,fill:'#225c75',stroke:'#d2bd68','stroke-width':6}),text('CORN-FED REBELLION',490,194,43),text('DAN OSBORN',490,265,50),text('INDEPENDENT WINNER',490,325,31,'#cdefff'),text('NO ASSUMED CAUCUS',490,375,24,'#dbe5c4'));svg.append(card);
   animated.push({node:card,frames:[{opacity:0,transform:'scale(.92)'},{opacity:1,transform:'scale(1)'}],duration:750});
  }
  svg.append(text('FOOTBALL SATIRE · COACH OSBORNE ≠ CANDIDATE OSBORN',490,480,20,'#c8d3c3'),text(preview?'SIMULATED PREVIEW · NO REAL VICTORY CLAIM':'SOURCE-REPORTED CALL · UNOFFICIAL',490,520,17,'#bfdbe1'));
  return finish(host,svg,animated,'nebraska',index,phase);
 }
 function renderIowa(host,{phase,beat,preview}){
  const index=phase==='complete'?2:beat;if(!Number.isInteger(index)||index<0||index>2)return false;
  const doc=host.ownerDocument,el=(tag,attrs={},label)=>{const n=doc.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(label!==undefined)n.textContent=label;return n;};
  const text=(label,x,y,size=28,color='#f0faff')=>el('text',{x,y,'text-anchor':'middle','font-family':'Arial,sans-serif','font-size':size,'font-weight':800,fill:color},label);
  const svg=el('svg',{viewBox:'0 0 980 540',role:'img','aria-label':'Iowa Blue Corn cartoon transformation; Senate or governor event, not a reporting map; '+(preview?'simulated preview':'source-reported unofficial call'),'data-scene':'blue_corn','data-beat':index}),animated=[];
  svg.append(el('rect',{width:980,height:540,rx:24,fill:'#123c45'}),text('IOWA · STATEWIDE',490,43,23,'#b6e6e7'));
  if(index<2){
   svg.append(text(index===0?'SOMETHING IN THE CORN':'BLUE KERNELS EVERYWHERE',490,100,34));
   const ear=el('g',{'data-layer':'iowa-corn-ear',transform:'translate(490 300) scale(.8)'});
   ear.append(el('path',{d:'M-50 178C-171 110-171 25-109-105Q-104 18-24 30',fill:'#77c6a2'}),el('path',{d:'M48 173C171 91 171-6 118-112Q94 14 17 33',fill:'#55c994'}),el('rect',{x:-63,y:-152,width:126,height:293,rx:63,fill:index===0?'#b99b43':'#2b77db',stroke:'#a8dce5','stroke-width':7}));
   for(let row=0;row<7;row++)for(let col=0;col<3;col++){
    const seed=row===3&&col===1,blue=index===1||seed,kernel=el('ellipse',{cx:-33+col*33+(row%2?11:0),cy:-119+row*39,rx:16,ry:21,fill:blue?'#80d8ff':'#edc965','data-layer':seed?'first-blue-kernel':'corn-kernel'});ear.append(kernel);
    if(index===1)animated.push({node:kernel,frames:[{fill:'#edc965'},{fill:'#80d8ff'}],duration:850,delay:row*90+col*40});
    else if(seed)animated.push({node:kernel,frames:[{fill:'#edc965'},{fill:'#80d8ff'}],duration:1200});
   }
   svg.append(ear,text(index===0?'ONE BLUE KERNEL OF TRUTH':'PLEASE REMAIN CORNY',490,465,27,'#cbe9c1'));
  }else{
   const card=el('g',{'data-layer':'iowa-blue-corn-finale',style:'transform-box:fill-box;transform-origin:center'});card.append(el('rect',{x:110,y:130,width:760,height:285,rx:24,fill:'#106fab',stroke:'#a8e8ff','stroke-width':6}),text('BLUE CORN',490,220,62),text('AN ENTIRELY NORMAL HARVEST',490,292,31,'#cfedc7'),text('IOWA SENATE OR GOVERNOR',490,365,27));svg.append(card);
   animated.push({node:card,frames:[{opacity:0,transform:'scale(.9)'},{opacity:1,transform:'scale(1)'}],duration:750});
  }
  svg.append(text(preview?'SIMULATED PREVIEW · NO REAL VICTORY CLAIM':'SOURCE-REPORTED CALL · UNOFFICIAL',490,520,17,'#bfdfe9'));
  return finish(host,svg,animated,'blue_corn',index,phase);
 }
 function renderMaine(host,{phase,beat,preview}){
  const index=phase==='complete'?2:beat;if(!Number.isInteger(index)||index<0||index>2)return false;
  const doc=host.ownerDocument,el=(tag,attrs={},label)=>{const n=doc.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(label!==undefined)n.textContent=label;return n;};
  const text=(label,x,y,size=28,color='#edfaff')=>el('text',{x,y,'text-anchor':'middle','font-family':'Arial,sans-serif','font-size':size,'font-weight':800,fill:color},label);
  const svg=el('svg',{viewBox:'0 0 980 540',role:'img','aria-label':'Original Maine theatrical broom and Collins-hat sendoff parody; '+(preview?'simulated preview':'source-reported unofficial call'),'data-scene':'maine','data-beat':index}),animated=[];
  svg.append(el('rect',{width:980,height:540,rx:24,fill:'#143843'}),text('MAINE · U.S. SENATE',490,43,23,'#b3dedf'),el('path',{d:'M30 420Q260 370 490 420T950 420V460H30Z',fill:'#0c6975'}));
  if(index<2){
   svg.append(text(index===0?'A BROOM WITH A VIEW':'CHANGE IN THE AIR',490,110,36));
   const props=el('g',{'data-layer':'maine-broom-hat',style:'transform-box:fill-box;transform-origin:center;'+(index===1?'transform:translate(430px,-90px) rotate(-12deg) scale(.65);opacity:.35':'')});
   props.append(el('path',{d:'M280 340L680 290',stroke:'#bc884d','stroke-width':12,'stroke-linecap':'round'}),el('path',{d:'M300 317L225 304 230 370 310 354Z',fill:'#e4bf77',stroke:'#ba8a4d','stroke-width':4}),el('path',{d:'M370 280L455 145 495 165 565 280Z',fill:'#30234a',stroke:'#c4a7eb','stroke-width':6}),el('path',{d:'M350 280Q465 330 590 280',stroke:'#a082d5','stroke-width':18,fill:'none','stroke-linecap':'round'}),text('COLLINS',465,272,25,'#f2e7ff'));svg.append(props);
   animated.push({node:props,frames:index===0?[{transform:'translateY(25px) rotate(-4deg)',opacity:0},{transform:'translateY(0) rotate(0)',opacity:1}]:[{transform:'translate(0,0) rotate(0) scale(1)',opacity:1},{transform:'translate(430px,-90px) rotate(-12deg) scale(.65)',opacity:.35}],duration:index===0?1000:1500});
   if(index===1){
    const breeze=el('g',{'data-layer':'maine-change-breeze',fill:'none',stroke:'#92e0f1','stroke-width':5});breeze.append(el('path',{d:'M140 245Q230 210 320 245M160 300Q260 265 350 300M190 355Q300 320 410 355'}));svg.append(breeze);
    svg.append(text('PLEASE SECURE ALL POINTY HATS',490,440,25,'#c4e7e7'));
   }
  }else{
   const card=el('g',{'data-layer':'maine-next-chapter',style:'transform-box:fill-box;transform-origin:center'});card.append(el('rect',{x:95,y:135,width:790,height:280,rx:24,fill:'#126a90',stroke:'#bbd5ee','stroke-width':6}),text('DING-DONG IN MAINE',490,220,47),text('THE NEXT CHAPTER STARTS HERE',490,300,30,'#cfe8f8'),text('MAINE SENATE',490,365,29));svg.append(card);
   animated.push({node:card,frames:[{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'translateY(0)'}],duration:750});
  }
  svg.append(text('THEATRICAL SENDOFF · ORIGINAL PARODY',490,480,21,'#bdd5de'),text(preview?'SIMULATED PREVIEW · NO REAL VICTORY CLAIM':'SOURCE-REPORTED CALL · UNOFFICIAL',490,520,17,'#bfdfe9'));
  return finish(host,svg,animated,'maine',index,phase);
 }
 function renderFinalRoster(host,{id,phase,beat,preview}){
  const index=phase==='complete'?2:beat;if(!Number.isInteger(index)||index<0||index>2)return false;
  const doc=host.ownerDocument,el=(tag,attrs={},label)=>{const n=doc.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(label!==undefined)n.textContent=label;return n;};
  const text=(label,x,y,size=28,color='#effaff')=>el('text',{x,y,'text-anchor':'middle','font-family':'Arial,sans-serif','font-size':size,'font-weight':800,fill:color},label);
  const label={ohio:'OHIO · SPECIAL SENATE',blexas:'TEXAS · SENATE + GOVERNOR',tsunami:'BLUE TSUNAMI · THEATRICAL PREVIEW'}[id];
  const svg=el('svg',{viewBox:'0 0 980 540',role:'img','aria-label':label+'; '+(id==='tsunami'?'preview only, no national call':preview?'simulated preview':'source-reported unofficial calls'),'data-scene':id,'data-beat':index}),animated=[];
  svg.append(el('rect',{width:980,height:540,rx:24,fill:'#092b45'}),text(label,490,43,23,'#acdff1'));
  const card=(layer,title,subtitle,third)=>{const g=el('g',{'data-layer':layer,style:'transform-box:fill-box;transform-origin:center'});g.append(el('rect',{x:100,y:130,width:780,height:285,rx:24,fill:'#11679e',stroke:'#b6e9ff','stroke-width':6}),text(title,490,220,44),text(subtitle,490,292,30,'#c9edff'),text(third,490,365,25));svg.append(g);animated.push({node:g,frames:[{opacity:0,transform:'scale(.92)'},{opacity:1,transform:'scale(1)'}],duration:750});};
  if(id==='ohio'){
   if(index===0){
    svg.append(text('A BUCKEYE UNDER PRESSURE',490,106,32));
    const nut=el('g',{'data-layer':'ohio-buckeye',style:'transform-box:fill-box;transform-origin:center'});nut.append(el('ellipse',{cx:490,cy:285,rx:145,ry:130,fill:'#573b2c',stroke:'#d6b98c','stroke-width':12}),el('ellipse',{cx:490,cy:267,rx:92,ry:84,fill:'#d9b482'}),el('path',{d:'M498 155L475 240 505 270 480 335 506 410',fill:'none',stroke:'#163d61','stroke-width':8}));svg.append(nut);animated.push({node:nut,frames:[{transform:'scaleX(1)'},{transform:'scaleX(.9)'},{transform:'scaleX(1)'}],duration:1500});
   }else if(index===1){
    svg.append(text('BLUE-SHOCK',490,106,40));
    for(const side of [-1,1]){const half=el('path',{d:side===-1?'M485 160C300 150 300 410 485 410L460 330 485 270 465 230Z':'M495 160C680 150 680 410 495 410L520 330 495 270 515 230Z',fill:'#573b2c',stroke:'#d6b98c','stroke-width':8,'data-layer':'ohio-cracked-shell',style:`transform:translateX(${side*60}px)`});svg.append(half);animated.push({node:half,frames:[{transform:'translateX(0)'},{transform:`translateX(${side*60}px)`}],duration:1100});}
    const bolt=el('path',{d:'M492 145L445 275H490L460 421 570 250H517L552 145Z',fill:'#268dde',stroke:'#c6f2ff','stroke-width':7,'data-layer':'ohio-blue-lightning'});svg.append(bolt);animated.push({node:bolt,frames:[{opacity:0},{opacity:1}],duration:900});
   }else card('ohio-special-finale','BUCKEYE BLUE-SHOCK','OH! THAT HAPPENED','OHIO · SPECIAL SENATE');
  }else if(id==='blexas'){
   if(index<2){
    const state=el('path',{d:texas,fill:'#056fcb',stroke:'#bdeeff','stroke-width':9,'data-layer':'blexas-illustrative-texas',style:'transform-box:fill-box;transform-origin:center'});svg.append(state);animated.push({node:state,frames:[{opacity:.4},{opacity:1}],duration:900});
    if(index===0)svg.append(text('ONE ENORMOUS STATE',490,465,32));
    else {for(const [i,x]of [425,565].entries()){const badge=el('g',{'data-layer':'blexas-office-star',style:'transform-box:fill-box;transform-origin:center'});badge.append(el('path',{d:star,transform:`translate(${x} 235) scale(2)`,fill:'#e1f7ff'}),text(i===0?'SENATE':'GOVERNOR',x,320,22));svg.append(badge);animated.push({node:badge,frames:[{opacity:0,transform:'scale(.5)'},{opacity:1,transform:'scale(1)'}],duration:850,delay:i*300});}svg.append(text('TWO SEPARATE STATEWIDE CALLS',490,465,28));}
   }else card('blexas-two-call-finale','BLEXAS','TWO BLUE STARS','SENATE + GOVERNOR · BOTH CALLS REQUIRED');
  }else{
   const wave=el('g',{'data-layer':'tsunami-theatrical-wave',style:'transform-box:fill-box;transform-origin:center bottom'});wave.append(el('path',{d:'M0 468C93 394 163 438 244 410c77-26 110-82 169-165 37-54 102-79 156-70 82 14 126 102 126 175-13-40-48-65-93-65-55 0-100 44-119 89 66-36 148-2 189 47 74 89 167 59 308-3v202H0Z',transform:'translate(0 -65) scale(1 .9)',fill:'#168bdf'}),el('path',{d:'M393 279c73-120 194-133 275-32-46-39-125-34-162-14-39 22-67 51-113 91',transform:'translate(0 -65) scale(1 .9)',fill:'#c9f8ff'}));svg.append(wave);
   animated.push({node:wave,frames:[{transform:'translateY(85px) scaleY(.6)'},{transform:'translateY(0) scaleY(1)'}],duration:1500});
   if(index===0)svg.append(text('A VERY LARGE WAVE',490,100,38));
   else if(index===1){svg.append(text('PLEASE SECURE YOUR LAWN SIGNS',490,100,31));const sign=el('g',{'data-layer':'tsunami-lawn-sign',style:'transform-box:fill-box;transform-origin:center bottom;transform:rotate(18deg) translateX(40px)'});sign.append(el('path',{d:'M800 310V440',stroke:'#ccd9e2','stroke-width':8}),el('rect',{x:730,y:255,width:140,height:70,rx:8,fill:'#cc687e'}),text('RED WAVE?',800,299,19));svg.append(sign);animated.push({node:sign,frames:[{transform:'rotate(0) translateX(0)'},{transform:'rotate(18deg) translateX(40px)'}],duration:1300});}
   else card('tsunami-preview-finale','BLUE TSUNAMI','THE TIDE HAS THEATRICAL AMBITIONS','PREVIEW ONLY · NO NATIONAL CALL');
  }
  if(id==='blexas')svg.append(text('ILLUSTRATIVE TEXAS · NOT A RESULTS MAP',490,485,18,'#bddfe9'));
  svg.append(text(id==='tsunami'?'PREVIEW ONLY · NOT A FORECAST TRIGGER OR VERIFIED OUTCOME':preview?'SIMULATED PREVIEW · NO REAL VICTORY CLAIM':'SOURCE-REPORTED CALL · UNOFFICIAL',490,520,id==='tsunami'?16:17,'#bfdfe9'));
  return finish(host,svg,animated,id,index,phase);
 }
 return Object.freeze({render,clear});
});
