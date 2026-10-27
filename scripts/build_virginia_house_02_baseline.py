"""Reproduce VA02 district-part totals; never sum nested precincts twice."""
import csv
import gzip
import hashlib
import io
import json
from pathlib import Path
import zipfile
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'data/virginia_house_02_sources'


class CandidateTable(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows = []; self.row = []; self.cell = None
    def handle_starttag(self, tag, attrs):
        if tag == 'tr': self.row = []
        if tag == 'td': self.cell = ''
    def handle_data(self, data):
        if self.cell is not None: self.cell += data
    def handle_endtag(self, tag):
        if tag == 'td' and self.cell is not None:
            self.row.append(self.cell.strip()); self.cell = None
        if tag == 'tr' and self.row: self.rows.append(self.row)


def aggregate(rows, reference):
    if rows[:2] != [['', '', 'Jen A. Kiggans', 'Missy Cotter Smasal', 'Robert E. Reid, Jr.', 'Write-Ins', 'Total Votes Cast'],
                    ['', '', 'Republican', 'Democratic', 'Independent', '', '']]:
        raise ValueError('Historical candidate/column contract changed')
    state = [r for r in rows[2:] if r[0] == 'Congressional District']
    if len(state) != 1 or state[0][1] != '2' or list(map(int, state[0][2:])) != [207368, 191666, 9197, 471, 408702]:
        raise ValueError('Wrong historical district or certified totals')
    result = []; seen = set()
    for row in rows[2:]:
        if row[0] != 'Locality': continue  # Precincts already included in Locality aggregates.
        if len(row) != 7 or row[1].casefold() not in reference or row[1].casefold() in seen:
            raise ValueError('Unknown, missing or duplicate district-part locality')
        seen.add(row[1].casefold()); fips, name = reference[row[1].casefold()]
        values = list(map(int, row[2:])); r, d, i, w, total = values
        if min(values) < 0 or r+d+i+w != total: raise ValueError('Locality counts do not reconcile')
        result.append(dict(county=name, county_fips=fips, dem_votes=d, rep_votes=r,
                           independent_votes=i, writein_votes=w))
    if seen != set(reference) or [sum(c[k] for c in result) for k in ['rep_votes','dem_votes','independent_votes','writein_votes']] != [207368,191666,9197,471]:
        raise ValueError('Incomplete locality matrix or district discrepancy')
    return result


def build(write=True):
    contract = json.loads((ROOT/'data/virginia_house_02_source_contract.json').read_text(encoding='utf-8'))
    raw = (FOLDER/'2024-official-va02-localities.csv').read_bytes()
    if hashlib.sha256(raw).hexdigest() != contract['original_historical_csv_sha256']: raise ValueError('Original CSV hash mismatch')
    candidate_html = gzip.decompress((FOLDER/'2026-official-federal-candidates.html.gz').read_bytes())
    if hashlib.sha256(candidate_html).hexdigest() != contract['original_candidate_html_sha256']: raise ValueError('Candidate HTML hash mismatch')
    table = CandidateTable(); table.feed(candidate_html.decode('utf-8'))
    roster = [(r[2], r[3]) for r in table.rows if r[:2] == ['Member, House of Representatives','2nd District']]
    if sorted(roster) != sorted([('Democratic','Elaine G. Luria'),('Republican','Jen A. Kiggans'),('Independent','Geral D. "Bishop" Staten'),('Independent','J. Matt Baker')]):
        raise ValueError('Independent official candidate roster changed')
    census_path = ROOT/'data/texas_historical_sources/2024-census-counties.zip'
    if hashlib.sha256(census_path.read_bytes()).hexdigest() != '3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0': raise ValueError('Census original mismatch')
    with zipfile.ZipFile(census_path) as archive:
        census = list(csv.DictReader(io.StringIO(archive.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')),delimiter='\t'))
    names = {r['name'].casefold() for r in contract['localities']}
    reference = {r['NAME'].casefold():(r['GEOID'],r['NAME']) for r in census if r['GEOID'].startswith('51') and r['NAME'].casefold() in names}
    if len(reference) != 8: raise ValueError('Eight independent Census locality identities required')
    for native in contract['localities']:
        if reference[native['name'].casefold()][0] != '51'+native['mapFeatureId'].zfill(3): raise ValueError('Official native code/Census mismatch')
    counties = aggregate(list(csv.reader(io.StringIO(raw.decode('utf-8-sig')))),reference)
    bridge = json.loads((ROOT/'data/house_geography_bridge.json').read_text(encoding='utf-8'))
    district = next(r for r in bridge['districts'] if r['race_code_2026']=='VA-02')
    if district['map_relation_2024_to_2026']!='boundaries_unchanged_per_2026_census' or district['recorded_dem_votes_2024']!=191666 or district['recorded_rep_votes_2024']!=207368:
        raise ValueError('Independent district geography/totals disagree')
    baseline = dict(race_code='VA-02', election_date='2024-11-05', geography_scope='district_parts',
                    map_comparability=district['map_relation_2024_to_2026'], source_sha256=contract['original_historical_csv_sha256'],
                    counties=counties, district_totals=dict(dem_votes=191666,rep_votes=207368),
                    method_scope='Combined locality totals; source live methods are retained but not separately modeled. No chronological calibration.')
    ref = dict(race_code='VA-02',source_sha256=hashlib.sha256(census_path.read_bytes()).hexdigest(),counties=[dict(fips=c['county_fips'],county=c['county']) for c in counties])
    if write:
        for name, obj in [('virginia_house_02_2024_county_baseline_official',baseline),('virginia_house_02_county_fips_reference',ref)]:
            (ROOT/('data/'+name+'.json')).write_text(json.dumps(obj,indent=2)+'\n',encoding='utf-8',newline='\n')
    return baseline, ref


if __name__ == '__main__': build()
