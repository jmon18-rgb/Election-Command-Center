/* 2026 national needle cartogram: geographic navigation of the SAME
 * linked House/Senate correlated race probabilities as Four Endings.
 * A House tile represents its state's CLOSEST district, not statewide
 * partisan control. Never derive calls from partial returns or a lead.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.NationalNeedleCartogram=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 // Explicit geographic approximation, NOT GIS boundaries; 50 voting states.
 // Coordinates are deliberately sparse to preserve broad regional adjacency.
 const COORDS=[
  ['AK',0,7],['HI',1,7],['WA',1,0],['OR',1,1],['CA',0,2],
  ['MT',2,0],['ID',2,1],['WY',2,2],['NV',1,2],['UT',1,3],
  ['AZ',1,4],['CO',2,3],['NM',2,4],['ND',3,0],['SD',3,1],
  ['NE',3,2],['KS',3,3],['OK',3,4],['TX',3,5],['MN',4,0],
  ['IA',4,1],['MO',4,2],['AR',4,3],['LA',4,4],['WI',5,0],
  ['IL',5,1],['KY',5,2],['TN',5,3],['MS',5,4],['MI',6,0],
  ['IN',6,1],['WV',6,2],['NC',6,3],['AL',6,4],['OH',7,1],
  ['VA',7,2],['SC',7,3],['GA',7,4],['FL',8,5],['PA',8,1],
  ['MD',8,2],['NY',9,1],['NJ',9,2],['DE',9,3],['VT',10,0],
  ['MA',10,2],['CT',10,3],['NH',11,0],['RI',11,3],['ME',12,0]
 ];
 const SEATS={AL:7,AK:1,AZ:9,AR:4,CA:52,CO:8,CT:5,DE:1,FL:28,
  GA:14,HI:2,ID:2,IL:17,IN:9,IA:4,KS:4,KY:6,LA:6,ME:2,MD:8,
  MA:9,MI:13,MN:8,MS:4,MO:8,MT:2,NE:3,NV:4,NH:2,NJ:12,NM:3,
  NY:26,NC:14,ND:1,OH:15,OK:5,OR:6,PA:17,RI:2,SC:7,SD:1,
  TN:9,TX:38,UT:4,VT:1,VA:11,WA:10,WV:2,WI:8,WY:1};
 const ALL=new Set(COORDS.map(x=>x[0]));
 const validProbability=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100;
 function normalize(record,office){
  if(!record||record.office!==office||typeof record.race_code!=='string'||
     !validProbability(record.dem_beats_rep_pct))return null;
  const code=record.race_code,st=code.slice(0,2);
  if(!ALL.has(st))return null;
  if(office==='senate'&&code!==st+'-SEN')return null;
  if(office==='house'){
   if(!new RegExp('^'+st+'-[0-9]{2}$').test(code))return null;
   const district=Number(code.slice(3));
   if(!Number.isInteger(district)||district<1||district>SEATS[st])return null;
  }
  return {office,race_code:code,state:st,
   dem_beats_rep_pct:record.dem_beats_rep_pct,
   provider_called_party:['D','R'].includes(record.provider_called_party)?
    record.provider_called_party:null};
 }
 function build(records,mode='senate'){
  const office=mode==='house'?'house':'senate',by=new Map(),seen=new Set();
  for(const raw of Array.isArray(records)?records:[]){
   const row=normalize(raw,office);if(!row||seen.has(row.race_code))continue;
   seen.add(row.race_code);
   if(!by.has(row.state))by.set(row.state,[]);
   by.get(row.state).push(row);
  }
  const tiles=COORDS.map(([state,col,row])=>{
   const contests=(by.get(state)||[]).sort((a,b)=>
    Math.abs(a.dem_beats_rep_pct-50)-Math.abs(b.dem_beats_rep_pct-50)||
    a.race_code.localeCompare(b.race_code));
   const race=contests[0]||null,p=race?.dem_beats_rep_pct;
   const band=!race?'missing':p>=90?'strong-d':p>=60?'lean-d':
    p>40?'toss-up':p>10?'lean-r':'strong-r';
   return {state,col,row,race,contests,band};
  });
  return {office,tiles,contested:tiles.filter(x=>x.race).length,
   races:seen.size};
 }
 const display=(race)=>{
  if(!race)return 'No linked model probability';
  const p=race.dem_beats_rep_pct,lead=p>=50?'D':'R';
  const chance=lead==='D'?p:100-p;
  const party=race.race_code==='NE-SEN'&&lead==='D'?'Independent/D-side':lead;
  return party+' '+chance.toFixed(1)+'% model chance';
 };
 function render(host,records,doc,{available=false,modelAsOf=null,onOpen=null}={}){
  if(!host||!doc)return false;
  const d=(tag,className,label)=>{
   const e=doc.createElement(tag);
   if(className)e.className=className;
   if(label!==undefined)e.textContent=label;
   return e;
  };
  // State of the user's selections survives source refresh and model reruns.
  let mode=host.__needleMode==='house'?'house':'senate';
  let selected=ALL.has(host.__needleSelected)?host.__needleSelected:null;
  const draw=()=>{
   host.replaceChildren();
   const controls=d('div','en-nmap-controls');
   for(const [value,label] of [['senate','Senate map'],['house','House tipping districts']]){
    const b=d('button','en-nmap-mode',label);b.type='button';
    b.setAttribute('aria-pressed',String(mode===value));
    b.addEventListener('click',()=>{mode=value;host.__needleMode=mode;selected=null;draw()});
    controls.append(b);
   }
   const count=build(available?records:[],mode);
   controls.append(d('span','en-nmap-count',
    available?(mode==='senate'?count.contested+' states with Senate contests':
     count.races+' modeled House districts · '+count.contested+' states'):
     'Linked model pending'));
   host.append(controls);
   const frame=d('div','en-nmap-scroll');
   frame.setAttribute('role','region');
   frame.setAttribute('aria-label','U.S. state tile map; scroll sideways on small screens');
   frame.tabIndex=0;
   const grid=d('div','en-nmap-grid');
   for(const t of count.tiles){
    const b=d('button','en-nmap-state '+t.band,t.state);
    b.type='button';b.style.gridColumn=String(t.col+1);
    b.style.gridRow=String(t.row+1);
    if(t.race){
     const sub=d('small','',mode==='house'?t.race.race_code.slice(3):
       Math.round(t.race.dem_beats_rep_pct)+'% D');
     b.append(sub);
     if(t.race.provider_called_party)b.append(d('i','en-nmap-call','✓'));
    }
    b.setAttribute('aria-pressed',String(selected===t.state));
    const note=!available?'Linked model snapshot unavailable':
     t.race?t.race.race_code+' · '+display(t.race)+
      (t.race.provider_called_party?' · source-reported '+t.race.provider_called_party+
       ' call, unofficial':''):
     mode==='senate'?'No 2026 Senate election in this state':'No eligible district probability';
    b.title=t.state+' · '+note;
    b.setAttribute('aria-label',t.state+', '+note);
    b.addEventListener('click',()=>{selected=t.state;host.__needleSelected=selected;draw()});
    grid.append(b);
   }
   frame.append(grid);host.append(frame);
   const legend=d('div','en-nmap-legend');
   for(const [cls,label] of [
    ['strong-r','R ≥90%'],['lean-r','R 60–90%'],
    ['toss-up','Competitive'],['lean-d','D 60–90%'],
    ['strong-d','D ≥90%'],['missing','No race / pending']]){
    const item=d('span','en-nmap-legend-item');
    item.append(d('i','en-nmap-dot '+cls),d('span','',label));
    legend.append(item);
   }
   host.append(legend);
   const foot=d('div','en-nmap-detail');
   const active=count.tiles.find(x=>x.state===selected)||null;
   if(!available)foot.append(d('p','','Waiting for current, matching joint forecast. No stale percentages shown.'));
   else if(!active)foot.append(d('p','',
    mode==='senate'?'Select a state to inspect its 2026 Senate race. Gray states have no Senate contest.':
    'Each state shows its most uncertain House district, not the party expected to win the state. Select a tile to inspect.'));
   else if(!active.race)foot.append(d('p','',active.state+' · '+(mode==='senate'?
    'No 2026 Senate seat up for election':'No validated linked House probability for this state')));
   else{
    const label=d('strong','',active.race.race_code+' · '+display(active.race));
    foot.append(label);
    foot.append(d('p','',active.race.provider_called_party?
     'Source-reported '+active.race.provider_called_party+' winner flag is included in the linked model; unofficial and retractable.':
     'MODEL FORECAST — not a projected or source-confirmed winner. Raw partial vote leads do not move this probability.'));
    if(mode==='house'&&active.contests.length>1)
     foot.append(d('p','en-nmap-more',
      'Next closest districts: '+active.contests.slice(1,4).map(x=>
       x.race_code+' ('+display(x)+')').join(' · ')));
    if(typeof onOpen==='function'){
     const open=d('button','en-nmap-open','Explore '+active.race.race_code+' in model');
     open.type='button';open.addEventListener('click',()=>onOpen(active.race));
     foot.append(open);
    }
   }
   host.append(foot);
   host.append(d('p','en-nmap-method',
    '50-state tile cartogram (approximate geography; not district boundaries). '+
    (mode==='house'?'House colors describe one selected district per state, never statewide House control. ':
     'Only states with 2026 Senate elections are colored. ')+
    'Probabilities come only from the linked correlated JackStradamus model'+
    (modelAsOf?' · source snapshot '+modelAsOf:'')+
    '. ✓ means an explicitly source-reported call, not certification. '+
    'County/precinct counts remain descriptive until geography is calibrated.'));
  };
  draw();return true;
 }
 return {build,normalize,display,render,COORDS};
});
