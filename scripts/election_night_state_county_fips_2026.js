/* Canonical U.S. state/D.C. census FIPS prefixes for geographic returns.
 * Two-letter state and five-digit county identity must independently match.
 * This verifies the state prefix, not the existence of every county code.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ElectionNightStateCountyFIPS2026=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const PREFIX=Object.freeze({
  AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',
  DE:'10',DC:'11',FL:'12',GA:'13',HI:'15',ID:'16',IL:'17',
  IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',
  MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',
  NV:'32',NH:'33',NJ:'34',NM:'35',NY:'36',NC:'37',ND:'38',
  OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',SD:'46',
  TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',
  WI:'55',WY:'56'
 });
 if(Object.keys(PREFIX).length!==51||
    new Set(Object.values(PREFIX)).size!==51)
  throw Error('Invalid canonical state/county FIPS prefix table');
 function matches(state,stateFips,countyId){
  return typeof state==='string'&&Object.prototype.hasOwnProperty.call(PREFIX,state)&&
   typeof stateFips==='string'&&stateFips===PREFIX[state]&&
   typeof countyId==='string'&&/^\d{5}$/.test(countyId)&&
   countyId.slice(0,2)===stateFips&&countyId.slice(2)!=='000';
 }
 return Object.freeze({PREFIX,matches});
});
