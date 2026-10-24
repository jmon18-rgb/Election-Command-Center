/* Early 2026 returns checklist. Editorial watch suggestions, NOT modeled
 * forecasts, live race calls, or a substitute for a national swing estimator.
 * Source provenance: community discussion, with poll-closing times checked
 * against nonpartisan election calendars; the results panel remains the
 * authority on whether a validated source actually has votes. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightEarlySignals=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const records=[
  {code:'KY-06',office:'House',time:'6:00 PM',closeET:'18:00',group:'First closings',
   why:'Appalachian/central Kentucky House district; compare its local swing with the district baseline. Community early-signal suggestion.'},
  {code:'IN-05',office:'House',time:'6:00 PM',closeET:'18:00',group:'First closings',
   why:'Indiana suburban House district. Look at actual district results, not statewide turnout inferences.'},
  {code:'VA-01',office:'House',time:'7:00 PM',closeET:'19:00',group:'Virginia check',
   why:'Part of the community-proposed three-district VA-01/02/05 watch. Only verified calls count as calls.'},
  {code:'VA-02',office:'House',time:'7:00 PM',closeET:'19:00',group:'Virginia check',
   why:'Coastal Virginia district; one of three early House seats in the Virginia comparison.'},
  {code:'VA-05',office:'House',time:'7:00 PM',closeET:'19:00',group:'Virginia check',
   why:'Third seat in the Virginia comparison; the suggested three-seat scenario is not a calibrated national forecast.'},
  {code:'VA-07',office:'House',time:'7:00 PM',closeET:'19:00',group:'Virginia check',
   why:'Additional Virginia suburban/rural comparison highlighted in earlier election-night discussions.'},
  {code:'SC-SEN',office:'Senate',time:'7:00 PM',closeET:'19:00',group:'Other early signals',
   why:'Watch the South Carolina Senate margin as an early statewide comparison; slow calls alone cannot establish a national wave.'},
  {code:'VA-SEN',office:'Senate',time:'7:00 PM',closeET:'19:00',group:'Other early signals',
   counties:['Loudoun'],
   why:'Virginia Senate statewide results; Loudoun County is a research-only local comparison until actual county vote data arrives.'},
  {code:'GA-SEN',office:'Senate',time:'7:00 PM',closeET:'19:00',group:'Other early signals',
   why:'Georgia Senate race and the state-wide pattern as counts become comparable. Do not infer votes from precinct share.'},
  {code:'NC-01',office:'House',time:'7:30 PM',closeET:'19:30',group:'Other early signals',
   why:'North Carolina House seat cited as an early competitive-district benchmark.'},
  {code:'NC-11',office:'House',time:'7:30 PM',closeET:'19:30',group:'Other early signals',
   why:'Western North Carolina House district proposed by community watchers as an additional comparison.'},
  {code:'NC-SEN',office:'Senate',time:'7:30 PM',closeET:'19:30',group:'Other early signals',counties:['Wake','Mecklenburg','Nash'],
   why:'Compare reported results across Wake, Mecklenburg and Nash counties once geographic county counts are available.'},
  {code:'OH-SEN',office:'Senate',time:'7:30 PM',closeET:'19:30',group:'Other early signals',counties:['Hamilton','Stark'],
   why:'Ohio statewide race; future county comparisons: Hamilton and Stark. County swing requires actual comparable county returns.'},
  {code:'MI-SEN',office:'Senate',time:'8:00 PM',closeET:'20:00',group:'Other early signals',counties:['Oakland'],
   why:'Michigan Senate vote margin; Oakland County is a suggested suburban indicator, not a nationally calibrated geographic update.'},
  {code:'PA-07',office:'House',time:'8:00 PM',closeET:'20:00',group:'Other early signals',
   why:'Pennsylvania House district used for later checks against the statewide House environment.'}
 ];
 const groups=['First closings','Virginia check','Other early signals'];
 const seen=new Set();
 for(const x of records){
  if(!/^(?:[A-Z]{2}-\d{2}|[A-Z]{2}-(?:SEN|GOV))$/.test(x.code)||
     !['House','Senate','Governor'].includes(x.office)||
     seen.has(x.code)||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(x.closeET||'')||!x.time||!x.why)
   throw Error('Bad early-signal specification: '+x.code);
  seen.add(x.code);Object.freeze(x);
 }
 // Separate an actual fresh race observation from early precinct speculation.
 // A race can be displayed with votes long before it is safe to compare even
 // that ONE district to its own pre-election margin. This never emits a
 // statewide estimate, county adjustment or a national wave indicator.
 const electionStart=Date.parse('2026-11-03T05:00:00Z');
 const CLOSE_DAY='2026-11-03T';
 // Caller-supplied presentation objects must not override the independently
 // curated closure time for an exact early-signal race.
 const canonical=new Map(records.map(row=>[row.code,row]));
 const closedAt=x=>{
  const known=canonical.get(x?.code);
  return known?Date.parse(CLOSE_DAY+known.closeET+':00-05:00'):NaN;
 };
 const unusable=(status,message)=>Object.freeze({status,message,hasVerifiedVotes:false,
  comparative:false,canMoveNationalNeedle:false,rawMargin:null,marginVsPrior:null});
 function assess(info,observation=null,{now=Date.now(),priorMargin=null,error=null}={}){
  const known=canonical.get(info?.code);
  if(!known)return unusable('INVALID','Unrecognized indicator identity');
  const close=closedAt(known);
  if(!Number.isFinite(close))return unusable('INVALID','Unverified indicator closing time');
  if(!Number.isFinite(now)||now<electionStart)
   return unusable('PREVIEW','November 3 live results have not begun');
  if(now<close)
   return unusable('WAITING_FOR_POLLS','Polls not yet scheduled to close for this indicator');
  if(error&&!observation)return unusable('SOURCE_ERROR','Provider unavailable · no inferred votes');
  if(!observation)return unusable('AWAITING_SOURCE','No verified race votes from a live source');
  if(observation.verified!==true||!['Open America','civicAPI'].includes(observation.provider)||
   !Number.isSafeInteger(observation.d)||!Number.isSafeInteger(observation.r)||
   observation.d<=0||observation.r<=0||
   !Number.isSafeInteger(observation.total)||observation.total<observation.d+observation.r)
   return unusable('INVALID_SOURCE','Unverified, incomplete or invalid party totals');
  const when=Date.parse(observation.asOf||'');
  if(observation.stale===true||!Number.isFinite(when)||
     when<close||when>now+15*60000||now-when>180*60000)
   return unusable('STALE','Source timestamp stale or outside this election');
  const precincts=observation.precincts;
  if(precincts!==null&&precincts!==undefined&&
    (!Number.isFinite(precincts)||precincts<0||precincts>100))
   return unusable('INVALID_SOURCE','Unreliable precinct reporting value');
  const margin=100*(observation.d-observation.r)/(observation.d+observation.r);
  const progress=Number.isFinite(precincts)?precincts:null;
  const comparative=progress!==null&&progress>=80&&Number.isFinite(priorMargin);
  return Object.freeze({status:comparative?'LATE_LOCAL_COMPARISON':
   progress===null?'COUNTING_UNKNOWN_PROGRESS':'COUNTING_PARTIAL',
   hasVerifiedVotes:true,comparative,canMoveNationalNeedle:false,
   rawMargin:+margin.toFixed(2),
   marginVsPrior:comparative?+(margin-priorMargin).toFixed(2):null,
   reportedVotes:observation.total,precincts:progress,source:observation.provider,
   sourceTime:observation.asOf,
   message:comparative?
    'Late local race margin vs pre-election estimate only · NOT a geographic or national swing':
    'Partial result · precinct share is NOT ballot share · NOT a national swing'});
 }
 return Object.freeze({records:Object.freeze(records),groups:Object.freeze(groups),
   assess,closedAt,status:'editorial_watchlist_not_forecast',
   source:'https://www.reddit.com/r/fivethirtyeight/comments/1x6l790/',
   closingSource:'https://www.270towin.com/poll-closing-times/index.php'});
});
