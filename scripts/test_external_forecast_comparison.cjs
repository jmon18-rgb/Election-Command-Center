#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {csvParse,parseHouseCandidates,parseMarginRows,parseFundamentalsRows,
 parseArgs,signedMargin}=require('./compare_external_forecast_local.cjs');
assert.deepEqual(csvParse('a,b\r\n"District, Test","D +2.1@@2.123"\r\n'),
 [{a:'District, Test',b:'D +2.1@@2.123'}]);
assert.deepEqual(csvParse('a,b\n"quoted ""item""",3\n'),
 [{a:'quoted "item"',b:'3'}]);
assert.throws(()=>csvParse('a,b\n"unterminated,5'),/Unterminated/);
assert.throws(()=>csvParse('a,b\n1,2,3'),/wrong width/);
assert.equal(signedMargin('R +13.4@@-13.421898'),-13.421898);
assert.equal(signedMargin('D +7.5@@7.53'),7.53);
assert.equal(signedMargin(''),null);
const house=parseHouseCandidates([{code:'0101',winner_Dparty:'42.1',winner_Rparty:'57.9',
 name_D1:'Sample Dem',name_R1:'Sample Rep'}]);
assert.equal(house.get('AL-01').dem_pct,42.1);
assert.equal(house.get('AL-01').rep_candidate,'Sample Rep');
assert.throws(()=>parseHouseCandidates([
 {code:'0101',winner_Dparty:'50',winner_Rparty:'50'},
 {code:'0101',winner_Dparty:'50',winner_Rparty:'50'}]),/Duplicate/);
assert.throws(()=>parseHouseCandidates([
 {code:'9999',winner_Dparty:'50',winner_Rparty:'50'}]),/FIPS/);
assert.throws(()=>parseHouseCandidates([
 {code:'0101',winner_Dparty:'150',winner_Rparty:'-50'}]),/Invalid candidate/);
const e=parseMarginRows([{'X.1':'Race'},{'X.1':'AZ-6','X.2':'D +4.2@@4.2',
 '~~~Expert ratings~~~':'R +0.3@@-0.3','X.3':'D +1.1@@1.1','⠀':'D +3.4@@3.4'}],
 'house');
assert.equal(e.get('AZ-06').deluxe,3.4);
assert.equal(e.get('AZ-06').expert_unadjusted,-.3);
assert.throws(()=>parseMarginRows([{'X.1':'AK-1','X.2':'R +1@@-1',
 '⠀':'R +2@@-2'},{'X.1':'AK-1','X.2':'R +1@@-1','⠀':'R +2@@-2'}],'house'),/duplicated/);
const f=parseFundamentalsRows([{'X.1':'ME','X.2':'D +2@@2',
 '~~~Fundamentals~~~':'R +1@@-1','X.3':'D +4@@4','X.4':'D +2@@2'}],'senate');
assert.equal(f.get('ME').simple,-1);
assert.equal(f.get('ME').blended,2);
assert.equal(parseArgs(['--house-candidates','/tmp/x','--house-margins','/tmp/y',
 '--senate-margins','/tmp/z','--json']).json,true);
assert.throws(()=>parseArgs(['--house-candidates','/tmp/x']),/Missing required/);
console.log('External forecast CSV parser, FIPS reconciliation, provenance validation: PASS');
