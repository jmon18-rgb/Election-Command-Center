import copy,gzip,json,unittest
import inspect_michigan_senate_preparation as m
class PreparationContract(unittest.TestCase):
 def test_reproduced_evidence_does_not_admit_or_invent_residuals(self):
  r=m.build()
  self.assertFalse(r['eligible_for_national_needle']);self.assertFalse(r['current_source_admitted'])
  self.assertEqual(r['runtime_inputs_unchanged'],17)
  self.assertEqual((r['processed_senate_rows'],r['processed_counties'],r['county_reference_matches']),(41551,83,82))
  self.assertEqual(r['unmatched_processed_county_labels'],["St. Joseph's"])
  self.assertEqual(r['MIT_minus_processed_residual_not_assigned_to_any_county'],{'D':11,'R':4,'L':875,'U':0,'G':0,'N':0})
  self.assertEqual(sum(x['votes'] for x in r['explicit_Cass_alias_rows']),340)
  self.assertEqual(len(r['Leelanau_blank_regular_counts_supplied_from_independent_combined_rows']),9)
  self.assertEqual(r['Leelanau_county_published_counts']['Elissa Slotkin'],9164)
  self.assertEqual(r['Leelanau_county_published_counts']['Mike Rogers'],8102)
  self.assertTrue(r['blank_unclassified_rows_not_zeroed'])
  self.assertFalse(r['same_senate_class_as_2026']);self.assertFalse(r['independent_chronological_calibration'])
 def test_pinned_originals_reject_replacement_bytes(self):
  for key in m.PINS:
   with self.assertRaisesRegex(ValueError,'Pinned original changed'):m.checked(b'not the original',key)
 def test_count_syntax(self):
  for text,value in [('0',0),('1013',1013),('1,013',1013),('1,000,001',1000001)]:self.assertEqual(m.integer(text),value)
  for text in ['', '1,01','1,0,13','-1','0.5',' 1','1 ','1,013.0','01']:
   with self.assertRaises(ValueError):m.integer(text)
 def test_native_combined_counts_not_overlapping_processed_methods(self):
  data=json.loads(gzip.decompress((m.SOURCES/'2024-leelanau-declared-media-export.json.gz').read_bytes()))
  original=m.review_leelanau(data)
  changed=copy.deepcopy(data)
  contest=next(b for b in changed['results']['ballotItems'] if b['name']=='United States Senator')
  for o in contest['ballotOptions']:
   for row in o['precinctResults']:
    for group in row.get('groupResults',[]):group['voteCount']=999999999
  self.assertEqual(m.review_leelanau(changed),original,'Only independently published combined voteCount supplies missing combined fields')
  for alter in [lambda d:d.update(electionDate='2020-11-03'),lambda d:d['results'].update(name='Wrong county'),lambda d:next(b for b in d['results']['ballotItems'] if b['name']=='United States Senator')['ballotOptions'][0].update(voteCount=0)]:
   bad=copy.deepcopy(data);alter(bad)
   with self.assertRaises(ValueError):m.review_leelanau(bad)
 def test_blocked_current_search_is_only_a_dependency_receipt(self):
  receipt=json.loads((m.SOURCES/'2026-directed-search-receipt.json').read_text(encoding='utf-8'))
  self.assertEqual(receipt['requests'],1);self.assertIn('403',receipt['error'])
  self.assertNotIn('candidates',receipt);self.assertNotIn('race_id',receipt)
if __name__=='__main__':unittest.main()
