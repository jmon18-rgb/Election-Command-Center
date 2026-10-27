/* Personal race display, not another forecasting or source-ingestion model. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.PersonalElectionFocus=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const SENATE=Object.freeze(['IA','KS','ME','OH','MI','NE','SC','MN','MS','AK']);
 const HOUSE=Object.freeze(['VA-02','PA-10','PA-07','PA-08','MI-07','NY-17','WI-03','AZ-06']);
 const CONNECTED=new Set(['IA-SEN','KS-SEN','ME-SEN','OH-SEN',...HOUSE]);
 const finite=x=>typeof x==='number'&&Number.isFinite(x),chance=x=>finite(x)&&x>=0&&x<=100;
 const time=x=>Number.isFinite(x)?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(x)+' ET':'Time unverified';
 function rows(result,baseline,{year=2026,now=Date.now(),closes,evidence=[],simulated=false}={}){
  if(year!==2026)return [];
  const current=new Map((result?.race_probabilities||[]).map(x=>[x.race_code,x]));
  const prior=new Map((baseline?.race_probabilities||[]).map(x=>[x.race_code,x]));
  const used=new Map((result?.county_results_update?.used||[]).map(x=>[x.code,x]));
  return [...SENATE.map(state=>({code:state+'-SEN',office:'Senate',key:state==='OH'?'OH-special':state})),...HOUSE.map(code=>({code,office:'House',key:code}))].map((spec,order)=>{
   const state=spec.code.slice(0,2),entry=current.get(spec.code),base=prior.get(spec.code);
   const first=closes?.floorFor(spec.key),last=closes?.winnerFloorFor(spec.office,spec.key);
   const direct=state==='AK'?null:used.get(spec.code),ownCounts=Boolean(direct),called=state!=='AK'&&['D','R'].includes(entry?.provider_called_party);
   // Existing AK identity/round exclusions apply to this display too. A baseline
   // binary margin must not be presented as an accepted final RCV probability.
   const pct=state==='AK'||!chance(entry?.dem_beats_rep_pct)?null:entry.dem_beats_rep_pct;
   const delta=pct!==null&&chance(base?.dem_beats_rep_pct)?pct-base.dem_beats_rep_pct:null;
   const left=state==='NE'?'Osborn':'D';
   const pending=state==='AK'?'Ballot identity / ranked-choice contract pending':CONNECTED.has(spec.code)?'Own county returns not admitted':'County evidence connection pending';
   const status=ownCounts?'Own county returns used nationally':called?'Validated source call used':pending;
   const candidateStamp=direct?.as_of||(called?evidence.find(x=>x.race_code===spec.code&&x.calledParty===entry.provider_called_party)?.asOf:null);
   const sourceAt=Number.isFinite(Date.parse(candidateStamp||''))?candidateStamp:null;
   const window=Number.isFinite(first)?time(first)+(Number.isFinite(last)&&last!==first?(state==='KS'?' · conservative call gate ':'–')+time(last):''):'Time unverified';
   return {...spec,state,order,left,pct,delta,status,sourceAt,ownCounts,called,simulated:simulated||result?.county_results_update?.status==='SIMULATED_NATIONAL_REHEARSAL',
    count:direct&&finite(direct.counted_two_party_votes)?direct.counted_two_party_votes:null,
    first,last,window,started:Number.isFinite(first)&&now>=first,
    note:state==='ME'?'First-choice evidence; final RCV transfers separate':state==='NE'?'Independent; no assumed Democratic caucus':state==='AK'?'Lowest first-night priority; final RCV timing separate':!ownCounts&&(used.size||called)?'Forecast may reflect other admitted races':'',
    rank:state==='AK'?4:ownCounts||called?0:Number.isFinite(first)&&now>=first?1:2};
  }).sort((a,b)=>a.rank-b.rank||(a.first||Infinity)-(b.first||Infinity)||a.order-b.order);
 }
 function render(host,result,baseline,options={}){
  if(!host)return;const data=rows(result,baseline,options);host.hidden=!data.length;
  host.replaceChildren();if(!data.length)return;
  const doc=host.ownerDocument,el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const simulated=data.some(x=>x.simulated);
  host.append(el('h2','',(simulated?'SIMULATED · ':'')+'Your election-night needles'),el('p','methodline',simulated?'FICTIONAL COUNTS · NOT LIVE. These race needles share this simulated national update; the live dashboard is unchanged.':'Same race forecasts as the national model. Own validated returns enter once; race probabilities are never averaged back into it. Order follows admitted evidence and poll-close windows, not a promise of when votes will arrive.'));
  host.append(el('p','personal-focus-next','Focus now / next: '+data.filter(x=>x.state!=='AK').slice(0,3).map(x=>x.code+' · '+x.window).join(' | ')));
  for(const office of ['Senate','House']){
   const group=el('section','');group.append(el('h3','',office==='Senate'?'Your ten Senate races':'House power-flip watch'));
   const grid=el('div','personal-focus-grid');
   for(const row of data.filter(x=>x.office===office)){
    const card=el('article','personal-focus-card');card.dataset.race=row.code;
    card.append(el('h4','',row.code==='OH-SEN'?'Ohio · special Senate':row.code));
    card.append(el('small','',row.state==='AK'?'Late night · '+row.window:row.state==='KS'?'Counts eligible from · '+row.window:'Poll-close window · '+row.window));
    if(row.pct!==null){
     const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 200 105');svg.setAttribute('role','img');svg.setAttribute('aria-label',row.code+' '+row.left+' model win chance '+row.pct.toFixed(1)+' percent');
     const node=(tag,attrs)=>{const n=doc.createElementNS(svg.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
     svg.append(node('path',{d:'M20 90 A80 80 0 0 1 100 10',stroke:'#ce6878',fill:'none','stroke-width':9}),node('path',{d:'M100 10 A80 80 0 0 1 180 90',stroke:row.left==='Osborn'?'#d2acff':'#57b4ff',fill:'none','stroke-width':9}),node('line',{x1:100,y1:90,x2:100,y2:18,stroke:'#fff0a4','stroke-width':4,transform:'rotate('+(-90+1.8*row.pct)+' 100 90)'}));
     card.append(svg,el('strong','',row.left+' '+row.pct.toFixed(1)+'% · model win chance'));
     card.append(el('small','',row.delta===null?'Baseline comparison unavailable':(row.delta>=0?'+':'')+row.delta.toFixed(1)+' probability points vs polling baseline'));
    }else card.append(el('strong','','Needle pending'));
    card.append(el('p','',(row.simulated?'SIMULATED · ':'')+row.status));
    if(row.count!==null)card.append(el('small','',row.count.toLocaleString('en-US')+' named-candidate '+row.left+'/R votes in admitted county evidence'));
    if(row.sourceAt)card.append(el('small','',(row.ownCounts?'Count':'Call')+' source time · '+time(Date.parse(row.sourceAt))));
    if(row.note)card.append(el('small','',row.note));grid.append(card);
   }
   group.append(grid);host.append(group);
  }
  host.append(el('p','methodline','Probability changes are not vote-margin outperformance. Matched county performance remains the model evidence. NC01/AZ01 boundary contracts are still pending; existing TX and WA03 integrations remain available. KS uses the existing conservative final-call gate pending county-hours review. Experimental and uncalibrated; a forecast is not a result.'));
 }
 return Object.freeze({SENATE,HOUSE,rows,render});
});
