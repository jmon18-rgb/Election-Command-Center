"""Offline inspection only. Never enables votes or derives ballots outstanding."""
import csv
import io
import json
import argparse
from pathlib import Path

CONTEST = 'US Rep Dist CD-1'
MODES = ['Early Vote', 'Election Day', 'Early A.R.S. 16-579', 'Provisional']


def inspect(text):
    reader = csv.DictReader(io.StringIO(text), delimiter='\t')
    required = {'ContestId', 'ContestName', 'CandidateId', 'CandidateName',
                'CandidateAffiliation', 'PrecinctExtId', 'Votes'}
    required.update('Votes_' + mode for mode in MODES)
    if not required.issubset(reader.fieldnames or []):
        raise ValueError('Missing official template columns')
    cells = {}
    identities = {}
    for row in reader:
        if row['ContestName'] != CONTEST:
            continue
        if row['ContestId'] != '1':
            raise ValueError('Unexpected contest identity')
        candidate = row['CandidateId']
        identity = (row['CandidateName'], row['CandidateAffiliation'])
        if not candidate or (candidate in identities and identities[candidate] != identity):
            raise ValueError('Candidate identity changes between rows')
        identities[candidate] = identity
        precinct = row['PrecinctExtId']
        if precinct and (len(precinct) != 4 or not precinct.isdigit()):
            raise ValueError('Invalid precinct identity')
        key = (precinct, candidate)
        if key in cells:
            raise ValueError('Duplicate precinct/candidate or summary row')
        raw = [row['Votes']] + [row['Votes_' + mode] for mode in MODES]
        if any(not value.isascii() or not value.isdigit() for value in raw):
            raise ValueError('Invalid vote count')
        values = list(map(int, raw))
        if sum(values[1:]) != values[0]:
            raise ValueError('Vote methods do not reconcile')
        cells[key] = values[0]
    precincts = {p for p, _ in cells if p}
    if not precincts or not identities:
        raise ValueError('Exact AZ01 contest absent')
    if any((p, c) not in cells for p in precincts | {''} for c in identities):
        raise ValueError('Incomplete candidate/precinct matrix or summary')
    totals = {c: sum(cells[p, c] for p in precincts) for c in identities}
    if any(cells['', c] != total for c, total in totals.items()):
        raise ValueError('Summary does not equal unique precinct rows')
    return {'status': 'OFFLINE_TEMPLATE_INSPECTION_NOT_LIVE_APPROVAL',
            'district_precincts': len(precincts),
            'summary_rows_excluded_from_totals': len(identities),
            'candidates': [{'id': c, 'name': identities[c][0],
                            'party': identities[c][1], 'votes': totals[c]}
                           for c in sorted(identities)],
            'live_votes_accepted': False, 'may_move_national_needle': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path)
    args = parser.parse_args()
    print(json.dumps(inspect(args.file.read_text(encoding='utf-8-sig')), indent=2))
