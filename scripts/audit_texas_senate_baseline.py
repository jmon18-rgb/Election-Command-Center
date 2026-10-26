"""Audit a candidate Texas baseline; never repair county totals or enable a feed."""
import argparse
import csv
import hashlib
import io
import json
import zipfile
from pathlib import Path

from read_official_xlsx_rows import read_workbook

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_URL = 'https://data.capitol.texas.gov/dataset/35b16aee-0bb0-4866-b1ec-859f1f044241/resource/5af9f5e2-ca14-4e5d-880e-3c3cd891d3ed/download/2020-general-vtd-election-data-2020.zip'
FEC_URL = 'https://www.fec.gov/documents/4228/federalelections2020.xlsx'
ARCHIVE_HASH = '4ad668baa6ac0e05ffc0893201279ef5a0656411693bd751c96d8b06deba3d1f'
FEC_HASH = '5073b6d2c76c86c941508dfb1a11cc497e8529b0068c5132aceb0f385c19352e'
NAMES = {'Cornyn': ('R', 'Cornyn, John'), 'Hegar': ('D', 'Hegar, Mary "MJ"'),
         'McKennon': ('L', 'McKennon, Kerry Douglas'), 'Collins': ('G', 'Collins, David B.')}


def audit(archive_path, fec_path):
    archive_bytes, fec_bytes = archive_path.read_bytes(), fec_path.read_bytes()
    if hashlib.sha256(archive_bytes).hexdigest() != ARCHIVE_HASH or hashlib.sha256(fec_bytes).hexdigest() != FEC_HASH:
        raise ValueError('Original official source bytes changed; independent review required')
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as z:
        member = z.read('2020_General_Election_Returns.csv')
        readme = z.read('ReadMe_20G_2020.txt')
    counties, cells, totals = {}, set(), {name: 0 for name in NAMES}
    for row in csv.DictReader(io.StringIO(member.decode('utf-8-sig'))):
        if row['Office'] != 'U.S. Sen':
            continue
        name = row['Name']
        if name not in NAMES or row['Party'] != NAMES[name][0] or not row['Votes'].isdigit():
            raise ValueError('Unexpected candidate/party/count')
        fips = '48' + row['FIPS'].zfill(3)
        if len(fips) != 5 or not fips.isdigit() or not 1 <= int(fips[2:]) <= 507 or int(fips[2:]) % 2 != 1:
            raise ValueError('Invalid Texas county code')
        key = (fips, row['vtdkeyvalue'], name)
        if key in cells:
            raise ValueError('Duplicate VTD/candidate cell')
        cells.add(key)
        county = counties.setdefault(fips, {'county_fips': fips, 'county': row['County'], 'candidate_votes': {n: 0 for n in NAMES}})
        if county['county'] != row['County']:
            raise ValueError('Inconsistent county name')
        votes = int(row['Votes'])
        county['candidate_votes'][name] += votes
        totals[name] += votes
    if len(counties) != 254 or len(cells) != 36628:
        raise ValueError('Candidate source coverage changed')
    vectors = {}
    for fips, vtd, name in cells:
        vectors.setdefault((fips, vtd), set()).add(name)
    if any(names != set(NAMES) for names in vectors.values()):
        raise ValueError('Incomplete candidate vector')
    fec = {}
    for row in read_workbook(fec_path)['12. US Senate Results by State']:
        if row[1] == 'TX' and row[8] and isinstance(row[15], int):
            name = row[8].strip()
            if name in fec:
                raise ValueError('Ambiguous certified candidate')
            fec[name] = row[15]
    if len(fec) != 5:
        raise ValueError('Certified candidate coverage changed')
    comparisons = [{ 'candidate': name, 'party': NAMES[name][0], 'tlc_vtd_sum': totals[name],
                     'fec_certified': fec[NAMES[name][1]], 'difference': totals[name] - fec[NAMES[name][1]]}
                   for name in NAMES]
    agrees = all(r['difference'] == 0 for r in comparisons)
    return {'status': 'RECONCILED_CANDIDATE_STILL_REQUIRES_GEOGRAPHY_REVIEW' if agrees else 'BLOCKED_CERTIFIED_TOTAL_MISMATCH',
            'production_eligible': False, 'race': '2020 Texas U.S. Senate', 'county_count': 254,
            'candidate_vtd_cells': len(cells), 'vtd_count': len(vectors),
            'source_archive': {'url': ARCHIVE_URL, 'sha256': ARCHIVE_HASH, 'bytes': len(archive_bytes),
                               'license': 'Creative Commons Attribution, per official dataset page',
                               'dataset_page': 'https://data.capitol.texas.gov/dataset/comprehensive-election-datasets-compressed-format',
                               'member': '2020_General_Election_Returns.csv', 'member_sha256': hashlib.sha256(member).hexdigest(),
                               'readme_sha256': hashlib.sha256(readme).hexdigest()},
            'certified_source': {'url': FEC_URL, 'sha256': FEC_HASH, 'worksheet': '12. US Senate Results by State'},
            'comparisons': comparisons, 'certified_write_in_votes_not_present_in_tlc_candidate_roster': fec['Turullols-Bonilla, Ricardo'],
            'limitations': ['TLC redistricting VTDs differ from actual election precincts',
                            'County names/codes have not yet been joined to independent Census reference',
                            'No vote-method split or historical publication clock',
                            'No statewide scaling, county allocation or missing-vote repair is permitted',
                            'This audit neither accepts 2026 live counts nor calibrates a forecast'],
            'counties': sorted(counties.values(), key=lambda r: r['county_fips'])}


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--archive', type=Path, required=True)
    p.add_argument('--fec', type=Path, required=True)
    p.add_argument('--check', action='store_true')
    args = p.parse_args()
    result = audit(args.archive, args.fec)
    target = ROOT / 'data/texas_senate_baseline_candidate_audit.json'
    if args.check:
        if result != json.loads(target.read_text(encoding='utf-8')):
            raise ValueError('Committed audit does not reproduce')
    else:
        target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ('counties', 'source_archive', 'certified_source')}))
