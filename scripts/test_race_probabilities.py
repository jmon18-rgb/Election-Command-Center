#!/usr/bin/env python3
import copy
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_race_probabilities as p

def fixtures():
    row=lambda office,code,margin,n,ind,age: {
       "race_code":code,"state_name":"Example","label":"Example",
       "status":"single_poll" if n==1 else "multi_poll",
       "dem_minus_rep":margin,"contributing_pollsters":n,
       "independent_pollsters":ind,"latest_poll_end":"2026-10-11",
       "poll_diagnostics":{"latest_poll_age_days":age,"pollster_spread_points":3.2}
    }
    polls={"is_election_forecast":False,
      "generated_at":"2026-10-13T12:00:00Z","source_snapshot":"source-v1",
      "senate_all":[row("senate","AK-SEN",0,5,4,2),row("senate","TX-SEN",5,3,2,4)],
      "house":[row("house","AZ-01",-4,5,3,2)],
      "governor":[row("governor","TX-GOV",12,2,0,16)]}
    historical={
       "status":"retrospective_poll_research_not_calibrated_forecast",
       "races_evaluated":42,"can_calibrate_2026_win_probabilities":False,
       "overall_recency21":{"rmse":5.633}
    }
    return polls,historical

class RaceProbabilityTests(unittest.TestCase):
    def test_baseline_risk_is_real_42_race_senate_error(self):
        polls,old=fixtures()
        self.assertEqual(p.validate(polls,old),5.633)
        self.assertAlmostEqual(p.normal_cdf(0),.5)
        self.assertAlmostEqual(p.normal_cdf(1),.841344746,places=6)
        self.assertAlmostEqual(p.normal_cdf(-1),.158655254,places=6)
    def test_uncertainty_increases_for_sparse_stale_sponsored(self):
        base,_=fixtures()
        strong=base["senate_all"][0]
        weak=base["governor"][0]
        v1,f1=p.race_uncertainty(strong,"senate",5.633)
        v2,f2=p.race_uncertainty(weak,"governor",5.633)
        self.assertAlmostEqual(v1,5.633,places=3)
        self.assertGreater(v2,v1)
        self.assertGreater(f2,f1)
    def test_score_is_monotone_and_no_correction(self):
        probs=[100*p.normal_cdf(m/5.633) for m in [-8,-4,0,4,8]]
        self.assertEqual(probs,sorted(probs))
        self.assertAlmostEqual(probs[2],50)
        self.assertAlmostEqual(probs[0]+probs[4],100)
    def test_fails_closed_on_missing_history_and_bad_rows(self):
        polls,old=fixtures()
        for changed in [None,{},dict(old,can_calibrate_2026_win_probabilities=True),
                        dict(old,overall_recency21={"rmse":99})]:
            with self.assertRaises(ValueError):
                p.validate(polls,changed)
        o=copy.deepcopy(polls)
        o["senate_all"][0]["contributing_pollsters"]=0
        with self.assertRaises(ValueError):
            p.race_uncertainty(o["senate_all"][0],"senate",5.633)
        o=copy.deepcopy(polls)
        o["senate_all"][0]["independent_pollsters"]=7
        with self.assertRaises(ValueError):
            p.race_uncertainty(o["senate_all"][0],"senate",5.633)
    def test_live_repository_source_reconciles(self):
        import json
        orig=json.loads(p.POLLS.read_text(encoding="utf-8"))
        hist=json.loads(p.HIST.read_text(encoding="utf-8"))
        report=p.build(orig,hist)
        self.assertEqual(report["schema_version"],"experimental-race-odds-v1")
        self.assertFalse(report["can_infer_chamber_control"])
        self.assertFalse(report["probabilities_calibrated_on_2026_outcomes"])
        self.assertEqual(report["number_of_races_by_office"]["senate"],
          sum(r.get("status") in ("multi_poll","single_poll") for r in orig["senate_all"]))
        self.assertEqual(report["number_of_races_by_office"]["governor"],
          sum(r.get("status") in ("multi_poll","single_poll") for r in orig["governor"]))
        self.assertEqual(report["number_of_races_by_office"]["house"],
          sum(r.get("status") in ("multi_poll","single_poll") for r in orig["house"]))
        bykey={(x["office"],x["race_code"]):x for x in report["records"]}
        for office,source in (("senate",orig["senate_all"]),("house",orig["house"]),("governor",orig["governor"])):
            for race in source:
                if race["status"] not in ("multi_poll","single_poll"):continue
                out=bykey[(office,race["race_code"])]
                self.assertAlmostEqual(out["dem_minus_rep"],race["dem_minus_rep"],places=2)
                self.assertAlmostEqual(out["dem_beats_rep_pct"]+out["rep_beats_dem_pct"],100)
                self.assertTrue(0<=out["dem_beats_rep_pct"]<=100)
                self.assertTrue(0<=out["tight_error_dem_pct"]<=100)
                self.assertTrue(0<=out["wide_error_dem_pct"]<=100)

if __name__=="__main__":
    unittest.main()
