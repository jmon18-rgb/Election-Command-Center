#!/usr/bin/env python3
"""Tests: prevent historical votes in changed 2026 House boundaries."""
import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_seat_universe import HOUSE_COUNTS
import build_map_bridge as bridge

def fixtures():
    voting=[]
    history=[]
    for state,count in HOUSE_COUNTS.items():
        for i in range(1,count+1):
            key=f"{state}-{i:02d}"
            voting.append({"state":state,"race_code":key})
            missing=key=="VT-01"
            history.append({"2024_race_code":key,"recorded_dem_votes":0 if missing else 120,
              "recorded_rep_votes":250,"recorded_two_party_vote_total":250 if missing else 370,
              "recorded_dem_share_two_party":0 if missing else round(120/370,5),
              "missing_major_party_votes":missing,"eligible_as_2026_prior":False})
    return ({"house":{"seats":voting}},
            {"status":"2024_history_staged_not_2026_priors","records":history})

class MapBridgeTests(unittest.TestCase):
    def setUp(self):self.seats,self.historic=fixtures()
    def test_nine_changed_states_and_missouri_reversal(self):
        doc=bridge.build(self.seats,self.historic)
        bridge.validate(doc)
        self.assertEqual(set(doc["changed_states"]),{"AL","CA","FL","LA","NC","OH","TN","TX","UT"})
        self.assertEqual(doc["by_state"]["MO"]["2024_to_2026_boundary_status"],"unchanged")
        self.assertEqual(doc["by_state"]["VA"]["2024_to_2026_boundary_status"],"unchanged")
    def test_changed_district_never_inherits_old_result(self):
        doc=bridge.build(self.seats,self.historic)
        for rec in doc["districts"]:
            if rec["state"] in bridge.CHANGED:
                self.assertIsNone(rec["historical_2024_dem_share_two_party"])
                self.assertIsNone(rec["recorded_dem_votes_2024"])
                self.assertFalse(rec["historical_comparison_available"])
                self.assertIsNone(rec["year_2026_forecast_prior"])
    def test_unchanged_context_not_prediction(self):
        doc=bridge.build(self.seats,self.historic)
        by={x["race_code_2026"]:x for x in doc["districts"]}
        self.assertTrue(by["MO-01"]["historical_comparison_available"])
        self.assertAlmostEqual(by["MO-01"]["historical_2024_dem_share_two_party"],120/370,places=4)
        self.assertFalse(by["VT-01"]["historical_comparison_available"])
        self.assertIsNone(by["VT-01"]["historical_2024_dem_share_two_party"])
        self.assertIsNone(by["MO-01"]["predicted_2026_margin"])
    def test_missing_or_duplicate_districts_fail(self):
        self.seats["house"]["seats"].pop()
        with self.assertRaises(AssertionError):bridge.build(self.seats,self.historic)
    def test_historical_forecast_flags_rejected(self):
        self.historic["records"][0]["eligible_as_2026_prior"]=True
        with self.assertRaises(AssertionError):bridge.build(self.seats,self.historic)

if __name__=="__main__":
    unittest.main()
