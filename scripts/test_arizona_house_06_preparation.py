import copy
import hashlib
import json
from pathlib import Path
import unittest
import csv
import io
import zipfile
from inspect_arizona_house_06 import inspect, COUNTIES, ROSTER

ROOT = Path(__file__).resolve().parents[1]


def fixture():
    # Synthetic only, including a separately certified independent write-in.
    candidates = [dict(name=n, party=p, candidate_id=i, votes=0) for n, p, i in ROSTER]
    return dict(country='US', province='AZ', district='AZ-06', election_name='Arizona US House 6',
                election_scope='General', election_type='House of Representatives',
                election_date='2026-11-03T05:00:00.000Z', round=1, test_data=False,
                last_updated='2026-11-04T03:00:00Z', candidates=candidates,
                region_results={f: dict(fips=f, name=n, type='County', candidates=copy.deepcopy(candidates))
                                for f, n in COUNTIES.items()})


class Preparation(unittest.TestCase):
    def test_pinned_originals_and_district_part_totals(self):
        baseline = json.loads((ROOT/'data/arizona_house_06_2024_county_baseline_official.json').read_text())
        self.assertEqual(hashlib.sha256((ROOT/'data/arizona_house_06_sources/2024-original-canvass-ucsb.pdf').read_bytes()).hexdigest(), baseline['original_sha256'])
        self.assertEqual({r['county_fips']: r['county'] for r in baseline['counties']}, COUNTIES)
        with zipfile.ZipFile(ROOT/'data/texas_historical_sources/2024-census-counties.zip') as archive:
            rows = csv.DictReader(io.StringIO(archive.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')), delimiter='\t')
            independent = {r['GEOID']: r['NAME'].removesuffix(' County') for r in rows if r['GEOID'] in COUNTIES}
        self.assertEqual(independent, COUNTIES)
        for key, total in baseline['district_totals'].items():
            self.assertEqual(sum(r[key] for r in baseline['counties']), total)
        bridge = json.loads((ROOT/'data/house_geography_bridge.json').read_text())
        district = next(r for r in bridge['districts'] if r['race_code_2026'] == 'AZ-06')
        self.assertTrue(district['geography_comparable_2024'])
        self.assertEqual(district['recorded_dem_votes_2024'], baseline['district_totals']['dem_votes'])
        self.assertEqual(district['recorded_rep_votes_2024'], baseline['district_totals']['rep_votes'])
        assessment = json.loads((ROOT/'data/arizona_house_06_source_assessment.json').read_text())
        for source in assessment['official_2026_documents']:
            self.assertEqual(hashlib.sha256((ROOT/source['path']).read_bytes()).hexdigest(), source['sha256'])

    def test_saved_actual_response_is_zero_and_not_live_proof(self):
        path = ROOT/'data/arizona_house_06_sources/2026-civic-zero-snapshot.json'
        assessment = json.loads((ROOT/'data/arizona_house_06_source_assessment.json').read_text())
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), assessment['source_sha256'])
        self.assertEqual(inspect(json.loads(path.read_text()))['named_candidate_votes'], 0)

    def test_zero_and_positive_reconciled_counts_are_preparation_only(self):
        p = fixture()
        self.assertEqual(inspect(p)['named_candidate_votes'], 0)
        p['candidates'][4]['votes'] = 13
        p['region_results']['04019']['candidates'][4]['votes'] = 13
        result = inspect(p)
        self.assertEqual(result['named_candidate_votes'], 13)
        self.assertFalse(result['live_delivery_verified'])
        self.assertFalse(result['production_input_enabled'])

    def test_reject_identity_matrix_counts_and_reconciliation_drift(self):
        mutations = [lambda p: p.update(district='AZ-01'), lambda p: p.update(round=2),
                     lambda p: p.update(test_data=True), lambda p: p['candidates'][0].update(candidate_id=219783),
                     lambda p: p['region_results'].pop('04019'),
                     lambda p: p['region_results']['04019'].update(type='Precinct'),
                     lambda p: p['region_results']['04019']['candidates'][0].update(votes=1),
                     lambda p: p['candidates'][0].update(votes=-1),
                     lambda p: p['candidates'][0].update(votes=True),
                     lambda p: p['candidates'].append(copy.deepcopy(p['candidates'][0]))]
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                p = fixture()
                mutate(p)
                with self.assertRaises(ValueError):
                    inspect(p)


if __name__ == '__main__':
    unittest.main()
