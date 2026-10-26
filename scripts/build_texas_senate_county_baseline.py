"""Reproduce Texas 2024 official Senate county facts, not live votes or calibration."""
import csv
import hashlib
import io
import json
import re
import sys
import zipfile
from pathlib import Path
from read_official_xlsx_rows import read_workbook

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/texas_historical_sources'
HASHES = {'2024-official-county-canvass.xlsx': '7b1e1a75b367c37006dd39d637681bad40070e23829297d50bc9c1f29b9e1ab4',
          '2024-census-counties.zip': '3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'}
# Independently observed on the official statewide results page, not derived
# by summing the workbook. Preserve all candidates, including write-ins.
EXPECTED = {'TED CRUZ': 5990741, 'COLIN ALLRED': 5031249, 'TED BROWN': 267039,
            'TRACY ANDRUS': 919, 'ANALISA ROCHE': 1906}
normalize = lambda s: re.sub('[^a-z]', '', s.lower())


def build():
    for filename, digest in HASHES.items():
        if hashlib.sha256((SOURCE / filename).read_bytes()).hexdigest() != digest:
            raise ValueError('Original source bytes changed: ' + filename)
    with zipfile.ZipFile(SOURCE / '2024-census-counties.zip') as z:
        rows = csv.DictReader(io.StringIO(z.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')), delimiter='\t')
        reference = {normalize(r['NAME'].removesuffix(' County')): {'county': r['NAME'].removesuffix(' County'), 'fips': r['GEOID']}
                     for r in rows if r['GEOID'].startswith('48')}
    if len(reference) != 254 or len({r['fips'] for r in reference.values()}) != 254:
        raise ValueError('Independent Census county coverage failed')
    rows = read_workbook(SOURCE / '2024-official-county-canvass.xlsx')['Voter Turnout Report']
    if [' '.join(str(v or '').split()) for v in rows[0]] != [
        'ELECTION DATE-NAME', 'OFFICE NAME', 'CANDIDATE NAME', 'COUNTY NAME', 'TOTAL VOTES PER OFFICE PER COUNTY']:
        raise ValueError('Official workbook schema changed')
    counties = {}
    for raw in rows[1:]:
        row = [' '.join(str(v or '').split()) for v in raw]
        if row[1] != 'U. S. SENATOR':
            continue
        if row[0] != '11/05/2024 - 2024 NOVEMBER 5TH GENERAL ELECTION':
            raise ValueError('Wrong official election identity')
        name, key, count = row[2].removesuffix(' (I)'), normalize(row[3]), row[4]
        if key not in reference or name not in EXPECTED or not re.fullmatch(r'\d{1,3}(?:,\d{3})*|\d+', count):
            raise ValueError('Unknown county/candidate/count')
        county = counties.setdefault(key, {})
        if name in county:
            raise ValueError('Duplicate county candidate')
        county[name] = int(count.replace(',', ''))
    if set(counties) != set(reference) or any(set(c) != set(EXPECTED) for c in counties.values()):
        raise ValueError('Incomplete official county candidate roster')
    totals = {name: sum(c[name] for c in counties.values()) for name in EXPECTED}
    if totals != EXPECTED:
        raise ValueError('Official county sums disagree with independently observed official statewide totals')
    result = []
    for key, c in counties.items():
        result.append({'county': reference[key]['county'], 'county_fips': reference[key]['fips'],
                       'dem_votes': c['COLIN ALLRED'], 'rep_votes': c['TED CRUZ'],
                       'other_votes': c['TED BROWN'] + c['TRACY ANDRUS'] + c['ANALISA ROCHE'], 'candidate_votes': c})
    return {'status': 'OFFICIAL_2024_COUNTY_BASELINE_NOT_LIVE_OR_CALIBRATION', 'election_date': '2024-11-05',
            'office': 'U.S. Senate', 'state': 'TX', 'county_count': 254, 'method_split_reported': False,
            'historical_release_times': False, 'may_move_national_needle': False, 'interval_calibrated': False,
            'statewide_candidate_votes': totals, 'source_sha256': HASHES,
            'official_workbook_url': 'https://results.texas-election.com/static/data/Reports/49664/CountybyCountyCanvassReport.xlsx',
            'independent_statewide_observation': {'url': 'https://results.texas-election.com/races',
                'election_label': '2024 NOVEMBER 5TH GENERAL ELECTION', 'status': 'OFFICIAL RESULTS',
                'provider_last_updated_display': 'Nov 26, 2024 12:57:43', 'race_total': 11291854,
                'scope': 'Normalized visible facts observed separately from workbook; not original HTML bytes'},
            'county_reference_url': 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip',
            'counties': sorted(result, key=lambda c: c['county_fips'])}


if __name__ == '__main__':
    value = build()
    if sum(value['statewide_candidate_votes'].values()) != value['independent_statewide_observation']['race_total']:
        raise ValueError('Independent statewide race total disagrees')
    reference = {'source_url': value['county_reference_url'], 'source_kind': 'US Census Bureau 2024 Gazetteer county identifiers',
                 'source_sha256': HASHES['2024-census-counties.zip'],
                 'counties': [{'county': c['county'], 'fips': c['county_fips']} for c in value['counties']]}
    for filename, data in [('texas_senate_2024_county_baseline_official.json', value), ('texas_county_fips_reference.json', reference)]:
        output = ROOT / 'data' / filename
        if '--check' in sys.argv:
            if json.loads(output.read_text(encoding='utf-8')) != data:
                raise ValueError('Official baseline/reference does not reproduce')
        else:
            output.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('PASS: 254 independent Census county joins; all five Senate candidate totals and official race total reconcile; not live delivery/calibration')
