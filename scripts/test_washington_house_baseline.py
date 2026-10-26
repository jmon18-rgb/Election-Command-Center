import csv
import gzip
import hashlib
import io
import unittest
from pathlib import Path
import build_washington_house_county_baseline as source


class BaselineTests(unittest.TestCase):
    def setUp(self):
        self.raw = gzip.decompress((source.ROOT/'data/washington_historical_sources/2024-official-all-counties.csv.gz').read_bytes())
        self.doc = source.build()
        self.ref = {r['county']: r['fips'] for r in self.doc['washington_house_03_county_fips_reference']['counties']}

    def test_original_pin_and_full_county_parts(self):
        self.assertEqual(hashlib.sha256(self.raw).hexdigest(), source.SOURCE_HASH)
        rows = source.parse_export(self.raw, self.ref)
        self.assertEqual(len(rows), 7)
        self.assertEqual(next(c for c in rows if c['county']=='Thurston')['dem_votes'], 6995)
        self.assertEqual(sum(c['rep_votes'] for c in rows), 199054)
        self.assertEqual(sum(c['other_votes'] for c in rows), 1673)

    def mutate(self, fn):
        rows = list(csv.DictReader(io.StringIO(self.raw.decode('utf-8-sig'))))
        selected = next(r for r in rows if r['Race']==source.RACE)
        fn(rows, selected)
        s=io.StringIO(); w=csv.DictWriter(s, fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
        return s.getvalue().encode('utf-8')

    def test_duplicates_and_wrong_candidates_fail(self):
        for mutate in [lambda rows,r:rows.append(r.copy()), lambda rows,r:r.update(Candidate='Different candidate'),
                       lambda rows,r:r.update(Party='(Prefers Republican Party)'), lambda rows,r:r.update(County='King'),
                       lambda rows,r:r.update(Votes='1.5')]:
            with self.assertRaises(ValueError):
                source.parse_export(self.mutate(mutate), self.ref)

    def test_missing_county_and_wrong_office_fail(self):
        for mutate in [lambda rows,r:rows.remove(r), lambda rows,r:r.update(JurisdictionName='Legislative')]:
            with self.assertRaises(ValueError):
                source.parse_export(self.mutate(mutate), self.ref)


if __name__=='__main__':
    unittest.main()
