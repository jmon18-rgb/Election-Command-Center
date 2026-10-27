"""Guard historical office identity, geography and aggregate reconciliation."""
import copy
import unittest
from openpyxl import load_workbook
from build_ohio_senate_county_baseline import ROOT, build, parse_rows


class OhioBaselineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = build()
        cls.reference = {r['county']: r['fips'] for r in cls.result['counties']}
        w = load_workbook(ROOT / 'data/ohio_historical_sources/2024-official-statewide-race-summary.xlsx',
                          read_only=True, data_only=True)
        cls.rows = [list(r) for r in w['U.S. Congress'].values]
        w.close()

    def test_original_counties_and_non_major_candidates_reconcile(self):
        r = self.result
        self.assertEqual(len(r['counties']), 88)
        self.assertEqual(len({c['fips'] for c in r['counties']}), 88)
        self.assertEqual(r['state_totals']['dem_votes'], 2650949)
        self.assertEqual(r['state_totals']['rep_votes'], 2857383)
        self.assertEqual(r['state_totals']['other_votes'], 196288)
        self.assertFalse(r['national_input_enabled'])
        self.assertEqual(r['calibration_inputs_approved'], 0)

    def test_wrong_office_or_candidate_rejected(self):
        for row, col, value in [(0, 6, 'President\n'), (1, 6, 'Sherrod Brown (R)')]:
            rows = copy.deepcopy(self.rows)
            rows[row][col] = value
            with self.assertRaises(ValueError):
                parse_rows(rows, self.reference)

    def test_duplicate_or_missing_county_rejected(self):
        rows = copy.deepcopy(self.rows)
        rows[-1] = rows[4]
        with self.assertRaises(ValueError):
            parse_rows(rows, self.reference)
        with self.assertRaises(ValueError):
            parse_rows(self.rows[:-1], self.reference)

    def test_perturbed_vote_or_fractional_count_rejected(self):
        for value in [self.rows[4][6] + 1, 0.5, -1, True]:
            rows = copy.deepcopy(self.rows)
            rows[4][6] = value
            with self.assertRaises(ValueError):
                parse_rows(rows, self.reference)

    def test_extra_state_total_cannot_be_counted_as_county(self):
        with self.assertRaises(ValueError):
            parse_rows(self.rows + [self.rows[2]], self.reference)


if __name__ == '__main__':
    unittest.main()
