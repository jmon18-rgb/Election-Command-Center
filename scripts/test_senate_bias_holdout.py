#!/usr/bin/env python3
"""Deterministic tests: hold out complete election years and reject leakage."""
import copy
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_senate_bias_holdout as m

DATES={2020:"2020-10-27",2022:"2022-11-01",2024:"2024-10-29"}
def source():
    rows=[]
    errors={2020:[6,4,5,5],2022:[-1,-1],2024:[5,7]}
    for year,es in errors.items():
        for i,e in enumerate(es):
            rows.append({"cycle":year,"state":f"{i+1:02d}", "pollster_count":4,
                "cutoff_is_fieldwork_only":True,"cutoff":DATES[year],
                "field_end_range":[DATES[year],DATES[year]],
                "actual_two_party_margin":0.0,
                "methods":{"recency21":{"predicted_two_party_margin":float(e),"error":float(e)}}})
    return {"schema_version":"historical-poll-backtest-v1",
        "status":"retrospective_poll_research_not_calibrated_forecast",
        "is_forecast":False,"can_calibrate_2026_win_probabilities":False,
        "poll_source_first_publication_dates_available":False,
        "cutoff_days_before_election":7,"races_evaluated":len(rows),
        "by_year":{str(year):{"eligible_races":sum(r["cycle"]==year for r in rows)} for year in m.YEARS},
        "records":rows}

class BiasHoldoutTests(unittest.TestCase):
    def test_each_test_year_training_uses_only_other_years(self):
        report=m.build(source(),"sha-pinned")
        self.assertFalse(report["is_forecast"])
        self.assertFalse(report["is_as_of_leakage_free"])
        self.assertFalse(report["is_statistically_calibrated_for_2026"])
        self.assertFalse(report["permitted_to_change_live_2026_polling_model"])
        self.assertEqual(report["source_poll_study_sha256"],"sha-pinned")
        self.assertEqual(report["source_race_count"],8)
        for year in m.YEARS:
            row=report["by_test_year"][str(year)]
            self.assertNotIn(year,row["training_cycles"])
            self.assertEqual(sorted(row["training_cycles"]),sorted(set(m.YEARS)-{year}))
            self.assertEqual(row["test_cycle"],year)
            self.assertEqual(row["test_races"],source()["by_year"][str(year)]["eligible_races"])
        self.assertEqual(report["by_test_year"]["2022"]["fixed_training_bias_points"],5.5)
        self.assertEqual(report["by_test_year"]["2022"]["methods"]["uncorrected"]["mae_points"],1.)
        self.assertEqual(report["by_test_year"]["2022"]["methods"]["full_prior_bias"]["mae_points"],6.5)
        self.assertEqual(report["by_test_year"]["2022"]["methods"]["half_prior_bias"]["mae_points"],3.75)
        self.assertEqual(report["by_test_year"]["2022"]["full_prior_bias_mae_improvement_points"],-5.5)
        self.assertEqual(report["all_heldout_races"]["uncorrected"]["races"],8)
    def test_no_test_year_outcome_leaks_into_same_year_adjustment(self):
        before=source()
        original=m.build(before)
        after=copy.deepcopy(before)
        for row in after["records"]:
            if row["cycle"]==2022:
                row["methods"]["recency21"]["error"]=99.
                row["methods"]["recency21"]["predicted_two_party_margin"]=99.
        changed=m.build(after)
        self.assertEqual(original["by_test_year"]["2022"]["fixed_training_bias_points"],
                         changed["by_test_year"]["2022"]["fixed_training_bias_points"])
        self.assertNotEqual(original["by_test_year"]["2020"]["fixed_training_bias_points"],
                            changed["by_test_year"]["2020"]["fixed_training_bias_points"])
    def test_cycle_balanced_not_race_count_weighted(self):
        report=m.build(source())
        # 2020 has four entries, 2024 two. Both have equal cycle votes.
        self.assertEqual(report["by_test_year"]["2022"]["training_cycle_signed_errors"],
                        {"2020":5.0,"2024":6.0})
        self.assertEqual(report["by_test_year"]["2022"]["fixed_training_bias_points"],5.5)
    def test_reject_duplicate_and_future_poll(self):
        bad=source()
        bad["records"].append(copy.deepcopy(bad["records"][0]))
        bad["races_evaluated"]+=1
        bad["by_year"]["2020"]["eligible_races"]+=1
        with self.assertRaisesRegex(ValueError,"Duplicate"):
            m.build(bad)
        bad=source()
        bad["records"][0]["field_end_range"][1]="2020-10-30"
        with self.assertRaisesRegex(ValueError,"after-cutoff"):
            m.build(bad)
    def test_reject_inconsistent_error_and_malformed_year_counts(self):
        bad=source()
        bad["records"][0]["methods"]["recency21"]["error"]=-4
        with self.assertRaisesRegex(ValueError,"does not reconcile"):
            m.build(bad)
        bad=source()
        bad["by_year"]["2022"]["eligible_races"]=14
        with self.assertRaisesRegex(ValueError,"do not reconcile"):
            m.build(bad)
        bad=source()
        bad["records"][0]["methods"]["recency21"]["error"]=float("nan")
        with self.assertRaisesRegex(ValueError,"does not reconcile"):
            m.build(bad)
    def test_reject_forecast_and_claimed_as_of_source(self):
        for key,new_val in (("is_forecast",True),
                            ("can_calibrate_2026_win_probabilities",True),
                            ("poll_source_first_publication_dates_available",True)):
            bad=source();bad[key]=new_val
            with self.subTest(key=key),self.assertRaisesRegex(ValueError,"integrity gate"):
                m.build(bad)
    def test_empty_year_does_not_masquerade_as_holdout(self):
        bad=source()
        bad["records"]=[r for r in bad["records"] if r["cycle"]!=2024]
        bad["races_evaluated"]=len(bad["records"])
        bad["by_year"]["2024"]["eligible_races"]=0
        with self.assertRaisesRegex(ValueError,"independent election year"):
            m.build(bad)

if __name__=="__main__":
    unittest.main()
