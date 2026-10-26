"""Reproduce official NY17 county parts with candidate-specific fusion lines.

This is historical input preparation, not a live feed or a calibration claim.
New York's official contest export is preserved verbatim. Generic party aliases
are unsafe: Lawler's Conservative line belongs to him, while the Working
Families line belongs to a different candidate, Anthony Frascone.
"""
import csv
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/new_york_historical_sources/2024-official-ny17-contest.csv'
SOURCE_HASH = 'be103b259252234331fd99c0f4f9d6b098d456f9a6242a4cb60e240384ce7a0f'
CENSUS_HASH = '3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'
SOURCE_URL = 'https://ny.elstats.civera.com/api/download_contest/5615_table.csv?split_party=true'
CONTEST_URL = 'https://results.elections.ny.gov/contest/5615'
COUNTIES = {'Dutchess', 'Putnam', 'Rockland', 'Westchester'}
HEADERS = ['', '', 'Mike Lawler', 'Mike Lawler', 'Mondaire L. Jones', 'Anthony Frascone', 'Scattering', 'Blank', 'Void', 'Total Votes']
PARTIES = ['', '', 'Republican', 'Conservative', 'Democratic', 'Working Families', '', '', '', '']


def parse_export(raw, census):
    rows = list(csv.reader(io.StringIO(raw.decode('utf-8-sig')), strict=True))
    if len(rows) != 7 or rows[0] != HEADERS or rows[1] != PARTIES:
        raise ValueError('Unexpected exact contest candidate/party/export schema')
    totals = None
    counties = []
    seen = set()
    for row in rows[2:]:
        if len(row) != 10 or any(not x.isascii() or not x.isdigit() for x in row[2:]):
            raise ValueError('Noninteger or malformed official totals')
        values = list(map(int, row[2:]))
        if sum(values[:-1]) != values[-1]:
            raise ValueError('Candidate/blank/void total does not reconcile')
        if row[:2] == ['Congressional District', '17']:
            if totals is not None:
                raise ValueError('Duplicate district aggregate')
            totals = values
            continue
        county = row[1]
        if row[0] != 'County' or county not in COUNTIES or county in seen or county not in census:
            raise ValueError('Unexpected/duplicate county or wrong contest scope')
        seen.add(county)
        counties.append({'county': county, 'county_fips': census[county],
                         'dem_votes': values[2], 'rep_votes': values[0] + values[1],
                         'named_other_votes': values[3], 'generic_write_in_votes': values[4],
                         'blank_votes': values[5], 'void_votes': values[6], 'reported_total': values[7],
                         'party_line_votes': dict(zip(['Republican', 'Conservative', 'Democratic', 'Working Families'], values[:4]))})
    if totals is None or seen != COUNTIES:
        raise ValueError('Incomplete district county coverage')
    # Each of eight additive source columns must reproduce the district row.
    county_rows = [list(map(int, r[2:])) for r in rows[2:] if r[0] == 'County']
    if [sum(r[i] for r in county_rows) for i in range(8)] != totals:
        raise ValueError('County parts disagree with district aggregate')
    summary = dict(zip(['republican_line', 'conservative_line', 'democratic_line', 'working_families_line',
                        'generic_write_in_votes', 'blank_votes', 'void_votes', 'reported_total'], totals))
    summary.update(dem_votes=totals[2], rep_votes=totals[0] + totals[1], named_other_votes=totals[3])
    return sorted(counties, key=lambda r: r['county_fips']), summary


def build():
    raw = SOURCE.read_bytes()
    census_raw = (ROOT / 'data/texas_historical_sources/2024-census-counties.zip').read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_HASH or hashlib.sha256(census_raw).hexdigest() != CENSUS_HASH:
        raise ValueError('Pinned original official source bytes changed')
    with zipfile.ZipFile(io.BytesIO(census_raw)) as z:
        census = {r['NAME'].removesuffix(' County'): r['GEOID'] for r in csv.DictReader(
            io.StringIO(z.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')), delimiter='\t') if r['GEOID'].startswith('36')}
    if len(census) != 62:
        raise ValueError('Independent full New York Census reference incomplete')
    counties, summary = parse_export(raw, census)
    if summary['dem_votes'] != 173899 or summary['rep_votes'] != 197845 or summary['named_other_votes'] != 7530:
        raise ValueError('Official full candidate totals changed')
    geo = next(r for r in json.loads((ROOT / 'data/house_geography_bridge.json').read_text(encoding='utf-8'))['districts'] if r['race_code_2026'] == 'NY-17')
    if not geo['geography_comparable_2024'] or geo['map_relation_2024_to_2026'] != 'boundaries_unchanged_per_2026_census':
        raise ValueError('Current district geography is not comparable')
    staged = next(r for r in json.loads((ROOT / 'data/house_history_2024_staging.json').read_text(encoding='utf-8'))['records'] if r['2024_race_code'] == 'NY-17')
    expected_staging = {'recorded_dem_votes': summary['democratic_line'], 'recorded_rep_votes': summary['rep_votes'],
                        'recorded_other_votes': sum(summary[k] for k in ['working_families_line', 'generic_write_in_votes', 'blank_votes', 'void_votes'])}
    if any(staged[k] != v for k, v in expected_staging.items()):
        raise ValueError('Corrected staging does not match official full-candidate totals')
    baseline = {'status': 'OFFICIAL_PUBLISHED_2024_DISTRICT_PART_BASELINE_NOT_LIVE_OR_CALIBRATION',
                'race_code': 'NY-17', 'office': 'U.S. House', 'election_date': '2024-11-05',
                'county_count': 4, 'counties': counties, 'district_totals': summary,
                'source_url': SOURCE_URL, 'official_contest_url': CONTEST_URL, 'source_sha256': SOURCE_HASH,
                'source_type': 'New York State Board of Elections official historical contest CSV export',
                'map_comparability': geo['map_relation_2024_to_2026'], 'map_source': geo['source_census'],
                'fusion_contract': 'Mike Lawler Republican+Conservative; Mondaire L. Jones Democratic only; Anthony Frascone Working Families is a separate candidate',
                'existing_staging_discrepancy': {'staging_rep_votes': staged['recorded_rep_votes'],
                    'omitted_same_candidate_conservative_votes': 0,
                    'historical_repair_added_conservative_votes': summary['conservative_line'],
                    'resolved': True, 'staging_other_includes_blank_void': True, 'global_staging_changed': True},
                'method_split_reported': False, 'historical_release_times': False, 'interval_calibrated': False,
                'limitations': ['Final certified historical counts are not chronological election-night returns',
                    'County rows are congressional district parts, not whole-county totals',
                    'Generic write-ins, blanks and voids remain separate from named-candidate votes',
                    '2024 turnout is not an official2026 remaining-ballot count or calibrated interval',
                    'No production live source or national controller is enabled by this import']}
    reference = {'source_url': 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip',
                 'source_sha256': CENSUS_HASH, 'scope': 'NY17 congressional district county parts, not whole-county returns',
                 'district_county_scope_source': CONTEST_URL,
                 'counties': [{'county': c['county'], 'fips': c['county_fips']} for c in counties]}
    return baseline, reference


if __name__ == '__main__':
    for suffix, value in zip(['2024_county_baseline_official', 'county_fips_reference'], build()):
        path = ROOT / 'data' / ('new_york_house_17_' + suffix + '.json')
        if '--check' in sys.argv:
            if json.loads(path.read_text(encoding='utf-8')) != value:
                raise ValueError('Published NY17 baseline does not reproduce')
        else:
            path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('NY17: four official county parts and full candidate fusion totals reproduced; not live/calibration')
