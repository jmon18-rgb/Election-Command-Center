// SYNTHETIC corrected-party first choices. The actual saved provider record
// still has a conflicting party and is rejected; this is NOT live evidence.
const contract=require('../data/alaska_senate_ballot_contract.json');
function candidates(d=0,r=0){
 return [219759,219760,219758,219761,219762,219763].map(id=>{
  const p=contract.people.find(p=>p.source_candidate_id===id);
  const votes=id===219759?d:id===219760?r:0;
  return {name:p.source_name,candidate_id:id,party:p.expected_source_party,votes,
   percent:d+r?votes/(d+r)*100:0,winner:false};
 });
}
module.exports={candidates};
