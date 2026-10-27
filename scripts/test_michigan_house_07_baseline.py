import copy
import csv
import gzip
import unittest
from build_michigan_house_07_baseline import ROOT, SOURCES, build, aggregate, verify_roster


class Michigan07Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline = build()
        cls.rows = [r for r in csv.DictReader(gzip.open(ROOT / 'data/michigan_historical_sources/2024-openelections-mi-precinct.csv.gz', 'rt', encoding='utf-8-sig')) if r['office'] == 'U.S. House' and r['district'] == '7']
        cls.census = {r['county']: r['county_fips'] for r in cls.baseline['counties']}
        cls.html = gzip.decompress((SOURCES / '2026-official-general-candidate-list.html.gz').read_bytes())

    def test_original_roster_sample_and_exact_processed_totals(self):
        self.assertEqual(self.baseline['district_totals'], {'dem_votes': 209959, 'rep_votes': 226722, 'named_other_votes': 14231})
        self.assertEqual(self.baseline['selected_precincts'], 302)
        self.assertEqual(self.baseline['county_count'], 7)
        self.assertEqual(self.baseline['official_roster'][-1], ('DISQ', 'Working Class Party', 'Thibodeau, Felix'))

    def test_metadata_and_other_contests_never_become_named_votes(self):
        totals, _, _ = aggregate(self.rows, self.census)
        self.assertEqual(totals['Clinton']['unresolved'], 44)
        self.assertEqual(totals['Ingham']['unresolved'], 279)
        self.assertEqual(totals['Ingham']['writeins'], 0)
        self.assertEqual(totals['Oakland']['rejected'], 24)
        self.assertEqual(totals['Shiawassee']['writeins'], 101)
        ingham = next(c for c in self.baseline['counties'] if c['county'] == 'Ingham')
        self.assertEqual(ingham['unresolved_write_in_votes'], 279)
        self.assertEqual(ingham['reported_write_in_votes_status_unverified'], 0)
        extra = copy.deepcopy(self.rows[:2]); extra[0]['office'] = 'State House'; extra[1]['district'] = '4'
        self.assertEqual(aggregate(self.rows + extra, self.census), aggregate(self.rows, self.census))

    def test_duplicate_missing_candidate_and_bad_count_or_part_rejected(self):
        duplicate = copy.deepcopy(self.rows[0]); duplicate['precinct'] = '  ' + duplicate['precinct'] + ' '
        with self.assertRaises(ValueError): aggregate(self.rows + [duplicate], self.census)
        first = next(i for i, r in enumerate(self.rows) if r['candidate'] == 'Curtis Hertel')
        with self.assertRaises(ValueError): aggregate(self.rows[:first] + self.rows[first+1:], self.census)
        for key, value in [('candidate', 'Unknown'), ('party', 'REP'), ('votes', '-1'), ('county', 'Kalamazoo')]:
            rows = copy.deepcopy(self.rows); rows[first][key] = value
            with self.assertRaises(ValueError): aggregate(rows, self.census)

    def test_disqualified_and_active_roster_drift_rejected(self):
        # The report contains disqualified candidates in its table. They must
        # never silently enter the supported active roster.
        for old, new in [(b'DISQ', b'VALID'), (b'Lawrence, William', b'Lawrence, Other'),
                         (b'Dedrick, Shane', b'Dedrick, Other')]:
            with self.assertRaises(ValueError): verify_roster(self.html.replace(old, new))


if __name__ == '__main__': unittest.main()
