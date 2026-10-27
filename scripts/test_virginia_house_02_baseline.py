import copy
import csv
import io
import unittest
from build_virginia_house_02_baseline import build, aggregate, FOLDER


class Baseline(unittest.TestCase):
    def setUp(self):
        self.baseline, ref = build()
        self.ref = {c['county'].casefold():(c['fips'],c['county']) for c in ref['counties']}
        self.rows = list(csv.reader(io.StringIO((FOLDER/'2024-official-va02-localities.csv').read_text(encoding='utf-8-sig'))))

    def test_original_localities_reconcile_independent_district_and_city_codes(self):
        self.assertEqual(len(self.baseline['counties']),8)
        self.assertEqual(self.baseline['district_totals'],dict(dem_votes=191666,rep_votes=207368))
        self.assertEqual(sorted(c['county_fips'] for c in self.baseline['counties']),['51001','51093','51131','51175','51550','51620','51800','51810'])

    def test_nested_precincts_are_not_counted_twice(self):
        extra=['Precinct','Nested', '1000000','1000000','0','0','2000000']
        self.assertEqual(aggregate(self.rows+[extra],self.ref),aggregate(self.rows,self.ref))

    def test_missing_duplicate_identity_column_and_count_drift_reject(self):
        for kind in ['duplicate','missing','name','count','column']:
            rows=copy.deepcopy(self.rows)
            i=next(i for i,r in enumerate(rows) if r[0]=='Locality')
            if kind=='duplicate': rows.append(copy.deepcopy(rows[i]))
            if kind=='missing': rows.pop(i)
            if kind=='name': rows[i][1]='Norfolk City'
            if kind=='count': rows[i][2]='0'
            if kind=='column': rows[0][2]='Different candidate'
            with self.subTest(kind=kind),self.assertRaises(ValueError): aggregate(rows,self.ref)


if __name__=='__main__': unittest.main()
