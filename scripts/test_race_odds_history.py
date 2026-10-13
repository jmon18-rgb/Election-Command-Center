#!/usr/bin/env python3
import copy
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import record_race_odds_history as h

def inputs():
    return json.loads(h.ODDS.read_text()),json.loads(h.POLLS.read_text())

class ProbabilityHistoryTests(unittest.TestCase):
    def test_actual_current_odds_and_candidate_ids(self):
        odds,polls=inputs()
        result=h.build(odds,polls)
        self.assertEqual(result["latest_source_at"],polls["generated_at"])
        self.assertEqual(len(result["snapshots"]),1)
        self.assertEqual(len(result["snapshots"][0]["races"]),len(odds["records"]))
        self.assertFalse(result["can_infer_chamber_control"])
        self.assertTrue(all(r["dem_candidate"] and r["rep_candidate"]
                            for r in result["snapshots"][0]["races"]))
    def test_distinct_model_runs_not_fabricated_backwards(self):
        odds,polls=inputs()
        oldest=h.build(odds,polls)
        same=h.build(odds,polls,oldest)
        self.assertEqual(len(same["snapshots"]),1)
        self.assertEqual(same["snapshots"],oldest["snapshots"])
        earlier=copy.deepcopy(oldest["snapshots"][0])
        from datetime import timedelta
        before=h.parse_time(odds["polling_source_generated_at"])-timedelta(hours=5)
        earlier["source_at"]=before.isoformat()
        earlier["races"][0]["dem_beats_rep_pct"]-=2
        newest=h.build(odds,polls,{"snapshots":[earlier]})
        self.assertEqual(len(newest["snapshots"]),2)
        self.assertNotEqual(newest["snapshots"][0]["races"][0]["dem_beats_rep_pct"],
                            newest["snapshots"][1]["races"][0]["dem_beats_rep_pct"])
    def test_mismatch_source_time_and_poll_identity_fails_closed(self):
        odds,polls=inputs()
        corrupt=copy.deepcopy(odds)
        corrupt["polling_source_generated_at"]="2025-01-01T00:00:00Z"
        with self.assertRaises(ValueError):
            h.build(corrupt,polls)
        corrupt=copy.deepcopy(odds)
        corrupt["records"][0]["dem_minus_rep"]+=1
        with self.assertRaises(ValueError):
            h.build(corrupt,polls)
        corrupt=copy.deepcopy(odds)
        corrupt["records"][0]["contributing_firms"]+=1
        with self.assertRaises(ValueError):
            h.build(corrupt,polls)
    def test_bad_old_history_and_future_record_ignored(self):
        odds,polls=inputs()
        now=h.build(odds,polls)
        future=copy.deepcopy(now["snapshots"][0])
        future["source_at"]="2030-01-01T00:00:00Z"
        wrong=copy.deepcopy(now["snapshots"][0])
        wrong["method_version"]="another_model"
        old={"snapshots":[future,wrong,{"broken":True}]}
        res=h.build(odds,polls,old)
        self.assertEqual(len(res["snapshots"]),1)
    def test_invalid_time(self):
        with self.assertRaises(ValueError):
            h.parse_time("not a date")
        with self.assertRaises(ValueError):
            h.parse_time("2026-10-13T11:00:00")

if __name__=="__main__":unittest.main()
