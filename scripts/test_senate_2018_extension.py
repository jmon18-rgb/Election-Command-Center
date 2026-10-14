#!/usr/bin/env python3
"""2018 Senate extension: offline source, multiple-election and no-leakage gates."""
import csv
import copy
import datetime as dt
import io
import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
import research_senate_2018_extension as ext
import research_senate_horizon_backtest as base

FIELDS=["pollster","start_date","end_date","sample_size","sample_type","rep","dem",
        "other","year","state","overlapping_special_election"]

def polls(extra=None):
    output=io.StringIO()
    writer=csv.DictWriter(output,fieldnames=FIELDS)
    writer.writeheader()
    for state in ("florida","arizona","texas"):
        for days in (34,24,10,4):
            for firm,dem,rep in [("Independent A",49,48),("Independent B",51,46)]:
                d=dt.date(2018,11,6)-dt.timedelta(days=days)
                writer.writerow({"pollster":firm,"start_date":(d-dt.timedelta(days=2)).strftime("%Y/%m/%d"),
                 "end_date":d.strftime("%Y/%m/%d"),"sample_size":800,"sample_type":"LV",
                 "rep":rep,"dem":dem,"other":"","year":2018,"state":state,
                 "overlapping_special_election":""})
    for item in extra or []:writer.writerow(item)
    return output.getvalue()

class Test2018Extension(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.outcomes=json.loads(ext.SOURCE.read_text())
    def test_default_2020_to_2024_research_is_isolated(self):
        self.assertEqual(base.YEAR_FOLDS,(2020,2022,2024))
        self.assertEqual(base.ELECTION_DATES[2018],dt.date(2018,11,6))
        self.assertNotIn(2018,base.baseline.ELECTIONS)
        actual=ext.eligible_results(self.outcomes)
        self.assertGreaterEqual(len(actual),20)
        self.assertNotIn("CA",actual)
        self.assertNotIn("VT",actual)
        self.assertNotIn("ME",actual)
        self.assertNotIn("MN",actual)
        self.assertNotIn("MS",actual)
        self.assertIn("FL",actual)
    def test_rebuild_research_strict_horizons_and_source_guards(self):
        report=ext.build(polls(),self.outcomes)
        self.assertEqual(report["status"],"RETROSPECTIVE_FIELDWORK_PROXY_RESEARCH_NO_2026_AUTO_TUNING")
        self.assertFalse(report["can_calibrate_live_2026_model"])
        self.assertFalse(report["may_change_production_candidate_priors"])
        self.assertEqual(len(report["horizons"]),len(base.HORIZONS))
        self.assertEqual({r["state"] for r in report["records"]["20"]},{"FL","AZ","TX"})
        self.assertEqual(report["records"]["20"][0]["pollster_count"],2)
        self.assertEqual(report["records"]["20"][0]["cutoff"],"2018-10-17")
        self.assertTrue(all(x["fieldwork_only_not_verified_published"]
            for rows in report["records"].values() for x in rows))
        self.assertEqual(report["independent_firms_required"],2)
        self.assertEqual(report["lookback_days"],45)
        self.assertEqual(report["recency_half_life_days"],21)
        self.assertFalse(report["poll_release_dates_verified"])
    def test_late_poll_cannot_change_earlier_snapshot(self):
        original=ext.build(polls(),self.outcomes)
        newer= {"pollster":"New pollster C","start_date":"2018/11/01",
               "end_date":"2018/11/02","sample_size":"850","sample_type":"LV",
               "rep":1,"dem":98,"other":"","year":2018,"state":"florida",
               "overlapping_special_election":""}
        changed=ext.build(polls([newer]),self.outcomes)
        for h in (60,45,30,20,14,10,7):
            self.assertEqual(original["records"][str(h)],changed["records"][str(h)])
        self.assertNotEqual(original["records"]["3"],changed["records"]["3"])
    def test_reject_corrupt_results_and_source_drift(self):
        corrupted=copy.deepcopy(self.outcomes)
        corrupted["contest_records"][0]["recorded_dem_votes"]+=1
        with self.assertRaisesRegex(ValueError,"tallies do not sum"):
            ext.eligible_results(corrupted)
        corrupted=copy.deepcopy(self.outcomes)
        corrupted["contest_records"]=[r for r in corrupted["contest_records"]
             if not (r["state"]=="MS" and r["election_type"]=="special")]
        with self.assertRaisesRegex(ValueError,"incomplete"):
            ext.eligible_results(corrupted)
        with self.assertRaisesRegex(ValueError,"source hash pin"):
            ext.download(opener=lambda *a,**kw: FakeDownload(b"some fake data" * 400))
    def test_2018_report_and_v4_inputs_both_exist(self):
        saved=json.loads(ext.OUT.read_text())
        self.assertEqual(saved["cycle"],2018)
        self.assertGreaterEqual(len(saved["records"]["20"]),15)
        self.assertGreaterEqual(len(saved["records"]["7"]),15)
        self.assertEqual(saved["poll_source_blob_sha"],ext.POLL_BLOB_SHA)
        old=json.loads((ROOT/"data/historical_senate_horizon_backtest.json").read_text())
        self.assertEqual(old["election_cycles"],[2020,2022,2024])
        self.assertFalse(old["may_automatically_change_live_2026_sigma"])

class FakeDownload:
    def __init__(self,b):self.b=b
    def __enter__(self):return self
    def __exit__(self,*args):return False
    def read(self,n):return self.b[:n]

if __name__=="__main__":
    unittest.main()
