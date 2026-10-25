#!/usr/bin/env python3
import unittest
from datetime import datetime, timezone
from probe_eight_gap_civicapi_aliases import GAPS, title_matches, find_one
NOW=datetime(2026,10,25,16,tzinfo=timezone.utc)

def house(state,dist,title):
 return {'id':87201,'country':'US','province':state,
 'district':state+'-'+dist,'municipality':None,
 'type':'House of Representatives','election_type':'General',
 'election_name':title,'election_date':'2026-11-03'}
def detail(row):
 return {**row,'election_type':row['type'],
 'candidates':[{'name':'Candidate A','party':'D','votes':0,'winner':False},
               {'name':'Candidate B','party':'R','votes':0,'winner':False}]}
class AliasProbe(unittest.TestCase):
 def test_exact_eight_target_identities(self):
  self.assertEqual(len(GAPS),8)
  self.assertEqual(len(set(GAPS)),8)
 def test_at_large_and_district_alias_titles(self):
  self.assertTrue(title_matches('House|AK-00',house('AK','00','Alaska U.S. Representative')))
  self.assertTrue(title_matches('House|NH-01',house('NH','01','New Hampshire Representative in Congress 1')))
  self.assertTrue(title_matches('House|NH-02',house('NH','02','New Hampshire House of Representatives District 2')))
  self.assertFalse(title_matches('House|NH-01',house('NH','02','New Hampshire Representative in Congress 2')))
  self.assertFalse(title_matches('House|AK-00',house('AK','00','Alaska U.S. Senate')))
 def test_senate_alias(self):
  a=house('MA','00','Massachusetts United States Senator')
  a.update(district=None,type='US Senate')
  self.assertTrue(title_matches('Senate|MA',a))
  self.assertFalse(title_matches('Senate|MA',{**a,'election_type':'Primary'}))
 def test_valid_exact_detail_is_an_id_hint_not_a_live_vote(self):
  row=house('NH','01','New Hampshire Representative in Congress 1')
  calls=[]
  def fetch(path,params):
   calls.append((path,params))
   return detail(row) if path.startswith('/race/') and path!='/race/search' else {'count':1,'races':[row]}
  out=find_one('House|NH-01',fetch,NOW)
  self.assertEqual(out['status'],'EXACT_2026_CANDIDATE_IDENTITY_VERIFIED')
  self.assertEqual(out['race_id'],87201)
  self.assertFalse(out['live_votes_approved'])
  self.assertEqual(sum(p.startswith('/race/search') for p,_ in calls),2)
 def test_partial_search_never_assigns_id(self):
  row=house('NH','01','New Hampshire Representative in Congress 1')
  out=find_one('House|NH-01',lambda path,params:{'count':2,'races':[row]},NOW)
  self.assertEqual(out['status'],'SEARCH_TRUNCATED_OR_INVALID')
 def test_duplicate_different_2026_ids_are_ambiguous(self):
  row=house('NH','01','New Hampshire Representative in Congress 1')
  i=[0]
  def fetch(path,params):
   i[0]+=1
   return {'count':1,'races':[{**row,'id':87201+i[0]}]}
  out=find_one('House|NH-01',fetch,NOW)
  self.assertEqual(out['status'],'AMBIGUOUS_RACE')
if __name__=='__main__':unittest.main()
