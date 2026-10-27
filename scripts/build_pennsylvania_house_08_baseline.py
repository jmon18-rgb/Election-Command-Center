"""PA-08 district parts from existing original state returns; no allocations."""
import csv
import gzip
import hashlib
import io
import json
import zipfile
from pypdf import PdfReader
from build_pennsylvania_house_county_baseline import (
    ROOT, FOLDER, RAW_HASH, SCHEMA_HASH, CENSUS_HASH, URL, SCHEMA_URL)

COUNTIES = {'35': 'Lackawanna', '40': 'Luzerne', '45': 'Monroe', '52': 'Pike', '64': 'Wayne'}
PDF_HASH = 'bb36b5b463fb748f59dff82d4daae604cd1be69411475b64d8faa20963c987a3'
PDF_URL = 'https://www.monroecountypa.gov/getmedia/8952bea5-32f4-4763-a61f-49d917063997/Nov26_CandidateProclamation.pdf'


def aggregate(rows, census):
    totals = {name: {'dem_votes': 0, 'rep_votes': 0} for name in COUNTIES.values()}
    seen, precincts = set(), {}
    for r in rows:
        if len(r) != 37:
            raise ValueError('Original 37-field schema mismatch')
        if r[8] != 'USC':
            continue
        if not r[5].isdigit():
            raise ValueError('Invalid candidate district')
        if int(r[5]) != 8:
            continue
        if r[0] != '2024' or r[1] != 'G' or r[18] != '8' or r[32] != '':
            raise ValueError('Wrong general congressional record scope')
        county = COUNTIES.get(r[2])
        if county is None or not r[29].isdigit() or '42' + r[29].zfill(3) != census.get(county):
            raise ValueError('County election code/FIPS mismatch')
        expected = {'DEM': ('CARTWRIGHT', 'MATTHEW'), 'REP': ('BRESNAHAN', 'ROBERT ')}
        if r[9] not in expected or (r[11], r[12]) != expected[r[9]] or not r[10]:
            raise ValueError('Wrong historical candidate/party')
        if not r[3].isdigit() or not r[15].isdigit():
            raise ValueError('Invalid precinct/count')
        key = (county, int(r[3]), r[9])
        if key in seen:
            raise ValueError('Duplicate normalized precinct candidate')
        seen.add(key)
        precincts.setdefault(key[:2], set()).add(r[9])
        totals[county]['dem_votes' if r[9] == 'DEM' else 'rep_votes'] += int(r[15])
    if (not precincts or any(p != {'DEM', 'REP'} for p in precincts.values())
            or {c for c, _ in precincts} != set(COUNTIES.values())):
        raise ValueError('Incomplete district-part precinct/candidate coverage')
    return totals, len(seen), len(precincts)


def build():
    raw = gzip.decompress((FOLDER / '2024-official-precinct-returns.txt.gz').read_bytes())
    schema = (FOLDER / '2024-official-precinct-schema.txt').read_bytes()
    census_raw = (ROOT / 'data/texas_historical_sources/2024-census-counties.zip').read_bytes()
    pdf = (ROOT / 'data/pennsylvania_source_documents/2026-monroe-general-candidates.pdf').read_bytes()
    for data, expected in [(raw, RAW_HASH), (schema, SCHEMA_HASH), (census_raw, CENSUS_HASH), (pdf, PDF_HASH)]:
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError('Pinned original government bytes changed')
    reader = PdfReader(io.BytesIO(pdf))
    text = reader.pages[0].extract_text() + '\n' + reader.pages[1].extract_text()
    for label in ['General Election', '11/3/2026', 'Representative in Congress 8th District',
                  'PAIGE COGNETTI', 'ROB BRESNAHAN JR', 'Barrett One', 'Ross Two', 'Tunkhannock West']:
        if label not in text:
            raise ValueError('Original 2026 candidate proclamation changed')
    with zipfile.ZipFile(io.BytesIO(census_raw)) as z:
        census = {r['NAME'].removesuffix(' County'): r['GEOID'] for r in csv.DictReader(
            io.StringIO(z.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')), delimiter='\t')
                  if r['GEOID'].startswith('42')}
    if len(census) != 67:
        raise ValueError('Independent Census reference incomplete')
    rows = list(csv.reader(io.StringIO(raw.decode('utf-8-sig')), strict=True))
    if len(rows) != 268768:
        raise ValueError('Original statewide coverage changed')
    totals, count, precincts = aggregate(rows, census)
    if count != 854 or precincts != 427:
        raise ValueError('Exact district coverage changed')
    summary = {k: sum(c[k] for c in totals.values()) for k in ['dem_votes', 'rep_votes']}
    if summary != {'dem_votes': 189411, 'rep_votes': 195663}:
        raise ValueError('Official named-candidate district totals changed')
    mit = next(r for r in json.loads((ROOT / 'data/house_history_2024_staging.json').read_text(
        encoding='utf-8'))['records'] if r['2024_race_code'] == 'PA-08')
    if any(mit['recorded_' + k] != summary[k] for k in summary) or mit['recorded_other_votes'] != 0:
        raise ValueError('Independent MIT district reconciliation failed')
    geo = next(r for r in json.loads((ROOT / 'data/house_geography_bridge.json').read_text(
        encoding='utf-8'))['districts'] if r['race_code_2026'] == 'PA-08')
    if not geo['geography_comparable_2024'] or geo['map_relation_2024_to_2026'] != 'boundaries_unchanged_per_2026_census':
        raise ValueError('Current House map not comparable')
    counties = [{'county': c, 'county_fips': census[c], **totals[c], 'named_other_votes': 0}
                for c in sorted(totals, key=lambda c: census[c])]
    baseline = {'status': 'OFFICIAL_DISTRICT_PART_HISTORY_NOT_LIVE_OR_CALIBRATION',
                'race_code': 'PA-08', 'election_date': '2024-11-05', 'county_count': 5,
                'geography_scope': 'district_parts', 'counties': counties, 'district_totals': summary,
                'source_url': URL, 'source_sha256': RAW_HASH, 'source_schema_url': SCHEMA_URL,
                'source_schema_sha256': SCHEMA_HASH, 'selected_precinct_candidate_rows': count,
                'selected_precincts': precincts, 'map_comparability': geo['map_relation_2024_to_2026'],
                'map_source': geo['source_census'], 'candidate_proclamation_url': PDF_URL,
                'candidate_proclamation_sha256': PDF_HASH,
                'limitations': ['Monroe is a district part, not its whole-county total.',
                                'Final 2024 counts are not reporting chronology or calibrated 2026 remaining ballots.',
                                'Generic write-ins are not supplied by the state extract; named-other zero is not all other ballots.']}
    reference = {'source_sha256': CENSUS_HASH, 'scope': 'PA-08 district parts; independent Census FIPS',
                 'counties': [{'county': c['county'], 'fips': c['county_fips']} for c in counties]}
    for suffix, output in [('2024_county_baseline_official', baseline), ('county_fips_reference', reference)]:
        (ROOT / 'data' / ('pennsylvania_house_08_' + suffix + '.json')).write_text(
            json.dumps(output, indent=2) + '\n', encoding='utf-8', newline='\n')
    return baseline


if __name__ == '__main__':
    build()
    print('PA-08: 854 candidate rows / 427 precincts / five district county parts reconcile; not live or calibration')
