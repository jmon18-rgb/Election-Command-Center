"""Import the archived official 2024 Senate canvass, not live returns.

The 2026 special election is a different Senate seat. These county totals are
a historical turnout/composition reference, never a calibrated release sequence.
"""
import csv
import hashlib
import io
import json
import zipfile
from pathlib import Path
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
SOURCE_HASH = 'ef2f8050e1779a905d602ce34facad510394ac5500ae76ce374f7f73420115e8'
CENSUS_HASH = '3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'
ORIGINAL_URL = 'https://www.ohiosos.gov/globalassets/elections/2024/gen/official/statewide-race-summary.xlsx'
ARCHIVE_URL = 'https://web.archive.org/web/20241207004035if_/' + ORIGINAL_URL
HEADER = ['County Name', 'Region Name', 'Media Market', 'Registered Voters',
          'Ballots Counted', 'Official Voter Turnout', 'Sherrod Brown (D)',
          'Stephen Faris (WI)*', 'Don Kissick (L)', 'Bernie Moreno (R)',
          'David Allen Pastorius (WI)*', 'Nathan Russell (WI)*', 'Tariq K. Shabazz (WI)*']
TOTALS = [2650949, 84, 195648, 2857383, 13, 19, 524]


def parse_rows(rows, reference):
    if (len(rows) != 92 or not str(rows[0][0]).startswith(
            'November 5, 2024 General Election Official Canvass')
            or rows[0][6] != 'U.S. Senator\n' or list(rows[1][:13]) != HEADER
            or rows[2][0] != 'Total' or list(rows[2][6:13]) != TOTALS
            or rows[3][0] != 'Percentage' or len(reference) != 88):
        raise ValueError('Official Senate identity/header/state totals changed')
    counties, sums = [], [0] * 9
    seen = set()
    for row in rows[4:]:
        name = row[0]
        if name not in reference or name in seen:
            raise ValueError('Unknown or duplicate county')
        seen.add(name)
        registration, ballots = row[3:5]
        counts = list(row[6:13])
        if any(type(v) is not int or v < 0 for v in [registration, ballots] + counts):
            raise ValueError('Invalid historical count')
        if sum(counts) > ballots or ballots > registration:
            raise ValueError('Historical contest/ballot/registration mismatch')
        sums = [a + b for a, b in zip(sums, [registration, ballots] + counts)]
        counties.append({'fips': reference[name], 'county': name,
                         'dem_votes': counts[0], 'rep_votes': counts[3],
                         'other_votes': sum(counts) - counts[0] - counts[3],
                         'contest_votes': sum(counts), 'ballots_counted': ballots,
                         'registered_voters': registration})
    if seen != set(reference) or sums != [8159946, 5851387] + TOTALS:
        raise ValueError('County sums do not equal official statewide totals')
    return {'schema': 'official-ohio-senate-county-baseline-v1', 'year': 2024,
            'state': 'OH', 'office': 'US Senate', 'counties': counties,
            'state_totals': {'dem_votes': TOTALS[0], 'rep_votes': TOTALS[3],
                            'other_votes': sum(TOTALS) - TOTALS[0] - TOTALS[3],
                            'contest_votes': sum(TOTALS), 'ballots_counted': 5851387},
            'source_url': ORIGINAL_URL, 'retrieved_archive_url': ARCHIVE_URL,
            'source_sha256': SOURCE_HASH, 'county_reference_sha256': CENSUS_HASH,
            'national_input_enabled': False, 'calibration_inputs_approved': 0,
            'limitations': ['Final certified county totals, not reporting chronology.',
                           '2024 regular Senate and 2026 special Senate are different seats.',
                           'Historical ballots counted are not 2026 outstanding ballots.',
                           'No 2026 source or national likelihood enabled by this importer.']}


def build():
    raw = (ROOT / 'data/ohio_historical_sources/2024-official-statewide-race-summary.xlsx').read_bytes()
    census = (ROOT / 'data/texas_historical_sources/2024-census-counties.zip').read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_HASH or hashlib.sha256(census).hexdigest() != CENSUS_HASH:
        raise ValueError('Pinned original source bytes changed')
    with zipfile.ZipFile(io.BytesIO(census)) as z:
        reference = {r['NAME'].removesuffix(' County'): r['GEOID'] for r in csv.DictReader(
            io.StringIO(z.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')),
            delimiter='\t') if r['GEOID'].startswith('39')}
    workbook = load_workbook(io.BytesIO(raw), data_only=True, read_only=True)
    try:
        result = parse_rows(list(workbook['U.S. Congress'].values), reference)
    finally:
        workbook.close()
    (ROOT / 'data/ohio_senate_2024_county_baseline_official.json').write_text(
        json.dumps(result, indent=2) + '\n', encoding='utf-8', newline='\n')
    return result


if __name__ == '__main__':
    result = build()
    print('Verified 88 Ohio Senate counties; statewide counts reconcile; no live input enabled.')
