import copy
import unittest
from build_maine_senate_county_baseline import build, parse_rows, HEADER


class Baseline(unittest.TestCase):
    def test_original_reconciles_without_allocating_uocava(self):
        result, reference = build()
        self.assertEqual(len(reference), 16)
        self.assertEqual(sum(c['records']['total']['dem_votes'] for c in result['counties'])
                         + result['state_unallocated_uocava']['dem_votes'], 347223)
        self.assertEqual(result['state_unallocated_uocava']['dem_votes'], 4068)
        self.assertEqual(result['state_unallocated_uocava']['rep_votes'], 1089)
        self.assertFalse(result['may_move_national_needle'])

    def test_duplicate_missing_and_double_counted_rows_rejected(self):
        reference = {'ABC': {'county': 'Example', 'fips': '23001'}}
        rows = [HEADER, [None] * 9,
                [None, None, 'Republican', 'Democratic', 'Independent', 'Independent'],
                ['ABC', 'Town', 7, 3, 1, 1, 0, 2, 14],
                [None, 'ABC Total', 7, 3, 1, 1, 0, 2, 14],
                [None, 'STATE UOCAVA', 2, 1, 0, 0, 0, 0, 3],
                [None, 'State Total', 9, 4, 1, 1, 0, 2, 17]]
        self.assertEqual(parse_rows(rows, reference)['statewide']['total_contest_votes'], 15)
        for index in [3, 4, 5, 6]:
            broken = copy.deepcopy(rows)
            broken.append(broken[index])
            with self.subTest(index=index), self.assertRaises(ValueError):
                parse_rows(broken, reference)
        with self.assertRaises(ValueError):
            parse_rows(rows[:-2] + rows[-1:], reference)


if __name__ == '__main__':
    unittest.main()
