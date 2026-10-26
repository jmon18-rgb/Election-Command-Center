"""Guard original-schema joins and office selection; no forecasting calibration."""
import copy,unittest
from build_pennsylvania_house_county_baseline import aggregate
CENSUS={'Cumberland':'42041','Dauphin':'42043','York':'42133'}
def fixtures():
 rows=[]
 for code,fips in [('21','41'),('22','043'),('67','133')]:
  for party,last,first,votes in [('DEM','STELSON','JANELLE','11'),('REP','PERRY','SCOTT','7')]:
   r=['']*37
   for i,v in {0:'2024',1:'G',2:code,3:'10',5:'10',8:'USC',9:party,10:party+'-candidate',11:last,12:first,15:votes,18:'10',29:fips}.items():r[i]=v
   rows.append(r)
 return rows
class ScopeTests(unittest.TestCase):
 def test_exact_office_not_geographic_metadata(self):
  rows=fixtures();other=copy.deepcopy(rows[0]);other[8]='STH';other[15]='9999999';rows.append(other)
  totals,n,precincts=aggregate(rows,CENSUS)
  self.assertEqual((n,precincts),(6,3))
  self.assertTrue(all(x=={'dem_votes':11,'rep_votes':7} for x in totals.values()))
 def test_normalized_precinct_duplicate(self):
  rows=fixtures();duplicate=copy.deepcopy(rows[0]);duplicate[3]='0010';rows.append(duplicate)
  with self.assertRaisesRegex(ValueError,'Duplicate'):aggregate(rows,CENSUS)
 def test_reject_bad_identity_count_and_record(self):
  for index,value in [(0,'2026'),(1,'P'),(18,'11'),(29,'21'),(15,'-1'),(11,'WRONG'),(32,'Total')]:
   rows=fixtures();rows[0][index]=value
   with self.subTest(index=index),self.assertRaises(ValueError):aggregate(rows,CENSUS)
 def test_missing_candidate_or_county(self):
  for rows in [fixtures()[1:],fixtures()[2:]]:
   with self.assertRaises(ValueError):aggregate(rows,CENSUS)
if __name__=='__main__':unittest.main()
