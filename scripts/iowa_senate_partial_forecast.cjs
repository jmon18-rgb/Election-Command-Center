'use strict';
// Experimental county x method remaining-vote model. No race calls or national
// updates. Counts already reported are fixed; only outstanding votes are modeled.
const erf=x=>{const s=Math.sign(x),a=Math.abs(x),t=1/(1+.3275911*a);
 return s*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-a*a));};
const normalCDF=x=>(1+erf(x/Math.SQRT2))/2;
const clamp=x=>Math.max(.001,Math.min(.999,x));
const key=r=>r.county+'|'+r.mode;
function forecast({baseline,observations=[],prior_margin_points,prior_sigma_points,
 county_sigma_points=6,structural_sigma_points=4,turnout_scale=1,turnout_sigma_fraction=.25}){
 if(!Array.isArray(baseline)||baseline.length!==198||!Array.isArray(observations)||
  ![prior_margin_points,prior_sigma_points,county_sigma_points,structural_sigma_points,turnout_scale,turnout_sigma_fraction].every(Number.isFinite)||
  Math.abs(prior_margin_points)>=100||prior_sigma_points<=0||county_sigma_points<=0||
  structural_sigma_points<0||turnout_scale<=0||turnout_sigma_fraction<=0)throw Error('Invalid model inputs');
 const cells=new Map();let baseD=0,baseN=0;
 for(const r of baseline){
  if(typeof r.county!=='string'||!r.county||!['election_day','absentee'].includes(r.mode)||
   !Number.isSafeInteger(r.dem_votes)||!Number.isSafeInteger(r.rep_votes)||
   r.dem_votes<0||r.rep_votes<0||!Number.isSafeInteger(r.dem_votes+r.rep_votes)||r.dem_votes+r.rep_votes<=0||cells.has(key(r)))
   throw Error('Invalid/duplicate historical county-method cell');
  const n=r.dem_votes+r.rep_votes;cells.set(key(r),{...r,n,share:r.dem_votes/n});baseD+=r.dem_votes;baseN+=n;
 }
 if(new Set(baseline.map(r=>r.county)).size!==99)throw Error('Incomplete county baseline');
 const observed=new Map();
 for(const r of observations){
  if(!cells.has(key(r))||observed.has(key(r))||typeof r.complete!=='boolean'||
   !Number.isSafeInteger(r.dem_votes)||!Number.isSafeInteger(r.rep_votes)||
   !Number.isSafeInteger(r.dem_votes+r.rep_votes)||r.dem_votes<0||r.rep_votes<0)
   throw Error('Invalid/duplicate observed county-method cell');
  observed.set(key(r),r);
 }
 // Shift the historical geography/method pattern to the supplied PRE-RETURN
 // polling prior. Neither historical statewide party balance nor raw early
 // vote share is silently substituted for the race prior.
 const initialShift=(prior_margin_points/100-(2*baseD/baseN-1))/2;
 const priorVariance=(prior_sigma_points/200)**2,countyVariance=(county_sigma_points/200)**2;
 let precision=1/priorVariance,weighted=0;
 for(const [id,r] of observed){
  const n=r.dem_votes+r.rep_votes;
  // Partial batches may be selected precincts or one side of a mode. Use
  // their counts, but learn a statewide swing only from explicitly completed
  // county-method units. Precinct percentage is never a completion flag.
  if(!r.complete||n===0)continue;
  const prior=clamp(cells.get(id).share+initialShift);
  const variance=countyVariance+.25/n;
  precision+=1/variance;weighted+=(r.dem_votes/n-prior)/variance;
 }
 const shift=weighted/precision,shiftVariance=1/precision;
 const turnout={};
 for(const mode of ['election_day','absentee']){
  const all=[...cells.values()].filter(c=>c.mode===mode);
  const completed=all.filter(c=>observed.get(key(c))?.complete);
  const base=all.reduce((s,c)=>s+c.n,0),knownBase=completed.reduce((s,c)=>s+c.n,0);
  const known=completed.reduce((s,c)=>s+observed.get(key(c)).dem_votes+observed.get(key(c)).rep_votes,0);
  // Learn method-specific turnout from completed units. Pandemic-era absentee
  // volume must not be carried forward as a fixed 2026 outstanding-vote count.
  const strength=.05*base;
  turnout[mode]={scale:(known+strength*turnout_scale)/(knownBase+strength),remaining_margin_weight:0};
 }
 let countedD=0,countedR=0,remaining=0,remainingD=0,independentVariance=0;
 const units=[],overruns=[];
 for(const [id,cell] of cells){
  const r=observed.get(id),n=r?r.dem_votes+r.rep_votes:0;
  const expected=cell.n*turnout[cell.mode].scale;
  if(!r?.complete&&n>=expected&&n>0)overruns.push(id);
  const outstanding=r?.complete?0:Math.max(0,expected-n);
  const share=clamp(cell.share+initialShift+shift);
  countedD+=r?.dem_votes||0;countedR+=r?.rep_votes||0;
  remaining+=outstanding;remainingD+=outstanding*share;
  independentVariance+=(outstanding**2)*countyVariance+outstanding*share*(1-share);
  if(!r?.complete)turnout[cell.mode].remaining_margin_weight+=cell.n*(2*share-1);
  units.push({county:cell.county,mode:cell.mode,reported_two_party_votes:n,
   modeled_remaining_two_party_votes:outstanding,modeled_remaining_dem_share:share,complete:r?.complete===true});
 }
 const total=countedD+countedR+remaining;
 if(total<=0)throw Error('No reported or modeled two-party ballots');
 const marginVotes=countedD-countedR+2*remainingD-remaining;
 // A correlated remaining-vote error floor does NOT vanish merely because
 // many counties reported. Parameters are declared assumptions, not fitted
 // or calibrated interval guarantees. Turnout uncertainty is scenario input.
 const turnoutVariance=Object.values(turnout).reduce((s,m)=>s+
  (m.remaining_margin_weight*m.scale*turnout_sigma_fraction)**2,0);
 const variance=4*(remaining**2*shiftVariance+independentVariance)+
  (remaining*structural_sigma_points/100)**2+turnoutVariance;
 const sd=Math.sqrt(variance),mean=100*marginVotes/total,sigma=100*sd/total;
 const p=sd?normalCDF(marginVotes/sd):marginVotes>0?1:marginVotes<0?0:.5;
 return {status:overruns.length?'TURNOUT_SCENARIO_EXCEEDED_REVISE_ESTIMATE':
   'EXPERIMENTAL_PARTIAL_RETURN_FORECAST_NOT_CALIBRATED',
  counted_dem_votes:countedD,counted_rep_votes:countedR,
  modeled_remaining_two_party_votes:remaining,modeled_final_two_party_votes:total,
  dem_win_probability:overruns.length?null:p,projected_d_minus_r_margin_points:mean,
  model_margin_interval_90_points:[Math.max(-100,mean-1.644853627*sigma),Math.min(100,mean+1.644853627*sigma)],
  completed_units:[...observed.values()].filter(r=>r.complete).length,
  posterior_swing_margin_points:200*shift,
  assumptions:{prior_margin_points,prior_sigma_points,county_sigma_points,structural_sigma_points,turnout_scale,turnout_sigma_fraction},
  method_turnout_scales:Object.fromEntries(Object.entries(turnout).map(([mode,m])=>[mode,m.scale])),
  incomplete_units_exceeding_turnout_estimate:overruns,
  interval_calibrated:false,turnout_uncertainty_included:true,may_move_national_needle:false,
  limitations:'Historical turnout scaled by an explicit scenario, not an observed ballot denominator. '+
   'Completed county-method flags must come from the source adapter, never precinct percentages. '+
   'County/method and turnout changes can bias this experimental forecast; reporting-order calibration remains open.',units};
}
function cellsFromOfficialYear(year){return year.counties.flatMap(c=>['election_day','absentee'].map(mode=>({
 county:c.county,mode,dem_votes:c.records[mode].dem_votes,rep_votes:c.records[mode].rep_votes})));}
module.exports={forecast,cellsFromOfficialYear};
