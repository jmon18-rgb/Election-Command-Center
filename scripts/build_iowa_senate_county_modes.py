"""Reproduce Iowa county-method facts from original official canvass excerpts.

PDF web-reader text is committed because direct HTTP downloads returned 403.
No binary-PDF checksum or real reporting-order provenance is claimed.
"""
import hashlib
import argparse
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ['rep_votes', 'dem_votes', 'other_votes', 'undervotes', 'overvotes', 'ballots']


def build_year(year):
    path = ROOT / f'data/iowa_{year}_senate_canvass_excerpt.txt'
    raw = path.read_bytes().replace(b'\r\n', b'\n')
    text = raw.decode('utf-8')
    names = {2014: {'D': 'Bruce Braley', 'R': 'Joni Ernst'},
             2016: {'D': 'Patty Judge', 'R': 'Charles E. Grassley'},
             2020: {'D': 'Theresa Greenfield', 'R': 'Joni Ernst'},
             2022: {'D': 'Michael Franken', 'R': 'Chuck Grassley'}}[year]
    office = {2014: 'U.S. Senator', 2016: 'US Senator'}.get(year, 'United States Senator')
    if office not in text or not all(token in text for n in names.values() for token in n.split()):
        raise ValueError('Wrong official Senate excerpt')
    counties, current, published = {}, None, {}
    for line in text.splitlines():
        match = re.fullmatch(r'L(\d+): (.*)', line)
        if not match:
            continue
        number, row = int(match[1]), match[2]
        row = re.sub(r'^\d+ of \d+', '', row)
        first = re.fullmatch(r'(.*?)\s*Election Day\s+([\d, ]+)', row)
        if first:
            current, mode, counts = first[1], 'election_day', first[2]
        elif current and re.fullmatch(r'Absentee\s+[\d, ]+', row):
            mode, counts = 'absentee', row.removeprefix('Absentee').strip()
        elif current and re.fullmatch(r'Total\s+[\d, ]+', row):
            mode, counts = 'total', row.removeprefix('Total').strip()
        else:
            continue
        values = [int(n.replace(',', '')) for n in counts.split()]
        if len(values) != {2014: 10, 2016: 9, 2020: 8, 2022: 6}[year]:
            raise ValueError(f'Wrong candidate columns at line {number}')
        if sum(values[:-1]) != values[-1]:
            raise ValueError('Candidate and ballot arithmetic does not reconcile')
        if current == 'TOTAL':
            if mode in published:
                raise ValueError('Duplicate statewide method footer')
            published[mode] = values[:2] + [sum(values[2:-3])] + values[-3:]
            continue
        county = counties.setdefault(current, {'county': current, 'records': {}})
        # 2020 ends with an independently checked statewide Total after Wright.
        if mode == 'total' and mode in county['records'] and len(counties) == 99:
            if values[:2] != [864997, 754859] or values[-1] != 1700130:
                raise ValueError('Wrong 2020 statewide footer')
            continue
        if mode in county['records']:
            raise ValueError('Duplicate county/method')
        normalized = values[:2] + [sum(values[2:-3])] + values[-3:]
        county['records'][mode] = {**dict(zip(FIELDS, normalized)), 'source_line': number}
    if len(counties) != 99:
        raise ValueError('Incomplete 99-county table')
    reference = json.loads((ROOT / 'data/iowa_county_fips_reference.json').read_text(encoding='utf-8'))
    normalized_names = lambda rows: {re.sub('[^a-z]', '', name.lower()) for name in rows}
    if normalized_names(counties) != normalized_names(c['county'] for c in reference['counties']):
        raise ValueError('Historical county names disagree with independent Census reference')
    totals = dict.fromkeys(FIELDS, 0)
    for county in counties.values():
        records = county['records']
        if set(records) != {'election_day', 'absentee', 'total'}:
            raise ValueError('Missing county voting method')
        for key in FIELDS:
            if records['election_day'][key] + records['absentee'][key] != records['total'][key]:
                raise ValueError('County method totals do not reconcile')
            totals[key] += records['total'][key]
    expected = {2014: (494370, 588575, 1142284), 2016: (549460, 926007, 1581371),
                2020: (754859, 864997, 1700130), 2022: (533330, 681501, 1230416)}[year]
    if tuple(totals[k] for k in ['dem_votes', 'rep_votes', 'ballots']) != expected:
        raise ValueError('County sums disagree with published statewide canvass')
    if year in [2014, 2016]:
        for mode in ['election_day', 'absentee', 'total']:
            sums = [sum(c['records'][mode][key] for c in counties.values()) for key in FIELDS]
            if sums != published.get(mode):
                raise ValueError('Candidate/method statewide footer does not reconcile')
    return {'source_url': f'https://sos.iowa.gov/elections/pdf/{year}/general/canvsummary.pdf',
            'source_index': 'https://sos.iowa.gov/iowans/election-results-statistics',
            'source_format': 'Official canvass PDF text extraction via web reader; direct HTTP returned 403',
            'source_excerpt_sha256': hashlib.sha256(raw).hexdigest(),
            'candidates': names, 'county_count': 99, 'statewide': totals,
            'counties': list(counties.values())}


def build():
    return {'schema': 'iowa-senate-county-modes-v1',
            'scope': 'Official final historical counts. Not reporting-order archives, live returns or calibrated model evidence.',
            'accessed_at': '2026-10-26',
            'absentee_definition': 'Source combines absentee voting; it does not separately identify mail and early-in-person.',
            'same_2026_senate_seat_baseline_year': 2020,
            'independent_different_senate_class_evaluation_year': 2022,
            'years': {str(year): build_year(year) for year in [2020, 2022]}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--independent', action='store_true')
    args = parser.parse_args()
    target = ROOT / 'data/iowa_senate_county_modes_official.json'
    result = build()
    if args.independent:
        target = ROOT / 'data/iowa_senate_independent_county_modes_official.json'
        result = {'schema': 'iowa-senate-independent-county-modes-v1',
                  'scope': '2014 baseline and unseen 2016 outcome for frozen-model stress evaluation; not reporting times or calibration.',
                  'years': {str(year): build_year(year) for year in [2014, 2016]}}
    if args.check:
        if json.loads(target.read_text(encoding='utf-8')) != result:
            raise SystemExit('Published Iowa baseline differs from original excerpts')
    else:
        target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print('Official Iowa Senate: 99 counties x 2 methods x 2 years, reconciled',
          '(independent evaluation)' if args.independent else '')
