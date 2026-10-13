#!/usr/bin/env python3
"""Validate 2024 historical data staging never fabricates 2026 priors."""
import csv
import io
import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import stage_house_history_2024 as history
from build_seat_universe import HOUSE_COUNTS

def input_csv():
    file=io.StringIO()
    writer=csv.DictWriter(file,fieldnames=["year","state_po","district","stage","special","party","candidatevotes"])
    writer.writeheader()
    for state,n in HOUSE_COUNTS.items():
        for district in range(1,n+1):
            for party,votes in (("DEMOCRAT",250),("REPUBLICAN",260)):
                writer.writerow({"year":"2024","state_po":state,"district":district,"stage":"GEN",
                                 "special":"FALSE","party":party,"candidatevotes":votes})
    writer.writerow({"year":"2022","state_po":"TX","district":"1","stage":"GEN",
                     "special":"FALSE","party":"DEMOCRAT","candidatevotes":9999})
    writer.writerow({"year":"2024","state_po":"TX","district":"1","stage":"PRI",
                     "special":"FALSE","party":"DEMOCRAT","candidatevotes":9999})
    return file.getvalue()

class HouseHistoryTests(unittest.TestCase):
    def test_full_2024_raw_history_staging(self):
        doc=history.stage(input_csv())
        self.assertEqual(doc["2024_district_rows"],435)
        self.assertEqual(doc["status"],"2024_history_staged_not_2026_priors")
        self.assertTrue(all(x["eligible_as_2026_prior"] is False for x in doc["records"]))
        by={r["2024_race_code"]:r for r in doc["records"]}
        self.assertEqual(by["TX-01"]["recorded_dem_votes"],250)
        self.assertEqual(by["TX-01"]["recorded_rep_votes"],260)
    def test_uncontested_is_recorded_not_imputed(self):
        raw=input_csv().replace("DEMOCRAT,250","INDEPENDENT,250",1)
        doc=history.stage(raw)
        self.assertGreaterEqual(doc["districts_missing_major_party_votes"],1)
    def test_unexpected_schema_is_rejected(self):
        with self.assertRaises(ValueError):history.stage("year,state,district\n2024,TX,1\n")
    def test_at_large_mapping(self):
        self.assertEqual(history.clean_district("AL"),1)
        self.assertEqual(history.clean_district("00"),1)
        self.assertIsNone(history.clean_district("not a district"))

if __name__=="__main__":
    unittest.main()
