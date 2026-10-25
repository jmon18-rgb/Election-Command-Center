#!/usr/bin/env python3
"""Evidence-graded real Fairfax 2024 county report-clock research only."""
import copy
import datetime as dt
import json
from pathlib import Path
import unittest

from audit_fairfax_2024_senate_clock_replay import validate

DATA = Path(__file__).resolve().parents[1] / "data" / "fairfax_2024_senate_election_clock_research.json"


class FairfaxRealClockReplayTests(unittest.TestCase):
    def setUp(self):
        self.sample = json.loads(DATA.read_text(encoding="utf-8"))

    def test_actual_2024_countywide_senate_reporting_sequence(self):
        x = validate(self.sample)
        self.assertEqual(x["status"],"SOURCE_MATCHED_REAL_COUNTS_NOT_CALIBRATED")
        self.assertEqual(x["geography"],"VA Fairfax County only")
        self.assertEqual(x["first_page_originals_visually_verified"],3)
        self.assertEqual(x["approved_needle_calibration_inputs"],0)
        self.assertFalse(x["may_modify_2026_odds"])
        self.assertTrue(x["source_generation_clock_not_capture_time"])
        rows = x["chronological_samples"]
        self.assertEqual(len(rows),4)
        self.assertEqual([(r["D"],r["R"],r["votes_cast"]) for r in rows],[
            (184945,82339,267746),
            (362403,174845,538983),
            (372328,177887,551994),
            (372685,178023,552488)])
        self.assertEqual(rows[0]["vote_method_tallies"]["D"][1],0)
        self.assertEqual(rows[1]["vote_method_tallies"]["D"][1],150439)
        self.assertEqual(rows[3]["vote_method_tallies"]["D"][1],151086)
        # The 7:08 PM results were mail + early votes, so a plausible
        # early partisan share is NOT a future county-wide share estimate.
        self.assertGreater(rows[0]["two_party_D_share"],
                           rows[1]["two_party_D_share"])
        self.assertLess(rows[1]["two_party_ballots_fraction_of_final"],1)
        self.assertLess(rows[3]["two_party_ballots_fraction_of_final"],1)
        self.assertAlmostEqual(rows[1]["two_party_D_share"],0.67455,delta=.0001)
        self.assertAlmostEqual(rows[3]["two_party_D_share"],0.67674,delta=.0001)
        self.assertAlmostEqual(x["final_D_share"],0.67895,delta=.0001)
        self.assertEqual(rows[1]["two_party_D_share_error_vs_final_pp"],
                         round(100*(362403/(362403+174845)-
                                    393906/(393906+186266)),4))
        self.assertAlmostEqual(rows[2]["incremental_two_party_D_share"],
                               9925/(9925+3042),delta=.000001)
        self.assertAlmostEqual(rows[3]["incremental_two_party_D_share"],
                               357/(357+136),delta=.000001)

    def test_fail_closed_against_fabricated_or_partisan_source_promotion(self):
        for key, val in (
            ("may_modify_2026_geographic_needle",True),
            ("may_update_2026_forecast",True),
            ("source_rights_reviewed",True),
            ("independent_timestamp_archive_verified",True),
            ("approved_calibration_inputs",1),
            ("synthetic_vote_data_present",True),
            ("precinct_or_multicounty_clock_replay",True),
        ):
            bad=copy.deepcopy(self.sample)
            bad[key]=val
            with self.subTest(field=key), self.assertRaises(ValueError):
                validate(bad)
        for mutate in (
            lambda x: x["sequential_snapshots"].pop(),
            lambda x: x["sequential_snapshots"][1].update(votes_cast_total=999999),
            lambda x: x["sequential_snapshots"][2]["dem_votes_by_mode"].__setitem__(2,999),
            lambda x: x["sequential_snapshots"][3].update(
                section_generated_local="2024-11-05T23:30:00-05:00"),
            lambda x: x["sequential_snapshots"][1].update(url="https://evil.example/report.pdf"),
            lambda x: x["sequential_snapshots"][1].update(
                evidence_level="ORIGINAL_PDF_ELECTION_SUMMARY_PAGE_VISUALLY_CHECKED",
                section_generated_local="2026-11-05T22:50:00-05:00"),
            lambda x: x["sequential_snapshots"][2]["dem_votes_by_mode"].__setitem__(0,1),
            lambda x: x["sequential_snapshots"][2].update(
                evidence_level="ORIGINAL_PDF_ELECTION_SUMMARY_PAGE_VISUALLY_CHECKED"),
            lambda x: x["terminal_benchmark"].update(dem_votes=400000),
            lambda x: x["terminal_benchmark"].update(
                url="https://example.com/unknown-final"),
        ):
            bad=copy.deepcopy(self.sample)
            mutate(bad)
            with self.subTest(modified=bad), self.assertRaises(ValueError):
                validate(bad)

    def test_no_hidden_monte_carlo_probabilities_or_forecast_writes(self):
        report=validate(self.sample)
        self.assertFalse(report["may_modify_2026_odds"])
        self.assertFalse(report["source_rights_reviewed"])
        self.assertFalse(self.sample["original_report_pdfs_redistributed"])
        self.assertEqual(self.sample["approved_calibration_inputs"],0)
        self.assertTrue(all(row["two_party_ballots_fraction_of_final"]<1
                            for row in report["chronological_samples"]))
        stamps=[dt.datetime.fromisoformat(r["section_clock"]) for r in
                report["chronological_samples"]]
        self.assertEqual(stamps,sorted(stamps))
        self.assertEqual(len(set(stamps)),4)


if __name__=="__main__":
    unittest.main()
