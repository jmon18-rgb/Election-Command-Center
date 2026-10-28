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
  if(host&&id==='abbott'&&['scene','complete'].includes(phase))return renderAbbott(host,{phase,beat,preview});
  if(host&&id==='mississippi'&&['scene','complete'].includes(phase))return renderMississippi(host,{phase,beat,preview});
  if(host&&id==='blansas'&&['scene','complete'].includes(phase))return renderKansas(host,{phase,beat,preview});
  if(host&&id==='graham'&&['scene','complete'].includes(phase))return renderGraham(host,{phase,beat,preview});
  if(host&&id==='nebraska'&&['scene','complete'].includes(phase))return renderNebraska(host,{phase,beat,preview});
  if(host&&id==='blue_corn'&&['scene','complete'].includes(phase))return renderIowa(host,{phase,beat,preview});
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
 function renderKansas(host,{phase,beat,preview}){
  const index=phase==='complete'?2:beat;if(!Number.isInteger(index)||index<0||index>2)return false;
  const doc=host.ownerDocument,el=(tag,attrs={},label)=>{const n=doc.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(label!==undefined)n.textContent=label;return n;};
  const text=(label,x,y,size=28,color='#e9f8ff')=>el('text',{x,y,'text-anchor':'middle','font-family':'Arial,sans-serif','font-size':size,'font-weight':800,fill:color},label);
  const svg=el('svg',{viewBox:'0 0 980 540',role:'img','aria-label':'Fictional Kansas Senate celebration: satirical John Brown ghost and blue ink covering an old rebel emblem; '+(preview?'simulated preview':'source-reported unofficial call'),'data-scene':'blansas','data-beat':index}),animated=[];
  svg.append(el('rect',{width:980,height:540,rx:24,fill:'#13243b'}),text('KANSAS · U.S. SENATE',490,43,23,'#9bdcff'));
  if(index<2){
   svg.append(text(index===0?'JOHN BROWN HAS ENTERED':'THE INK IS BLUE',490,105,36),el('rect',{x:95,y:164,width:790,height:266,rx:14,fill:'#5c4a52',stroke:'#a7c6d9','stroke-width':7,'data-layer':'kansas-poster-board'}));
   const emblem=el('g',{'data-layer':'old-rebel-emblem'});emblem.append(el('rect',{x:575,y:205,width:250,height:150,rx:10,fill:'#963f50'}),el('path',{d:'M600 225L800 335M800 225L600 335',stroke:'#c6a7ad','stroke-width':14}),text('JOHNNY REB',700,395,23,'#efcbd0'));svg.append(emblem);
   if(index===1){
    const ink=el('g',{'data-layer':'kansas-ink-wash'});ink.append(el('rect',{x:99,y:168,width:782,height:258,rx:12,fill:'#087ccb'}),text('KANSAS',615,310,53,'#d4f4ff'));svg.append(ink);
    animated.push({node:ink,frames:[{opacity:0,transform:'translateX(-160px)'},{opacity:1,transform:'translateX(0)'}],duration:850});
    [[560,190],[840,220],[790,413]].forEach(([x,y],i)=>{const drop=el('g',{transform:'translate('+x+' '+y+')'}),splash=el('g',{'data-layer':'blue-ink-splash',style:'transform-box:fill-box;transform-origin:center'});splash.append(el('path',{d:'M0-25L8-10 27-9 15 4 20 24 0 15-20 24-15 4-27-9-8-10Z',fill:'#5dd2ff'}));drop.append(splash);svg.append(drop);animated.push({node:splash,frames:[{opacity:0,transform:'scale(.1)'},{opacity:1,transform:'scale(1.3)'},{opacity:1,transform:'scale(1)'}],duration:600,delay:300+i*180});});
   }
   const position=el('g',{transform:'translate(285 280) scale(.7)'}),ghost=el('g',{'data-layer':'john-brown-ghost',style:'transform-box:fill-box;transform-origin:center'});
   ghost.append(el('path',{d:'M-117 128q1-83 70-100L0 18l56 19q61 13 75 91',fill:'#d8e5e9',stroke:'#163049','stroke-width':8}),el('path',{d:'M-67-28q-20-70 0-113h134q22 50 0 113',fill:'#2b3d4c'}),el('rect',{x:-92,y:-152,width:184,height:18,rx:9,fill:'#253444'}),el('ellipse',{cx:0,cy:-45,rx:64,ry:78,fill:'#dcc6ad'}),el('path',{d:'M-64-28q10 71 51 96L0 144 34 71q45-27 31-104L19 30 0 49l-24-23Z',fill:'#ddeaf2'}),el('path',{d:'M-61-50q23-10 45 0M18-50q22-10 45 0',stroke:'#26313d','stroke-width':8}));position.append(ghost);svg.append(position);
   if(index===0)animated.push({node:ghost,frames:[{opacity:0,transform:'translateY(35px)'},{opacity:1,transform:'translateY(0)'}],duration:900});
   svg.append(text('ILLUSTRATIVE CELEBRATION ART · SATIRE',490,480,22,'#a8d7e9'));
  }else{
   const card=el('g',{'data-layer':'kansas-victory-card',style:'transform-box:fill-box;transform-origin:center'});card.append(el('rect',{x:100,y:135,width:780,height:275,rx:25,fill:'#087ccb',stroke:'#96e5ff','stroke-width':6}),text('BLANSAS',490,220,62),text('KANSAS SENATE',490,288,39,'#c4efff'),text('THE INK IS BLUE',490,353,33));svg.append(card,text("JOHN BROWN'S GHOST APPROVES · SATIRE",490,478,24,'#a8d7e9'));
   animated.push({node:card,frames:[{opacity:0,transform:'scale(.9)'},{opacity:1,transform:'scale(1)'}],duration:750});
  }
  svg.append(text(preview?'SIMULATED PREVIEW · NO REAL VICTORY CLAIM':'SOURCE-REPORTED CALL · UNOFFICIAL',490,520,17,'#b9d9ed'));
  return finish(host,svg,animated,'blansas',index,phase);
 }
 // Original fictional stage props; no real venue, conduct or private identity.
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
 return Object.freeze({render,clear});
});
