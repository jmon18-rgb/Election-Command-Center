"""Original NY contest export/fusion guards; no mocked calibration claim."""
import csv
import io
import json
import unittest
from build_new_york_house_county_baseline import SOURCE, ROOT, build, parse_export

CENSUS = {'Dutchess': '36027', 'Putnam': '36079', 'Rockland': '36087', 'Westchester': '36119'}


def altered(change):
    rows = list(csv.reader(io.StringIO(SOURCE.read_text(encoding='utf-8'))))
    change(rows)
    target = io.StringIO(newline='')
    csv.writer(target, lineterminator='\n').writerows(rows)
    return target.getvalue().encode()


class NewYorkBaselineTests(unittest.TestCase):
    def test_official_fusion_and_metadata_separation(self):
        counties, totals = parse_export(SOURCE.read_bytes(), CENSUS)
        self.assertEqual((totals['dem_votes'], totals['rep_votes'], totals['named_other_votes']), (173899, 197845, 7530))
        self.assertEqual(totals['rep_votes'] - totals['republican_line'], 16921)
        self.assertEqual(totals['generic_write_in_votes'], 234)
        self.assertEqual(totals['blank_votes'] + totals['void_votes'], 14452)
        self.assertEqual(sum(c['rep_votes'] for c in counties), totals['rep_votes'])
        self.assertEqual(next(c for c in counties if c['county'] == 'Rockland')['rep_votes'], 84925)
        # Working Families is a different candidate here, never automatically D.
        self.assertNotEqual(totals['dem_votes'], totals['democratic_line'] + totals['working_families_line'])

    def test_exact_candidate_party_identity(self):
        for row, col, value in [(0, 3, 'Another Republican'), (1, 3, 'Working Families'), (0, 5, 'Mondaire L. Jones')]:
            with self.subTest(row=row, col=col), self.assertRaises(ValueError):
                parse_export(altered(lambda rows: rows[row].__setitem__(col, value)), CENSUS)

    def test_aggregate_never_added_as_fifth_county(self):
        counties, totals = parse_export(SOURCE.read_bytes(), CENSUS)
        self.assertEqual(len(counties), 4)
        self.assertEqual(sum(c['reported_total'] for c in counties), totals['reported_total'])
        for change in [lambda rows: rows.pop(), lambda rows: rows.__setitem__(3, rows[4][:]),
                       lambda rows: rows[2].__setitem__(1, '18'), lambda rows: rows[3].__setitem__(0, 'Town')]:
            with self.assertRaises(ValueError):
                parse_export(altered(change), CENSUS)

    def test_malformed_or_nonreconciling_counts(self):
        for value in ['-1', '1.5', '1,392', '', '1393']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse_export(altered(lambda rows: rows[3].__setitem__(3, value)), CENSUS)

    def test_original_census_map_and_staging_discrepancy_reproduce(self):
        baseline, reference = build()
        self.assertEqual({c['fips'] for c in reference['counties']}, set(CENSUS.values()))
        self.assertFalse(baseline['interval_calibrated'])
        self.assertEqual(baseline['existing_staging_discrepancy']['omitted_same_candidate_conservative_votes'], 0)
        self.assertEqual(baseline['existing_staging_discrepancy']['historical_repair_added_conservative_votes'], 16921)
        self.assertTrue(baseline['existing_staging_discrepancy']['global_staging_changed'])

    def test_actual_source_assessment_does_not_enable_a_live_forecast(self):
        evidence = json.loads((ROOT / 'data/new_york_house_17_source_assessment.json').read_text(encoding='utf-8'))
        self.assertEqual({r['fips'] for r in evidence['regions']}, set(CENSUS.values()))
        self.assertEqual({r['name'] for r in evidence['regions']}, set(CENSUS))
        self.assertEqual(evidence['candidate_roster'], [{'name': 'Cait Conley', 'party': 'Democratic'}, {'name': 'Mike Lawler', 'party': 'Republican'}])
        self.assertEqual(evidence['accepted_live_vote_rows'], 0)
        self.assertTrue(evidence['national_controller_enabled'])
        self.assertFalse(evidence['independent_official_source']['usable_feed'])


if __name__ == '__main__':
    unittest.main()
