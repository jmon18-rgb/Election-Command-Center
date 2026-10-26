"""Reproduce PA-10 county PARTS from the state's original precinct extract."""
import csv,gzip,hashlib,io,json,re,sys,zipfile
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FOLDER=ROOT/'data/pennsylvania_historical_sources'
RAW_HASH='34339122238fe82272c52717a4065dbd3949e00eeb98320332797853c96f3b6c'
SCHEMA_HASH='b0d9e221deab9acd982982d187e4f16e7fae43d59b360b867cd89fad559eb632'
CENSUS_HASH='3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'
SAMPLE_HASH='27ab8368b840932a76c9530f64a0583adb708f7e1870ff345d0b503f94f15e4a'
URL='https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/bulk-data/2024-general-election/er/erstat_2024_g_268768_20250129.txt'
SCHEMA_URL='https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/bulk-data/2024-general-election/er/erstat_2024_g_readme.txt'
COUNTIES={'21':'Cumberland','22':'Dauphin','67':'York'}
class CountySample(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.heading=False;self.headings=[];self.depth=0;self.table_count=0;self.parts=[]
 def handle_starttag(self,tag,attrs):
  if tag=='h1':self.heading=True
  if tag=='table':
   if self.depth:self.depth+=1
   elif dict(attrs).get('id')=='tblRace':self.depth=1;self.table_count+=1
 def handle_endtag(self,tag):
  if tag=='h1':self.heading=False
  if tag=='table' and self.depth:self.depth-=1
 def handle_data(self,data):
  if self.heading:self.headings.append(data)
  if self.depth:self.parts.append(data)
def parse_official_sample(raw):
 p=CountySample();p.feed(raw.decode('utf-8'))
 if ' '.join(' '.join(p.headings).split())!='2024 Presidential General Election Results' or p.table_count!=1:raise ValueError('Wrong official county election/table identity')
 text=' '.join(' '.join(p.parts).split())
 if not text.startswith('REPRESENTATIVE IN CONGRESS '):raise ValueError('Wrong county office sample')
 matches=re.findall(r'(DEM|REP|NONPARTISAN)\s*\.\s*(JANELLE STELSON|SCOTT PERRY|WRITE-IN)\s+([\d,]+)(?:\s|$)',text)
 if len(matches)!=3:raise ValueError('County candidate totals missing/duplicated')
 votes={(party,name):int(n.replace(',','')) for party,name,n in matches}
 if set(votes)!={('DEM','JANELLE STELSON'),('REP','SCOTT PERRY'),('NONPARTISAN','WRITE-IN')}:raise ValueError('Wrong official county candidates')
 total=re.search(r'TOTAL:\s*([\d,]+)',text)
 if total is None or int(total[1].replace(',',''))!=sum(votes.values()):raise ValueError('County reported total does not reconcile')
 return votes
def aggregate(rows,census):
 totals={name:{'dem_votes':0,'rep_votes':0} for name in COUNTIES.values()}
 seen=set();precincts={};selected=0
 for r in rows:
  if len(r)!=37:raise ValueError('Original37-field schema mismatch')
  # Geographic district metadata alone would also select President/state races.
  if r[8]!='USC':continue
  if not r[5].isdigit():raise ValueError('Invalid congressional candidate district')
  if int(r[5])!=10:continue
  if r[0]!='2024' or r[1]!='G' or r[18]!='10' or r[32]!='':raise ValueError('Wrong exact general congressional/record scope')
  county=COUNTIES.get(r[2])
  if county is None or not r[29].isdigit() or '42'+r[29].zfill(3)!=census.get(county):raise ValueError('County election code/FIPS join mismatch')
  expected={'DEM':('STELSON','JANELLE'),'REP':('PERRY','SCOTT')}
  if r[9] not in expected or (r[11],r[12])!=expected[r[9]] or not r[10]:raise ValueError('Wrong historical candidate/party')
  if not r[3].isdigit() or not r[15].isdigit() or int(r[15])<0:raise ValueError('Invalid precinct/count')
  key=(county,int(r[3]),r[9])
  if key in seen:raise ValueError('Duplicate normalized precinct candidate')
  seen.add(key);precincts.setdefault(key[:2],set()).add(r[9]);selected+=1
  totals[county]['dem_votes' if r[9]=='DEM' else 'rep_votes']+=int(r[15])
 if any(parties!={'DEM','REP'} for parties in precincts.values()) or not precincts:raise ValueError('Incomplete precinct candidate pairs')
 if set(c for c,_ in precincts)!=set(COUNTIES.values()):raise ValueError('Missing county part')
 return totals,selected,len(precincts)
def build():
 raw=gzip.decompress((FOLDER/'2024-official-precinct-returns.txt.gz').read_bytes())
 schema=(FOLDER/'2024-official-precinct-schema.txt').read_bytes()
 sample=gzip.decompress((FOLDER/'2024-dauphin-congress-official.html.gz').read_bytes())
 census_bytes=(ROOT/'data/texas_historical_sources/2024-census-counties.zip').read_bytes()
 if any(hashlib.sha256(b).hexdigest()!=h for b,h in [(raw,RAW_HASH),(schema,SCHEMA_HASH),(census_bytes,CENSUS_HASH),(sample,SAMPLE_HASH)]):raise ValueError('Pinned original government bytes changed')
 for label in ['Candidate Office Code','Candidate District','Vote Total','U.S. Congressional District','FIPS Code']:
  if label not in schema.decode('ascii'):raise ValueError('Official column definition missing')
 with zipfile.ZipFile(io.BytesIO(census_bytes)) as z:
  census={r['NAME'].removesuffix(' County'):r['GEOID'] for r in csv.DictReader(io.StringIO(z.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')),delimiter='\t') if r['GEOID'].startswith('42')}
 if len(census)!=67:raise ValueError('Independent Pennsylvania Census reference incomplete')
 rows=list(csv.reader(io.StringIO(raw.decode('utf-8-sig')),strict=True))
 if len(rows)!=268768:raise ValueError('Original statewide record count changed')
 totals,n,precincts=aggregate(rows,census)
 if n!=680 or precincts!=340:raise ValueError('Exact district precinct coverage changed')
 county_sample=parse_official_sample(sample)
 if county_sample[('DEM','JANELLE STELSON')]!=totals['Dauphin']['dem_votes'] or county_sample[('REP','SCOTT PERRY')]!=totals['Dauphin']['rep_votes']:raise ValueError('Independent official county D/R sample disagrees')
 counties=[{'county':c,'county_fips':census[c],**totals[c],'named_other_votes':0,'geography_scope':'PA-10 congressional district part, not whole county'} for c in sorted(totals,key=lambda c:census[c])]
 summary={k:sum(c[k] for c in counties) for k in ['dem_votes','rep_votes','named_other_votes']}
 if summary!={'dem_votes':200434,'rep_votes':205567,'named_other_votes':0}:raise ValueError('Official named-candidate totals changed')
 mit=next(r for r in json.loads((ROOT/'data/house_history_2024_staging.json').read_text(encoding='utf-8'))['records'] if r['2024_race_code']=='PA-10')
 if any(mit['recorded_'+k]!=summary[k] for k in ['dem_votes','rep_votes']) or mit['recorded_other_votes']!=summary['named_other_votes']:raise ValueError('Independent MIT reconciliation failed')
 geo=next(r for r in json.loads((ROOT/'data/house_geography_bridge.json').read_text(encoding='utf-8'))['districts'] if r['race_code_2026']=='PA-10')
 if not geo['geography_comparable_2024'] or geo['map_relation_2024_to_2026']!='boundaries_unchanged_per_2026_census':raise ValueError('Current House map not comparable')
 baseline={'status':'OFFICIAL_STATE_PUBLISHED_2024_DISTRICT_PART_BASELINE_NOT_LIVE_OR_CALIBRATION','race_code':'PA-10','office':'U.S. House','election_date':'2024-11-05','county_count':3,'counties':counties,'district_totals':summary,
  'source_url':URL,'source_sha256':RAW_HASH,'source_type':'Original Pennsylvania Department of State precinct return extract','source_schema_url':SCHEMA_URL,'source_schema_sha256':SCHEMA_HASH,'source_record_count':268768,'selected_precinct_candidate_rows':n,'selected_precincts':precincts,
  'selection_contract':'CandidateOfficeCode USC AND CandidateDistrict10 AND current row US CongressionalDistrict10; not all offices in geographic district10',
  'county_code_contract':'County election codes21/22/67 are NOT FIPS; independently join zero-padded raw FIPS to Census42041/42043/42133',
  'map_comparability':geo['map_relation_2024_to_2026'],'map_source':geo['source_census'],'independent_district_reconciliation':'MIT House2024 D/R/named-other totals match exactly; generic write-ins not supplied by the state extract',
  'generic_write_ins_reported_by_state_extract':False,
  'independent_official_sample':{'county':'Dauphin','county_fips':'42043','source_url':'https://elections.dauphincounty.gov/?key=38&race=REPRESENTATIVE%20IN%20CONGRESS','source_sha256':SAMPLE_HASH,'dem_votes':county_sample[('DEM','JANELLE STELSON')],'rep_votes':county_sample[('REP','SCOTT PERRY')],'generic_write_in_votes':county_sample[('NONPARTISAN','WRITE-IN')],'scope':'One official county sample; write-ins are separate and not added to named candidate totals'},
  'method_split_reported':False,'historical_release_times':False,'interval_calibrated':False,
  'limitations':['Final certified-era extract is not a chronological election-night snapshot','Presidential-year turnout does not establish2026 remaining ballots or calibration','Combined candidate counts do not provide ballot-method completion or vote release order','Generic write-ins omitted by the state extract: named-other zero is not zero write-ins or an all-ballot total']}
 reference={'source_url':'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip','source_sha256':CENSUS_HASH,'scope':'PA-10 district county PARTS from official precinct returns, mapped to Census identifiers; not whole-county votes','district_county_scope_source':URL,'counties':[{'county':c['county'],'fips':c['county_fips']} for c in counties]}
 return baseline,reference
if __name__=='__main__':
 for suffix,data in zip(['2024_county_baseline_official','county_fips_reference'],build()):
  path=ROOT/'data'/('pennsylvania_house_10_'+suffix+'.json')
  if '--check' in sys.argv:
   if json.loads(path.read_text(encoding='utf-8'))!=data:raise ValueError('Published Pennsylvania baseline does not reproduce')
  else:path.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8',newline='\n')
 print('PA-10: original268768 rows ->680 candidate rows/340 precincts/3 district county parts; Census/map/MIT reconcile; not live/calibration')
