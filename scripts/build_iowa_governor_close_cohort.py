"""Reproduce a separate close-election cohort; never supplies 2026 counted votes."""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build():
    reference = json.loads((ROOT / 'data/iowa_county_fips_reference.json').read_text())
    normalize = lambda s: ''.join(c for c in s.lower() if c.isalpha())
    names = {normalize(c['county']): c['county'] for c in reference['counties']}
    excerpts = {}

    def lines(year):
        raw = (ROOT / f'data/iowa_{year}_governor_canvass_excerpt.txt').read_bytes().replace(b'\r\n', b'\n')
        excerpts[year] = hashlib.sha256(raw).hexdigest()
        text = raw.decode('utf-8')
        if year == 2010 and '2010 General Election held Tuesday, November 2nd 2010' not in text:
            raise ValueError('Wrong baseline election')
        if year == 2018 and not all(s in text for s in ['General Election 2018', 'Kim Reynolds/Adam', 'Fred Hubbell/Rita R.']):
            raise ValueError('Wrong outcome election/candidates')
        return [(int(m[1]), m[2]) for row in text.split('\n') if (m := re.fullmatch(r'L(\d+): (.*)', row))]

    baseline, footer, ballot_issues = {}, None, []
    for n, row in lines(2010):
        match = re.fullmatch(r'(.+?)\s+([\d ]+)', row)
        if not match:
            continue
        key, numbers = match[1], list(map(int, match[2].split()))
        if key == 'Grand Totals':
            footer = numbers
            continue
        if normalize(key) not in names:
            continue
        assert len(numbers) == 10 and names[normalize(key)] not in baseline
        if sum(numbers[:-1]) != numbers[-1]:
            ballot_issues.append({'line': n, 'county': key,
                                 'reason': 'Ballots column does not reconcile; excluded, not repaired'})
        baseline[names[normalize(key)]] = {'county': names[normalize(key)], 'records': {'total': {
            'dem_votes': numbers[0], 'rep_votes': numbers[1], 'source_line': n}}}
    assert len(baseline) == 99
    assert [sum(c['records']['total'][k] for c in baseline.values())
            for k in ['dem_votes', 'rep_votes']] == footer[:2] == [484798, 592494]

    outcome, current, footer2018 = {}, None, None
    for n, row in lines(2018):
        row = re.sub(r'Page \d+ of \d+$', '', row).strip()
        match = re.fullmatch(r'(.+?) Election(?:\s+([\d, ]+))?', row)
        if match:
            current = names[normalize(match[1])]
            assert current not in outcome
            outcome[current] = {'county': current, 'records': {}}
            if match[2]:
                mode, numbers = 'election_day', match[2]
            else:
                continue
        elif current and (match := re.fullmatch(r'(Day|Absentee|Total)\s+([\d, ]+)', row)):
            mode = {'Day': 'election_day', 'Absentee': 'absentee', 'Total': 'total'}[match[1]]
            numbers = match[2]
        else:
            continue
        counts = [int(value.replace(',', '')) for value in numbers.split()]
        assert len(counts) == 8 and sum(counts[:-1]) == counts[-1], (n, counts)
        if mode == 'total' and mode in outcome[current]['records']:
            assert len(outcome) == 99
            footer2018 = counts
            continue
        assert mode not in outcome[current]['records']
        outcome[current]['records'][mode] = {'dem_votes': counts[1], 'rep_votes': counts[0],
            'other_votes': sum(counts[2:5]), 'ballots': counts[-1], 'source_line': n}
    assert len(outcome) == 99 and footer2018 == [667275, 630986, 21426, 7463, 488, 5707, 934, 1334279]
    assert set(outcome) == set(baseline) == set(names.values())
    for county in outcome.values():
        assert set(county['records']) == {'election_day', 'absentee', 'total'}
        for key in ['dem_votes', 'rep_votes', 'other_votes', 'ballots']:
            assert county['records']['election_day'][key] + county['records']['absentee'][key] == county['records']['total'][key]
    assert [sum(c['records']['total'][k] for c in outcome.values())
            for k in ['dem_votes', 'rep_votes', 'ballots']] == [630986, 667275, 1334279]
    return {'schema': 'iowa-governor-separate-close-election-cohort-v1',
        'scope': 'Certified historical same-office county counts; eight-year baseline gap and assumed release orders, not actual reporting timestamps',
        'source_index': 'https://sos.iowa.gov/iowans/election-results-statistics',
        'source_format': 'PDF web-reader excerpts, not original PDF byte checksums; direct download returned 403',
        'baseline_year': 2010, 'outcome_year': 2018, 'baseline_method_split_reported': False,
        'ballot_columns_excluded': ballot_issues,
        'years': {'2010': {'counties': list(baseline.values()), 'source_url': 'https://sos.iowa.gov/elections/pdf/2010/govorr.pdf',
            'excerpt_sha256': excerpts[2010], 'statewide': {'dem_votes': 484798, 'rep_votes': 592494}},
            '2018': {'counties': list(outcome.values()), 'source_url': 'https://sos.iowa.gov/elections/pdf/2018/general/govcanvsummary.pdf',
            'excerpt_sha256': excerpts[2018], 'statewide': {'dem_votes': 630986, 'rep_votes': 667275}}}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = build()
    target = ROOT / 'data/iowa_governor_close_cohort_official.json'
    if args.check:
        assert json.loads(target.read_text()) == result, 'Cohort differs from official excerpts'
    else:
        target.write_text(json.dumps(result, indent=2) + '\n')
    print('Separate close Iowa governor cohort: 99 counties, D/R totals and outcome methods reconcile; no inferred baseline methods')
