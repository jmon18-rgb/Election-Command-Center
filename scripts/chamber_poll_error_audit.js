/* Historical Senate poll error audit from saved, source-attributed results.
 * Research context only. Publication timestamps were not captured; this is
 * retrospective fieldwork cutoff validation, not a 2026 forecast calibration.
 */
(function(root,factory){
 const x=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=x;
 if(root)root.JackErrorAudit=x;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const YEAR_SET=[2020,2022,2024];
 const mean=list=>list.reduce((a,b)=>a+b,0)/list.length;
 const rounded=n=>Math.round(n*1000)/1000;
 function summarize(data){
  if(data?.schema_version!=='historical-poll-backtest-v1'||
     data.status!=='retrospective_poll_research_not_calibrated_forecast'||
     data.can_calibrate_2026_win_probabilities!==false||
     data.poll_source_first_publication_dates_available!==false||
     !Array.isArray(data.records)||data.records.length!==42)
   throw Error('Historical poll audit source or retrospective safeguards changed');
  const groups=new Map(YEAR_SET.map(y=>[y,[]]));
  for(const row of data.records){
   const error=row.methods?.recency21?.error;
   const predicted=row.methods?.recency21?.predicted_two_party_margin;
   if(!groups.has(row.cycle)||!Number.isFinite(error)||
      !Number.isFinite(predicted)||!Number.isFinite(row.actual_two_party_margin)||
      Math.abs(predicted-row.actual_two_party_margin-error)>.005)
    throw Error('Invalid historical forecast-error record');
   groups.get(row.cycle).push(error);
  }
  const metrics=[];
  for(const year of YEAR_SET){
   const test=groups.get(year),other=YEAR_SET.filter(y=>y!==year)
    .flatMap(y=>groups.get(y));
   if(test.length<8||other.length<20)
    throw Error('Insufficient historical cycle coverage');
   const bias=mean(test),trainingBias=mean(other);
   // Leave-one-cycle-out training; intentionally compare naive correction
   // with no correction. No retrospective full-sample "optimal" bias is used.
   const corrected=test.map(e=>e-trainingBias*.5);
   metrics.push({
    cycle:year,races:test.length,bias_points:rounded(bias),
    mae_points:rounded(mean(test.map(Math.abs))),
    rmse_points:rounded(Math.sqrt(mean(test.map(e=>e*e)))),
    train_other_year_bias_points:rounded(trainingBias),
    heldout_shrunk_bias_mae_points:rounded(mean(corrected.map(Math.abs))),
    heldout_no_correction_mae_points:rounded(mean(test.map(Math.abs)))
   });
  }
  const errors=YEAR_SET.flatMap(year=>groups.get(year));
  const abs=errors.map(Math.abs);
  const heldoutCorrected=YEAR_SET.reduce((acc,year,i)=>{
   const train=YEAR_SET.filter(y=>y!==year).flatMap(y=>groups.get(y));
   for(const error of groups.get(year))acc.push(error-mean(train)*.5);
   return acc;
  },[]);
  const rmse=rounded(Math.sqrt(mean(errors.map(e=>e*e))));
  const averageBias=rounded(mean(errors));
  const cycleBiasRange=[Math.min(...metrics.map(x=>x.bias_points)),
   Math.max(...metrics.map(x=>x.bias_points))];
  return {
   status:'RETROSPECTIVE_AUDIT_ONLY',cycles:metrics,
   total_races:errors.length,overall_signed_poll_minus_result_points:averageBias,
   overall_mae_points:rounded(mean(abs)),overall_rmse_points:rmse,
   cycle_bias_range_points:cycleBiasRange,
   leave_one_cycle_out_uncorrected_mae_points:rounded(mean(abs)),
   leave_one_cycle_out_shrunk_correction_mae_points:
    rounded(mean(heldoutCorrected.map(Math.abs))),
   can_calibrate_joint_chamber_odds:false,
   caveat:'42 retrospective Senate polls across three election years. No first-publication timestamps, no House joint outcomes; cannot validate 2026 probabilities.'
  };
 }
 return Object.freeze({summarize});
});