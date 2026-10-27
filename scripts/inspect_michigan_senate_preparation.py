"""Offline Michigan Senate evidence review; deliberately does NOT build a live baseline.

Processed2024 rows need explicit corrections/corroboration and still disagree
with an independent statewide reference. Never assign that residual to a county.
"""
import collections,csv,gzip,hashlib,io,json,re,zipfile
from pathlib import Path
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
SOURCES=ROOT/'data/michigan_senate_preparation_sources'
PINS={
 'processed':'654a7dbf7a86a96c52cb182ba4472565b62d5aa76533238228fc3065c7d447fb',
 'cass':'4d802aa7b56b5a866dfb1add1992a02b9348d7d46982a04f8e709cf9822faffd',
 'leelanau':'82b457dc6ae2089c92f2671a6b38cdb0cd6b027b271593fad84dab6cb2511f04',
 'census':'3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'}
NAMES={'Elissa Slotkin':'D','Mike Rogers':'R','Joseph Solis-Mullen':'L','Joseph Solis-Mullin':'L','Joseph Solis\u2010Mullen':'L','Dave Stein':'U','Douglas P. Marsh':'G','Doug Dern':'N'}
PARTIES={'DEM':'D','Democrat':'D','REP':'R','Republican':'R','LIB':'L','Libertarian':'L','UST':'U','U.S. Taxpayers':'U','GRN':'G','GRE':'G','Green':'G','NLP':'N','NL':'N','Natural Law':'N'}
NATIVE={'Elissa Slotkin':('Democrat','D'),'Mike Rogers':('Republican','R'),'Joseph Solis-Mullen':('Libertarian','L'),'Dave Stein':('U.S. Taxpayers','U'),'Douglas P. Marsh':('Green','G'),'Doug Dern':('Natural Law','N')}
def fail(message):raise ValueError(message)
def checked(body,key):
 if hashlib.sha256(body).hexdigest()!=PINS[key]:fail('Pinned original changed: '+key)
 return body
def integer(text):
 if not re.fullmatch(r'(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)',text):fail('Invalid combined integer syntax')
 return int(text.replace(',',''))
def review_leelanau(data):
 if data.get('electionDate')!='2024-11-05' or data.get('electionName')!='2024 Leelanau County General' or data.get('results',{}).get('name')!='Leelanau County':fail('Wrong Leelanau historical identity')
 contests=[b for b in data['results']['ballotItems'] if b.get('name')=='United States Senator']
 if len(contests)!=1 or contests[0].get('voteFor')!=1:fail('Missing/ambiguous historical Senate contest')
 options=contests[0].get('ballotOptions',[])
 if len(options)!=10 or len({o['name'] for o in options})!=10:fail('Changed Leelanau candidate set')
 native={};totals={};regular={}
 for option in options:
  name=option['name'];count=option.get('voteCount');rows=option.get('precinctResults',[])
  if type(count) is not int or count<0 or len(rows)!=13 or len({r['name'] for r in rows})!=13:fail('Invalid Leelanau original totals/precinct identities')
  if any(type(r.get('voteCount')) is not int or r['voteCount']<0 for r in rows) or sum(r['voteCount'] for r in rows)!=count:fail('Leelanau candidate precinct sum mismatch')
  if name in NATIVE:
   party,axis=NATIVE[name]
   if option.get('politicalParty')!=party:fail('Changed Leelanau candidate party')
   regular[axis]=count
  elif name not in {'Write-in','James Chapman','Marcus A. Irvine','Valerie Lee Willis'}:fail('Unreviewed Leelanau other candidate')
  totals[name]=count
  for row in rows:native[(name,row['name'])]=row['voteCount']
 if len(regular)!=6:fail('Missing Leelanau regular candidate')
 return native,regular,totals
