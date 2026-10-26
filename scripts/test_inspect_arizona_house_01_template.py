import csv
import io
import unittest
from inspect_arizona_house_01_template import inspect, CONTEST, MODES


def fixture(mutate=lambda rows: None):
    fields = ['ContestId', 'ContestName', 'CandidateId', 'CandidateName',
              'CandidateAffiliation', 'PrecinctExtId', 'Votes']
    fields += ['Votes_' + mode for mode in MODES]
    rows = []
    for precinct, votes in [('0014', '7'), ('0020', '3'), ('', '10')]:
        row = dict(zip(fields[:7], ['1', CONTEST, '1', 'Example', 'DEM', precinct, votes]))
        row.update({'Votes_' + mode: votes if i == 0 else '0'
                    for i, mode in enumerate(MODES)})
        rows.append(row)
    mutate(rows)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fields, delimiter='\t')
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


class Inspection(unittest.TestCase):
    def test_summary_not_double_counted_or_live(self):
        result = inspect(fixture())
        self.assertEqual(result['district_precincts'], 2)
        self.assertEqual(result['candidates'][0]['votes'], 10)
        self.assertFalse(result['may_move_national_needle'])

    def test_invalid_data_rejected(self):
        mutations = [lambda r: r.append(r[0].copy()),
                     lambda r: r.pop(),
                     lambda r: r[0].update(Votes='8'),
                     lambda r: r[-1].update(Votes='11', **{'Votes_Early Vote': '11'}),
                     lambda r: r[0].update(CandidateName='Other'),
                     lambda r: [row.update(ContestName='Governor') for row in r]]
        for mutate in mutations:
            with self.subTest(mutate=mutate), self.assertRaises(ValueError):
                inspect(fixture(mutate))


if __name__ == '__main__':
    unittest.main()
