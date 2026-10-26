"""Independent original-source checks for the atomic House history repair."""
import csv
import gzip
import hashlib
import io
import json
import re
import unittest
from pathlib import Path
from rebuild_house_history_bundle import same_facts, check_python_descendants
from stage_house_history_2024 import clean_district
from build_seat_universe import HOUSE_COUNTS

ROOT = Path(__file__).resolve().parents[1]


class MigrationTests(unittest.TestCase):
    def test_independent_official_minnesota_candidate_totals(self):
        raw = gzip.decompress((ROOT / 'data/house_historical_sources/2024-mn03-official.html.gz').read_bytes())
        self.assertEqual(hashlib.sha256(raw).hexdigest(), '4bb6b965a0b88965a2c9332d223e50f8d968d6f2e6cc704f9b1aa137469a5b91')
        text = raw.decode('utf-8-sig')
        self.assertIn('U.S. Representative District 3', text)
        pairs = re.findall(r'<td\b[^>]*\bwrapText\b[^>]*>\s*(Kelly Morrison|Tad Jude|WRITE-IN)\s*</td>\s*<td\b[^>]*>\s*([0-9,]+)\s*</td>', text)
        self.assertEqual(len(pairs), 3)
        votes = {name: int(n.replace(',', '')) for name, n in pairs}
        self.assertEqual(votes, {'Kelly Morrison': 240209, 'Tad Jude': 170427, 'WRITE-IN': 504})
        history = json.loads((ROOT / 'data/house_history_2024_staging.json').read_text(encoding='utf-8'))
        row = next(r for r in history['records'] if r['2024_race_code'] == 'MN-03')
        self.assertEqual((row['recorded_dem_votes'], row['recorded_rep_votes'], row['recorded_other_votes']), (240209, 170427, 504))

    def test_every_district_source_count_is_conserved(self):
        raw = gzip.decompress((ROOT / 'data/house_historical_sources/mit-1976-2024-house.csv.gz').read_bytes())
        self.assertEqual(hashlib.sha256(raw).hexdigest(), '76eec42483ee9f0fc5cf6e377442c783d1ae6eefa929729fd6561a69bab47f2a')
        totals = {}
        legacy = {}
        for row in csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))):
            year, state = row['year'], row['state_po']
            district = clean_district(row['district'])
            if year not in ('2022', '2024') or row['stage'] != 'GEN' or row['special'] == 'TRUE' or state not in HOUSE_COUNTS or district is None or not 1 <= district <= HOUSE_COUNTS[state]:
                continue
            key = (year, f'{state}-{district:02d}')
            totals.setdefault(key, 0)
            if row['candidatevotes'].isdigit():
                totals[key] += int(row['candidatevotes'])
                party = row['party'].strip().upper()
                group = 'dem' if party in ('DEMOCRAT', 'DEMOCRATIC', 'DEM') else 'rep' if party in ('REPUBLICAN', 'REP', 'GOP') else 'other'
                legacy.setdefault(key, {'dem': 0, 'rep': 0, 'other': 0})[group] += int(row['candidatevotes'])
        self.assertEqual(len(totals), 870)
        for year in (2022, 2024):
            doc = json.loads((ROOT / f'data/house_history_{year}_staging.json').read_text(encoding='utf-8'))
            old = json.loads(gzip.decompress((ROOT / f'data/house_historical_sources/pre_repair_house_history_{year}_staging.json.gz').read_bytes()))
            # The exact same pinned raw CSV reproduces the published pre-fix
            # classifier. The difference is the repair, not newly ingested polls
            # or changed historical source totals.
            for row in old['records']:
                self.assertEqual(legacy[(str(year), row[f'{year}_race_code'])], {k: row[f'recorded_{k}_votes'] for k in ['dem', 'rep', 'other']})
            for row in doc['records']:
                self.assertEqual(sum(row[k] for k in ['recorded_dem_votes', 'recorded_rep_votes', 'recorded_other_votes']), totals[(str(year), row[f'{year}_race_code'])])

    def test_descendant_verification_and_stale_fact_detection(self):
        check_python_descendants()
        actual = {'generated_at': 'old', 'records': [{'dem_votes': 10, 'rep_votes': 20}]}
        self.assertTrue(same_facts(actual, {**actual, 'generated_at': 'new'}))
        self.assertFalse(same_facts(actual, {'generated_at': 'new', 'records': [{'dem_votes': 11, 'rep_votes': 20}]}))


if __name__ == '__main__':
    unittest.main()
