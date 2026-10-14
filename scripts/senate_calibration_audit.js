/* Retrospective validation audit: Senate polling-error diagnostics only.
 * Historical 2020/22/24 Senate fieldwork dates are not publication dates.
 * The source explicitly forbids claiming this is a validated 2026 forecast.
 * No future election result is used as an input to the current 2026 model.
 */
(function(root,factory){
 const value=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=value;
 if(root)root.SenateCalibrationAudit=value;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const YEARS=Object.freeze([2020,2022,2024]),SIGMA=6;
 const round=(n,d=2)=>Number(n.toFixed(d));
 const avg=x=>x.reduce((n,v)=>n+v,0)/x.length;
 const cdf=x=>{
  const a=Math.abs(x),t=1/(1+0.2316419*a);
  const d=0.3989422804014327*Math.exp(-a*a/2);
  const q=1-d*t*(0.319381530+t*(-0.356563782+t*
   (1.781477937+t*(-1.821255978+t*1.330274429))));
  return x>=0?q:1-q;
 };
 const loss=(row,correctedMargin,sd)=>{
  const p=Math.min(1-1e-8,Math.max(1e-8,cdf(correctedMargin/sd)));
  const y=row.actual_two_party_margin>0?1:0;
  return {p,y,brier:(p-y)**2,
   logLoss:-(y*Math.log(p)+(1-y)*Math.log(1-p))};
 };
 const metrics=(rows,corrected,sd)=>{
  const errors=rows.map((row,i)=>
   corrected[i]-row.actual_two_party_margin);
  const scored=rows.map((row,i)=>loss(row,corrected[i],sd));
  return {n:rows.length,
   signed_bias:round(avg(errors)),mae:round(avg(errors.map(Math.abs))),
   rmse:round(Math.sqrt(avg(errors.map(x=>x*x)))),
   interval_90_pct:round(100*avg(errors.map(x=>Math.abs(x)<=1.64485362695*sd?1:0)),1),
   brier:round(avg(scored.map(x=>x.brier)),4),
   log_loss:round(avg(scored.map(x=>x.logLoss)),4),
   democratic_wins:scored.filter(x=>x.y===1).length};
 };
 function evaluate(data){
  if(data?.schema_version!=='historical-poll-backtest-v1'||
     data.can_calibrate_2026_win_probabilities!==false||
     data.cutoff_days_before_election!==7||
     data.poll_source_first_publication_dates_available!==false||
     !Array.isArray(data.records)||data.records.length!==42)
   throw Error('Incompatible or potentially leaky Senate research input');
  const records=data.records;
  const identities=new Set(),byYear={};
  for(const y of YEARS)byYear[y]=[];
  for(const row of records){
   if(!YEARS.includes(row.cycle)||
      !/^[A-Z]{2}$/.test(row.state)||
      !Number.isFinite(row.actual_two_party_margin)||
      !Number.isFinite(row.methods?.recency21?.predicted_two_party_margin)||
      Math.abs(row.actual_two_party_margin)>100||
      Math.abs(row.methods.recency21.predicted_two_party_margin)>100||
      row.cutoff_is_fieldwork_only!==true||
      !row.historical_race_id)throw Error('Malformed retrospective poll record');
   if(identities.has(row.historical_race_id))
    throw Error('Duplicate historical Senate race');
   identities.add(row.historical_race_id);
   byYear[row.cycle].push(row);
  }
  if(YEARS.some(y=>byYear[y].length<10))
   throw Error('Too few races per historical year');
  const predicted=rows=>rows.map(x=>x.methods.recency21.predicted_two_party_margin);
  const yearly=YEARS.map(year=>({
   year,...metrics(byYear[year],predicted(byYear[year]),SIGMA)
  }));
  const full=metrics(records,predicted(records),SIGMA);
  const crossYear=YEARS.map(year=>{
   const training=records.filter(x=>x.cycle!==year);
   const held=byYear[year];
   const trainingErrors=training.map(x=>
    x.methods.recency21.predicted_two_party_margin-x.actual_two_party_margin);
   // Partially pooled correction with >1 full year's prior weight.
   // Evaluated only on withheld years, never on the fitted training year.
   const shrink=training.length/(training.length+60);
   const bias=avg(trainingErrors)*shrink;
   const calibratedSigma=Math.max(5,Math.sqrt(avg(trainingErrors.map(x=>x*x))));
   const scores=metrics(held,predicted(held).map(x=>x-bias),calibratedSigma);
   return {year,training_races:training.length,held_out_races:held.length,
    fitted_bias_correction:round(bias),fitted_sigma:round(calibratedSigma),
    ...scores};
  });
  const weighted=(key,arr)=>round(arr.reduce((sum,x)=>sum+x[key]*x.n,0)/42,4);
  const heldOut={
   brier:weighted('brier',crossYear),log_loss:weighted('log_loss',crossYear),
   interval_90_pct:round(weighted('interval_90_pct',crossYear),1)
  };
  // These data alone cannot identify geography, joint election error or a
  // stable directional correction for the 2026 electorate.
  return {schema:'senate_poll_audit_v1',
   status:'RETROSPECTIVE_VALIDATION_ONLY',
   cutoff_description:'Seven days before election by fieldwork end; publication timing unknown',
   source:data.poll_source,source_attribution:data.poll_source_attribution,
   standard_sigma_points:SIGMA,overall:full,by_year:yearly,
   cross_year_heldout:crossYear,pooled_heldout:heldOut,
   directionally_inconsistent:Math.min(...yearly.map(x=>x.signed_bias))<0&&
    Math.max(...yearly.map(x=>x.signed_bias))>0,
   automatic_democratic_bias_correction:false,
   may_calibrate_2026_joint_probabilities:false,
   warnings:[
    'Only 42 voluntarily eligible historical polled Senate races, not all contests',
    'Polling fieldwork cutoff is seven days out; publication dates were unavailable',
    'Errors are cycle-correlated; 42 observations are not 42 independent national election shocks',
    'Historical averages do not prove the direction or magnitude of 2026 polling error',
    'No 2026 bias correction or joint probability calibration applied automatically'
   ]};
 }
 return Object.freeze({YEARS,SIGMA,evaluate});
});