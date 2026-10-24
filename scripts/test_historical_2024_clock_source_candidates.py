#!/usr/bin/env python3
"""2024 public archive discovery metadata is not a license to ingest AP votes."""
import datetime as dt
import json
import re
from pathlib import Path
import unittest
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT/"data"/"historical_2024_clock_source_candidates.json"

class ArchivedElection2024ResearchLeadTests(unittest.TestCase):
    def test_no_rights_or_votedata_promotion(self):
        x=json.loads(PATH.read_text())
        self.assertEqual(x["schema"],"2024-election-clock-source-candidate-metadata-v1")
        self.assertEqual(x["status"],"REAL_2024_CAPTURE_TIMESTAMPS_FOUND_RIGHTS_NOT_CLEARED")
        self.assertEqual(x["election_date"],"2024-11-05")
        self.assertFalse(x["candidate"]["permission_for_data_ingestion"])
        self.assertFalse(x["candidate"]["permission_for_redistribution"])
        self.assertFalse(x["candidate"]["professionally_reviewed_rights"])
        self.assertFalse(x["candidate"]["source_capture_provenance_verified_independently"])
        self.assertFalse(x["may_update_2026_model"])
        self.assertFalse(x["geographic_needle_calibrated"])
        self.assertEqual(x["approved_backtest_inputs"],0)
        # No AP-derived vote results, candidate names, poll odds or raw JSON
        # are to be published in this metadata manifest.
        forbidden=("dem_votes","rep_votes","candidate_votes","reported_votes",
                   "race_totals","winner","vote_share","cached_payload")
        text=json.dumps(x).lower()
        for key in forbidden:
            self.assertNotIn('"'+key+'":',text)

    def test_independent_git_timestamp_evidence_only(self):
        x=json.loads(PATH.read_text())
        self.assertEqual(x["candidate"]["repository"],
                         "cuihaoleo/2024-us-election-result-snapshots")
        samples=x["candidate"]["samples"]
        self.assertGreaterEqual(len(samples),2)
        first=dt.datetime(2024,11,5,23,tzinfo=dt.timezone.utc)
        last=dt.datetime(2024,11,7,tzinfo=dt.timezone.utc)
        stamps=[]
        shas=set()
        for item in samples:
            sha=item["git_sha"]
            self.assertRegex(sha,r"^[0-9a-f]{40}$")
            self.assertNotIn(sha,shas)
            shas.add(sha)
            uri=urlsplit(item["url"])
            self.assertEqual(uri.scheme,"https")
            self.assertEqual(uri.hostname,"github.com")
            self.assertEqual(uri.path,
             "/cuihaoleo/2024-us-election-result-snapshots/commit/"+sha)
            self.assertEqual(uri.query,"")
            self.assertEqual(uri.fragment,"")
            date=dt.datetime.fromisoformat(
                item["commit_time_utc"].replace("Z","+00:00"))
            self.assertTrue(first<=date<last)
            stamps.append(date)
        self.assertEqual(stamps,sorted(stamps))
        self.assertGreater((stamps[-1]-stamps[0]).total_seconds(),3600)

if __name__=="__main__":
    unittest.main()
