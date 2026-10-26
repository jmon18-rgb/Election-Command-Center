"""Reproduce MI-04 district parts from pinned, explicitly processed public data.

The official Kalamazoo application independently corroborates one county part.
Neither final rows nor publication clocks are chronological calibration data.
"""
import csv,gzip,hashlib,io,json,sys,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCES=ROOT/'data/michigan_historical_sources'
RAW_HASH='654a7dbf7a86a96c52cb182ba4472565b62d5aa76533238228fc3065c7d447fb'
BLOB='f0a1eab82fab6107e28fedda0167309ba65ab44a'
SAMPLE_HASH='d2ffbe9c96364a3967b1d7e514e76dd20cd94b87eea29d0c8063afc4093cc946'
CENSUS_HASH='3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'
URL='https://raw.githubusercontent.com/openelections/openelections-data-mi/master/2024/20241105__mi__general__precinct.csv'
COUNTIES={'Allegan','Berrien','Calhoun','Kalamazoo','Ottawa','Van Buren'}
ALIASES={'Jessica Swartz':'D','DEM Jessica Swartz':'D','Bill Huizenga':'R','REP Bill Huizenga':'R','Curtis Clark':'O','UST Curtis Clark':'O'}
PARTIES={'DEM':'D','Democrat':'D','REP':'R','Republican':'R','UST':'O','U.S. Taxpayers':'O'}
METADATA={'Ballots Cast','Over Vote Count','Over Votes','Under Vote Count','Under Votes'}
WRITEINS={'Write-in','Write-ins'}
def checked_bytes(name,sha):
 b=gzip.decompress((SOURCES/name).read_bytes())
 if hashlib.sha256(b).hexdigest()!=sha:raise ValueError('Pinned original source bytes changed: '+name)
 return b
