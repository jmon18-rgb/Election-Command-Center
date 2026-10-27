import copy
import csv
import gzip
import io
import unittest
import build_south_carolina_senate_county_baseline as source


class HistoricalContract(unittest.TestCase):
    def test_original_and_independent_geography(self):
        result = source.build()
        self.assertEqual(len(result['counties']), 46)
        self.assertEqual(sum(c['dem_votes'] for c in result['counties']), 1110828)
        self.assertEqual(sum(c['rep_votes'] for c in result['counties']), 1369137)
        self.assertEqual(sum(c['other_votes'] for c in result['counties']), 32845 + 2294)
        self.assertEqual(result['precinct_rows_reconciled'], 2399)
        self.assertIn('NOT_CURRENT_SOURCE_ADMISSION', result['status'])

    def test_changed_identity_and_inconsistent_precincts(self):
        body = gzip.decompress((source.ROOT / 'data/south_carolina_historical_sources/2020-official-senate-table.csv.gz').read_bytes())
        rows = list(csv.reader(io.StringIO(body.decode('utf-8-sig'))))
        reference = {c['county']: c['fips'] for c in source.build()['counties']}
        for mutation in ['candidate', 'county', 'precinct', 'scope']:
            bad = copy.deepcopy(rows)
            if mutation == 'candidate':
                bad[0][2] = 'Different candidate'
            elif mutation == 'county':
                bad[3][1] = 'Unknown county'
            elif mutation == 'precinct':
                # Preserve the precinct's total to exercise county reconciliation.
                bad[4][2] = str(int(bad[4][2]) + 1)
                bad[4][3] = str(int(bad[4][3]) - 1)
            else:
                bad[4][0] = 'County subtotal'
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                source.parse_rows(bad, reference)


if __name__ == '__main__':
    unittest.main()
