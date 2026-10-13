#!/usr/bin/env python3
"""Offline reproducible tests for the MIT Senate historical import contract."""
import csv
import io
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import stage_senate_history as m

def example_csv(delimiter=","):
    f=io.StringIO()
    fields=["year","state_po","office","stage","special","candidate","party","candidatevotes"]
    writer=csv.DictWriter(f,fieldnames=fields,delimiter=delimiter)
    writer.writeheader()
    states=sorted(m.STATE_CODES)[:33]+['UT']
    # Force special-election states into the fixture regardless of alphabetic subset.
    for year in m.YEARS:
        for state in states:
            for party,candidate,votes in (
                ("DEMOCRAT","Democratic nominee",110000),
                ("REPUBLICAN","Republican nominee",105000),
                ("INDEPENDENT","Independent nominee",7500)):
                if year==2022 and state=="UT" and party=="DEMOCRAT":continue
                writer.writerow(dict(year=year,state_po=state,office="US SENATE",stage="GEN",
                                     special="FALSE",candidate=candidate,party=party,candidatevotes=votes))
        if year in (2020,2022):
            state="GA" if year==2020 else "OK"
            for party,votes in (("DEMOCRAT",80000),("REPUBLICAN",90000)):
                writer.writerow(dict(year=year,state_po=state,office="US SENATE",stage="GEN",
                                     special="TRUE",candidate=party+" SPECIAL",party=party,candidatevotes=votes))
    # 2024 has 34 regular races, 2022 and 2020 have 35.
    writer.writerow(dict(year=2024,state_po="AZ",office="US SENATE",stage="PRIMARY",
                         special="FALSE",candidate="Primary candidate",party="DEMOCRAT",candidatevotes=999999))
    writer.writerow(dict(year=2026,state_po="AZ",office="US SENATE",stage="GEN",
                         special="FALSE",candidate="Future",party="DEMOCRAT",candidatevotes=999999))
    return f.getvalue()

class HistoricalSenateTests(unittest.TestCase):
    def test_three_cycles_and_specials_stay_separate(self):
        data=m.parse_source(example_csv(),source_file_id=123,sha256="deadbeef")
        self.assertEqual(data["contests_by_year"],{"2020":35,"2022":35,"2024":34})
        self.assertEqual(data["contest_count"],104)
        self.assertFalse(data["is_election_forecast"])
        self.assertFalse(data["can_predict_2026_senate"])
        races={r["historical_race_id"]:r for r in data["contest_records"]}
        self.assertIn("2020-GA-SEN-special",races)
        self.assertIn("2020-GA-SEN-regular",races)
        self.assertIn("2022-OK-SEN-special",races)
        self.assertEqual(races["2020-GA-SEN-special"]["recorded_total_candidate_votes"],170000)
        self.assertEqual(races["2020-GA-SEN-regular"]["recorded_total_candidate_votes"],222500)
        self.assertEqual(races["2020-GA-SEN-regular"]["recorded_other_votes"],7500)
        self.assertEqual(len(races["2020-GA-SEN-regular"]["candidates"]),3)
        self.assertTrue(all(not r["eligible_as_2026_forecast_prior"] for r in races.values()))
    def test_independent_is_not_imputed_as_democrat(self):
        # UT is in the complete raw Senate dataset, but not in first 34
        # alphabetical state codes. Rewrite AZ to UT for this deliberate edge.
        csv_text=example_csv().replace(",AZ,",",UT,")
        # Fixture then has 34 unique regular contests per year.
        data=m.parse_source(csv_text)
        row=next(r for r in data["contest_records"] if
                 r["historical_race_id"]=="2022-UT-SEN-regular")
        self.assertEqual(row["recorded_dem_votes"],0)
        self.assertEqual(row["recorded_rep_votes"],105000)
        self.assertEqual(row["recorded_other_votes"],7500)
        self.assertTrue(row["missing_major_party_vote"])
        self.assertEqual(row["dem_share_of_two_party"],0)
        self.assertEqual(row["dem_share_of_all_candidates"],0)
    def test_tab_delimited_source(self):
        doc=m.parse_source(example_csv("\t"))
        self.assertEqual(doc["contests_by_year"]["2024"],34)
    def test_reject_changed_schema(self):
        with self.assertRaisesRegex(ValueError,"missing fields"):
            m.parse_source("year,state_po,candidatevotes\n2024,TX,42\n")
    def test_reject_invalid_special_marker(self):
        with self.assertRaisesRegex(ValueError,"regular/special"):
            m.parse_source(example_csv().replace(",FALSE,",",UNCLEAR,",1))
    def test_reject_missing_candidate_votes(self):
        with self.assertRaisesRegex(ValueError,"missing candidate vote"):
            m.parse_source(example_csv().replace(",110000",",N/A",1))
    def test_reject_incomplete_universe(self):
        bad="\n".join(x for x in example_csv().splitlines() if not x.startswith("2024,"))
        with self.assertRaisesRegex(ValueError,"contest count"):
            m.parse_source(bad+"\n")
    def test_datafile_selection_is_exact(self):
        metadata={"data":{"latestVersion":{"files":[
            {"dataFile":{"id":122,"filename":"old_senate.tab"}},
            {"dataFile":{"id":234,"filename":"1976-2024-senate-state.tab"}}
        ]}}}
        self.assertEqual(m.resolve_datafile(metadata),234)
        metadata["data"]["latestVersion"]["files"].append(
            {"dataFile":{"id":999,"filename":"1976-2024-senate-state.tab"}})
        with self.assertRaisesRegex(ValueError,"not uniquely"):
            m.resolve_datafile(metadata)

if __name__=="__main__":unittest.main()
