#!/usr/bin/env python3
import copy
import csv
import io
import unittest
from pathlib import Path
from audit_nc_2022_senate_web_baseline import verify, CROSSWALK_SHA
from run_nc_2022_senate_historical_replay import (
    PINNED_SHA256, OFFICIAL_URL, OFFICIAL_SENATE_TOTALS,
)
ROOT=Path(__file__).resolve().parents[1]
CSV=(ROOT/"data/nc_2022_senate_county_verified.csv").read_text()
lines=CSV.strip().splitlines()
real_rows=list(csv.DictReader(io.StringIO("\n".join(lines[2:]))))

def pretend_original():
    return {
      "schema":"nc-official-2022-senate-replay-v1",
      "status":"PINNED_2022_SENATE_100_COUNTIES",
      "pinned_archive_verified":True,
      "observed_archive_sha256":PINNED_SHA256,
      "contest_group_id":"1378","original_url":OFFICIAL_URL,
      "crosswalk_sha256":CROSSWALK_SHA,
      "candidate_major_totals":OFFICIAL_SENATE_TOTALS,
      "county_count":100,"may_move_national_needle":False,
      "counties":[{
         "county_id":r["county_fips"],
         "candidates":[
            {"party":"DEM","votes":int(r["senate_2022_dem_votes"])},
            {"party":"REP","votes":int(r["senate_2022_rep_votes"])},
         ]
      } for r in real_rows],
    }

class Signed2022CountyBaseline(unittest.TestCase):
    def test_offline_contract_tamper_and_duplicate(self):
        # This locally constructed shape tests the contract only; the workflow
        # ALSO downloads the independently SHA-pinned original 2022 archive.
        original=pretend_original()
        result=verify(CSV,original)
        self.assertEqual(result["counties"],100)
        self.assertFalse(result["may_move_national_needle"])
        for tamper in (
            CSV.replace("37001,25866,32866","37001,25867,32865"),
            CSV.replace("37001,25866,32866","37003,25866,32866"),
            CSV.replace(PINNED_SHA256,"0"*64),
            CSV.replace("group 1378","group 13"),
        ):
            with self.assertRaises(ValueError):
                verify(tamper,original)
        tampered=copy.deepcopy(original)
        tampered["counties"][0]["candidates"][0]["votes"]+=1
        with self.assertRaises(ValueError):
            verify(CSV,tampered)
        original["pinned_archive_verified"]=False
        with self.assertRaises(ValueError):
            verify(CSV,original)

    def test_static_source_pins_are_exact(self):
        self.assertEqual(PINNED_SHA256,
                         "2024bf67243ef173f54e625c3bace4c8b6f80947fa7d67df26796c2c85d3e9f1")
        self.assertEqual(len(real_rows),100)
        self.assertEqual(sum(int(r["senate_2022_dem_votes"]) for r in real_rows),1784049)
        self.assertEqual(sum(int(r["senate_2022_rep_votes"]) for r in real_rows),1905786)

if __name__=="__main__":
    unittest.main()
