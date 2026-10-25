#!/usr/bin/env python3
import copy
import json
from pathlib import Path
import unittest

from audit_fairfax_2024_paired_office_clocks import validate as validate_pair
from audit_fairfax_2024_senate_clock_replay import validate as validate_senate

ROOT=Path(__file__).resolve().parents[1]
P=ROOT/"data/fairfax_2024_paired_office_clock_research.json"
S=ROOT/"data/fairfax_2024_senate_election_clock_research.json"

class PairedFairfaxOriginalClockTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.paired=json.loads(P.read_text(encoding="utf-8"))
        cls.senate=validate_senate(json.loads(S.read_text(encoding="utf-8")))

    def test_same_actual_fairfax_county_president_senate_reporting_order(self):
        report=validate_pair(self.paired,self.senate)
        self.assertEqual(report["status"],
                         "ACTUAL_OFFICIAL_MULTI_OFFICE_COUNTY_NOT_CALIBRATED")
        self.assertEqual(report["same_county"],"VA Fairfax County")
        self.assertEqual(report["office_count"],2)
        self.assertEqual(report["approved_national_needle_inputs"],0)
        self.assertIs(report["may_modify_2026_forecast"],False)
        self.assertEqual(report["visual_verified_shared_checkpoints"],3)
        row=report["comparisons"]
        self.assertEqual([x["section_clock"] for x in row],[
            "2024-11-05T19:08:00-05:00",
            "2024-11-05T22:50:00-05:00",
            "2024-11-06T00:13:00-05:00"])
        self.assertEqual([(x["president_D"],x["president_R"]) for x in row],[
            (184134,80292),(355482,170279),(365654,173320)])
        self.assertTrue(all(x["same_county_not_independent_geographic_holdout"] for x in row))
        self.assertAlmostEqual(report["final_president_dem_two_party_share"],
          386438/(386438+181895),delta=.000001)
        self.assertEqual(report["final_senate_dem_two_party_share"],
                         self.senate["final_D_share"])
        # Both federal offices change as source reporting order changes,
        # yet have DIFFERENT partisan clock errors: no universal shortcut.
        self.assertGreater(row[0]["president_D_share_error_vs_official_final_pp"],0)
        self.assertGreater(row[0]["senate_D_share_error_vs_official_final_pp"],0)
        self.assertLess(row[1]["president_D_share_error_vs_official_final_pp"],0)
        self.assertLess(row[1]["senate_D_share_error_vs_official_final_pp"],0)
        self.assertNotEqual(row[1]["president_D_share_error_vs_official_final_pp"],
                            row[1]["senate_D_share_error_vs_official_final_pp"])
        self.assertEqual(row[0]["president_election_day_method_D"],0)
        self.assertEqual(row[1]["president_election_day_method_D"],144347)
        self.assertEqual(row[2]["president_mail_method_D"],61817)
        self.assertAlmostEqual(row[2]["president_fraction_of_final_two_party_ballots"],
           (365654+173320)/(386438+181895),delta=.000001)

    def test_never_promotes_single_county_clocks_to_2026_needle(self):
        for field in ("publication_capture_clocks_verified",
                      "rights_for_original_data_republication_reviewed",
                      "full_precinct_geography_matched",
                      "out_of_sample_multi_county_backtest_completed",
                      "transferable_reporting_order_bias_established",
                      "may_update_2026_model","may_update_2026_live_needle"):
            altered=copy.deepcopy(self.paired);altered[field]=True
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_pair(altered,self.senate)
        altered=copy.deepcopy(self.paired);altered["approved_calibration_inputs"]=1
        with self.assertRaises(ValueError):validate_pair(altered,self.senate)
        bad_senate={**self.senate,"may_modify_2026_odds":True}
        with self.assertRaises(ValueError):validate_pair(self.paired,bad_senate)

    def test_rejects_source_clock_invention_and_ballot_arithmetic_drift(self):
        mutations=(
         lambda x: x["chronological_presidential_snapshots"].pop(),
         lambda x: x["chronological_presidential_snapshots"][0].update(
               section_clock="2026-11-05T19:08:00-05:00"),
         lambda x: x["chronological_presidential_snapshots"][1].update(
               source_url="https://news.example.org/projection.pdf"),
         lambda x: x["chronological_presidential_snapshots"][2].update(
               source_status="SEARCH_RESULT_INFERRED"),
         lambda x: x["chronological_presidential_snapshots"][0].update(
               all_candidates_votes_cast=100),
         lambda x: x["chronological_presidential_snapshots"][1].update(
               D_by_mode=[158887,0,0]),
         lambda x: x["chronological_presidential_snapshots"][2].update(
               R_by_mode=[75109,83964,14247]),
         lambda x: x["official_final"].update(D_votes=386439),
         lambda x: x.update(state="MA"),
        )
        for mutate in mutations:
            altered=copy.deepcopy(self.paired);mutate(altered)
            with self.subTest(altered=altered),self.assertRaises(ValueError):
                validate_pair(altered,self.senate)

if __name__=="__main__":
    unittest.main()
