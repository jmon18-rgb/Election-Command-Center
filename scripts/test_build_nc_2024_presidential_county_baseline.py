import copy
import csv
import hashlib
import io
import unittest
from pathlib import Path

from build_nc_2024_presidential_county_baseline import build
from run_nc_official_zip_historical_replay import (
    OFFICIAL_SHA, OFFICIAL_URL, EXPECTED_PRESIDENTIAL, CROSSWALK_SOURCE,
)
ROOT=Path(__file__).resolve().parents[1]

def fixture():
    reference=(ROOT/"data/nc_2024_county_fips_reference.csv").read_text()
    counties=list(csv.DictReader(io.StringIO(reference)))
    rows=[]
    for i,row in enumerate(counties):
        d=EXPECTED_PRESIDENTIAL["DEM"]//100+int(i<EXPECTED_PRESIDENTIAL["DEM"]%100)
        r=EXPECTED_PRESIDENTIAL["REP"]//100+int(i<EXPECTED_PRESIDENTIAL["REP"]%100)
        rows.append({"county_id":row["statefp"]+row["countyfp"],
          "candidates":[{"party":"DEM","name":"D","votes":d},
                        {"party":"REP","name":"R","votes":r}]})
    doc={
      "schema":"nc-official-county-staging-v1",
      "status":"SOURCE_ATTRIBUTED_CANDIDATE_VOTES_STAGED_NOT_LIVE_CERTIFIED",
      "production":False,"may_move_national_needle":False,
      "county_count":100,"counties":rows,
      "source":{"url":OFFICIAL_URL,"archive_sha256":OFFICIAL_SHA,
                "archive_member":"results_pct_20241105.txt",
                "election_date":"2024-11-05","contest_name":"US PRESIDENT",
                "contest_group_id":"123"},
      "crosswalk_source_url":CROSSWALK_SOURCE,
      "crosswalk_sha256":hashlib.sha256(reference.encode()).hexdigest(),
      "historical_certified_major_party_totals":EXPECTED_PRESIDENTIAL,
    }
    return doc,reference

class HistoricalBaselineTests(unittest.TestCase):
    def setUp(self):
        self.stage,self.crosswalk=fixture()

    def test_complete_exact_100_county_baseline_remains_nonpredictive(self):
        output=build(self.stage,self.crosswalk)
        self.assertEqual(output["schema"],"nc-2024-presidential-county-baseline-v1")
        self.assertEqual(len(output["counties"]),100)
        self.assertEqual(len({r["county_fips"] for r in output["counties"]}),100)
        self.assertEqual(output["certified_presidential_2024"],EXPECTED_PRESIDENTIAL)
        self.assertFalse(output["may_move_national_needle"])
        self.assertFalse(output["same_office_as_2026_senate"])
        self.assertIsNone(output["ballots_remaining_forecast"])
        self.assertTrue(all(-100<=r["president_2024_two_party_dem_margin_points"]<=100
                            for r in output["counties"]))

    def test_wrong_source_and_contest_rejected(self):
        for part in ("archive_sha256","url","contest_name","election_date"):
            doc=copy.deepcopy(self.stage)
            doc["source"][part]="incorrect"
            with self.assertRaises(ValueError):
                build(doc,self.crosswalk)

    def test_missing_duplicate_and_tampered_fips_rejected(self):
        for action in ("missing","duplicate","foreign"):
            doc=copy.deepcopy(self.stage)
            if action=="missing": doc["counties"].pop()
            if action=="duplicate": doc["counties"][1]["county_id"]=doc["counties"][0]["county_id"]
            if action=="foreign": doc["counties"][0]["county_id"]="36061"
            with self.assertRaises(ValueError):
                build(doc,self.crosswalk)

    def test_wrong_certified_vote_totals_rejected(self):
        doc=copy.deepcopy(self.stage)
        doc["counties"][0]["candidates"][0]["votes"]+=1
        with self.assertRaises(ValueError):
            build(doc,self.crosswalk)

    def test_crosswalk_and_predictive_fraud_rejected(self):
        with self.assertRaises(ValueError):
            build(self.stage,self.crosswalk+"\n")
        doc=copy.deepcopy(self.stage)
        doc["may_move_national_needle"]=True
        with self.assertRaises(ValueError):
            build(doc,self.crosswalk)

if __name__=="__main__":
    unittest.main()
