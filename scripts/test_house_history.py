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
    writer=csv.DictWriter(file,fieldnames=["year","state_po","district","stage","special","party","candidatevotes","candidate"])
    writer.writeheader()
    for state,n in HOUSE_COUNTS.items():
        for district in range(1,n+1):
            for party,votes in (("DEMOCRAT",250),("REPUBLICAN",260)):
                writer.writerow({"year":"2024","state_po":state,"district":district,"stage":"GEN",
                                 "special":"FALSE","party":party,"candidatevotes":votes,
                                 "candidate":"Sample Democrat" if party=="DEMOCRAT" else "Sample Republican"})
    writer.writerow({"year":"2024","state_po":"DC","district":"1","stage":"GEN",
                     "special":"FALSE","party":"DEMOCRAT","candidatevotes":12345})
    writer.writerow({"year":"2022","state_po":"TX","district":"1","stage":"GEN",
                     "special":"FALSE","party":"DEMOCRAT","candidatevotes":9999})
    writer.writerow({"year":"2024","state_po":"TX","district":"1","stage":"PRI",
                     "special":"FALSE","party":"DEMOCRAT","candidatevotes":9999})
    return file.getvalue()

class HouseHistoryTests(unittest.TestCase):
    def test_full_2024_raw_history_staging(self):
        doc=history.stage(input_csv())
        self.assertEqual(doc["2024_district_rows"],435)
        self.assertFalse(any(x["2024_race_code"].startswith("DC-") for x in doc["records"]))
        self.assertEqual(doc["status"],"2024_history_staged_not_2026_priors")
        self.assertTrue(all(x["eligible_as_2026_prior"] is False for x in doc["records"]))
        by={r["2024_race_code"]:r for r in doc["records"]}
        self.assertEqual(by["TX-01"]["recorded_dem_votes"],250)
        self.assertEqual(by["TX-01"]["recorded_rep_votes"],260)
    def test_2022_historical_rows_have_distinct_year_keys_and_no_priors(self):
        # Build a complete 2022 input from a 2024 fixture, preserving its
        # intentionally included stray rows from the other year.
        content=input_csv().replace("2024,", "2022,")
        doc=history.stage(content,year=2022)
        self.assertEqual(doc["2022_district_rows"],435)
        self.assertEqual(doc["status"],"2022_history_staged_not_2026_priors")
        self.assertTrue(all(r["election_year"]==2022 and
            r["eligible_as_2026_prior"] is False and
            "2022_race_code" in r and "2024_race_code" not in r for r in doc["records"]))
    def test_dfl_and_democratic_npl_ballot_party_aliases(self):
        data=input_csv().replace("2024,MN,3,GEN,FALSE,DEMOCRAT,250,Sample Democrat",
          "2024,MN,3,GEN,FALSE,DEMOCRATIC-FARMER-LABOR,250,Sample Democrat")
        data=data.replace("2024,ND,1,GEN,FALSE,DEMOCRAT,250,Sample Democrat",
          "2024,ND,1,GEN,FALSE,DEMOCRATIC-NPL,250,Sample Democrat")
        data=data.replace("2024,VT,1,GEN,FALSE,REPUBLICAN,260,Sample Republican",
          "2024,VT,1,GEN,FALSE,REPUBLICAN/INDEPENDENT,260,Sample Republican")
        records={r["2024_race_code"]:r for r in history.stage(data)["records"]}
        for code in ("MN-03","ND-01","VT-01"):
            self.assertEqual(records[code]["recorded_dem_votes"],250)
            self.assertEqual(records[code]["recorded_rep_votes"],260)
            self.assertFalse(records[code]["missing_major_party_votes"])

    def test_fusion_votes_follow_verified_candidate_not_ballot_line(self):
        data=input_csv()
        data+=("2024,NY,1,GEN,FALSE,CONSERVATIVE,100,Sample Republican\\n"
               "2024,NY,1,GEN,FALSE,WORKING FAMILIES,45,Sample Democrat\\n"
               "2024,NY,1,GEN,FALSE,INDEPENDENT,60,Third Candidate\\n")
        doc=history.stage(data)
        r=next(x for x in doc["records"] if x["2024_race_code"]=="NY-01")
        self.assertEqual(r["recorded_dem_votes"],295)
        self.assertEqual(r["recorded_rep_votes"],360)
        self.assertEqual(r["recorded_other_votes"],60)
        self.assertEqual(r["fusion_vote_rows_attributed"],2)
        self.assertGreaterEqual(doc["fusion_vote_rows_attributed"],2)

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
