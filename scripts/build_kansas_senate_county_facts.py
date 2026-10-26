"""Reconcile actual official Kansas workbook counts, retaining redaction limits."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from read_official_xlsx_rows import read_workbook

ROOT = Path(__file__).resolve().parents[1]
CONFIG = {
 '2020': {'JOHNSON': (4, 0, {'D': 1, 'R': 3, 'L': 2}),
          'SHAWNEE': (4, 0, {'D': 1, 'R': 3, 'L': 2}),
          'SEDGWICK': (5, 0, {'D': 1, 'R': 3, 'L': 2}),
          'WYANDOTTE': (6, 1, {'D': 4, 'R': 7, 'L': 5})},
 '2022': {'JOHNSON': (3, 1, {'D': 5, 'R': 6, 'L': 4}),
          'SHAWNEE': (3, 1, {'D': 2, 'R': 3, 'L': 4}),
          'SEDGWICK': (3, 1, {'D': 2, 'R': 3, 'L': 4}),
          'WYANDOTTE': (3, 1, {'D': 3, 'R': 4, 'L': 2})}}


def integer(value):
    if isinstance(value, str) and re.fullmatch(r'[\d,]+', value):
        value = int(value.replace(',', ''))
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0 or int(value) != value:
        raise ValueError('Invalid source count')
    return int(value)


def build():
    source_manifest = json.loads((ROOT / 'data/kansas_senate_county_sources.json').read_text())
    reference = json.loads((ROOT / 'data/kansas_county_fips_reference.json').read_text())
    normalize = lambda s: ''.join(c for c in s.lower() if c.isalpha())
    county_ref = {normalize(row['county']): row for row in reference['counties']}
    assert len(county_ref) == 105 and len({r['fips'] for r in county_ref.values()}) == 105
    years = {}
    for year, source in source_manifest['sources'].items():
        path = ROOT / source['path']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256'], 'Original workbook bytes changed'
        book = read_workbook(path)
        counties, missing, footers = {}, [], []
        primary = next(iter(book.values()))
        assert primary[0][:6] == ['County', 'Precinct', 'Race', 'Candidate', 'Party', 'Votes']
        for i, row in enumerate(primary[1:], 2):
            if all(v is None for v in row):
                continue
            name, precinct, race, candidate, party, votes, *_ = row
            assert race == 'United States Senate'
            name = county_ref[normalize(name)]['county']
            p = {'Democratic': 'D', 'Republican': 'R', 'Libertarian': 'L'}[party]
            if votes is None:
                missing.append(i)
                continue
            counties.setdefault(name, dict.fromkeys(['D', 'R', 'L'], 0))[p] += integer(votes)
        assert len(counties) == 101
        for sheet, (first, label_column, columns) in CONFIG[year].items():
            sums, redacted = dict.fromkeys(['D', 'R', 'L'], 0), dict.fromkeys(['D', 'R', 'L'], 0)
            footer, precincts = None, 0
            for i, row in enumerate(book[sheet][first - 1:], first):
                label = row[label_column]
                if label is None:
                    continue
                if 'total' in str(label).lower():
                    footer = {p: integer(row[col]) for p, col in columns.items()}
                    footer_row = i
                    break
                for p, col in columns.items():
                    if row[col] == 'Redacted':
                        redacted[p] += 1
                    else:
                        sums[p] += integer(row[col])
                precincts += 1
            assert footer is not None
            for p in ['D', 'R', 'L']:
                assert sums[p] <= footer[p]
                if not redacted[p]:
                    assert sums[p] == footer[p]
            name = county_ref[normalize(sheet)]['county']
            assert name not in counties
            counties[name] = footer
            footers.append({'sheet': sheet, 'footer_row': footer_row, 'precinct_rows': precincts,
                'counts': footer, 'numeric_precinct_sums': sums, 'redacted_precinct_cells': redacted,
                'rule': 'Nonredacted sums reconcile; redacted cells are not reconstructed. Use the actual published county footer.'})
        totals = {p: sum(row[p] for row in counties.values()) for p in ['D', 'R', 'L']}
        assert totals == source['expected_statewide'] and len(counties) == 105
        assert {normalize(c) for c in counties} == set(county_ref)
        years[year] = {'source_url': source['url'], 'original_xlsx_sha256': source['sha256'],
            'official_statewide_check_url': source['statewide_check_url'], 'statewide': totals,
            'vote_method': 'combined_not_reported', 'unpopulated_primary_precinct_vote_cells': len(missing),
            'missing_cell_policy': 'Not zero-filled. Only numeric rows aggregated; published county/state totals independently reconcile.',
            'big_four_footer_reconciliations': footers,
            'counties': [{'county': name, 'county_fips': county_ref[normalize(name)]['fips'],
                'dem_votes': row['D'], 'rep_votes': row['R'], 'other_votes': row['L']}
                for name, row in sorted(counties.items())]}
    return {'schema': 'kansas-senate-official-county-facts-v1',
        'scope': 'Certified historical county counts, not live votes, voting-method splits or reporting timestamps',
        'source_index': source_manifest['source_index'], 'years': years}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = build()
    target = ROOT / 'data/kansas_senate_county_facts_official.json'
    if args.check:
        assert json.loads(target.read_text()) == result, 'County facts differ from source workbooks'
    else:
        target.write_text(json.dumps(result, indent=2) + '\n')
    print('Kansas 2020/2022 Senate: original workbook hashes and all105 county D/R/L sums reconcile; no inferred methods/redacted cells')
