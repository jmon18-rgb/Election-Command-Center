"""Reproduce WI-01 district-part county counts from the official WEC canvass."""
import csv,hashlib,io,json,re,sys,zipfile
from pathlib import Path
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
PDF=ROOT/'data/wisconsin_historical_sources/2024-official-us-congress-county.pdf'
PDF_HASH='3542962d2986d7ae6149c7d7de5a7708ba8e301e6f18fb51bdfb004f8982d375'
CENSUS=ROOT/'data/texas_historical_sources/2024-census-counties.zip'
CENSUS_HASH='3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'
URL='https://elections.wi.gov/sites/default/files/documents/County%20by%20County%20Report_US%20Congress_0.pdf'
CONFIG={
 1:{'names':{'KENOSHA','MILWAUKEE','RACINE','ROCK','WALWORTH'},'candidates':['Peter Barca','Bryan Steil','Todd, Jr.'],'numbers':[393493,172402,212515,8191,385]},
 3:{'names':{'ADAMS','BUFFALO','CHIPPEWA','CRAWFORD','DUNN','EAU CLAIRE','GRANT','JACKSON','JUNEAU','LA CROSSE','MONROE','PEPIN','PIERCE','PORTAGE','RICHLAND','SAUK','TREMPEALEAU','VERNON','WOOD'},'candidates':['Rebecca Cooke','Derrick Van Orden'],'numbers':[413181,200808,212064,309]}
}
def build(district=1):
 config=CONFIG[district];code=f'WI-{district:02d}'
 for p,h in [(PDF,PDF_HASH),(CENSUS,CENSUS_HASH)]:
  if hashlib.sha256(p.read_bytes()).hexdigest()!=h:raise ValueError('Original government source bytes changed')
 pages=PdfReader(PDF).pages
 selected=[p.extract_text() for p in pages if f'REPRESENTATIVE IN CONGRESS DISTRICT {district}\n' in p.extract_text()]
 if len(selected)!=1:raise ValueError('Exact official district report missing/duplicated')
 text=selected[0]
 for token in ['2024 General Election',*config['candidates'],'Report Generated - 11/27/2024 3:00:04 PM']:
  if token not in re.sub(r'\s+',' ',text):raise ValueError('Official canvass identity changed')
 rows=re.findall(r'(?m)^([A-Z ]+) \n'+r'([\d,]+)\n'*len(config['numbers']),text)
 if {r[0].strip() for r in rows}!=config['names']:raise ValueError('Incomplete/extra district county parts')
 with zipfile.ZipFile(CENSUS) as z:
  census={r['NAME'].removesuffix(' County').upper():{'county':r['NAME'].removesuffix(' County'),'fips':r['GEOID']} for r in csv.DictReader(io.StringIO(z.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')),delimiter='\t') if r['GEOID'].startswith('55')}
 if len(census)!=72:raise ValueError('Independent Wisconsin Census reference incomplete')
 counties=[]
 for name,*values in rows:
  total,d,r,*others=[int(v.replace(',','')) for v in values]
  if total!=d+r+sum(others):raise ValueError('County candidate arithmetic does not reconcile')
  c=census[name.strip()];counties.append({'county':c['county'],'county_fips':c['fips'],'dem_votes':d,'rep_votes':r,'other_votes':sum(others),'total_votes':total,'geography_scope':code+' district part, not whole county'})
 counties.sort(key=lambda c:c['county_fips'])
 totals={k:sum(c[k] for c in counties) for k in ['dem_votes','rep_votes','other_votes','total_votes']}
 if totals!={'dem_votes':config['numbers'][1],'rep_votes':config['numbers'][2],'other_votes':sum(config['numbers'][3:]),'total_votes':config['numbers'][0]}:raise ValueError('Office totals do not reconcile')
 if not re.search(r'Office Totals:\s+'+r'\s+'.join(f'{v:,}' for v in config['numbers']),text):raise ValueError('Printed independent office totals disagree')
 history=json.loads((ROOT/'data/house_history_2024_staging.json').read_text(encoding='utf8'))
 mit=next(r for r in history['records'] if r['2024_race_code']==code)
 if any(mit['recorded_'+k]!=totals[k] for k in ['dem_votes','rep_votes','other_votes']):raise ValueError('Independent MIT district reconciliation failed')
 geography=json.loads((ROOT/'data/house_geography_bridge.json').read_text(encoding='utf8'))
 geo=next(r for r in geography['districts'] if r['race_code_2026']==code)
 if not geo['geography_comparable_2024'] or geo['map_relation_2024_to_2026']!='boundaries_unchanged_per_2026_census':raise ValueError('2026 House map is not comparable')
 result={'status':'OFFICIAL_2024_DISTRICT_PART_BASELINE_NOT_LIVE_OR_CALIBRATION','race_code':code,'office':'U.S. House','election_date':'2024-11-05','county_count':len(counties),'counties':counties,'district_totals':totals,'source_url':URL,'source_sha256':PDF_HASH,'method_split_reported':False,'historical_release_times':False,'interval_calibrated':False,'map_comparability':geo['map_relation_2024_to_2026'],'map_source':geo['source_census'],'independent_district_reconciliation':'MIT House 2024 staged candidate totals match all three party categories'}
 reference={'source_url':'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip','source_sha256':CENSUS_HASH,'scope':code+' county PARTS from official district canvass, mapped to Census county identifiers; not whole-county votes','district_county_scope_source':URL,'counties':[{'county':c['county'],'fips':c['county_fips']} for c in counties]}
 return result,reference
if __name__=='__main__':
 for district in CONFIG:
  for suffix,data in zip(['2024_county_baseline_official','county_fips_reference'],build(district)):
   path=ROOT/'data'/(f'wisconsin_house_{district:02d}_'+suffix+'.json')
   if '--check' in sys.argv:
    if json.loads(path.read_text(encoding='utf8'))!=data:raise ValueError('Baseline/reference does not reproduce')
   else:path.write_text(json.dumps(data,indent=2)+'\n',encoding='utf8',newline='\n')
 print('WI-01/WI-03: official district-part county totals, Census joins, MIT totals and unchanged 2026 maps reconcile; not live or calibration')
