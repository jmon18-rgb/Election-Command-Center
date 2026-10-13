#!/usr/bin/env python3
"""Deterministic historical Senate poll-only benchmark tests, no downloads."""
import csv
import io
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import backtest_historical_senate_polls as b

FIELDS=["cycle","state","pollster","poll_id","question_id","end_date","created_at",
        "election_date","stage","candidate_party","pct","population","candidate_name",
        "sample_size","race_id"]

def outcomes():
    contests=[]
    for year,state,d,r in [(2020,"AZ",520,480),(2022,"PA",510,490),(2024,"WI",480,520)]:
        contests.append({"election_year":year,"state":state,
            "recorded_dem_votes":d,"recorded_rep_votes":r,"recorded_other_votes":0,
            "recorded_total_candidate_votes":d+r,"recorded_two_party_vote_total":d+r,
            "missing_major_party_vote":False,"historical_race_id":f"{year}-{state}-SEN-regular"})
    return {"status":"historical_senate_results_research_only","is_election_forecast":False,
            "source_url":"https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/PEJ5QU",
            "source_license":"CC0 1.0","contest_records":contests}

def source_rows(extra=None):
    rows=[]
    cases=[
      (2020,"Arizona","2020-10-20","2020-10-21","11/3/20"),
      (2022,"Pennsylvania","2022-10-25","2022-10-26","11/8/22"),
      (2024,"Wisconsin","2024-10-20","2024-10-21","11/5/24")]
    for year,state,end,created,election in cases:
        for firm,poll,dem,rep in [("Firm A","111",48.,45.),("Firm B","222",47.,49.)]:
            for party,percent in [("DEM",dem),("REP",rep)]:
                rows.append({"cycle":year,"state":state,"pollster":firm,
                    "poll_id":str(year)+poll,"question_id":str(year)+poll,
                    "end_date":end,"created_at":created,"election_date":election,
                    "stage":"general","candidate_party":party,"pct":percent,
                    "candidate_name":party+" nominee","population":"lv","sample_size":"800",
                    "race_id":str(year)+state})
    return rows+(extra or [])

def csvfile(rows=None):
    f=io.StringIO()
    w=csv.DictWriter(f,fieldnames=FIELDS)
    w.writeheader();w.writerows(rows if rows is not None else source_rows())
    return f.getvalue()

class HistoricalPollTests(unittest.TestCase):
    def test_three_cycle_poll_only_benchmarks(self):
        report=b.build(csvfile(),outcomes(),"fixture-sha")
        self.assertEqual(report["races_evaluated"],3)
        self.assertEqual([report["by_year"][str(y)]["eligible_races"] for y in b.ELECTIONS],[1,1,1])
        self.assertEqual({r["pollster_count"] for r in report["records"]},{2})
        self.assertFalse(report["can_calibrate_2026_win_probabilities"])
        self.assertFalse(report["is_forecast"])
        self.assertEqual(report["poll_source_sha256"],"fixture-sha")
        self.assertTrue(all(x["methods"]["recency21"]["predicted_two_party_margin"]!=x["actual_two_party_margin"] for x in report["records"]))
    def test_future_release_or_fieldwork_never_enters_training(self):
        future=[]
        for party in ("DEM","REP"):
            bad=source_rows()[0].copy()
            bad.update(pollster="Leaky Firm",poll_id="after-cutoff",question_id="after-cutoff",
                       candidate_party=party,pct=99. if party=="DEM" else 1.,
                       end_date="2020-10-28",created_at="2020-10-29")
            future.append(bad)
        original=b.build(csvfile(),outcomes())
        changed=b.build(csvfile(source_rows(future)),outcomes())
        self.assertEqual(original["records"],changed["records"])
        self.assertEqual(b.date_value("10/27/20"),b.ELECTIONS[2020]-b.dt.timedelta(days=7))
    def test_same_pollster_one_vote_and_office_isolation(self):
        before=source_rows()
        older=[]
        for party in ("DEM","REP"):
            q=before[0].copy()
            q.update(poll_id="older",question_id="older",candidate_party=party,
                     pct=99. if party=="DEM" else 1.,end_date="2020-10-01",created_at="2020-10-02",
                     pollster="Firm A")
            older.append(q)
        changed=b.build(csvfile(source_rows(older)),outcomes())
        initial=b.build(csvfile(),outcomes())
        self.assertEqual(changed["records"],initial["records"],
            "Only latest firm survey should affect mean")
    def test_outcomes_reject_ambiguous_specials(self):
        o=outcomes()
        special=o["contest_records"][0].copy()
        special["historical_race_id"]="2020-AZ-SEN-special"
        o["contest_records"].append(special)
        report=b.build(csvfile(),o)
        self.assertEqual(report["races_evaluated"],2)
        self.assertFalse(any(r["state"]=="AZ" for r in report["records"]))
    def test_malformed_poll_source_and_missing_party(self):
        with self.assertRaisesRegex(ValueError,"schema changed"):
            b.build("cycle,state\n2024,WI\n",outcomes())
        invalid=source_rows()
        invalid=[x for x in invalid if not(x["cycle"]==2024 and x["candidate_party"]=="REP")]
        report=b.build(csvfile(invalid),outcomes())
        self.assertEqual(report["by_year"]["2024"]["eligible_races"],0)
    def test_normalization_and_no_imputed_major_party(self):
        self.assertEqual(b.party_of("DEM"),"D")
        self.assertEqual(b.party_of("Republican"),"R")
        self.assertEqual(b.party_of("Independent"),"OTHER")
        self.assertEqual(b.party_margin(48,52),-4)
        o=outcomes()
        o["contest_records"][1]["recorded_dem_votes"]=0
        o["contest_records"][1]["missing_major_party_vote"]=True
        self.assertEqual(len(b.load_outcomes(o)),2)

if __name__=="__main__":unittest.main()
