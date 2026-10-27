import copy,gzip,json,tempfile,unittest
from pathlib import Path
import build_minnesota_senate_county_baseline as source
class OriginalContract(unittest.TestCase):
 def setUp(self):
  self.result=source.build();self.mapping={r['native_county_id']:r['fips'] for r in self.result['counties']}
  table=source.pinned('2020-county-table.txt.gz').splitlines();self.metadata={r.split(';')[0]:{'precincts':int(r.split(';')[2])} for r in table}
  self.rows=[r.split(';') for r in source.pinned('2020-senate-county.txt.gz').splitlines()]
 def test_original_complete_other_accounting(self):
  self.assertEqual(self.result['county_count'],87);self.assertEqual(sum(r['other_votes'] for r in self.result['counties']),249589)
  self.assertEqual(sum(r['write_in_votes'] for r in self.result['counties']),2261)
  self.assertFalse(self.result['current2026_source_admitted']);self.assertFalse(self.result['numeric_certification_independently_verified'])
 def test_adversarial_identity_scope_and_counts(self):
  for label in ['name','party','office','county','duplicate','missing','negative','decimal','nan','total','reporting','extra']:
   rows=copy.deepcopy(self.rows)
   if label=='name':rows[0][7]='Different candidate'
   elif label=='party':rows[0][10]='D'
   elif label=='office':rows[0][4]='State Senator'
   elif label=='county':rows[0][1]='99'
   elif label=='duplicate':rows[1]=rows[0]
   elif label=='missing':rows.pop()
   elif label=='negative':rows[0][13]='-1'
   elif label=='decimal':rows[0][13]='462.0'
   elif label=='nan':rows[0][14]='NaN'
   elif label=='total':rows[0][15]='999999'
   elif label=='reporting':rows[0][11]='53'
   else:rows.append(rows[0])
   with self.subTest(label=label),self.assertRaises(ValueError):source.parse('\n'.join(';'.join(r) for r in rows),self.mapping,self.metadata)
 def test_independent_geography_conflict(self):
  reference={r['county'].casefold():r['fips'] for r in self.result['counties']};current=json.loads((source.ROOT/'data/mn_2026_official_county_fips_crosswalk.json').read_text())
  current['county_id_to_fips']['01']='27999'
  with self.assertRaises(ValueError):source.geography(source.pinned('2020-county-table.txt.gz'),reference,current)
 def test_changed_original_rejected_by_pin(self):
  original=source.ORIGINALS
  try:
   with tempfile.TemporaryDirectory() as tmp:
    source.ORIGINALS=Path(tmp)
    altered=gzip.decompress((original/'2020-senate-county.txt.gz').read_bytes())+b'\n'
    (source.ORIGINALS/'2020-senate-county.txt.gz').write_bytes(gzip.compress(altered,mtime=0))
    with self.assertRaises(ValueError):source.pinned('2020-senate-county.txt.gz')
  finally:source.ORIGINALS=original
if __name__=='__main__':unittest.main()
