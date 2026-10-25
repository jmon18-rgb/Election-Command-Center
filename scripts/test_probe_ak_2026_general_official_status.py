#!/usr/bin/env python3
"""Alaska official page has unrelated 2026 primary and REAA results already."""
import datetime as dt
import unittest
from probe_ak_2026_general_official_status import assess
NOW=dt.datetime(2026,10,24,22,tzinfo=dt.timezone.utc)
OPEN=dt.datetime(2026,11,4,5,0,tzinfo=dt.timezone.utc)
BEFORE=dt.datetime(2026,11,4,4,59,59,tzinfo=dt.timezone.utc)
BASE="<h2>2026 REAA Election – October 6, 2026</h2><h2>2026 Primary Election – August 18, 2026</h2><h2>2024 General Election – November 5, 2024</h2>"
GENERAL="<h2>2026 General Election – November 3, 2026</h2>"

class AlaskaGeneralSourceQuarantine(unittest.TestCase):
 def test_reaa_primary_2024_must_not_alias_november_general(self):
  x=assess(BASE,NOW)
  self.assertFalse(x["2026_general_page_verified"])
  self.assertTrue(x["2026_primary_reference_present"])
  self.assertTrue(x["2026_reaa_reference_present"])
  self.assertEqual(x["status"],"2026_GENERAL_NOT_PUBLISHED_PRIMARY_REAA_ARE_NOT_GENERAL")
  self.assertIsNone(x["candidate_votes"])
  self.assertFalse(x["machine_house_ak_00_verified"])
  self.assertFalse(x["machine_senate_ak_verified"])
  self.assertFalse(x["machine_governor_ak_verified"])
 def test_correct_cycle_after_close_is_only_official_page_metadata(self):
  for clock in (BEFORE,OPEN):
   x=assess(BASE+GENERAL,clock)
   self.assertTrue(x["2026_general_page_verified"])
   self.assertFalse(x["professional_calls_approved"])
   self.assertFalse(x["may_update_forecast"])
   self.assertFalse(x["may_move_geographic_needle"])
   self.assertIsNone(x["county_observations"])
   self.assertIsNone(x["reported_precincts"])
   self.assertEqual(x["voting_results_downloaded"],0)
  self.assertEqual(assess(BASE+GENERAL,BEFORE)["status"],
     "ALASKA_2026_GENERAL_PAGE_PRE_CLOSE_NOT_VOTES")
  self.assertEqual(assess(BASE+GENERAL,OPEN)["status"],
     "ALASKA_2026_GENERAL_PAGE_POST_CLOSE_NO_VERIFIED_MACHINE_FEED")
 def test_test_banner_unavailable_and_wrong_date(self):
  self.assertEqual(assess(BASE+GENERAL+" Testing In Progress",OPEN)["status"],
    "ALASKA_2026_GENERAL_TEST_MODE")
  self.assertEqual(assess(BASE+GENERAL,OPEN,available=False)["status"],
    "ALASKA_RESULTS_PAGE_UNAVAILABLE")
  for wrong in ("2026 General Election – November 4, 2026",
                "2026 General Election – June 9, 2026"):
   self.assertFalse(assess(BASE+"<h2>"+wrong+"</h2>",OPEN)["2026_general_page_verified"])
  with self.assertRaises(ValueError):
   assess(BASE,dt.datetime(2026,11,4,5))

if __name__=="__main__":
 unittest.main()
