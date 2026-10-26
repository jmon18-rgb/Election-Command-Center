"""Reproduce close-election county D/R counts without filling missing precincts."""
import argparse
import hashlib
import json
from pathlib import Path
from build_kansas_senate_county_facts import integer
from read_official_xlsx_rows import read_workbook

ROOT = Path(__file__).resolve().parents[1]
CONFIG = {
 '2018': {'JOHNSON': (4, 1, {'D': 3, 'R': 5}), 'SHAWNEE': (4, 0, {'D': 2, 'R': 4})},
 '2022': {'JOHNSON': (3, 1, {'D': 5, 'R': 7}), 'SHAWNEE': (3, 1, {'D': 2, 'R': 3}),
          'SEDGWICK': (3, 1, {'D': 4, 'R': 5}), 'WYANDOTTE': (3, 1, {'D': 3, 'R': 5})}}


def build():
    manifest = json.loads((ROOT / 'data/kansas_governor_close_cohort_sources.json').read_text())
    reference = json.loads((ROOT / 'data/kansas_county_fips_reference.json').read_text())
    normalize = lambda s: ''.join(c for c in s.lower() if c.isalpha())
    names = {normalize(c['county']): c for c in reference['counties']}
    years = {}
    for year, source in manifest['sources'].items():
        original = ROOT / source['path']
        assert hashlib.sha256(original.read_bytes()).hexdigest() == source['sha256']
        book = read_workbook(original)
        primary = next(iter(book.values()))
        assert primary[0][:6] == ['County', 'Precinct', 'Race', 'Candidate', 'Party', 'Votes']
        counties, present, missing, evidence = {}, set(), 0, []
        for row in primary[1:]:
            if all(v is None for v in row):
                continue
            county, precinct, race, candidate, party, votes, *_ = row
            assert race == 'Governor / Lt. Governor'
            if party not in ['Democratic', 'Republican']:
                continue
            name = names[normalize(county)]['county']
            p = 'D' if party == 'Democratic' else 'R'
            if votes is None:
                missing += 1
                continue
            counties.setdefault(name, {'D': 0, 'R': 0})[p] += integer(votes)
            present.add((name, p))
        assert len(counties) == 101 and len(present) == 202
        for sheet, (first, label_col, columns) in CONFIG[year].items():
            sums = {'D': 0, 'R': 0}
            redacted = {'D': 0, 'R': 0}
            footer = None
            for row in book[sheet][first-1:]:
                label = row[label_col]
                if label is None:
                    continue
                if 'total' in str(label).lower():
                    footer = {p: integer(row[col]) for p, col in columns.items()}
                    break
                for p, col in columns.items():
                    if row[col] == 'Redacted':
                        redacted[p] += 1
                    else:
                        sums[p] += integer(row[col])
            assert footer is not None
            for p in ['D', 'R']:
                assert sums[p] <= footer[p]
                if not redacted[p]:
                    assert sums[p] == footer[p], (year, sheet, sums, footer)
            name = names[normalize(sheet)]['county']
            assert name not in counties
            counties[name] = footer
            evidence.append({'sheet': sheet, 'published_footer': footer,
                             'numeric_precinct_sums': sums, 'redacted_cells_not_reconstructed': redacted})
        if year == '2018':
            summary = {row[1]: integer(row[2]) for row in book['SEDGWICK'][2:8]
                       if row[1] in ['Democratic', 'Republican']}
            detail = {'Laura Kelly': 0, 'Kris Kobach': 0}
            for row in book['SEDGWICK'][10:]:
                if row[1] in detail:
                    detail[row[1]] += integer(row[2])
            assert detail == {'Laura Kelly': summary['Democratic'], 'Kris Kobach': summary['Republican']}
            counties['Sedgwick'] = {'D': summary['Democratic'], 'R': summary['Republican']}
            wy = manifest['wyandotte_2018']
            excerpt = (ROOT / wy['path']).read_bytes()
            assert hashlib.sha256(excerpt).hexdigest() == wy['normalized_excerpt_sha256']
            assert b'28,285' in excerpt and b'10,526' in excerpt
            assert 'PLEASE CONTACT' in book['WYANDOTTE'][0][0]
            counties['Wyandotte'] = {p: wy[p] for p in ['D', 'R']}
            evidence.extend([{'sheet': 'SEDGWICK', 'summary_matches_precinct_sums': detail},
                             {'county': 'Wyandotte', 'source': wy, 'precinct_votes_reconstructed': False}])
        assert len(counties) == 105 and {normalize(c) for c in counties} == set(names)
        totals = {p: sum(c[p] for c in counties.values()) for p in ['D', 'R']}
        assert totals == source['expected_statewide'], (year, totals)
        years[year] = {'source': source, 'statewide': totals, 'missing_primary_DR_cells_not_zero_filled': missing,
            'aggregate_evidence': evidence, 'counties': [{'county': c, 'county_fips': names[normalize(c)]['fips'],
                'records': {'total': {'dem_votes': v['D'], 'rep_votes': v['R']}}} for c, v in sorted(counties.items())]}
    return {'schema': 'kansas-governor-close-cohort-v1', 'scope':
        'Certified county D/R counts only; not live data, voting-method splits or recorded reporting times', 'years': years}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = build()
    target = ROOT / 'data/kansas_governor_close_cohort_official.json'
    if args.check:
        assert json.loads(target.read_text()) == result
    else:
        target.write_text(json.dumps(result, indent=2) + '\n')
    print('Kansas2018/2022 governor: all105 county D/R totals reconcile; actual Wyandotte official aggregate, no missing precinct reconstruction')
