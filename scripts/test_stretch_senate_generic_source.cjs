'use strict';
// Actual generic 2026 source producer with fictional records: zero GETs/draws.
// --repo-root exists only to stage this unchanged portable test before copying.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const args=process.argv.slice(2);assert(args.length===0||args.length===2&&args[0]==='--repo-root');const root=path.resolve(args[1]||path.join(__dirname,'..'));
const index=fs.readFileSync(path.join(root,'index.html'),'utf8'),signals=require(path.join(root,'scripts/election_night_signals.js')),reconciliation=require(path.join(root,'scripts/election_night_reconciliation.js')),closes=require(path.join(root,'scripts/election_night_poll_closings_2026.js')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function between(start,end){const a=index.indexOf(start),b=index.indexOf(end,a);assert(a>=0&&b>a,'Actual production markers '+start);return index.slice(a,b);}
const base=index.match(/const enCivicBase='[^']+';/)?.[0];assert(base);
const batch=between('const enBatchPilotSlots=','function enCivicSourceDisabled(x){'),producer=between('function enCivicSourceDisabled(x){','function enCivicQuery(item){');
const NOW=Date.parse('2026-11-04T03:00:00Z');class FixedDate extends Date{static now(){return NOW;}}
let gets=0;const context={Date:FixedDate,window:{ElectionNightReconciliation:reconciliation,ElectionNightPollClosings2026:closes},enWatchId:x=>x.office+'|'+x.key,fetch:()=>{gets++;throw Error('Source fixture must not fetch');}};
vm.runInNewContext(base+'\n'+batch+'\n'+producer,context);
const reports=[];
for(const [state,key,id]of [['FL','FL-special','florida_senate'],['LA','LA','louisiana_senate']]){
 const item={office:'Senate',key},name=state+' US Senate'+(state==='FL'?' Special':''),stamp='2026-11-04T02:59:00Z';assert.equal(context.enBatchPilot(item),false,'Use the actual generic statewide producer, not a pinned adapter');
 const candidates=[{name:'Fictional '+state+' Democrat',party:'Democratic',votes:60,percent:60,winner:true},{name:'Fictional '+state+' Republican',party:'Republican',votes:40,percent:40,winner:false}];
 const search={country:'US',province:state,election_date:'2026-11-03',id:123,election_name:name,election_type:'General',type:'US Senate',municipality:null,district:null,candidates};
 const detail={id:123,country:'US',province:state,election_date:'2026-11-03',election_name:name,election_type:'US Senate',district:null,candidates,percent_reporting:100,last_updated:stamp};
 const positive=context.enCivicValidate(item,search,detail);assert(positive,'Unmarked valid positive control must remain admitted');assert.equal(signals.validatedCall(positive,NOW)?.party,'D');assert.equal(signals.evaluateMilestones({['Senate|'+key]:positive},{year:2026,now:NOW}).find(row=>row.id===id)?.state,'earned','Existing actual producer call can earn the correct passive milestone');
 const cases=[['index-only test_data',{...search,test_data:true},detail],['detail-only test_data',search,{...detail,test_data:true}],['both test_data',{...search,test_data:true},{...detail,test_data:true}],['existing is_test',{...search,is_test:true},{...detail,is_test:true}]];
 for(const [label,indexRow,detailRow]of cases){const rejected=context.enCivicValidate(item,indexRow,detailRow);assert.equal(rejected,null,state+' '+label+' must fail before normalization loses the marker');assert.equal(signals.validatedCall(rejected,NOW),null);assert.equal(signals.evaluateMilestones({['Senate|'+key]:rejected},{year:2026,now:NOW}).find(row=>row.id===id)?.state,'waiting',state+' '+label+' must not earn');}
 assert.equal(context.enCivicMatch(item,{...search,test_data:true}),false,'The actual raw search marker is rejected');assert.equal(context.enCivicSourceDisabled({...detail,test_data:true}),true,'The actual raw detail marker is rejected');
 reports.push({office:item.office,key,earned_id:id,unmarked_positive_admitted:true,index_only_test_data_rejected:true,detail_only_test_data_rejected:true,both_test_data_rejected:true,original_is_test_rejected:true});
}
assert.equal(gets,0);
const proof={schema:'stretch-senate-generic-source-marker-v1',status:'PASS',at:new Date().toISOString(),source_sha256:{'index.html':sha(index),'scripts/election_night_signals.js':sha(fs.readFileSync(path.join(root,'scripts/election_night_signals.js')))},reports,GETs:gets,model_draws:0,browser_runs:0,scope:'Fictional post-close records through actual installed generic raw search/detail producer and actual Signals call/milestone consumer. Positive behavior retained; explicit nonproduction markers rejected before normalization. No actual FL/LA provider availability, candidate identity, result delivery, calibration or human acceptance claim.'};
const target=path.join(root,'artifacts/readiness/stretch-senate-generic-source-proof.json');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(proof,null,2)+'\n');console.log('Stretch Senate generic producer: both real positive paths plus index/detail/both test_data and existing is_test controls PASS; zero GETs/draws');
