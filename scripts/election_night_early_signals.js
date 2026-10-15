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
  {code:'KY-06',office:'House',time:'6:00 PM',group:'First closings',
   why:'Appalachian/central Kentucky House district; compare its local swing with the district baseline. Community early-signal suggestion.'},
  {code:'IN-05',office:'House',time:'6:00 PM',group:'First closings',
   why:'Indiana suburban House district. Look at actual district results, not statewide turnout inferences.'},
  {code:'VA-01',office:'House',time:'7:00 PM',group:'Virginia check',
   why:'Part of the community-proposed three-district VA-01/02/05 watch. Only verified calls count as calls.'},
  {code:'VA-02',office:'House',time:'7:00 PM',group:'Virginia check',
   why:'Coastal Virginia district; one of three early House seats in the Virginia comparison.'},
  {code:'VA-05',office:'House',time:'7:00 PM',group:'Virginia check',
   why:'Third seat in the Virginia comparison; the suggested three-seat scenario is not a calibrated national forecast.'},
  {code:'VA-07',office:'House',time:'7:00 PM',group:'Virginia check',
   why:'Additional Virginia suburban/rural comparison highlighted in earlier election-night discussions.'},
  {code:'GA-SEN',office:'Senate',time:'7:00 PM',group:'Other early signals',
   why:'Georgia Senate race and the state-wide pattern as counts become comparable. Do not infer votes from precinct share.'},
  {code:'NC-01',office:'House',time:'7:30 PM',group:'Other early signals',
   why:'North Carolina House seat cited as an early competitive-district benchmark.'},
  {code:'NC-11',office:'House',time:'7:30 PM',group:'Other early signals',
   why:'Western North Carolina House district proposed by community watchers as an additional comparison.'},
  {code:'NC-SEN',office:'Senate',time:'7:30 PM',group:'Other early signals',
   why:'Compare reported results across Wake, Mecklenburg and Nash counties once geographic county counts are available.'},
  {code:'OH-SEN',office:'Senate',time:'7:30 PM',group:'Other early signals',
   why:'Ohio statewide race; future county comparisons: Hamilton and Stark. County swing requires actual comparable county returns.'},
  {code:'PA-07',office:'House',time:'8:00 PM',group:'Other early signals',
   why:'Pennsylvania House district used for later checks against the statewide House environment.'}
 ];
 const groups=['First closings','Virginia check','Other early signals'];
 const seen=new Set();
 for(const x of records){
  if(!/^(?:[A-Z]{2}-\d{2}|[A-Z]{2}-(?:SEN|GOV))$/.test(x.code)||
     !['House','Senate','Governor'].includes(x.office)||
     seen.has(x.code)||!x.time||!x.why)
   throw Error('Bad early-signal specification: '+x.code);
  seen.add(x.code);Object.freeze(x);
 }
 return Object.freeze({records:Object.freeze(records),groups:Object.freeze(groups),
   status:'editorial_watchlist_not_forecast',
   source:'https://www.reddit.com/r/fivethirtyeight/comments/1x6l790/',
   closingSource:'https://www.270towin.com/poll-closing-times/index.php'});
});
