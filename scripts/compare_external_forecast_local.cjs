#!/usr/bin/env node
'use strict';
/*
 * Local-only analysis of user-supplied third-party tabular forecast exports.
 * No subscription data or derived records are checked into GitHub.
 * Usage:
 * node scripts/compare_external_forecast_local.cjs \
 * --house-candidates /private/house_cand.csv \
 * --house-margins /private/house_margins.csv \
 * --senate-margins /private/senate_margins.csv \
 * --house-fundamentals /private/house_fund.csv \
 * --senate-fundamentals /private/senate_fund.csv
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const FIPS=Object.freeze({
 '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
 '11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA',
 '20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN',
 '28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM',
 '36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
 '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA',
 '54':'WV','55':'WI','56':'WY'});
const normalize=x=>String(x||'').trim().toUpperCase().replace(/\s+/g,'');
const district=x=>{
 const m=/^([A-Z]{2})-?(\d{1,2})$/.exec(normalize(x));
 return m?`${m[1]}-${m[2].padStart(2,'0')}`:null;
};
function csvParse(source){
 // RFC-4180-compatible including quoted escaped delimiters/embedded lines.
 let i=0,v='',quoted=false,row=[],rows=[];
 for(;i<source.length;i++){
  const ch=source[i];
  if(ch==='"'){
   if(quoted&&source[i+1]==='"'){v+='"';i++}
   else if(v==='')quoted=!quoted;
   else if(quoted)quoted=false;
   else throw Error('CSV quote inside unquoted field');
  }else if(ch===','&&!quoted){row.push(v);v=''}
  else if((ch==='\n'||ch==='\r')&&!quoted){
   if(ch==='\r'&&source[i+1]==='\n')i++;
   row.push(v);v='';
   if(row.some(x=>x.trim()!==''))rows.push(row);
   row=[];
  }else v+=ch;
 }
 if(quoted)throw Error('Unterminated quoted CSV field');
 if(row.length||v){row.push(v);if(row.some(x=>x.trim()!==''))rows.push(row)}
 if(!rows.length)throw Error('Empty CSV input');
 const cols=rows[0].map((c,i)=>i===0?c.replace(/^\uFEFF/,''):c);
 return rows.slice(1).map((r,i)=>{
  if(r.length!==cols.length)throw Error('CSV row '+(i+2)+' wrong width');
  return Object.fromEntries(cols.map((c,j)=>[c,r[j]]));
 });
}
const fromPath=p=>csvParse(fs.readFileSync(p,'utf8'));
const signedMargin=raw=>{
 const n=Number(String(raw??'').trim().split('@@').at(-1));
 return raw===null||raw===undefined||String(raw).trim()===''||!Number.isFinite(n)?
  null:n;
};
const signedPct=raw=>{const n=Number(raw);return Number.isFinite(n)&&raw!==''?n:null};
const worstFirst=(records,attribute,n=20)=>records.sort((a,b)=>
 Math.abs(b[attribute])-Math.abs(a[attribute])||
 a.race_code.localeCompare(b.race_code)).slice(0,n);
function parseMarginRows(rows,type){
 const map=new Map();
 for(const r of rows){
  if(r['X.1']==='Race')continue;
  const code=type==='house'?district(r['X.1']):normalize(r['X.1']);
  if(!code||map.has(code))throw Error('Invalid/duplicated '+type+' margin race '+r['X.1']);
  const data={race_code:code,classic:signedMargin(r['X.2']),
   expert_unadjusted:signedMargin(r['~~~Expert ratings~~~']),
   expert_adjusted:signedMargin(r['X.3']),
   deluxe:signedMargin(r['⠀'])};
  if(!Number.isFinite(data.deluxe)||!Number.isFinite(data.classic))
   throw Error('Missing actual external forecast margin '+code);
  map.set(code,data);
 }
 return map;
}
function parseFundamentalsRows(rows,type){
 const map=new Map();
 for(const r of rows){
  if(r['X.1']==='Race')continue;
  const code=type==='house'?district(r['X.1']):normalize(r['X.1']);
  if(!code||map.has(code))throw Error('Invalid fundamentals race '+r['X.1']);
  const data={race_code:code,polls:signedMargin(r['X.2']),
   simple:signedMargin(r['~~~Fundamentals~~~']),
   fancy:signedMargin(r['X.3']),blended:signedMargin(r['X.4'])};
  if(!Number.isFinite(data.polls)||!Number.isFinite(data.blended))
   throw Error('Malformed fundamentals row '+code);
  map.set(code,data);
 }
 return map;
}
function parseHouseCandidates(rows){
 const map=new Map();
 for(const r of rows){
  const code=normalize(r.code);
  const state=FIPS[code.slice(0,2)],n=Number(code.slice(2));
  if(!state||!Number.isInteger(n)||n<1||n>53||code.length!==4)
   throw Error('Invalid or unknown US FIPS district code '+code);
  const race_code=state+'-'+String(n).padStart(2,'0');
  if(map.has(race_code))throw Error('Duplicate external district '+race_code);
  const p=signedPct(r.winner_Dparty),q=signedPct(r.winner_Rparty);
  if(p===null||q===null||p<0||q<0||p>100||q>100||
   Math.abs(p+q-100)>.06)throw Error('Invalid candidate party probability '+race_code);
  map.set(race_code,{race_code,dem_pct:p,rep_pct:q,
   dem_candidate:r.name_D1||null,rep_candidate:r.name_R1||null});
 }
 return map;
}
const mean=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:null;
const round=(n,d=2)=>n===null?null:Number(n.toFixed(d));
function compare(opts){
 const model=require('./chamber_control_model.js');
 const dataPath=n=>path.resolve(__dirname,'..','data',n+'.json');
 const read=n=>JSON.parse(fs.readFileSync(dataPath(n),'utf8'));
 const sources={seats:read('seat_universe'),history:read('house_history_2024_staging'),
  geography:read('house_geography_bridge'),
  senateHistory:read('senate_history_2020_2022_2024'),
  odds:read('race_probabilities'),polls:read('polling_estimates')};
 const house=parseHouseCandidates(fromPath(opts['house-candidates']));
 const hm=parseMarginRows(fromPath(opts['house-margins']),'house');
 const sm=parseMarginRows(fromPath(opts['senate-margins']),'senate');
 const hf=opts['house-fundamentals']?
  parseFundamentalsRows(fromPath(opts['house-fundamentals']),'house'):new Map();
 const sf=opts['senate-fundamentals']?
  parseFundamentalsRows(fromPath(opts['senate-fundamentals']),'senate'):new Map();
 if(house.size!==435||hm.size<400||sm.size!==35)
  throw Error('Required external forecast files have incomplete race coverage');
 const basis=model.prepare(sources);
 const sim=model.simulate(basis,{samples:12000,seed:20261103});
 const simRaces=new Map(sim.race_probabilities.map(x=>[x.race_code,x]));
 const houseDiffs=basis.house.map(x=>{
  const e=house.get(x.code),m=hm.get(x.code),
   observed=simRaces.get(x.code);
  if(!e)throw Error('Missing external 2026 district '+x.code);
  return {race_code:x.code,model_dem_win_pct:observed.dem_beats_rep_pct,
   reference_dem_win_pct:e.dem_pct,
   probability_gap_pp:round(observed.dem_beats_rep_pct-e.dem_pct),
   model_margin:round(x.mean),reference_margin:m?.deluxe??null,
   margin_gap:m?round(x.mean-m.deluxe):null,
   polled:x.polled,model_poll_weight:x.poll_weight,
   external_poll_minus_fundamental:hf.get(x.code)?
    round(hf.get(x.code).polls-hf.get(x.code).blended):null};
 });
 const senateDiffs=basis.senate.map(x=>{
  const e=sm.get(x.state);
  if(!e)throw Error('Missing external statewide Senate margin '+x.state);
  return {race_code:x.code,model_margin:round(x.mean),
   reference_margin:round(e.deluxe),margin_gap:round(x.mean-e.deluxe),
   polled:x.polled,model_poll_weight:x.poll_weight,
   external_poll_minus_fundamental:sf.get(x.state)?
    round(sf.get(x.state).polls-sf.get(x.state).blended):null};
 });
 const comparableHouse=houseDiffs.filter(x=>x.margin_gap!==null);
 const p=houseDiffs.map(x=>x.probability_gap_pp),m=comparableHouse.map(x=>x.margin_gap);
 const selectedHousePollUniverse=sources.polls.house.filter(x=>x.dem_candidate&&x.rep_candidate);
 const normName=s=>normalize(s).replace(/[^A-Z ]/g,' ').replace(/\s+/g,' ').trim();
 const candidateMismatch=selectedHousePollUniverse.flatMap(r=>{
  const x=house.get(r.race_code);
  if(!x)return [];
  const disagreements=[];
  for(const side of ['dem','rep']){
   const ours=normName(r[side+'_candidate']),ext=normName(x[side+'_candidate']);
   if(ours&&ext&&ours!==ext)disagreements.push(side);
  }
  return disagreements.length?[{race_code:r.race_code,side:disagreements.join('/'),
   model_candidates:[r.dem_candidate,r.rep_candidate],
   external_candidates:[x.dem_candidate,x.rep_candidate],
   model_poll_margin:round(r.dem_minus_rep),
   note:'IDENTITY SIGNAL ONLY: neither source independently verifies certified ballot'}]:[];
 });
 const report={
  status:'LOCAL_PRIVATE_FORECAST_COMPARISON_DO_NOT_PUBLISH_SUBSCRIBER_DATA',
  as_of:sources.polls.generated_at,
  simulated_draws:sim.samples,
  coverage:{external_house_party_probabilities:house.size,
   external_house_deluxe_margins:hm.size,
   external_senate_deluxe_margins:sm.size,
   external_house_fundamentals:hf.size,
   external_senate_fundamentals:sf.size},
  house:{
   model_dem_house_seat_mean:sim.means.house_dem_seats,
   external_expected_dem_house_seats:round([...house.values()]
    .reduce((sum,x)=>sum+x.dem_pct/100,0)),
   model_dem_control_pct:sim.house_dem_control_pct,
   model_vs_reference_party_probability_mean_gap_pp:round(mean(p)),
   mean_absolute_party_probability_gap_pp:round(mean(p.map(Math.abs))),
   comparable_margin_count:comparableHouse.length,
   model_vs_reference_margin_mean_gap_points:round(mean(m)),
   mean_absolute_margin_gap_points:round(mean(m.map(Math.abs))),
   largest_party_probability_gaps:worstFirst(houseDiffs.slice(),'probability_gap_pp',20)
    .map(x=>({race_code:x.race_code,model:x.model_dem_win_pct,
     external:x.reference_dem_win_pct,delta:x.probability_gap_pp,polled:x.polled})),
   largest_deluxe_margin_gaps:worstFirst(comparableHouse.slice(),'margin_gap',20)
    .map(x=>({race_code:x.race_code,model:x.model_margin,
     external:x.reference_margin,delta:x.margin_gap,polled:x.polled}))
  },
  senate:{
   model_dem_control_pct:sim.senate_dem_control_pct,
   comparable_margin_count:senateDiffs.length,
   mean_signed_margin_gap_points:round(mean(senateDiffs.map(x=>x.margin_gap))),
   mean_absolute_margin_gap_points:round(mean(senateDiffs.map(x=>Math.abs(x.margin_gap)))),
   largest_deluxe_margin_gaps:worstFirst(senateDiffs.slice(),'margin_gap',20)
    .map(x=>({race_code:x.race_code,model:x.model_margin,
     external:x.reference_margin,delta:x.margin_gap,polled:x.polled}))
  },
  polling_candidate_identity_differences:candidateMismatch,
  caveats:[
   'This compares forecasts to forecasts; mean absolute discrepancies are not historical predictive accuracy scores.',
   'External inputs came from local user-supplied subscription exports; this summary should be kept private, not committed to the public repository.',
   'Differences in dates, two-party definitions, third-party fields and candidate identity may invalidate naive pairwise comparisons.',
   'Observed poll-name mismatches are triage flags; independently verify the official candidate roster and poll matchups before applying exclusions.',
   'Never fit the model to externally published expected margins or winning percentages.'
  ]
 };
 return report;
}
function parseArgs(argv){
 const args={};
 for(let i=0;i<argv.length;i++){
  const name=argv[i];
  if(!name.startsWith('--')||!['house-candidates','house-margins',
   'senate-margins','house-fundamentals','senate-fundamentals','json'].includes(name.slice(2)))
   throw Error('Unknown comparison option '+name);
  if(name==='--json'){args.json=true;continue}
  if(!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Missing path for '+name);
  args[name.slice(2)]=argv[++i];
 }
 for(const key of ['house-candidates','house-margins','senate-margins'])
  if(!args[key])throw Error('Missing required --'+key);
 return args;
}
if(require.main===module){
 const args=parseArgs(process.argv.slice(2)),report=compare(args);
 if(args.json)console.log(JSON.stringify(report,null,2));
 else{
  console.log('PRIVATE EXTERNAL FORECAST DIAGNOSTIC — DO NOT COMMIT INPUTS');
  console.log('House expected seats:',report.house.model_dem_house_seat_mean,
   'vs comparison',report.house.external_expected_dem_house_seats);
  console.table(report.house.largest_party_probability_gaps.slice(0,12));
  console.table(report.senate.largest_deluxe_margin_gaps.slice(0,12));
  console.log('Candidate name mismatches:',report.polling_candidate_identity_differences.length);
  console.table(report.polling_candidate_identity_differences.slice(0,20));
 }
}
module.exports={parseHouseCandidates,parseMarginRows,parseFundamentalsRows,
 csvParse,parseArgs,signedMargin,compare};
