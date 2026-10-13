#!/usr/bin/env python3
"""Offline 10-cycle Senate chronology, map, date, source and regression tests."""
import csv
import copy
import datetime as dt
import io
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
import research_long_run_senate as m

FIELDS=["pollster","start_date","end_date","sample_size","sample_type","rep","dem",
        "other","year","state","overlapping_special_election"]
STATES=("AZ","PA","WI")
def fixture():
    polls={}
    for year in m.YEARS:
        cutoff=m.ELECTION_DATES[year]-dt.timedelta(days=m.CUTOFF_DAYS)
        end=(cutoff-dt.timedelta(days=3)).strftime("%Y/%m/%d")
        start=(cutoff-dt.timedelta(days=5)).strftime("%Y/%m/%d")
        buffer=io.StringIO()
        w=csv.DictWriter(buffer,fieldnames=FIELDS)
        w.writeheader()
        for state in STATES:
            for firm,d,r in [("Firm A",52,45),("Firm B",50,47)]:
                w.writerow({"pollster":firm,"start_date":start,"end_date":end,
                    "sample_type":"LV","rep":r,"dem":d,"year":year,
                    "state":m.legacy.STATE_NAMES[state].lower()})
        polls[year]=buffer.getvalue()
    # Sufficient voting districts to pass provenance envelope, with only
    # three polled states; source outcome office coverage is separate.
    historic=[]
    all_states=sorted(m.medsl.STATE_CODES)[:30]
    all_states=sorted(set(all_states)|set(STATES))
    for year in m.YEARS:
        for state in all_states:
            historic.append({"election_year":year,"state":state,"election_type":"regular",
               "historical_race_id":f"{year}-{state}-SEN-regular",
               "recorded_dem_votes":52500,"recorded_rep_votes":47500,"recorded_other_votes":3000,
               "recorded_total_candidate_votes":103000,"recorded_two_party_vote_total":100000,
               "missing_major_party_vote":False})
    medsl={
       "status":"historical_senate_results_research_only",
       "years":list(m.YEARS),"source_doi":"doi:10.7910/DVN/PEJ5QU",
       "source_file_sha256":"fixture_checksum",
       "is_election_forecast":False,
       "contest_records":historic,"contest_count":len(historic)}
    return polls,medsl

class HistoricalChronologyTests(unittest.TestCase):
    def test_ten_years_seven_forward_only_holdouts(self):
        polls,mit=fixture()
        doc=m.build(polls,mit,{"2006":"sourcehash"})
        self.assertEqual(doc["years"],list(range(2006,2025,2)))
        self.assertEqual(doc["history_cycles"],10)
        self.assertEqual(doc["evaluated_test_cycles"],7)
        self.assertEqual(set(doc["holdout_by_year"]),{"2012","2014","2016","2018","2020","2022","2024"})
        self.assertEqual(doc["total_race_observations"],30)
        self.assertEqual(doc["holdout_by_year"]["2012"]["training_cycles"],[2006,2008,2010])
        self.assertEqual(doc["holdout_by_year"]["2024"]["training_cycles"],list(m.YEARS[:-1]))
        self.assertEqual(doc["pooled_walk_forward"]["none"]["races"],21)
        self.assertEqual(doc["pooled_walk_forward"]["none"]["mae_points"],2.5)
        self.assertFalse(doc["is_forecast"])
        self.assertFalse(doc["is_as_of_leakage_free"])
        self.assertFalse(doc["can_justify_2026_bias_correction"])
        self.assertFalse(doc["can_calibrate_2026_chamber_probabilities"])
        for year in m.YEARS:
            self.assertEqual(doc["by_year"][str(year)]["races"],3)
        for year,one in doc["holdout_by_year"].items():
            self.assertTrue(all(x<int(year) for x in one["training_cycles"]))
            self.assertFalse(any(x>=int(year) for x in one["training_cycles"]))
    def test_future_result_changes_cannot_reach_past_training(self):
        polls,mit=fixture()
        baseline=m.build(polls,mit)
        changed=copy.deepcopy(mit)
        for item in changed["contest_records"]:
            if item["election_year"]==2024:
                item["recorded_dem_votes"]=47500
                item["recorded_rep_votes"]=52500
        future=m.build(polls,changed)
        self.assertEqual(
           baseline["holdout_by_year"]["2018"]["learned_past_bias_points"],
           future["holdout_by_year"]["2018"]["learned_past_bias_points"])
        self.assertEqual(
           baseline["holdout_by_year"]["2024"]["learned_past_bias_points"],
           future["holdout_by_year"]["2024"]["learned_past_bias_points"])
        self.assertNotEqual(baseline["holdout_by_year"]["2024"]["methods"]["none"]["signed_error_points"],
                            future["holdout_by_year"]["2024"]["methods"]["none"]["signed_error_points"])
    def test_inverted_date_and_post_cutoff_excluded(self):
        polls,mit=fixture()
        a=m.build(polls,mit)
        copy_text=polls[2020].splitlines()
        head=copy_text[0]
        extra="Bad Publisher,2020/10/30,2020/10/28,900,LV,1,99,,2020,arizona,"
        too_late="Late Poll,2020/10/27,2020/11/01,900,LV,1,99,,2020,arizona,"
        polls[2020]=polls[2020].strip()+"\n"+extra+"\n"+too_late+"\n"
        b=m.build(polls,mit)
        self.assertEqual(b["by_year"]["2020"],a["by_year"]["2020"])
        self.assertEqual(b["source_audit"]["invalid_date_rows"]["2020"],1)
    def test_second_same_year_senate_office_excluded(self):
        polls,mit=fixture()
        row=copy.deepcopy(next(x for x in mit["contest_records"] if x["state"]=="AZ" and x["election_year"]==2020))
        row["election_type"]="special";row["historical_race_id"]="2020-AZ-SEN-special"
        mit["contest_records"].append(row);mit["contest_count"]+=1
        d=m.build(polls,mit)
        self.assertEqual(d["by_year"]["2020"]["races"],2)
        self.assertGreater(d["outcome_audit"]["ambiguous_regular_special"],0)
    def test_missing_major_party_and_third_party_blocked(self):
        polls,mit=fixture()
        az=next(x for x in mit["contest_records"] if x["state"]=="AZ" and x["election_year"]==2018)
        az["missing_major_party_vote"]=True
        d=m.build(polls,mit)
        self.assertEqual(d["by_year"]["2018"]["races"],2)
        self.assertFalse(any(x["state"]=="AZ" for x in d["by_year"]["2018"]["race_errors"]))
        self.assertGreaterEqual(d["outcome_audit"]["missing_major_party"],1)
    def test_incomplete_cycles_and_malformed_votes_rejected(self):
        polls,mit=fixture()
        del polls[2006]
        with self.assertRaisesRegex(ValueError,"Missing historical survey cycle"):
            m.build(polls,mit)
        polls,mit=fixture()
        mit["contest_records"][0]["recorded_dem_votes"]=-1
        with self.assertRaisesRegex(ValueError,"candidate totals"):
            m.build(polls,mit)
    def test_source_provenance(self):
        polls,mit=fixture()
        mit["source_doi"]="other"
        with self.assertRaisesRegex(ValueError,"Wrong MIT"):
            m.build(polls,mit)
    def test_distinct_firms_required(self):
        polls,mit=fixture()
        for year in m.YEARS:
            polls[year]=polls[year].replace("Firm B","Firm A")
        with self.assertRaisesRegex(ValueError,"too sparse"):
            m.build(polls,mit)

if __name__=="__main__":
    unittest.main()
