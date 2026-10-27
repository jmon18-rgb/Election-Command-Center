"""Pinned offline historical preparation; never current results or a model admission."""
import csv,gzip,hashlib,io,json,re,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ORIGINALS=ROOT/'data/minnesota_historical_sources'
PINS={'2020-media-index.html.gz':'30efc4b129697cef505e8ab9dfbf6be008d6cb7083061ffe384e2b11e8accdb8',
 '2020-senate-county.txt.gz':'02e353f991be29a0621971d0e1bdfe59a29c0534b3343966692e655c3da4a557',
 '2020-senate-statewide.txt.gz':'44b13763766bb263af9c9b9944adc9aa6e6865ab1da34f1323d469dc6df94c4f',
 '2020-county-table.txt.gz':'4bb20423e417bd3139bdb99eaec2d41453e3ad40d549275771c57ed7f8fcc773'}
CANDIDATES={'0101':("Kevin O'Connor",'LMN'),'0201':('Oliver Steinberg','GLC'),'0301':('Jason Lewis','R'),'0401':('Tina Smith','DFL'),'9901':('WRITE-IN','WI')}
def need(ok,reason):
 if not ok:raise ValueError(reason)
def pinned(name):
 raw=gzip.decompress((ORIGINALS/name).read_bytes());need(hashlib.sha256(raw).hexdigest()==PINS[name],'Original pin changed');return raw.decode('utf-8-sig')
def geography(table,reference,current):
 mapping={};metadata={}
 for line in table.splitlines():
  r=line.split(';');need(len(r)==3,'County-table field count')
  key,name,precincts=r
  need(re.fullmatch(r'\d{2}',key) and key not in mapping and re.fullmatch(r'\d{1,5}',precincts),'Invalid/duplicate county identity')
  fips=reference.get(name.casefold());need(fips is not None,'County not independently matched')
  need(current['county_id_to_fips'].get(key)==fips and current['county_metadata'].get(key,{}).get('county_name','').casefold()==name.casefold(),'Historical/current county identity mismatch')
  mapping[key]=fips;metadata[key]={'county':name,'precincts':int(precincts)}
 need(len(mapping)==87 and len(set(mapping.values()))==87,'Expected87 unique counties')
 return mapping,metadata
def parse(text,mapping,metadata,statewide=False):
 need(isinstance(text,str) and len(text.encode('utf-8'))<350000,'Unbounded historical source')
 lines=text.splitlines();need(len(lines)==(5 if statewide else 435),'Historical candidate-row scope')
 groups={}
 for line in lines:
  r=line.split(';');need(len(r)==16,'Expected16-field candidate layout')
  st,co,precinct,office,label,district,order,name,suffix,inc,party,reporting,pcts,votes,share,total=r
  need(st=='MN' and not precinct and office=='0102' and label=='U.S. Senator' and not district and not suffix and not inc,'Historical contest scope')
  need(order in CANDIDATES and (name,party)==CANDIDATES[order],'Historical candidate identity')
  need(co=='' if statewide else co in mapping,'Unknown county/scope')
  need(all(re.fullmatch(r'\d{1,10}',v) for v in [reporting,pcts,votes,total]),'Noninteger historical counts')
  rep,p,count,allvotes=map(int,[reporting,pcts,votes,total]);need(rep==p and p>0 and allvotes>0 and count<=allvotes,'Historical precinct/count conflict')
  if not statewide:need(p==metadata[co]['precincts'],'County reporting mismatch')
  need(re.fullmatch(r'\d{1,3}(?:\.\d{1,2})?',share) is not None and abs(float(share)-100*count/allvotes)<=.011,'Candidate percentage conflict')
  g=groups.setdefault(co,{'precincts':p,'total':allvotes,'votes':{}})
  need(g['precincts']==p and g['total']==allvotes and order not in g['votes'],'Duplicate/inconsistent county candidate')
  g['votes'][order]=count
 for v in groups.values():need(set(v['votes'])==set(CANDIDATES) and sum(v['votes'].values())==v['total'],'All-candidate accounting conflict')
 need(set(groups)==({''} if statewide else set(mapping)),'Missing county')
 return groups
