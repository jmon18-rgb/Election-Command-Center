"""Reproduce WA03 district-part historical counts from the official 2024 export.

Contest votes are not ballots cast or an official outstanding-ballot estimate.
This prepares a source contract; it does not enable a national evidence input.
"""
import csv
import gzip
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://results.vote.wa.gov/results/20241105/export/20241105_AllCounties.csv'
SOURCE_HASH = '58b301850875691a104a76c3c4e58555ec476e19c511f3fbb9c80e4110fc2c6a'
CENSUS_HASH = '3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'
COUNTIES = {'Clark', 'Cowlitz', 'Lewis', 'Pacific', 'Skamania', 'Thurston', 'Wahkiakum'}
RACE = 'CONGRESSIONAL DISTRICT 3 U.S. Representative'
CANDIDATES = {'Marie Gluesenkamp Perez': ('(Prefers Democratic Party)', 'dem_votes'),
              'Joe Kent': ('(Prefers Republican Party)', 'rep_votes'),
              'WRITE-IN': (' ', 'other_votes')}


def parse_export(raw, census):
    reader = csv.DictReader(io.StringIO(raw.decode('utf-8-sig')), strict=True)
    if reader.fieldnames != ['County', 'Race', 'Candidate', 'Party', 'Votes', 'PercentageOfTotalVotes', 'JurisdictionName']:
        raise ValueError('Official export columns changed')
    result = {}
    for row in reader:
        if row['Race'] != RACE:
            continue
        name, candidate = row['County'], row['Candidate']
        if name not in COUNTIES or name not in census or candidate not in CANDIDATES or row['JurisdictionName'] != 'Congressional':
            raise ValueError('Unknown WA03 county, office or candidate')
        party, key = CANDIDATES[candidate]
        if row['Party'] != party or not row['Votes'].isascii() or not row['Votes'].isdigit():
            raise ValueError('Candidate party/count mismatch')
        county = result.setdefault(name, {'county': name, 'county_fips': census[name], 'geography_scope': 'WA-03 district part, not whole county'})
        if key in county:
            raise ValueError('Duplicate candidate/county')
        county[key] = int(row['Votes'])
    if set(result) != COUNTIES or any(not all(k in c for k in ['dem_votes', 'rep_votes', 'other_votes']) for c in result.values()):
        raise ValueError('Incomplete county/candidate coverage')
    rows = sorted(result.values(), key=lambda c: c['county_fips'])
    for c in rows:
        c['total_votes'] = c['dem_votes'] + c['rep_votes'] + c['other_votes']
    return rows


def build():
    raw = gzip.decompress((ROOT/'data/washington_historical_sources/2024-official-all-counties.csv.gz').read_bytes())
    census_raw = (ROOT/'data/texas_historical_sources/2024-census-counties.zip').read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_HASH or hashlib.sha256(census_raw).hexdigest() != CENSUS_HASH:
        raise ValueError('Pinned original government source changed')
    with zipfile.ZipFile(io.BytesIO(census_raw)) as z:
        census = {r['NAME'].removesuffix(' County'): r['GEOID'] for r in csv.DictReader(io.StringIO(
            z.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')), delimiter='\t') if r['GEOID'].startswith('53')}
    if len(census) != 39:
        raise ValueError('Independent Washington Census reference incomplete')
    rows = parse_export(raw, census)
    totals = {key: sum(c[key] for c in rows) for key in ['dem_votes', 'rep_votes', 'other_votes', 'total_votes']}
    if totals != {'dem_votes': 215177, 'rep_votes': 199054, 'other_votes': 1673, 'total_votes': 415904}:
        raise ValueError('Official historical district totals changed')
    geo = next(r for r in json.loads((ROOT/'data/house_geography_bridge.json').read_text(encoding='utf-8'))['districts'] if r['race_code_2026'] == 'WA-03')
    if geo['map_relation_2024_to_2026'] != 'boundaries_unchanged_per_2026_census' or not geo['geography_comparable_2024']:
        raise ValueError('Historical district boundaries not comparable')
    if (geo['recorded_dem_votes_2024'], geo['recorded_rep_votes_2024']) != (totals['dem_votes'], totals['rep_votes']):
        raise ValueError('Independent historical staging disagrees')
    baseline = {'race_code': 'WA-03', 'year': 2024, 'source_url': URL, 'source_sha256': SOURCE_HASH,
                'status': 'OFFICIAL_HISTORICAL_CONTEST_COUNTS_NOT_LIVE_OR_CALIBRATION',
                'map_comparability': geo['map_relation_2024_to_2026'], 'counties': rows, 'totals': totals,
                'limits': ['District parts, not whole-county totals.', 'Contest votes do not measure ballots outstanding.',
                           '2024 presidential-year turnout and mail-return composition may differ from2026.']}
    reference = {'source_url': 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip',
                 'source_sha256': CENSUS_HASH, 'scope': 'WA-03 county district parts from original official export',
                 'counties': [{'county': c['county'], 'fips': c['county_fips']} for c in rows]}
    return {'washington_house_03_2024_county_baseline_official': baseline, 'washington_house_03_county_fips_reference': reference}


if __name__ == '__main__':
    for name, doc in build().items():
        path = ROOT/'data'/(name+'.json')
        if '--check' in sys.argv:
            if json.loads(path.read_text(encoding='utf-8')) != doc:
                raise ValueError('Stale Washington historical preparation: '+name)
        else:
            path.write_text(json.dumps(doc, indent=2)+'\n', encoding='utf-8')
    print('Official WA03 seven district-part baseline and independent Census identities reproduce')
