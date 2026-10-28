"""Offline factual2024 Osborn/Fischer county preparation, NOT a2026 baseline admission."""
import csv,gzip,hashlib,io,json,re,zipfile
from pathlib import Path
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1];SOURCES=ROOT/'data/nebraska_senate_sources'
PDF_SHA='4887fb1caab820ab737adaaff9b73ee601e37a707fb0002d8901fd674e8efbe9'
CENSUS_SHA='3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'
TOTAL=(499124,436493,2719)
def need(ok,why):
 if not ok:raise ValueError(why)
def reference():
 raw=(ROOT/'data/texas_historical_sources/2024-census-counties.zip').read_bytes();need(hashlib.sha256(raw).hexdigest()==CENSUS_SHA,'Census pin')
 with zipfile.ZipFile(io.BytesIO(raw)) as z:rows=csv.DictReader(io.StringIO(z.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')),delimiter='\t');refs={r['NAME'].removesuffix(' County'):(r['GEOID']) for r in rows if r['GEOID'].startswith('31')}
 need(len(refs)==93 and len(set(refs.values()))==93,'Independent93counties');return refs
def parse(text,refs):
 need(isinstance(text,str) and len(text)<40000,'Bounded page text')
 need(len(refs)==93 and len(set(refs.values()))==93 and all(re.fullmatch(r'31\d{3}',f) for f in refs.values()),'Independent geography shape')
 for token in ['Member of the United States Senate – Six Year Term','Deb Fischer','Dan Osborn','(Republican)','(By Petition)','Scatterings','General Election – November 5, 2024','Page | 16']:need(token in text,'Historical scope/header '+token)
 for token in ['Deb Fischer','Dan Osborn','(Republican)','(By Petition)','Scatterings']:need(text.count(token)==2,'Both candidate-column identities '+token)
 header=next((x for x in text.splitlines() if len(re.findall(r'\bCounty\b',x))==2),None);need(header is not None,'Two county-column headings')
 split=list(re.finditer(r'\bCounty\b',header))[1].start();started=False;groups={};statewide=None
 number=r'(?:0|[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d*)'
 pattern=re.compile(r'([A-Za-z][A-Za-z ]*?)\s{2,}('+number+r')\s+('+number+r')\s+('+number+r')\s*')
 for line in text.splitlines():
  if line.startswith('Total '):started=True
  if not started:continue
  if line.startswith('General Election'):break
  if not line.strip():continue
  for part in [line[:split],line[split:]]:
   need(part.strip()!='','Missing table cell group');m=pattern.fullmatch(part.strip());need(m is not None,'Invalid county/three integer cells')
   name=m[1].strip();values=tuple(int(m[i].replace(',','')) for i in range(2,5))
   if name=='Total':need(statewide is None,'Duplicate total');statewide=values;continue
   need(name in refs and name not in groups,'Unknown/duplicate county');groups[name]=values
 need(set(groups)==set(refs) and len(groups)==93,'Full93matched counties')
 need(statewide==TOTAL,'Pinned official statewide totals')
 need(tuple(sum(v[i] for v in groups.values()) for i in range(3))==statewide,'County/state reconciliation')
 return {'schema':'nebraska-2024-six-year-senate-historical-preparation-v1','source_decoded_sha256':PDF_SHA,'independent_census_sha256':CENSUS_SHA,'source_page':16,'election_date':'2024-11-05','office':'United States Senate – Six Year Term','county_count':93,'candidate_axis':{'republican':'Deb Fischer','by_petition':'Dan Osborn','other':'Write-In Scatterings'},'totals':{'deb_fischer':TOTAL[0],'dan_osborn':TOTAL[1],'write_in_scatterings':TOTAL[2],'two_named_candidates':sum(TOTAL[:2]),'all_reported':sum(TOTAL)},'counties':[{'fips':refs[name],'county':name,'deb_fischer':v[0],'dan_osborn':v[1],'write_in_scatterings':v[2]} for name,v in sorted(groups.items(),key=lambda kv:refs[kv[0]])],'same_named_independent_candidate_as_2026':True,'same_Senate_seat_as_2026':False,'2026_baseline_scenario_reviewed':False,'must_not_combine_with_2024_Ricketts_race':True,'native_2026_all_other_accounting_separate':True,'runtime_eligible':False,'chronological_calibration':False,'runtime_inputs_unchanged':17}
def build():
 raw=gzip.decompress((SOURCES/'2024-official-general-canvass.pdf.gz').read_bytes());need(hashlib.sha256(raw).hexdigest()==PDF_SHA,'Original PDF pin')
 reader=PdfReader(io.BytesIO(raw));need(len(reader.pages)==82,'Original page count');return parse(reader.pages[15].extract_text(extraction_mode='layout'),reference())
if __name__=='__main__':
 result=build();(ROOT/'data/nebraska_senate_2024_candidate_reference.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n');print(json.dumps({'counties':result['county_count'],'totals':result['totals'],'runtime_eligible':result['runtime_eligible']}))
