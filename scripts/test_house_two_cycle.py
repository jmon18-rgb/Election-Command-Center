#!/usr/bin/env python3
import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from test_map_bridge import fixtures
import build_map_bridge
import build_house_two_cycle
from build_seat_universe import HOUSE_COUNTS

def historical22():
    records=[]
    for state,n in HOUSE_COUNTS.items():
        for idx in range(1,n+1):
            code=f"{state}-{idx:02d}"
            records.append({"2022_race_code":code,
                "recorded_dem_share_two_party":.44,
                "recorded_two_party_vote_total":1200,
                "missing_major_party_votes":False,
                "eligible_as_2026_prior":False})
    return {"status":"2022_history_staged_not_2026_priors","records":records}

class TwoElectionTests(unittest.TestCase):
    def setUp(self):
        voting,historical24=fixtures()
        self.bridge=build_map_bridge.build(voting,historical24)
        self.raw=historical22()
    def test_map_rules_and_435_safety(self):
        result=build_house_two_cycle.build(self.bridge,self.raw)
        build_house_two_cycle.validate(result)
        self.assertEqual(result["coverage"]["states_same_boundaries_2022_2024_2026"],39)
        self.assertEqual(len(result["rows"]),435)
    def test_two_different_redistricting_barriers(self):
        result=build_house_two_cycle.build(self.bridge,self.raw)
        by={x["race_code_2026"]:x for x in result["rows"]}
        self.assertFalse(by["GA-01"]["geography_comparable_across_all_three_elections"])
        self.assertFalse(by["TX-01"]["geography_comparable_across_all_three_elections"])
        self.assertFalse(by["AL-01"]["geography_comparable_across_all_three_elections"])
        self.assertTrue(by["MO-01"]["geography_comparable_across_all_three_elections"])
        self.assertTrue(by["NY-01"]["boundaries_2022_to_2024"]=="changed")
    def test_both_major_parties_required_each_cycle(self):
        result=build_house_two_cycle.build(self.bridge,self.raw)
        by={x["race_code_2026"]:x for x in result["rows"]}
        self.assertTrue(by["MO-01"]["can_compare_historic_two_party_votes"])
        self.assertAlmostEqual(by["MO-01"]["observed_dem_share_change_2022_to_2024_points"],(120/370-.44)*100,places=2)
        self.assertFalse(by["VT-01"]["can_compare_historic_two_party_votes"])
        self.assertIsNone(by["VT-01"]["observed_dem_share_change_2022_to_2024_points"])
        self.assertTrue(all(x["forecast_2026_margin"] is None for x in result["rows"]))
    def test_incomplete_2022_source_blocks_publish(self):
        self.raw["records"].pop()
        with self.assertRaises(AssertionError):
            build_house_two_cycle.build(self.bridge,self.raw)

if __name__=="__main__":
    unittest.main()