def build():
 page=pinned('2020-media-index.html.gz')
 need('Unofficial Results' in page and 'November 3, 2020' in page and 'https://electionresultsfiles.sos.mn.gov/20201103/ussenatecty.txt' in page,'Declared historical publication mismatch')
 raw=(ROOT/'data/texas_historical_sources/2024-census-counties.zip').read_bytes()
 need(hashlib.sha256(raw).hexdigest()=='3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0','Census pin changed')
 with zipfile.ZipFile(io.BytesIO(raw)) as z:census=z.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')
 reference={r['NAME'].removesuffix(' County').casefold():r['GEOID'] for r in csv.DictReader(io.StringIO(census),delimiter='\t') if r['USPS']=='MN'}
 crosswalk=(ROOT/'data/mn_2026_official_county_fips_crosswalk.json').read_bytes()
 need(hashlib.sha256(crosswalk).hexdigest()=='bd245e3d53f026aae9a258422a224e549c9271123016c973cd915a0a310dbc2e','Current identity crosswalk pin changed')
 mapping,metadata=geography(pinned('2020-county-table.txt.gz'),reference,json.loads(crosswalk))
 counties=parse(pinned('2020-senate-county.txt.gz'),mapping,metadata);state=parse(pinned('2020-senate-statewide.txt.gz'),mapping,metadata,True)['']
 need(sum(v['precincts'] for v in counties.values())==state['precincts'],'County/state precinct mismatch')
 for key in CANDIDATES:need(sum(v['votes'][key] for v in counties.values())==state['votes'][key],'County/state candidate mismatch')
 imported=json.loads((ROOT/'data/senate_history_2020_2022_2024.json').read_text(encoding='utf-8'))
 comparison=[r for r in imported['contest_records'] if r['state']=='MN' and r['election_year']==2020 and r['election_type']=='regular']
 need(len(comparison)==1,'Independent statewide reference absent/duplicate')
 expected=[1566522,1398145,249589,3214256]
 need([comparison[0][k] for k in ['recorded_dem_votes','recorded_rep_votes','recorded_other_votes','recorded_total_candidate_votes']]==expected,'Independent statewide reference changed')
 v=state['votes'];need([v['0401'],v['0301'],v['0101']+v['0201']+v['9901'],state['total']]==expected,'Historical statewide candidate totals conflict')
 rows=[{'county':metadata[k]['county'],'fips':mapping[k],'native_county_id':k,'dem_votes':v['votes']['0401'],'rep_votes':v['votes']['0301'],'other_votes':v['votes']['0101']+v['votes']['0201']+v['votes']['9901'],'write_in_votes':v['votes']['9901'],'candidate_votes':v['total']} for k,v in sorted(counties.items())]
 return {'schema':'minnesota-senate2020-publisher-export-preparation-v1','status':'HISTORICAL_PREPARATION_NOT_CURRENT_SOURCE_ADMISSION','year':2020,'county_count':87,'candidate_rows':435,'source_label':'Official publisher archive labels these exports Unofficial Results','numeric_certification_independently_verified':False,'source_page':'https://electionresults.sos.mn.gov/Select/MediaFiles/Index?ersElectionId=136','source_pins':PINS,'public_capture_receipts':'data/minnesota_historical_sources/2020-public-capture-receipts.json','counties':rows,'statewide':dict(zip(['dem_votes','rep_votes','other_votes','candidate_votes'],expected)),'current2026_source_admitted':False,'runtime_inputs_unchanged':17,'limits':['Final historical totals, not chronological calibration','2020 ballot-order IDs are not 2026 candidate IDs','Reporting precincts are not an outstanding-ballot or vote-completion denominator','Current2026candidate/test/clock/access/correction/transport/state-budget contract remains separate']}
if __name__=='__main__':
 out=build();(ROOT/'data/minnesota_senate_2020_county_baseline_publisher.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8');print('MN historical87counties/435candidate rows reconcile; NOT current-source admission')
