import unittest
from pathlib import Path
import build_nebraska_senate_candidate_reference as m
import gzip,io
from pypdf import PdfReader
class HistoricalPreparation(unittest.TestCase):
 def setUp(self):self.text=PdfReader(io.BytesIO(gzip.decompress((m.SOURCES/'2024-official-general-canvass.pdf.gz').read_bytes()))).pages[15].extract_text(extraction_mode='layout');self.refs=m.reference()
 def test_original_and_no_admission(self):
  r=m.build();self.assertEqual(r['county_count'],93);self.assertEqual(r['totals']['all_reported'],938336);self.assertFalse(r['runtime_eligible']);self.assertFalse(r['same_Senate_seat_as_2026']);self.assertFalse(r['2026_baseline_scenario_reviewed']);self.assertNotIn('dem_votes',str(r));self.assertEqual(r,m.parse(self.text,self.refs))
 def test_changed_scope_identities_and_integers_fail(self):
  cases=[self.text.replace('Six Year Term','Two Year Term',1),self.text.replace('Dan Osborn','Preston Love Jr.',1),self.text.replace('(By Petition)','(Democratic)',1),self.text.replace('Adams','Unknown',1),self.text.replace('Adams','Antelope',1),self.text.replace('8,869','-8,869',1),self.text.replace('8,869','8869.5',1),self.text.replace('8,869','NaN',1),self.text.replace('8,869','8,86',1),self.text.replace('499,124','499,125',1),self.text.replace('2,719','2,720'),self.text.replace('November 5, 2024','November 3, 2026')]
  for i,t in enumerate(cases):
   self.assertNotEqual(t,self.text,'Every adversarial case must actually mutate its fixture')
   with self.subTest(case=i),self.assertRaises(ValueError):m.parse(t,self.refs)
 def test_incomplete_and_geography_fail(self):
  with self.assertRaises(ValueError):m.parse(self.text.replace(next(x for x in self.text.splitlines() if x.startswith('Adams')),''),self.refs)
  bad=dict(self.refs);bad.pop('Adams')
  with self.assertRaises(ValueError):m.parse(self.text,bad)
if __name__=='__main__':unittest.main()