def build():
 raw=checked_bytes('2024-openelections-mi-precinct.csv.gz',RAW_HASH)
 if hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()!=BLOB:raise ValueError('Publisher Git blob mismatch')
 sample=json.loads(checked_bytes('2024-kalamazoo-official-results.json.gz',SAMPLE_HASH))
 census_bytes=(ROOT/'data/texas_historical_sources/2024-census-counties.zip').read_bytes()
 if hashlib.sha256(census_bytes).hexdigest()!=CENSUS_HASH:raise ValueError('Census original changed')
 with zipfile.ZipFile(io.BytesIO(census_bytes)) as z:
  census={r['NAME'].removesuffix(' County'):r['GEOID'] for r in csv.DictReader(io.StringIO(z.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')),delimiter='\t') if r['GEOID'].startswith('26')}
 if len(census)!=83 or not COUNTIES<=census.keys():raise ValueError('Independent complete Michigan county reference failed')
 totals={c:{'D':0,'R':0,'O':0,'writeins':0} for c in COUNTIES};seen=set();metadata=0
 for row in csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))):
  # State House district4 is a DIFFERENT contest.
  if row['office']!='U.S. House' or row['district']!='4':continue
  county,name=row['county'],row['candidate']
  if county not in COUNTIES:raise ValueError('Unexpected district county part')
  if not row['votes'].isdigit():raise ValueError('Noninteger candidate/metadata count')
  votes=int(row['votes'])
  if name in METADATA:
   if row['party']:raise ValueError('Metadata party mismatch')
   metadata+=1;continue
  if name in WRITEINS:
   if row['party']:raise ValueError('Write-in party mismatch')
   key=(county,row['precinct'],'writeins');party='writeins'
  else:
   party=ALIASES.get(name)
   if party is None or PARTIES.get(row['party'])!=party:raise ValueError('Unrecognized historical candidate/party')
   key=(county,row['precinct'],party)
  if not row['precinct'] or key in seen:raise ValueError('Missing/duplicate normalized precinct candidate')
  seen.add(key);totals[county][party]+=votes
 rows=[{'county':c,'county_fips':census[c],'dem_votes':totals[c]['D'],'rep_votes':totals[c]['R'],
        'named_other_votes':totals[c]['O'],'generic_write_in_votes':totals[c]['writeins'],
        'geography_scope':'MI-04 district part, not whole county'} for c in sorted(COUNTIES,key=lambda c:census[c])]
 summary={k:sum(r[k] for r in rows) for k in ['dem_votes','rep_votes','named_other_votes','generic_write_in_votes']}
 if summary!={'dem_votes':184641,'rep_votes':234489,'named_other_votes':6687,'generic_write_in_votes':597}:raise ValueError('District candidate totals mismatch')
 mit=next(r for r in json.loads((ROOT/'data/house_history_2024_staging.json').read_text(encoding='utf-8'))['records'] if r['2024_race_code']=='MI-04')
 if (mit['recorded_dem_votes'],mit['recorded_rep_votes'],mit['recorded_other_votes'])!=(summary['dem_votes'],summary['rep_votes'],summary['named_other_votes']):raise ValueError('Independent MIT reconciliation failed')
 geo=next(r for r in json.loads((ROOT/'data/house_geography_bridge.json').read_text(encoding='utf-8'))['districts'] if r['race_code_2026']=='MI-04')
 if not geo['geography_comparable_2024'] or geo['map_relation_2024_to_2026']!='boundaries_unchanged_per_2026_census':raise ValueError('Incomparable current map')
 election=sample['election']
 if election['electionDate']!='2024-11-05' or election['isOfficialResults'] is not True or election['isPrimary'] is not False:raise ValueError('Official historical sample identity changed')
 contests=[r for r in sample['ballotItems'] if r['name']==[{'languageId':'en','text':'Representative in Congress District 4'}]]
 if len(contests)!=1 or contests[0]['reportingStatus']['totalUnits']!=97:raise ValueError('Official district-part sample mismatch')
 options=contests[0]['summaryResults']['ballotOptions']
 expected={'DEM Jessica Swartz':totals['Kalamazoo']['D'],'REP Bill Huizenga':totals['Kalamazoo']['R'],'UST Curtis Clark':totals['Kalamazoo']['O'],'Write-in':totals['Kalamazoo']['writeins']}
 if {x['name'][0]['text']:x['voteCount'] for x in options}!=expected or any(sum(g['voteCount'] for g in x['groupResults'])!=x['voteCount'] for x in options):raise ValueError('Independent official county sample/method sums disagree')
 baseline={'status':'PROCESSED_2024_DISTRICT_PART_BASELINE_NOT_LIVE_OR_CALIBRATION','race_code':'MI-04','office':'U.S. House','election_date':'2024-11-05','county_count':6,'counties':rows,'district_totals':summary,
  'source_type':'OpenElections preprocessed public precinct data; not original government bytes','source_url':URL,'source_sha256':RAW_HASH,'source_git_blob':BLOB,
  'publisher_use_statement':'https://openelections.net/about/','publisher_use_scope':'Publisher says data remains free to anyone and is intended for web applications; no named state-repository license, no CC0 claim',
  'method_split_reported':False,'historical_release_times':False,'interval_calibrated':False,
  'map_comparability':geo['map_relation_2024_to_2026'],'map_source':geo['source_census'],
  'independent_district_reconciliation':'MIT House2024 D/R/named-other totals exactly match; generic write-ins kept separately',
  'independent_official_sample':{'county':'Kalamazoo','county_fips':'26077','district_part_units':97,'county_precincts':105,'source_url':'https://app.enhancedvoting.com/results/public/api/elections/kalamazoo-county-mi/November52024General/data','source_sha256':SAMPLE_HASH,'coverage':'ONE of six county parts; all named candidates, generic write-ins and method sums corroborated'},
  'excluded_metadata_rows':metadata,'limitations':['Final precinct rows are not chronological snapshots','Presidential-year turnout and different D nominee do not establish2026 calibration','Partial/overlapping processed method columns are not used; combined D/R only','Named-other and generic write-ins are separate; no ballot-total inference']}
 reference={'source_url':'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip','source_sha256':CENSUS_HASH,'scope':'MI-04 district county PARTS mapped to independent Census county identifiers; not whole-county votes','district_county_scope_source':URL,'counties':[{'county':r['county'],'fips':r['county_fips']} for r in rows]}
 return baseline,reference
if __name__=='__main__':
 for suffix,data in zip(['2024_county_baseline_processed','county_fips_reference'],build()):
  path=ROOT/'data'/('michigan_house_04_'+suffix+'.json')
  if '--check' in sys.argv:
   if json.loads(path.read_text(encoding='utf-8'))!=data:raise ValueError('Published baseline does not reproduce')
  else:path.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8',newline='\n')
 print('MI-04 processed district-part baseline: pinned bytes, Census83/6, MIT totals and original Kalamazoo sample reconcile; NOT live/calibration')
