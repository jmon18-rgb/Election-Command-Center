#!/usr/bin/env python3
"""Offline, deterministic adversarial tests for Senate horizon study."""
import csv
import datetime as dt
import io
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import research_senate_horizon_backtest as study
from test_historical_senate_poll_backtest import outcomes

FIELDS=["pollster","start_date","end_date","sample_size","sample_type",
        "rep","dem","other","year","state","overlapping_special_election"]
NAMES={2020:"arizona",2022:"pennsylvania",2024:"wisconsin"}

def observations(inject=None):
    raw={}
    for year in study.YEAR_FOLDS:
        buf=io.StringIO()
        writer=csv.DictWriter(buf,fieldnames=FIELDS)
        writer.writeheader()
        for gap in (65,49,36,24,17,11,8,4):
            for firm,d,r in (("Firm One",52,45),("Firm Two",45,51),
                             ("Firm Three",49,49)):
                end=study.baseline.ELECTIONS[year]-dt.timedelta(days=gap)
                row=dict(pollster=firm,start_date=(end-dt.timedelta(days=2)).isoformat(),
                  end_date=end.isoformat(),sample_size="800",sample_type="LV",
                  rep=r,dem=d,other="",year=year,state=NAMES[year])
                writer.writerow(row)
        for row in (inject or {}).get(year,[]):
            writer.writerow(row)
        raw[year]=buf.getvalue()
    return raw

def bad(year,gap,firm="Bad New Survey",dem=99,rep=1):
    end=study.baseline.ELECTIONS[year]-dt.timedelta(days=gap)
    return dict(pollster=firm,start_date=(end-dt.timedelta(days=2)).isoformat(),
      end_date=end.isoformat(),sample_size="800",sample_type="LV",
      rep=rep,dem=dem,other="",year=year,state=NAMES[year])

class HorizonStudyTests(unittest.TestCase):
    def test_every_horizon_and_2020_2022_2024_holds_out(self):
        doc=study.build(observations(),outcomes())
        self.assertEqual(doc["cutoffs_days_before_election"],list(study.HORIZONS))
        self.assertFalse(doc["first_publication_dates_available"])
        self.assertFalse(doc["may_calibrate_2026_probabilities"])
        self.assertFalse(doc["may_automatically_change_live_2026_sigma"])
        self.assertFalse(doc["full_2026_candidate_fundamentals_model_backtested"])
        self.assertTrue(doc["fieldwork_cutoff_enforced"])
        self.assertEqual(doc["poll_lookback_days"],45)
        self.assertEqual(len(doc["horizon_results"]),8)
        self.assertTrue(all(x["race_snapshots"]==3 for x in doc["horizon_results"]))
        for h in doc["horizon_results"]:
            self.assertEqual([x["test_year"] for x in h["leave_one_election_year_out"]["by_test_year"]],
             [2020,2022,2024])
            self.assertEqual(h["leave_one_election_year_out"]["heldout_races"],3)
            self.assertEqual(h["candidate_sigma_scores"]["7.5"]["races"],3)
            for item in doc["records"][str(h["days_before_election"])]:
                self.assertLessEqual(item["latest_field_end"],item["cutoff"])
                self.assertTrue(item["fieldwork_only_not_verified_published"])
                self.assertGreaterEqual(item["pollster_count"],2)
    def test_future_poll_cannot_change_previous_horizon(self):
        original=study.build(observations(),outcomes())
        edited=study.build(observations({2024:[bad(2024,4,dem=100,rep=0)]}),outcomes())
        for day in study.HORIZONS:
            if day>=7:
                self.assertEqual(edited["records"][str(day)],original["records"][str(day)])
        self.assertNotEqual(edited["records"]["3"],original["records"]["3"])
    def test_future_outcome_does_not_fit_own_year_sigma(self):
        a=study.build(observations(),outcomes())
        shifted=outcomes()
        shifted["contest_records"][2]["recorded_dem_votes"]=800
        shifted["contest_records"][2]["recorded_rep_votes"]=200
        shifted["contest_records"][2]["recorded_two_party_vote_total"]=1000
        shifted["contest_records"][2]["recorded_total_candidate_votes"]=1000
        b=study.build(observations(),shifted)
        for h_a,h_b in zip(a["horizon_results"],b["horizon_results"]):
            fa=next(x for x in h_a["leave_one_election_year_out"]["by_test_year"] if x["test_year"]==2024)
            fb=next(x for x in h_b["leave_one_election_year_out"]["by_test_year"] if x["test_year"]==2024)
            self.assertEqual(fa["heldout_sigma_points"],fb["heldout_sigma_points"])
            self.assertEqual(fa["training_races"],fb["training_races"])
            self.assertNotEqual(fa["heldout_scores"],fb["heldout_scores"])
    def test_distinct_pollster_and_malformed_archive_guards(self):
        sample=observations()
        self.assertRaisesRegex(ValueError,"schema changed",study.build,
            {**sample,2022:"x,y\n1,2\n"},outcomes())
        self.assertRaisesRegex(ValueError,"Missing historical",study.build,
            {2020:sample[2020],2024:sample[2024]},outcomes())
        self.assertRaisesRegex(ValueError,"incorrect election cycle",study.build,
            {**sample,2020:sample[2022]},outcomes())
        collision=outcomes()
        item=collision["contest_records"][0].copy()
        item["historical_race_id"]="2020-AZ-SEN-special"
        collision["contest_records"].append(item)
        doc=study.build(sample,collision)
        self.assertTrue(all(x["state"]!="AZ" for values in doc["records"].values() for x in values))
    def test_age_window_latest_per_firm_and_no_poll_backfill(self):
        year=2024
        parsed,_=study.parse_all(observations())
        self.assertIsNone(study.snapshot(parsed[(year,"WI")],year,200))
        ss=study.snapshot(parsed[(year,"WI")],year,20)
        self.assertEqual(ss["pollster_count"],3)
        self.assertEqual(ss["most_recent_field_end"],
            (study.baseline.ELECTIONS[year]-dt.timedelta(days=24)).isoformat())
        # Inverted fieldwork is invalid; no future results or date can be used.
        corrupt=bad(2024,20)
        corrupt["start_date"]=(study.baseline.ELECTIONS[year]-dt.timedelta(days=19)).isoformat()
        edited=study.parse_all(observations({year:[corrupt]}))[0]
        self.assertEqual(study.snapshot(edited[(year,"WI")],year,20),ss)
    def test_probabilities_and_sigma_zero(self):
        self.assertAlmostEqual(study.prob(0,7.5),.5)
        self.assertLess(study.prob(-10,7.5),.2)
        self.assertGreater(study.prob(10,7.5),.8)
        with self.assertRaisesRegex(ValueError,"Nonpositive"):
            study.prob(1,0)
        self.assertIsNone(study.score([],7.5))
        self.assertIsNone(study.leave_year_out([])["combined"])

if __name__=="__main__":
    unittest.main()
