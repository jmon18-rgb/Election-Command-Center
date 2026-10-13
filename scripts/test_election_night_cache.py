#!/usr/bin/env python3
"""Contract tests for state-result archival and corrected election-night totals."""
import copy
import datetime as dt
import tempfile
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
import refresh_election_night as en

NOW = dt.datetime(2026, 11, 4, 3, 30, tzinfo=dt.timezone.utc)

def fixture(year=2026, office="House", votes=100):
    key = {"House": "AZ-01", "Senate": "AZ", "Governor": "AZ"}[office]
    return {
        "api": 1, "year": year, "office": office, "live": True,
        "stale": False, "counting": True, "final": False, "source": "state",
        "as_of": "2026-11-04T03:25:00+00:00",
        "counts": {"races": 1, "with_precincts": 1, "reporting": 0,
                   "not_called": 1, "called": {}},
        "races": {key: {"leader": "D", "called": False, "winner": "",
            "pct_in": 12.5, "total": votes, "uncontested": False,
            "cands": [
                {"n": "Candidate A", "p": "D", "v": round(votes*.6), "pct": 60},
                {"n": "Candidate B", "p": "R", "v": votes-round(votes*.6), "pct": 40}
            ]}}
    }

class Contract(unittest.TestCase):
    def test_valid_results(self):
        for office in en.OFFICES:
            self.assertTrue(en.validate(fixture(office=office), 2026, office, NOW))
    def test_wrong_year_or_office_rejected(self):
        doc=fixture()
        with self.assertRaises(ValueError):
            en.validate(doc,2024,"House",NOW)
        with self.assertRaises(ValueError):
            en.validate(doc,2026,"Senate",NOW)
    def test_corrupt_or_negative_votes_rejected(self):
        bad=fixture()
        bad["races"]["AZ-01"]["cands"][0]["v"]=-1
        with self.assertRaises(ValueError):
            en.validate(bad,2026,"House",NOW)
        bad=fixture()
        bad["races"]["AZ-01"]["cands"][0]["v"]=500
        with self.assertRaises(ValueError):
            en.validate(bad,2026,"House",NOW)
    def test_wrong_race_and_precincts_rejected(self):
        bad=fixture()
        bad["races"]={"AZ":bad["races"].pop("AZ-01")}
        with self.assertRaises(ValueError):
            en.validate(bad,2026,"House",NOW)
        bad=fixture()
        bad["races"]["AZ-01"]["pct_in"]=110
        with self.assertRaises(ValueError):
            en.validate(bad,2026,"House",NOW)
    def test_fake_calls_and_future_timestamps_rejected(self):
        bad=fixture()
        bad["races"]["AZ-01"]["called"]=True
        with self.assertRaises(ValueError):
            en.validate(bad,2026,"House",NOW)
        bad=fixture()
        bad["as_of"]="2026-11-08T03:25:00Z"
        with self.assertRaises(ValueError):
            en.validate(bad,2026,"House",NOW)
    def test_before_election_no_counted_2026_votes(self):
        with self.assertRaises(ValueError):
            en.validate(fixture(),2026,"House",
                        dt.datetime(2026,10,13,tzinfo=dt.timezone.utc))
    def test_revision_is_observation_not_an_allegation(self):
        old=fixture(votes=200)
        now=fixture(votes=180)
        changes=en.collect_changes(old,now,NOW.isoformat(),"House")
        self.assertEqual(len(changes),1)
        self.assertEqual(changes[0]["vote_change"],-20)
        self.assertEqual(changes[0]["kind"],"revision")
        self.assertNotIn("fraud",str(changes).lower())
    def test_archive_and_revisions_write_without_network(self):
        initial=fixture()
        later=fixture(votes=150)
        with tempfile.TemporaryDirectory() as d:
            old_out=en.OUT
            en.OUT=Path(d)
            try:
                first=en.refresh(2026,"House",NOW,lambda y,o:initial)
                second=en.refresh(2026,"House",NOW+dt.timedelta(minutes=6),lambda y,o:later)
                self.assertEqual(first["fetched_at"],NOW.isoformat())
                self.assertEqual(second["races"]["AZ-01"]["total"],150)
                events=en.read_existing(en.changes_path())["events"]
                self.assertEqual(events[0]["vote_change"],50)
                self.assertEqual(events[0]["kind"],"new_reporting")
            finally:
                en.OUT=old_out

if __name__ == "__main__":
    unittest.main()