def build():
 raw=checked(gzip.decompress((ROOT/'data/michigan_historical_sources/2024-openelections-mi-precinct.csv.gz').read_bytes()),'processed')
 cass=checked(gzip.decompress((SOURCES/'2024-cass-official-statement.pdf.gz').read_bytes()),'cass')
 leel_bytes=checked(gzip.decompress((SOURCES/'2024-leelanau-declared-media-export.json.gz').read_bytes()),'leelanau')
 census_bytes=checked((ROOT/'data/texas_historical_sources/2024-census-counties.zip').read_bytes(),'census')
 pdf=PdfReader(io.BytesIO(cass));cover=pdf.pages[0].extract_text();senate=pdf.pages[3].extract_text()
 if not all(t in cover for t in ['Statement of Votes Cast (Official)','Cass County, Michigan','November 05, 2024']):fail('Wrong Cass election original')
 if 'United States Senator (Vote for  1)' not in senate or 'County - Total 28,049 County - Total 8,584 18,127 272 205 121 106 27,415 36' not in senate:fail('Cass Senate candidate/count corroboration changed')
 native,leel_regular,leel_all=review_leelanau(json.loads(leel_bytes))
 rows=[r for r in csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))) if r['office']=='U.S. Senate']
 totals=collections.Counter();by_county=collections.defaultdict(collections.Counter);unknown=collections.Counter();blanks=[];fills=[];aliases=[];seen=set()
 for row in rows:
  name=row['candidate']
  if name[:4] in {'DEM ','REP ','LIB ','UST ','GRN ','NLP '}:name=name[4:]
  if name=='Elissa Stotkin':
   if (row['county'],row['precinct'],row['votes']) not in {('Cass','Jefferson Township, Precinct 1','136'),('Cass','LaGrange Township, Precinct 1','204')}:fail('Unreviewed Cass alias row')
   aliases.append({'county':row['county'],'precinct':row['precinct'],'original_name':name,'votes':integer(row['votes'])});name='Elissa Slotkin'
  if name not in NAMES:
   if row['votes']=='':blanks.append({'county':row['county'],'precinct':row['precinct'],'candidate':row['candidate'],'votes':None})
   else:unknown[(row['candidate'],row['party'])]+=integer(row['votes'])
   continue
  axis=NAMES[name];key=(row['county'],row['precinct'],name)
  if not row['precinct'] or key in seen or PARTIES.get(row['party'])!=axis:fail('Duplicate/invalid regular candidate identity/party')
  seen.add(key)
  if row['votes']=='':
   if row['county']!='Leelanau' or (name,row['precinct']) not in native:fail('Missing combined count lacks independent original')
   votes=native[(name,row['precinct'])];fills.append({'county':'Leelanau','precinct':row['precinct'],'candidate':name,'native_combined_votes':votes})
  else:votes=integer(row['votes'])
  if row['county']=='Leelanau' and native.get((name,row['precinct']))!=votes:fail('Processed Leelanau disagrees with independent combined count')
  totals[axis]+=votes;by_county[row['county']][axis]+=votes
 cass_counts={'D':8584,'R':18127,'L':272,'U':205,'G':121,'N':106}
 if dict(by_county['Cass'])!=cass_counts or dict(by_county['Leelanau'])!=leel_regular:fail('Independent county aggregate disagreement')
 with zipfile.ZipFile(io.BytesIO(census_bytes)) as z:
  census={r['NAME'].removesuffix(' County'):r['GEOID'] for r in csv.DictReader(io.StringIO(z.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')),delimiter='\t') if r['GEOID'].startswith('26')}
 if len(census)!=83 or len(by_county)!=83:fail('Missing statewide county breadth')
 mit=json.loads((ROOT/'data/senate_history_2020_2022_2024.json').read_text(encoding='utf-8'))
 prior=next(r for r in mit['contest_records'] if r['state']=='MI' and r['election_year']==2024)
 reference={axis:next(r['votes'] for r in prior['candidates'] if r['name']==name.upper()) for name,(_,axis) in NATIVE.items()}
 result={'schema':'michigan-senate-historical-preparation-assessment-v1','status':'OPEN_DEPENDENCIES_NOT_BASELINE_OR_RUNTIME_ADMISSION','eligible_for_national_needle':False,'current_source_admitted':False,'runtime_inputs_unchanged':17,'source_hashes':PINS,'historical_year':2024,'same_senate_class_as_2026':False,'processed_senate_rows':len(rows),'processed_counties':len(by_county),'county_reference_matches':len(set(by_county)&set(census)),'unmatched_processed_county_labels':sorted(set(by_county)-set(census)),'unmatched_independent_counties':sorted(set(census)-set(by_county)),'explicit_Cass_alias_rows':aliases,'Cass_official_counts':cass_counts,'Leelanau_county_published_counts':leel_all,'Leelanau_source_label':'UNOFFICIAL RESULTS; retrospective Jan2025 export, not independent2024capture or certification','Leelanau_blank_regular_counts_supplied_from_independent_combined_rows':fills,'regular_processed_totals_after_documented_corroboration':dict(totals),'independent_reference':'Previously imported MIT/MEDSL CC0 statewide Senate snapshot, not a new original state canvass','independent_MIT_totals':reference,'MIT_minus_processed_residual_not_assigned_to_any_county':{k:reference[k]-totals[k] for k in reference},'unclassified_row_label_totals_not_assumed_additive':[{'candidate':k[0],'party':k[1],'votes':v} for k,v in sorted(unknown.items())],'blank_unclassified_rows_not_zeroed':blanks,'current_contract_status':'One directed2026MIsearch returnedHTTP403; stopped, no currentID/detail/county contract admitted','open_dependencies':['Unreconciled statewide D11/R4/L875 reference differences; never allocate residuals to guessed counties','Processed St. Joseph\'s versus independent St. Joseph name requires explicit independently grounded join before admission','Historical2024different-class scenario needs explicit review; this is not the missing official2020same-seat baseline','Current2026 exact6candidate/provider/geography/clock contract unavailable; directed search403 stopped','MI already has2predeclared House members: preserve their fixed shares and the state20likelihood budget before any18th route; cap-only expansion forbidden'],'actual_positive_2026_delivery_verified':False,'independent_chronological_calibration':False}
 result['source_receipts']={key:json.loads((SOURCES/file).read_text(encoding='utf-8')) for key,file in [('Cass','2024-cass-original-receipt.json'),('Leelanau','2024-leelanau-export-receipt.json'),('current_search','2026-directed-search-receipt.json')]}
 result['receipt_clock_scope']='at is the recorded request-start clock; decoded-body completion clocks were not recorded. Jan2025 export creation is not an independent2024capture.'
 return result
if __name__=='__main__':
 out=ROOT/'data/michigan_senate_historical_preparation_assessment.json'
 out.write_text(json.dumps(build(),indent=2)+'\n',encoding='utf-8',newline='\n')
 print('MI Senate historical evidence reproduced; residual/geography/current-source/state-budget gates remain OPEN; no new baseline, route or votes admitted')
