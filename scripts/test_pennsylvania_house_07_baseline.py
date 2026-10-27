import copy
import csv
import gzip
import unittest
from build_pennsylvania_house_07_baseline import aggregate, build, FOLDER


class DistrictPartTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline = build()
        cls.rows = [r for r in csv.reader(gzip.open(FOLDER / '2024-official-precinct-returns.txt.gz',
                    'rt', encoding='utf-8-sig')) if r[8] == 'USC' and r[5].isdigit() and int(r[5]) == 7]
        cls.census = {r['county']: r['county_fips'] for r in cls.baseline['counties']}

    def test_original_scope_and_totals(self):
        self.assertEqual(self.baseline['district_totals'], {'dem_votes': 199626, 'rep_votes': 203688})
        self.assertEqual(self.baseline['selected_precincts'], 369)
        self.assertEqual(len(self.baseline['counties']), 4)
        self.assertEqual(self.baseline['geography_scope'], 'district_parts')
        monroe = next(c for c in self.baseline['counties'] if c['county'] == 'Monroe')
        self.assertEqual(monroe['dem_votes'], 2406)

    def test_other_office_and_other_district_not_added(self):
        extra = copy.deepcopy(self.rows[:2])
        extra[0][8] = 'USP'
        extra[1][5] = '8'
        self.assertEqual(aggregate(self.rows + extra, self.census), aggregate(self.rows, self.census))

    def test_duplicate_normalized_precinct_and_missing_pair_rejected(self):
        duplicate = copy.deepcopy(self.rows[0])
        duplicate[3] = '000' + duplicate[3]
        with self.assertRaises(ValueError):
            aggregate(self.rows + [duplicate], self.census)
        with self.assertRaises(ValueError):
            aggregate(self.rows[1:], self.census)

    def test_identity_geographic_and_count_corruption_rejected(self):
        for col, value in [(18, '8'), (29, '999'), (11, 'WRONG'), (15, '-1'), (1, 'P')]:
            rows = copy.deepcopy(self.rows)
            rows[0][col] = value
            with self.assertRaises(ValueError):
                aggregate(rows, self.census)


if __name__ == '__main__':
    unittest.main()
